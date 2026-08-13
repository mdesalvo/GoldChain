import { assign, createMachine } from "xstate";
import { PIPELINE_ORDER, STAGE_LABEL } from "../../simulation/world.js";
import { randomInt } from "../../simulation/rng.js";

const stageNames = (roles) => roles.map((r) => STAGE_LABEL[r]).join(", ");

/**
 * Strike: brewing -> active -> negotiating -> resolved
 *
 * Grievance is a reservoir, not a coin flip. Neglect worker wellbeing
 * and pressure accumulates until it boils over; the `brewing` state is
 * the warning window where the player can still buy the walkout off.
 * Once workers are out, only bargaining ends it — and bargaining is
 * driven by unionizer headcount, so a society that never funded its
 * unions has nobody able to negotiate an end to its own strike.
 *
 * The machine is stepped by explicit TICK events rather than XState's
 * `after` delays: wall-clock timers would tie disruption timing to
 * render performance, which is exactly what the fixed-tick loop exists
 * to prevent.
 */

const PRESSURE_THRESHOLD = 100;
const GRIEVANCE_RATE = 16; // pressure/sec at zero wellbeing
const RELIEF_RATE = 7; // pressure/sec shed while workers are content
const CONTENT_WELLBEING = 62;
const BREWING_SECONDS = 14;
const PICKET_SECONDS = 10;
const NEGOTIATION_WORK = 45;

const initialContext = {
  pressure: 0,
  timer: 0,
  progress: 0,
  severity: 0,
  blockedRoles: [],
};

export const strikeMachine = createMachine({
  id: "strike",
  initial: "dormant",
  context: () => ({ ...initialContext }),
  // Lets the engine start a walkout on demand (debug panel, scripted
  // scenario, future player action). It enters at the *start* of the
  // lifecycle, so a forced strike still has to brew and be negotiated.
  on: {
    FORCE: { target: ".brewing", actions: assign({ timer: 0 }) },
    // The player conceding at the table. It buys progress towards a
    // settlement and drains the grievance reservoir, but it cannot skip
    // the lifecycle: an active picket still has to reach negotiations.
    CONCEDE: {
      actions: assign(({ context }) => ({
        pressure: Math.max(0, context.pressure - PRESSURE_THRESHOLD * 0.3),
        progress: context.progress + NEGOTIATION_WORK * 0.35,
      })),
    },
  },
  states: {
    dormant: {
      on: {
        TICK: [
          {
            guard: ({ context, event }) =>
              context.pressure >=
              PRESSURE_THRESHOLD * event.signals.strikeResistance,
            target: "brewing",
            actions: assign({ timer: 0 }),
          },
          { actions: "accumulateGrievance" },
        ],
      },
    },

    brewing: {
      on: {
        TICK: [
          {
            // Conditions improved in time — the walkout is called off,
            // but the reservoir stays half full: goodwill is slow.
            guard: ({ event }) =>
              event.signals.workerWellbeing >= CONTENT_WELLBEING + 6,
            target: "dormant",
            actions: assign({
              pressure: PRESSURE_THRESHOLD * 0.45,
              timer: 0,
            }),
          },
          {
            guard: ({ context }) => context.timer >= BREWING_SECONDS,
            target: "active",
            actions: "callWalkout",
          },
          { actions: "advanceTimer" },
        ],
      },
    },

    active: {
      on: {
        TICK: [
          {
            guard: ({ context }) => context.timer >= PICKET_SECONDS,
            target: "negotiating",
            actions: assign({ timer: 0, progress: 0 }),
          },
          { actions: "advanceTimer" },
        ],
      },
    },

    negotiating: {
      on: {
        TICK: [
          {
            guard: ({ context }) => context.progress >= NEGOTIATION_WORK,
            target: "resolved",
          },
          { actions: "bargain" },
        ],
      },
    },

    resolved: {
      // Held for a single tick so the engine can see the transition and
      // apply the settlement exactly once.
      on: {
        TICK: {
          target: "dormant",
          actions: assign(() => ({ ...initialContext })),
        },
      },
    },
  },
}).provide({
  actions: {
    advanceTimer: assign(({ context, event }) => ({
      timer: context.timer + event.dt,
    })),

    accumulateGrievance: assign(({ context, event }) => {
      const { dt, signals } = event;
      const deficit = Math.max(
        0,
        (CONTENT_WELLBEING - signals.workerWellbeing) / CONTENT_WELLBEING
      );
      // Bodies in the hospital are their own argument.
      const grievance =
        GRIEVANCE_RATE * deficit + signals.injuredFraction * 22;
      const relief = deficit === 0 ? RELIEF_RATE : 0;
      return {
        pressure: Math.max(0, context.pressure + (grievance - relief) * dt),
      };
    }),

    callWalkout: assign(({ event }) => {
      const { workerWellbeing } = event.signals;
      // The angrier the workforce, the more of the chain walks out
      // together.
      const severity =
        workerWellbeing < 25 ? 3 : workerWellbeing < 45 ? 2 : 1;
      const start = randomInt(0, PIPELINE_ORDER.length - severity + 1);
      return {
        timer: 0,
        severity,
        blockedRoles: PIPELINE_ORDER.slice(start, start + severity),
      };
    }),

    bargain: assign(({ context, event }) => {
      const { dt, signals } = event;
      // Unionizers do the bargaining; a decent baseline of wellbeing
      // means there is less to argue about. Suppression laws make the
      // talks drag instead of making them unnecessary.
      const bargainingPower =
        signals.unionizers * 3 + signals.workerWellbeing / 12;
      const drag = Math.max(0.4, 1 / signals.strikeResistance);
      return {
        timer: context.timer + dt,
        progress: context.progress + bargainingPower * drag * dt,
      };
    }),
  },
});

