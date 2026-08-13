import { useGameStore } from "../state/useGameStore.js";
import {
  stepPipeline,
  stepMonkeyStates,
  pipelineSnapshot,
  treasury,
} from "./pipeline.js";
import { stepMedical, treatmentCapacity, injuredRoleSet } from "./medical.js";
import { stepSociety } from "./society.js";
import { stepDeity, maybeUnleashWrath } from "./deity.js";
import { eventsEngine } from "../events/eventsEngine.js";
import { stepActionCooldowns, actionSnapshot } from "./playerActions.js";
import { EVENT_TYPES } from "../events/eventTypes.js";

/**
 * One simulation tick, and the throttled HUD snapshot that goes with it.
 *
 * Deliberately free of React: the driver (`useGameLoop`) owns *when*
 * this runs, this owns *what* happens. That split is what lets the
 * headless harness in `scripts/simulate.mjs` run thousands of ticks for
 * balance work without a browser, using the exact same code path the
 * game does.
 */

export const TICK_RATE = 15; // Hz — simulation ticks per second
export const TICK_DT = 1 / TICK_RATE;

export function stepSimulation(dt) {
  const store = useGameStore.getState();

  // 1. Events first: they decide what is blocked, taxed or on fire this
  //    tick. Machines only read the world; the engine hands back
  //    modifiers, one-shot health deltas and player-facing messages.
  const { modifiers, notifications, health, events } = eventsEngine.tick(
    dt,
    store
  );
  lastEngineFrame.events = events;

  // 2. The Deity's demand is the standing quota plus whatever a law has
  //    temporarily added on top.
  const targetRate = store.baseTargetRate + modifiers.targetRateBonus;
  if (targetRate !== store.targetRate) {
    store.applyTargetRateBonus(modifiers.targetRateBonus);
  }

  stepActionCooldowns(dt);

  // 3. Workforce: blocks, accidents, treatment.
  stepMonkeyStates(dt, modifiers.blockedRoles);
  const medical = stepMedical(dt, {
    workerWellbeing: store.workerWellbeing,
    hazardMultiplier: modifiers.hazardMultiplier,
  });
  lastEngineFrame.injuredCount = medical.waiting;
  lastEngineFrame.treatmentCapacity = treatmentCapacity();
  lastEngineFrame.siphonRate = modifiers.corruptionDrain;
  lastEngineFrame.blockedRoles = [...modifiers.blockedRoles];

  // 4. The economy. Everything above only reaches gold through here.
  const wellbeingFactor = 0.5 + store.workerWellbeing / 200; // 0.5..1.0
  const { coins, taxed, stolen, stolenFrom, bottleneck } = stepPipeline(dt, {
    wellbeingFactor,
    throughputMultiplier: modifiers.throughputMultiplier,
    corruptionDrain: modifiers.corruptionDrain,
    taxRate: modifiers.taxRate,
    demandRate: targetRate,
    blockedRoles: modifiers.blockedRoles,
  });

  lastEngineFrame.bottleneck = bottleneck;
  lastEngineFrame.stolenFrom = stolenFrom;

  if (coins > 0) store.deliverCoin(coins);
  if (taxed > 0 || stolen > 0) store.recordSkim({ taxed, stolen });
  store.setCurrentRate(coins / dt);
  store.tickStreak(dt);

  // 5. The Deity reacts to the tribute and nothing else.
  const deity = stepDeity(dt, {
    currentRate: coins / dt,
    targetRate,
    streakSeconds: store.streakSeconds,
  });
  const wrath = maybeUnleashWrath(store.deityMood + deity.moodDelta);

  // Only sustained success raises the standing quota. Wrath punishes the
  // society instead — see the note in `maybeUnleashWrath`.
  if (deity.targetRateDelta > 0) store.raiseBaseTargetRate(deity.targetRateDelta);

  // 6. Fold every source of systemic change into a single update:
  //    the societal drift, the per-second drifts from active events,
  //    and the one-shot deltas from events that just changed state.
  const drift = stepSociety(dt, {
    workerWellbeing: store.workerWellbeing,
    corruption: store.corruption,
    politicalStability: store.politicalStability,
    targetRate,
    deityMood: store.deityMood,
  });

  store.applySystemicDeltas({
    workerWellbeing:
      drift.workerWellbeing +
      modifiers.wellbeingDelta * dt +
      health.workerWellbeing +
      (wrath?.wellbeingDelta ?? 0),
    corruption: drift.corruption + modifiers.corruptionDelta * dt + health.corruption,
    politicalStability:
      drift.politicalStability +
      modifiers.stabilityDelta * dt +
      health.politicalStability +
      deity.stabilityDelta +
      (wrath?.stabilityDelta ?? 0),
    deityMood: deity.moodDelta + (wrath?.moodDelta ?? 0),
  });

  const allNotifications = [...notifications, ...deity.notifications];
  if (wrath?.notification) allNotifications.push(wrath.notification);
  store.pushNotifications(allNotifications);
  store.decayNotifications(dt);
}

/**
 * Which system, if any, is currently the reason a given pipeline role
 * needs attention — one colour dot per stage card, distinct from the
 * bottleneck (yellow) and blocked (red) borders those cards already
 * carry. Priority order (a role can only show one dot at a time):
 * a walkout or a seized machine is the stage's whole story for the
 * tick, mid-chain theft is the next most urgent, and a hospitalised
 * worker is the quietest of the four.
 */
function buildRoleHints(events, stolenFrom) {
  const byType = Object.fromEntries(events.map((e) => [e.type, e]));
  const hints = {};

  for (const role of byType[EVENT_TYPES.STRIKE]?.roles ?? []) {
    hints[role] = "union";
  }
  for (const role of byType[EVENT_TYPES.BREAKDOWN]?.roles ?? []) {
    hints[role] ??= "breakdown";
  }
  for (const role of stolenFrom) {
    hints[role] ??= "mafia";
  }
  for (const role of injuredRoleSet()) {
    hints[role] ??= "medical";
  }
  return hints;
}

export function publishSnapshot() {
  const store = useGameStore.getState();
  const { events } = lastEngineFrame;
  store.publishSnapshot({
    activeEvents: events,
    stages: pipelineSnapshot(),
    bottleneck: lastEngineFrame.bottleneck,
    roleHints: buildRoleHints(events, lastEngineFrame.stolenFrom),
    injuredCount: lastEngineFrame.injuredCount,
    // Published rather than read live so the viewport can react to the
    // tribute failing without re-rendering at the 15Hz rate.
    flowMet: store.currentRate >= store.targetRate - 0.02,
    reserves: treasury.reserves,
    reserveCapacity: treasury.capacity,
    actions: actionSnapshot(store),
    treatmentCapacity: lastEngineFrame.treatmentCapacity,
    siphonRate: lastEngineFrame.siphonRate,
    blockedRoles: lastEngineFrame.blockedRoles,
  });
}

// Cheap hand-off between the tick and the throttled snapshot publisher,
// so the publisher never has to re-run simulation queries or re-tick the
// engine just to read what the last tick already computed.
const lastEngineFrame = {
  events: [],
  bottleneck: null,
  stolenFrom: [],
  injuredCount: 0,
  treatmentCapacity: 0,
  siphonRate: 0,
  blockedRoles: [],
};
