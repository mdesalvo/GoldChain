import { assign, createMachine } from "xstate";
import { randomRange } from "../../simulation/rng.js";

/**
 * Mafia raid: dormant -> casing -> raiding -> (fleeing | foiled) -> dormant
 *
 * The mafia is opportunistic, not random. Opportunity builds from two
 * things the player controls: how much gold is sitting in mid-chain
 * buffers (a jammed chain is a warehouse full of loot) and how thin
 * policing is relative to the mafiosi. So the corruption layer punishes
 * exactly the state a player drifts into when optimising throughput and
 * ignoring the systemic layer.
 *
 * Policing works through suspicion accumulating against a stealth roll
 * drawn when the crew starts casing the job — enough police and the
 * raid is foiled before it starts, but the police wage bill is paid
 * whether or not a raid was ever coming.
 */

const OPPORTUNITY_THRESHOLD = 150;
const CASING_SECONDS = 8;
const RAID_SECONDS = 6;
// Units/sec each mafioso can siphon while a raid is live.
const HAUL_PER_MAFIOSO = 0.9;

const freshContext = () => ({
  opportunity: 0,
  suspicion: 0,
  stealth: randomRange(45, 110),
  timer: 0,
  crew: 0,
  haul: 0,
});

export const mafiaRaidMachine = createMachine({
  id: "mafiaRaid",
  initial: "dormant",
  context: freshContext,
  on: { FORCE: { target: ".casing", actions: "caseTheJob" } },
  states: {
    dormant: {
      on: {
        TICK: [
          {
            guard: ({ context, event }) =>
              context.opportunity >= OPPORTUNITY_THRESHOLD &&
              event.signals.mafiosi > 0,
            target: "casing",
            actions: "caseTheJob",
          },
          { actions: "scoutOpportunity" },
        ],
      },
    },

    casing: {
      on: {
        TICK: [
          {
            guard: ({ context }) => context.suspicion >= context.stealth,
            target: "foiled",
          },
          {
            guard: ({ context }) => context.timer >= CASING_SECONDS,
            target: "raiding",
            actions: assign({ timer: 0, haul: 0 }),
          },
          { actions: "watchAndWait" },
        ],
      },
    },

    raiding: {
      on: {
        TICK: [
          {
            // Caught in the act: the haul is recovered.
            guard: ({ context }) => context.suspicion >= context.stealth * 1.6,
            target: "foiled",
          },
          {
            guard: ({ context }) => context.timer >= RAID_SECONDS,
            target: "fleeing",
          },
          { actions: "loot" },
        ],
      },
    },

    // Both outcomes are held for one tick so the engine can report them
    // once, then the cycle resets with a fresh stealth roll.
    fleeing: {
      on: { TICK: { target: "dormant", actions: assign(() => freshContext()) } },
    },
    foiled: {
      on: { TICK: { target: "dormant", actions: assign(() => freshContext()) } },
    },
  },
}).provide({
  actions: {
    scoutOpportunity: assign(({ context, event }) => {
      const { dt, signals } = event;
      // Loot on the table, scaled by how outnumbered the police are.
      const loot = Math.min(2, signals.mobileGold / 60);
      const impunity =
        signals.mafiosi / Math.max(0.5, signals.police) +
        signals.corruption / 100;
      const growth = 2.5 * loot * impunity;
      // With gold locked away and police thick on the ground, plans
      // decay instead of maturing.
      const decay = signals.police >= signals.mafiosi * 1.5 ? 1.2 : 0;
      return {
        opportunity: Math.max(0, context.opportunity + (growth - decay) * dt),
      };
    }),

    caseTheJob: assign(({ event }) => ({
      timer: 0,
      suspicion: 0,
      crew: event.signals.mafiosi,
    })),

    watchAndWait: assign(({ context, event }) => {
      const { dt, signals } = event;
      // Corruption inside the force blunts its own investigations.
      const effectivePolice = signals.police * (1 - signals.corruption / 150);
      return {
        timer: context.timer + dt,
        suspicion: context.suspicion + Math.max(0, effectivePolice) * 4 * dt,
      };
    }),

    loot: assign(({ context, event }) => {
      const { dt, signals } = event;
      const effectivePolice = signals.police * (1 - signals.corruption / 150);
      return {
        timer: context.timer + dt,
        // A raid in progress is loud: suspicion climbs faster.
        suspicion: context.suspicion + Math.max(0, effectivePolice) * 9 * dt,
        haul: context.haul + context.crew * HAUL_PER_MAFIOSO * dt,
      };
    }),
  },
});

export function describeMafiaRaid(snapshot) {
  const { opportunity, haul, crew } = snapshot.context;
  switch (snapshot.value) {
    case "casing":
      return {
        label: "Suspicious activity",
        detail: "Unfamiliar monkeys are watching the convoy routes.",
        severity: 1,
      };
    case "raiding":
      return {
        label: "Mafia raid",
        detail: `${crew} mafiosi are siphoning gold in transit.`,
        severity: 2,
      };
    case "fleeing":
      return {
        label: "Raid succeeded",
        detail: `${haul.toFixed(1)} units gone.`,
        severity: 1,
      };
    case "foiled":
      return { label: "Raid foiled", detail: "Police intervened.", severity: 0 };
    default:
      return {
        label: "Security",
        detail: `Underworld interest ${Math.round(
          (opportunity / OPPORTUNITY_THRESHOLD) * 100
        )}%.`,
        severity: 0,
        idle: true,
      };
  }
}

export function mafiaRaidModifiers(snapshot) {
  switch (snapshot.value) {
    case "casing":
      return { corruptionDelta: 0.15 };
    case "raiding":
      return {
        corruptionDrain: snapshot.context.crew * HAUL_PER_MAFIOSO,
        corruptionDelta: 0.8,
      };
    default:
      return {};
  }
}

export function mafiaRaidTransition(from, to, context) {
  if (to === "casing") {
    return {
      tone: "warn",
      message: "Police report unfamiliar faces near the convoy routes.",
    };
  }
  if (to === "raiding") {
    return { tone: "bad", message: "RAID: gold is being siphoned in transit." };
  }
  if (to === "fleeing") {
    return {
      tone: "bad",
      message: `The crew got away with ${context.haul.toFixed(1)} units.`,
      effects: { corruption: 6, politicalStability: -2 },
    };
  }
  if (to === "foiled") {
    return {
      tone: "good",
      message:
        from === "raiding"
          ? "Police caught the crew mid-raid; the gold is recovered."
          : "Police disrupted the plan before it started.",
      effects: { corruption: -8, politicalStability: 3 },
    };
  }
  return null;
}