export function describeStrike(snapshot) {
  const { pressure, severity, progress, blockedRoles } = snapshot.context;
  switch (snapshot.value) {
    case "brewing":
      return {
        label: "Unrest brewing",
        detail: "Unionizers are collecting grievances.",
        severity: 1,
      };
    case "active":
      return {
        label: "Strike",
        detail: `${stageNames(blockedRoles)} have walked out.`,
        severity: severity + 1,
        roles: blockedRoles,
      };
    case "negotiating":
      return {
        label: "Negotiating",
        detail: `Settlement ${Math.min(
          99,
          Math.round((progress / NEGOTIATION_WORK) * 100)
        )}% agreed.`,
        severity: 1,
        // Most of the chain has drifted back to work by now; only the
        // stage that started it still holds the line (mirrors
        // strikeModifiers' blockedRoles for this state).
        roles: blockedRoles.slice(0, 1),
      };
    case "resolved":
      return { label: "Strike settled", detail: "Back to work.", severity: 0 };
    default:
      return {
        label: "Labour calm",
        detail: `Grievance ${Math.round(
          (pressure / PRESSURE_THRESHOLD) * 100
        )}%.`,
        severity: 0,
        idle: true,
      };
  }
}

export function strikeModifiers(snapshot) {
  const { blockedRoles } = snapshot.context;
  switch (snapshot.value) {
    case "brewing":
      // Work-to-rule: still working, but pointedly slowly.
      return { throughputMultiplier: 0.94 };
    case "active":
      return { blockedRoles, stabilityDelta: -0.7 };
    case "negotiating":
      // Most of the chain drifts back to work while talks run; the
      // stage that started it holds the line.
      return {
        blockedRoles: blockedRoles.slice(0, 1),
        throughputMultiplier: 0.9,
        stabilityDelta: -0.2,
      };
    default:
      return {};
  }
}

export function strikeTransition(from, to, context) {
  if (to === "brewing") {
    return {
      tone: "warn",
      message:
        "Unrest is brewing. Improve conditions or the chain stops moving.",
    };
  }
  if (from === "brewing" && to === "dormant") {
    return {
      tone: "good",
      message: "Concessions accepted — the walkout has been called off.",
      effects: { workerWellbeing: 3 },
    };
  }
  if (to === "active") {
    return {
      tone: "bad",
      message: `STRIKE: ${stageNames(context.blockedRoles)} have downed tools.`,
    };
  }
  if (to === "negotiating") {
    return { tone: "info", message: "Negotiations have opened." };
  }
  if (to === "resolved") {
    return {
      tone: "good",
      message: "Settlement reached: conditions improved, chain restarting.",
      effects: { workerWellbeing: 15, politicalStability: 4 },
    };
  }
  return null;
}
