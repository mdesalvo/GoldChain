import { ROLES, ableWorkerCount } from "./world.js";
import { injuredFraction, treatmentCapacity } from "./medical.js";

/**
 * The systemic layer: what the societal roles actually buy you.
 *
 * Each health score drifts towards an equilibrium set by headcount in
 * the non-productive roles. That is the whole trade-off in one place:
 * a unionizer, a doctor or a police officer is a monkey *not* on the
 * production chain, so every point of resilience is paid for in
 * throughput. Nothing here is a strict upgrade — a society with a large
 * hospital and strong unions mines less gold, it just doesn't collapse.
 *
 * Events push these scores around on top of the drift; the drift is
 * what they return to.
 */

// How fast a score closes the gap to its equilibrium, per second.
const DRIFT_RATE = 0.06;

export function wellbeingEquilibrium(targetRate) {
  const unionizers = ableWorkerCount(ROLES.UNIONIZER);
  // Hospital coverage relative to the workforce that might need it.
  const coverage = Math.min(1, treatmentCapacity() / 60);

  return clamp(
    32 +
      unionizers * 7 +
      coverage * 22 -
      injuredFraction() * 70 -
      // Being driven harder than one coin per second is felt on the
      // floor, whatever the paperwork says.
      Math.max(0, targetRate - 1) * 25
  );
}

export function corruptionEquilibrium() {
  const police = ableWorkerCount(ROLES.POLICE);
  const mafiosi = ableWorkerCount(ROLES.MAFIOSO);
  return clamp(6 + mafiosi * 9 - police * 6);
}

export function stabilityEquilibrium(deityMood) {
  const politicians = ableWorkerCount(ROLES.POLITICIAN);
  // A furious Deity destabilises the society that failed them; the more
  // politicians, the more of that blame gets absorbed institutionally.
  return clamp(45 + politicians * 8 + deityMood * 0.25);
}

/**
 * Returns the per-tick drift for each systemic score. Pure — the caller
 * folds these in with the events engine's deltas and applies them once.
 */
export function stepSociety(dt, { workerWellbeing, corruption, politicalStability, targetRate, deityMood }) {
  return {
    workerWellbeing:
      (wellbeingEquilibrium(targetRate) - workerWellbeing) * DRIFT_RATE * dt,
    corruption: (corruptionEquilibrium() - corruption) * DRIFT_RATE * dt,
    politicalStability:
      (stabilityEquilibrium(deityMood) - politicalStability) * DRIFT_RATE * dt,
  };
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}
