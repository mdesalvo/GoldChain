/**
 * Shared vocabulary for the events engine.
 *
 * Every disruption is an XState machine. Machines never touch buffers,
 * entity state or the store: they only change their own state, and the
 * engine translates that state into modifiers handed to
 * `stepPipeline()` / `stepMedical()`. That keeps the economy model the
 * single source of truth for how gold moves.
 */

export const EVENT_TYPES = Object.freeze({
  STRIKE: "strike",
  BREAKDOWN: "breakdown",
  MAFIA_RAID: "mafiaRaid",
  LEGISLATION: "legislation",
});

/** Laws the politicians can enact. Each one is a real trade-off. */
export const LAW_KINDS = Object.freeze({
  SAFETY_REGULATIONS: "safetyRegulations",
  TRIBUTE_TAX: "tributeTax",
  PRODUCTION_QUOTA: "productionQuota",
  UNION_CRACKDOWN: "unionCrackdown",
});

/**
 * The neutral modifier set. Machines contribute partial versions of
 * this and the engine folds them together — multiplying multipliers,
 * summing rates, unioning role sets.
 */
export function neutralModifiers() {
  return {
    blockedRoles: new Set(),
    throughputMultiplier: 1,
    corruptionDrain: 0,
    taxRate: 0,
    targetRateBonus: 0,
    hazardMultiplier: 1,
    // Per-second drifts applied to the systemic health scores.
    wellbeingDelta: 0,
    corruptionDelta: 0,
    stabilityDelta: 0,
    // Raises the pressure a grievance must build before workers walk
    // out. Above 1 means dissent is being suppressed, not resolved.
    strikeResistance: 1,
  };
}

/** Folds a partial modifier set into an accumulator, in place. */
export function mergeModifiers(target, partial = {}) {
  if (partial.blockedRoles) {
    for (const role of partial.blockedRoles) target.blockedRoles.add(role);
  }
  if (partial.throughputMultiplier !== undefined) {
    target.throughputMultiplier *= partial.throughputMultiplier;
  }
  if (partial.hazardMultiplier !== undefined) {
    target.hazardMultiplier *= partial.hazardMultiplier;
  }
  if (partial.strikeResistance !== undefined) {
    target.strikeResistance *= partial.strikeResistance;
  }
  for (const key of [
    "corruptionDrain",
    "taxRate",
    "targetRateBonus",
    "wellbeingDelta",
    "corruptionDelta",
    "stabilityDelta",
  ]) {
    if (partial[key] !== undefined) target[key] += partial[key];
  }
  return target;
}
