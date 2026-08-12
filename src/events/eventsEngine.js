import { createActor } from "xstate";
import { EVENT_TYPES, mergeModifiers, neutralModifiers } from "./eventTypes.js";
import {
  strikeMachine,
  describeStrike,
  strikeModifiers,
  strikeTransition,
} from "./machines/strikeMachine.js";
import {
  breakdownMachine,
  describeBreakdown,
  breakdownModifiers,
  breakdownTransition,
} from "./machines/breakdownMachine.js";
import {
  mafiaRaidMachine,
  describeMafiaRaid,
  mafiaRaidModifiers,
  mafiaRaidTransition,
} from "./machines/mafiaRaidMachine.js";
import {
  legislationMachine,
  describeLegislation,
  legislationModifiers,
  legislationTransition,
} from "./machines/legislationMachine.js";
import { ROLES, PIPELINE_ORDER, ableWorkerCount } from "../simulation/world.js";
import { mobileGold } from "../simulation/pipeline.js";
import { injuredFraction, injureRandomWorker } from "../simulation/medical.js";

/**
 * The events engine.
 *
 * Owns one XState actor per disruption type and is the *only* thing
 * that translates their states into consequences. Machines stay pure —
 * they never touch buffers, entities or the store. Each tick the engine:
 *
 *   1. builds a read-only signal snapshot of the world
 *   2. sends TICK to every actor
 *   3. detects state changes and turns them into one-shot effects
 *      (notifications, injuries, systemic-health nudges)
 *   4. folds every actor's current state into one modifier set for
 *      `stepPipeline()` / `stepMedical()`
 *
 * Nothing here decides *whether* a disruption happens on a coin flip:
 * every machine's trigger is a reservoir fed by the state of the
 * society. The seeded RNG only settles details — which stage breaks,
 * how long a crew stays lucky — so neglect is what causes disasters,
 * and a given seed replays identically.
 */

const REGISTRY = [
  {
    type: EVENT_TYPES.STRIKE,
    machine: strikeMachine,
    describe: describeStrike,
    modifiers: strikeModifiers,
    transition: strikeTransition,
  },
  {
    type: EVENT_TYPES.BREAKDOWN,
    machine: breakdownMachine,
    describe: describeBreakdown,
    modifiers: breakdownModifiers,
    transition: breakdownTransition,
  },
  {
    type: EVENT_TYPES.MAFIA_RAID,
    machine: mafiaRaidMachine,
    describe: describeMafiaRaid,
    modifiers: mafiaRaidModifiers,
    transition: mafiaRaidTransition,
  },
  {
    type: EVENT_TYPES.LEGISLATION,
    machine: legislationMachine,
    describe: describeLegislation,
    modifiers: legislationModifiers,
    transition: legislationTransition,
  },
];

const STRIKING_STATES = new Set(["active", "negotiating"]);

// States each machine considers "nothing happening" — the only ones a
// forced trigger is allowed to interrupt.
const IDLE_STATES = {
  [EVENT_TYPES.STRIKE]: "dormant",
  [EVENT_TYPES.BREAKDOWN]: "operational",
  [EVENT_TYPES.MAFIA_RAID]: "dormant",
  [EVENT_TYPES.LEGISLATION]: "recess",
};

export class EventsEngine {
  constructor() {
    this.actors = new Map();
    this.previousStates = new Map();
    // Laws influence strikes, and strikes influence which laws get
    // drafted. Feeding the previous tick's aggregate back in breaks
    // that cycle without imposing an arbitrary evaluation order; at
    // 15Hz the one-tick lag is not observable.
    this.lastModifiers = neutralModifiers();

    for (const entry of REGISTRY) {
      const actor = createActor(entry.machine).start();
      this.actors.set(entry.type, actor);
      this.previousStates.set(entry.type, String(actor.getSnapshot().value));
    }
  }

