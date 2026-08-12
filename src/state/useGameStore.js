import { create } from "zustand";

/**
 * Global game state.
 *
 * The core loop of GoldChain is deceptively simple: keep exactly
 * 1 coin/second flowing to the Deity. Everything else — mining,
 * smelting, minting, banking, unions, police, politics — exists
 * only to protect that single number.
 */

const MAX_NOTIFICATIONS = 8;
let notificationId = 0;

export const useGameStore = create((set, get) => ({
  // --- Core tribute loop ---
  coinsDelivered: 0,
  // The Deity's standing demand. Ratchets up permanently on long clean
  // streaks and after wrath; `targetRate` is this plus whatever
  // temporary bonus an active law adds.
  baseTargetRate: 1,
  targetRate: 1, // coins per second currently expected
  currentRate: 0, // coins per second actually being delivered
  streakSeconds: 0, // consecutive seconds the target rate was met
  longestStreakSeconds: 0,
  // Simulation time, in seconds. The UI turns this into the day/clock
  // readout; nothing in the simulation reads it.
  elapsedSeconds: 0,
  taxedTotal: 0, // coin skimmed by legislation
  stolenTotal: 0, // gold siphoned out of the chain by the mafia

  // --- Deity mood ---
  // 0 = furious, 50 = neutral, 100 = delighted
  deityMood: 70,

  // --- Systemic health (affects production indirectly) ---
  workerWellbeing: 70, // 0-100, driven by unions/medical/safety
  corruption: 10, // 0-100, driven by mafia infiltration vs police
  politicalStability: 80, // 0-100, driven by legislation events

  // --- Events / presentation ---
  // Populated by the events engine each tick: one entry per disruption
  // machine, carrying its current state and a human-readable summary.
  activeEvents: [],
  notifications: [],
  // Per-stage buffers and headcount, for the chain readout in the HUD.
  stages: [],
  bottleneck: null,
  injuredCount: 0,
  // Coin banked between the chain and the Deity. The tribute is paid
  // out of here, which is why a stoppage upstream is survivable.
  flowMet: true,
  reserves: 0,
  reserveCapacity: 0,
  // What the player can do right now, with cost/cooldown/affordability
  // already resolved. Rebuilt with the rest of the HUD snapshot.
  actions: [],
  treatmentCapacity: 0,
  siphonRate: 0, // units/sec the mafia is currently siphoning
  blockedRoles: [],
  paused: false,
  // Time multiplier. The loop still steps a fixed dt — it just steps it
  // more times per frame — so speeding up never changes the outcome.
  speed: 1,

  // --- Actions ---
  deliverCoin: (amount = 1) =>
    set((s) => ({ coinsDelivered: s.coinsDelivered + amount })),

  setCurrentRate: (rate) => set({ currentRate: rate }),

  advanceClock: (dt) => set((s) => ({ elapsedSeconds: s.elapsedSeconds + dt })),

  /** Permanently raises what the Deity demands (never lowered). */
  raiseBaseTargetRate: (delta) =>
    set((s) => ({ baseTargetRate: s.baseTargetRate + delta })),

  /** Effective demand = standing demand + temporary legislated bonus. */
  applyTargetRateBonus: (bonus) =>
    set((s) => ({ targetRate: s.baseTargetRate + bonus })),

  tickStreak: (dt) =>
    set((s) => {
      const met = s.currentRate >= s.targetRate;
      const streakSeconds = met ? s.streakSeconds + dt : 0;
      return {
        streakSeconds,
        longestStreakSeconds: Math.max(s.longestStreakSeconds, streakSeconds),
      };
    }),

  adjustDeityMood: (delta) =>
    set((s) => ({
      deityMood: Math.max(0, Math.min(100, s.deityMood + delta)),
    })),

  adjustWorkerWellbeing: (delta) =>
    set((s) => ({
      workerWellbeing: Math.max(0, Math.min(100, s.workerWellbeing + delta)),
    })),

  adjustCorruption: (delta) =>
    set((s) => ({
      corruption: Math.max(0, Math.min(100, s.corruption + delta)),
    })),

  adjustPoliticalStability: (delta) =>
    set((s) => ({
      politicalStability: Math.max(
        0,
        Math.min(100, s.politicalStability + delta)
      ),
    })),

  /**
   * Applies several systemic deltas in one `set`. The tick touches all
   * three scores every frame, and doing that as three separate updates
   * would fire three rounds of subscriber notifications per tick.
   */
  applySystemicDeltas: ({
    workerWellbeing = 0,
    corruption = 0,
    politicalStability = 0,
    deityMood = 0,
  }) =>
    set((s) => ({
      workerWellbeing: clamp(s.workerWellbeing + workerWellbeing),
      corruption: clamp(s.corruption + corruption),
      politicalStability: clamp(s.politicalStability + politicalStability),
      deityMood: clamp(s.deityMood + deityMood),
    })),

  recordSkim: ({ taxed = 0, stolen = 0 }) =>
    set((s) => ({
      taxedTotal: s.taxedTotal + taxed,
      stolenTotal: s.stolenTotal + stolen,
    })),

  /** Replaces the HUD-facing snapshot of the chain and active events. */
  publishSnapshot: (snapshot) => set(snapshot),

  pushNotifications: (incoming) => {
    if (!incoming || incoming.length === 0) return;
    const stamped = incoming.map((n) => ({
      ...n,
      id: ++notificationId,
      at: get().coinsDelivered,
    }));
    set((s) => ({
      // Newest first, oldest evicted — this is a feed, not a log.
      notifications: [...stamped.reverse(), ...s.notifications].slice(
        0,
        MAX_NOTIFICATIONS
      ),
    }));
  },

  dismissNotification: (id) =>
    set((s) => ({
      notifications: s.notifications.filter((n) => n.id !== id),
    })),

  togglePaused: () => set((s) => ({ paused: !s.paused })),

  setSpeed: (speed) => set({ speed, paused: false }),
}));

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}
