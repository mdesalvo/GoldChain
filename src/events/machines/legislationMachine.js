import { assign, createMachine } from "xstate";
import { random } from "../../simulation/rng.js";
import { LAW_KINDS } from "../eventTypes.js";

/**
 * Legislation: recess -> drafting -> debating -> enacted -> repealed
 *
 * This is the machine that changes the rules of the game at runtime.
 * Every law is a trade-off, never an upgrade: safety regulations cost
 * throughput, a quota raises what the Deity expects, a tax skims the
 * tribute to fund enforcement, and a union crackdown buys quiet at the
 * price of the wellbeing that caused the unrest.
 *
 * Which law gets drafted is decided by whichever crisis is loudest at
 * the moment of drafting — politicians respond to the visible problem,
 * which is not always the real one.
 */

/**
 * The rulebook. Each entry is a partial modifier set folded into the
 * global aggregate by the engine while the law is in force.
 */
export const LAW_EFFECTS = Object.freeze({
  [LAW_KINDS.SAFETY_REGULATIONS]: {
    label: "Safety Regulations",
    summary: "Slower work, far fewer accidents.",
    modifiers: {
      throughputMultiplier: 0.85,
      hazardMultiplier: 0.4,
      wellbeingDelta: 1.6,
    },
  },
  [LAW_KINDS.TRIBUTE_TAX]: {
    label: "Tribute Levy",
    summary: "Skims the tribute to fund enforcement.",
    modifiers: {
      taxRate: 0.12,
      corruptionDelta: -0.7,
      stabilityDelta: 0.2,
    },
  },
  [LAW_KINDS.PRODUCTION_QUOTA]: {
    label: "Production Quota",
    summary: "The Deity expects more, immediately.",
    modifiers: {
      targetRateBonus: 0.25,
      wellbeingDelta: -1.2,
      hazardMultiplier: 1.4,
    },
  },
  [LAW_KINDS.UNION_CRACKDOWN]: {
    label: "Union Crackdown",
    summary: "Strikes are harder to call, grievances go nowhere.",
    modifiers: {
      strikeResistance: 1.9,
      wellbeingDelta: -1.8,
      stabilityDelta: -0.5,
    },
  },
});

const PRESSURE_THRESHOLD = 250;
const DRAFTING_SECONDS = 6;
const DEBATE_WORK = 40;
const MAX_DEBATE_SECONDS = 45;
const TERM_SECONDS = 75;

const freshContext = () => ({
  pressure: 0,
  timer: 0,
  debate: 0,
  law: null,
  termRemaining: 0,
  failed: false,
});

/**
 * Politicians legislate against the loudest complaint. Weights are
 * deliberately reactive rather than wise.
 */
function chooseLaw(signals) {
  const weights = [
    [LAW_KINDS.SAFETY_REGULATIONS, 1 + signals.injuredFraction * 40],
    [LAW_KINDS.TRIBUTE_TAX, 1 + signals.corruption / 12],
    [
      LAW_KINDS.PRODUCTION_QUOTA,
      1 + Math.max(0, signals.targetRate - signals.currentRate) * 14,
    ],
    [
      LAW_KINDS.UNION_CRACKDOWN,
      // Only a live labour dispute puts this on the order paper.
      signals.strikeInProgress ? 4 + (100 - signals.workerWellbeing) / 20 : 0.2,
    ],
  ];

  const total = weights.reduce((sum, [, w]) => sum + w, 0);
  let roll = random() * total;
  for (const [kind, w] of weights) {
    roll -= w;
    if (roll <= 0) return kind;
  }
  return LAW_KINDS.TRIBUTE_TAX;
}

