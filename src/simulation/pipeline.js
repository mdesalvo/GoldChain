import { world, queries, ROLES, STATES, PIPELINE_ORDER } from "./world.js";

/**
 * Fixed-tick simulation step for the production pipeline.
 *
 * Design: each pipeline role has a base throughput (units/sec) that
 * gets modified by systemic factors (worker wellbeing, corruption,
 * active events). This function is meant to be called at a fixed
 * rate (e.g. 10-20 Hz) from a game loop driver, independent of
 * render framerate.
 *
 * Returns the coins/sec actually produced this tick, so the caller
 * can feed it into the global store.
 */

const BASE_THROUGHPUT = {
  [ROLES.MINER]: 0.5, // gold units/sec per monkey
  [ROLES.HAULER]: 0.6,
  [ROLES.SMELTER]: 0.4,
  [ROLES.GOLDSMITH]: 0.5,
  [ROLES.DRIVER]: 0.6,
  [ROLES.BANKER]: 0.8,
  [ROLES.TELLER]: 0.8,
  [ROLES.PAYER]: 1.0,
};

/**
 * A very simple "bucket chain" model: each stage has a buffer.
 * Workers of stage N drain stage N's buffer and fill stage N+1's
 * buffer, bounded by their throughput and by how much is available.
 * The final stage (payer) draining its buffer IS the coin delivered
 * to the Deity.
 */
export const stageBuffers = Object.fromEntries(
  PIPELINE_ORDER.map((role) => [role, 0])
);
// Seed the first stage so miners have something to mine without
// needing an infinite external gold source modeled explicitly.
stageBuffers[ROLES.MINER] = Infinity;

export function stepPipeline(dt, modifiers = {}) {
  const {
    wellbeingFactor = 1, // 0..1+ multiplier from worker wellbeing
    corruptionDrain = 0, // flat units/sec siphoned off by mafia
    blockedRoles = new Set(), // roles currently on strike/broken
  } = modifiers;

  let coinsThisTick = 0;

  for (let i = 0; i < PIPELINE_ORDER.length; i++) {
    const role = PIPELINE_ORDER[i];
    const nextRole = PIPELINE_ORDER[i + 1];

    if (blockedRoles.has(role)) continue;

    const workers = [...queries.byRole(role)];
    if (workers.length === 0) continue;

    const throughput =
      BASE_THROUGHPUT[role] * workers.length * wellbeingFactor * dt;

    const available = stageBuffers[role];
    const moved = Math.min(throughput, available === Infinity ? throughput : available);

    if (available !== Infinity) {
      stageBuffers[role] -= moved;
    }

    if (nextRole) {
      stageBuffers[nextRole] += moved;
    } else {
      // Payer stage: this is coin delivered to the Deity.
      coinsThisTick += moved;
    }
  }

  // Corruption siphons off gold sitting in mid-chain buffers
  // (mafia intercepts shipments) rather than the final coin count,
  // to keep the "coins delivered" ledger honest.
  if (corruptionDrain > 0) {
    const midStage = PIPELINE_ORDER[2]; // e.g. smelter buffer
    stageBuffers[midStage] = Math.max(
      0,
      stageBuffers[midStage] - corruptionDrain * dt
    );
  }

  return coinsThisTick;
}

/**
 * Advances every monkey's simple state machine. Currently a
 * placeholder cycle (idle -> working -> idle) — this is the hook
 * point for richer per-role behavior and animation triggers later.
 */
export function stepMonkeyStates(dt) {
  for (const entity of world.with("role", "state", "stateTimer")) {
    entity.stateTimer += dt;

    if (entity.state === STATES.BLOCKED || entity.state === STATES.INJURED) {
      continue; // external systems (events, medical) clear these
    }

    if (entity.stateTimer > 2) {
      entity.state =
        entity.state === STATES.WORKING ? STATES.IDLE : STATES.WORKING;
      entity.stateTimer = 0;
    }
  }
}
