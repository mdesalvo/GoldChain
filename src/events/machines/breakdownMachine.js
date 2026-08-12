import { assign, createMachine } from "xstate";
import { ROLES } from "../../simulation/world.js";
import { pick, randomRange } from "../../simulation/rng.js";

/**
 * Mechanical breakdown: operational -> broken -> repairing -> operational
 *
 * Machinery wears out, and it wears out faster when the workforce is
 * treated badly — a demoralised crew defers maintenance and works
 * equipment past its limits. Rather than rolling dice every tick (which
 * makes failures feel arbitrary and unpredictable across runs), each
 * cycle draws a wear budget up front and the machine fails when wear
 * crosses it. Same average frequency, but a run is reproducible and the
 * player can feel neglect turning into breakdowns.
 */

// Stages with heavy machinery. Bankers and tellers have paperwork, not
// furnaces, so they never break down.
const MECHANISED_STAGES = [
  ROLES.MINER,
  ROLES.HAULER,
  ROLES.SMELTER,
  ROLES.GOLDSMITH,
  ROLES.DRIVER,
];

const WEAR_BUDGET_MIN = 70;
const WEAR_BUDGET_MAX = 190;
const REPAIR_WORK = 30;
const REPAIR_RATE_PER_WORKER = 1.4;
// How long before anyone admits the machine is broken. A motivated
// crew reports faults immediately; a resentful one lets it sit.
const MAX_DIAGNOSIS_SECONDS = 9;

function drawWearBudget() {
  return randomRange(WEAR_BUDGET_MIN, WEAR_BUDGET_MAX);
}

const freshContext = () => ({
  wear: 0,
  wearBudget: drawWearBudget(),
  stage: null,
  timer: 0,
  repairProgress: 0,
  hurt: 0,
});

export const breakdownMachine = createMachine({
  id: "breakdown",
  initial: "operational",
  context: freshContext,
  on: { FORCE: { target: ".broken", actions: "seizeUp" } },
  states: {
    operational: {
      on: {
        TICK: [
          {
            guard: ({ context }) => context.wear >= context.wearBudget,
            target: "broken",
            actions: "seizeUp",
          },
          { actions: "accumulateWear" },
        ],
      },
    },

    broken: {
      on: {
        TICK: [
          {
            guard: ({ context, event }) =>
              context.timer >=
              MAX_DIAGNOSIS_SECONDS *
                (1 - event.signals.workerWellbeing / 140),
            target: "repairing",
            actions: assign({ timer: 0, repairProgress: 0 }),
          },
          { actions: "advanceTimer" },
        ],
      },
    },

    repairing: {
      on: {
        TICK: [
          {
            guard: ({ context }) => context.repairProgress >= REPAIR_WORK,
            target: "operational",
            actions: assign(() => freshContext()),
          },
          { actions: "advanceRepair" },
        ],
      },
    },
  },
}).provide({
  actions: {
    advanceTimer: assign(({ context, event }) => ({
      timer: context.timer + event.dt,
    })),

    accumulateWear: assign(({ context, event }) => {
      const { dt, signals } = event;
      // Neglect doubles wear at rock-bottom wellbeing; a production
      // quota pushes equipment harder still.
      const neglect = 1 + (1 - signals.workerWellbeing / 100);
      const overdrive = 1 + Math.max(0, signals.targetRate - 1) * 0.5;
      return { wear: context.wear + neglect * overdrive * dt };
    }),

    seizeUp: assign(({ event }) => {
      const stage = pick(MECHANISED_STAGES);
      // Worse-maintained kit fails harder, and hurts people when it does.
      const violent = event.signals.workerWellbeing < 40;
      return {
        stage,
        timer: 0,
        repairProgress: 0,
        hurt: violent ? 1 : 0,
      };
    }),

    advanceRepair: assign(({ context, event }) => {
      const { dt, signals } = event;
      // The crew of the broken stage does its own repairs; if they are
      // all in hospital or on strike, nothing gets fixed.
      const hands = signals.ableByRole[context.stage] ?? 0;
      const help = signals.strikeInProgress ? 0 : hands;
      return {
        timer: context.timer + dt,
        repairProgress:
          context.repairProgress + help * REPAIR_RATE_PER_WORKER * dt,
      };
    }),
  },
});

export function describeBreakdown(snapshot) {
  const { stage, wear, wearBudget, repairProgress } = snapshot.context;
  switch (snapshot.value) {
    case "broken":
      return {
        label: "Breakdown",
        detail: `${stage} equipment has seized up.`,
        severity: 2,
      };
    case "repairing":
      return {
        label: "Repairs",
        detail: `${stage} line ${Math.min(
          99,
          Math.round((repairProgress / REPAIR_WORK) * 100)
        )}% repaired.`,
        severity: 1,
      };
    default:
      return {
        label: "Machinery",
        detail: `Wear ${Math.round((wear / wearBudget) * 100)}%.`,
        severity: 0,
        idle: true,
      };
  }
}

export function breakdownModifiers(snapshot) {
  const { stage } = snapshot.context;
  if (!stage) return {};
  switch (snapshot.value) {
    case "broken":
      return { blockedRoles: [stage], hazardMultiplier: 1.8 };
    case "repairing":
      // Working around a half-repaired machine is the dangerous part.
      return { blockedRoles: [stage], hazardMultiplier: 2.2 };
    default:
      return {};
  }
}

export function breakdownTransition(from, to, context) {
  if (to === "broken") {
    return {
      tone: "bad",
      message: `BREAKDOWN: the ${context.stage} line has stopped.`,
      // Injuries are applied by the engine, which owns entity state.
      injuries: context.hurt,
    };
  }
  if (to === "repairing") {
    return {
      tone: "info",
      message: `Repair crew dispatched to the ${context.stage} line.`,
    };
  }
  if (from === "repairing" && to === "operational") {
    return { tone: "good", message: "Line repaired and back in service." };
  }
  return null;
}
