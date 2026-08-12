import { create } from "zustand";

/**
 * Global game state.
 *
 * The core loop of GoldChain is deceptively simple: keep exactly
 * 1 coin/second flowing to the Deity. Everything else — mining,
 * smelting, minting, banking, unions, police, politics — exists
 * only to protect that single number.
 */
export const useGameStore = create((set, get) => ({
  // --- Core tribute loop ---
  coinsDelivered: 0,
  targetRate: 1, // coins per second the Deity expects
  currentRate: 0, // coins per second actually being delivered
  streakSeconds: 0, // consecutive seconds the target rate was met
  longestStreakSeconds: 0,

  // --- Deity mood ---
  // 0 = furious, 50 = neutral, 100 = delighted
  deityMood: 70,

  // --- Systemic health (affects production indirectly) ---
  workerWellbeing: 70, // 0-100, driven by unions/medical/safety
  corruption: 10, // 0-100, driven by mafia infiltration vs police
  politicalStability: 80, // 0-100, driven by legislation events

  // --- Actions ---
  deliverCoin: (amount = 1) =>
    set((s) => ({ coinsDelivered: s.coinsDelivered + amount })),

  setCurrentRate: (rate) => set({ currentRate: rate }),

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
}));