  /** Read-only view of the world the machines are allowed to see. */
  buildSignals(state) {
    const ableByRole = {};
    for (const role of PIPELINE_ORDER) {
      ableByRole[role] = ableWorkerCount(role);
    }

    const strike = this.actors.get(EVENT_TYPES.STRIKE).getSnapshot();

    return {
      workerWellbeing: state.workerWellbeing,
      corruption: state.corruption,
      politicalStability: state.politicalStability,
      currentRate: state.currentRate,
      targetRate: state.targetRate,
      unionizers: ableWorkerCount(ROLES.UNIONIZER),
      politicians: ableWorkerCount(ROLES.POLITICIAN),
      police: ableWorkerCount(ROLES.POLICE),
      mafiosi: ableWorkerCount(ROLES.MAFIOSO),
      mobileGold: mobileGold(),
      injuredFraction: injuredFraction(),
      ableByRole,
      strikeInProgress: STRIKING_STATES.has(String(strike.value)),
      strikeResistance: this.lastModifiers.strikeResistance,
    };
  }

  /**
   * Steps every machine one tick.
   *
   * Returns `{ modifiers, notifications, events, health }` where
   * `health` holds one-shot deltas for the systemic scores (as opposed
   * to the per-second drifts carried in `modifiers`).
   */
  tick(dt, state) {
    const signals = this.buildSignals(state);
    const modifiers = neutralModifiers();
    const notifications = [];
    const events = [];
    const health = { workerWellbeing: 0, corruption: 0, politicalStability: 0 };

    for (const entry of REGISTRY) {
      const actor = this.actors.get(entry.type);
      actor.send({ type: "TICK", dt, signals });

      const snapshot = actor.getSnapshot();
      const value = String(snapshot.value);
      const previous = this.previousStates.get(entry.type);

      if (value !== previous) {
        this.previousStates.set(entry.type, value);
        this.#applyTransition(entry, previous, value, snapshot, {
          notifications,
          health,
        });
      }

      mergeModifiers(modifiers, entry.modifiers(snapshot));

      const description = entry.describe(snapshot);
      events.push({
        type: entry.type,
        state: value,
        ...description,
      });
    }

    this.lastModifiers = modifiers;
    return { modifiers, notifications, events, health };
  }

  #applyTransition(entry, from, to, snapshot, sink) {
    const outcome = entry.transition(from, to, snapshot.context);
    if (!outcome) return;

    if (outcome.message) {
      sink.notifications.push({
        type: entry.type,
        tone: outcome.tone ?? "info",
        message: outcome.message,
      });
    }

    for (const [key, delta] of Object.entries(outcome.effects ?? {})) {
      if (key in sink.health) sink.health[key] += delta;
    }

    // Entity state is the engine's business, not the machine's: a
    // machine that could injure monkeys directly would be a second
    // source of truth for the workforce.
    for (let i = 0; i < (outcome.injuries ?? 0); i++) {
      const victim = injureRandomWorker();
      if (victim) {
        sink.notifications.push({
          type: entry.type,
          tone: "bad",
          message: `A ${victim.role} was injured and taken to the hospital.`,
        });
      }
    }
  }

  /** Current state name of one machine, e.g. "brewing". */
  stateOf(type) {
    const actor = this.actors.get(type);
    return actor ? String(actor.getSnapshot().value) : null;
  }

  /** True when a disruption type is quiet and can be forced to start. */
  canForce(type) {
    return this.stateOf(type) === IDLE_STATES[type];
  }

  /**
   * Forces a disruption to begin now.
   *
   * This is the hook for anything that should be able to *cause* an
   * event rather than wait for one: a debug panel, a scripted tutorial,
   * a difficulty script, or a future player action. It jumps a machine
   * to the first state of its lifecycle — the disruption still has to
   * run its whole course (brewing, negotiating, repairing …), so
   * forcing changes the timing, never the rules.
   *
   * Returns false if that machine is already busy.
   */
  force(type, state) {
    if (!this.canForce(type)) return false;
    const actor = this.actors.get(type);
    if (!actor) return false;
    actor.send({ type: "FORCE", dt: 0, signals: this.buildSignals(state) });
    return true;
  }

  stop() {
    for (const actor of this.actors.values()) actor.stop();
  }
}

/**
 * Module-level singleton. The simulation is a single world, so a single
 * engine — mirroring how `world` and `useGameStore` are already shared.
 */
export const eventsEngine = new EventsEngine();