export const legislationMachine = createMachine({
  id: "legislation",
  initial: "recess",
  context: freshContext,
  on: {
    FORCE: { target: ".drafting", actions: "openSession" },
    // Lobbying moves the vote count either way. It never enacts or kills
    // a bill outright — the chamber still has to get there on its own,
    // which is why blocking a bill can stall it into a dead session
    // rather than defeating it cleanly.
    LOBBY: {
      actions: assign(({ context, event }) => ({
        debate: Math.max(
          0,
          context.debate + DEBATE_WORK * 0.3 * (event.direction ?? 1)
        ),
      })),
    },
  },
  states: {
    recess: {
      on: {
        TICK: [
          {
            guard: ({ context, event }) =>
              context.pressure >= PRESSURE_THRESHOLD &&
              event.signals.politicians > 0,
            target: "drafting",
            actions: "openSession",
          },
          { actions: "accumulatePoliticalPressure" },
        ],
      },
    },

    drafting: {
      on: {
        TICK: [
          {
            guard: ({ context }) => context.timer >= DRAFTING_SECONDS,
            target: "debating",
            actions: assign({ timer: 0, debate: 0 }),
          },
          { actions: "advanceTimer" },
        ],
      },
    },

    debating: {
      on: {
        TICK: [
          {
            guard: ({ context }) => context.debate >= DEBATE_WORK,
            target: "enacted",
            actions: assign({ timer: 0, termRemaining: TERM_SECONDS }),
          },
          {
            // A deadlocked chamber runs out of session time.
            guard: ({ context }) => context.timer >= MAX_DEBATE_SECONDS,
            target: "repealed",
            actions: assign({ failed: true }),
          },
          { actions: "debateBill" },
        ],
      },
    },

    enacted: {
      on: {
        TICK: [
          {
            guard: ({ context }) => context.termRemaining <= 0,
            target: "repealed",
            actions: assign({ failed: false }),
          },
          { actions: "serveTerm" },
        ],
      },
    },

    repealed: {
      on: { TICK: { target: "recess", actions: assign(() => freshContext()) } },
    },
  },
}).provide({
  actions: {
    advanceTimer: assign(({ context, event }) => ({
      timer: context.timer + event.dt,
    })),

    accumulatePoliticalPressure: assign(({ context, event }) => {
      const { dt, signals } = event;
      // Crises create appetite for legislation; a calm, stable society
      // leaves the chamber in recess.
      const crisis =
        (100 - signals.politicalStability) / 100 +
        signals.corruption / 100 +
        signals.injuredFraction * 2 +
        (signals.strikeInProgress ? 0.6 : 0);
      return {
        pressure: Math.max(0, context.pressure + (crisis * 12 - 1.5) * dt),
      };
    }),

    openSession: assign(({ event }) => ({
      timer: 0,
      debate: 0,
      law: chooseLaw(event.signals),
    })),

    debateBill: assign(({ context, event }) => {
      const { dt, signals } = event;
      // A stable chamber legislates; an unstable one grandstands.
      const productivity =
        signals.politicians * (0.35 + signals.politicalStability / 100) * 3;
      return {
        timer: context.timer + dt,
        debate: context.debate + productivity * dt,
      };
    }),

    serveTerm: assign(({ context, event }) => ({
      timer: context.timer + event.dt,
      termRemaining: context.termRemaining - event.dt,
    })),
  },
});

export function describeLegislation(snapshot) {
  const { law, pressure, debate, termRemaining, failed } = snapshot.context;
  const entry = law ? LAW_EFFECTS[law] : null;
  switch (snapshot.value) {
    case "drafting":
      return {
        label: "Bill drafted",
        detail: `${entry.label}: ${entry.summary}`,
        severity: 1,
      };
    case "debating":
      return {
        label: `Debating ${entry.label}`,
        detail: `${Math.min(
          99,
          Math.round((debate / DEBATE_WORK) * 100)
        )}% of the chamber persuaded.`,
        severity: 1,
      };
    case "enacted":
      return {
        label: `Law: ${entry.label}`,
        detail: `${entry.summary} ${Math.ceil(termRemaining)}s remaining.`,
        severity: 1,
      };
    case "repealed":
      return {
        label: failed ? "Bill failed" : "Law expired",
        detail: entry ? entry.label : "",
        severity: 0,
      };
    default:
      return {
        label: "Legislature",
        detail: `In recess. Appetite for reform ${Math.round(
          (pressure / PRESSURE_THRESHOLD) * 100
        )}%.`,
        severity: 0,
        idle: true,
      };
  }
}

export function legislationModifiers(snapshot) {
  if (snapshot.value !== "enacted") return {};
  const entry = LAW_EFFECTS[snapshot.context.law];
  return entry ? entry.modifiers : {};
}

export function legislationTransition(from, to, context) {
  const entry = context.law ? LAW_EFFECTS[context.law] : null;
  if (to === "drafting") {
    return {
      tone: "info",
      message: `A bill is tabled: ${entry.label} — ${entry.summary}`,
    };
  }
  if (to === "enacted") {
    return { tone: "law", message: `${entry.label} is now law.` };
  }
  if (to === "repealed") {
    return context.failed
      ? {
          tone: "info",
          message: `${entry.label} died in a deadlocked chamber.`,
          effects: { politicalStability: -3 },
        }
      : { tone: "info", message: `${entry.label} has expired.` };
  }
  return null;
}
