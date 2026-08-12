import {
  allMonkeys,
  countByRole,
  ableWorkerCount,
  ROLES,
  STATES,
  PIPELINE_ORDER,
} from "./world.js";

/**
 * Fixed-tick simulation step for the production pipeline.
 *
 * Design: each pipeline role has a base throughput (units/sec) that
 * gets modified by systemic factors (worker wellbeing, corruption,
 * active events). This function is meant to be called at a fixed
 * rate (e.g. 10-20 Hz) from a game loop driver, independent of
 * render framerate.
 *
 * It is the single source of truth for how gold moves: events never
 * touch buffers themselves, they hand modifiers in here.
 */

const BASE_THROUGHPUT = {
  [ROLES.MINER]: 0.5, // gold units/sec per monkey
  [ROLES.HAULER]: 0.6,
  [ROLES.SMELTER]: 0.5,
  [ROLES.GOLDSMITH]: 0.5,
  [ROLES.DRIVER]: 0.75,
  [ROLES.BANKER]: 0.8,
  [ROLES.TELLER]: 0.8,
  [ROLES.PAYER]: 1.8,
};

/**
 * Per-stage buffer capacity. Finite buffers are what give the chain
 * backpressure: block the smelters and gold piles up behind them until
 * the haulers have nowhere to put it, so a strike three stages
 * upstream is visible as a stalled front end rather than an
 * ever-growing invisible number. It also gives the mafia something
 * worth stealing.
 */
const BUFFER_CAPACITY = 40;

/**
 * A "bucket chain" model: each stage has a buffer. Workers of stage N
 * drain stage N's buffer and fill stage N+1's buffer, bounded by their
 * throughput, by how much is available, and by how much room the next
 * stage has left. The final stage (payer) draining its buffer IS the
 * coin delivered to the Deity.
 */
export const stageBuffers = Object.fromEntries(
  PIPELINE_ORDER.map((role) => [role, 0])
);
// Seed the first stage so miners have something to mine without
// needing an infinite external gold source modeled explicitly.
stageBuffers[ROLES.MINER] = Infinity;

/**
 * The reserve.
 *
 * The chain does not hand coin straight to the Deity — it fills a
 * reserve, and the Deity is paid out of the reserve at exactly the
 * demanded rate. This is what makes "1 coin per second" a defensible
 * target instead of a knife-edge: surplus production banks up, and a
 * stoppage upstream is survivable for as long as the reserve lasts.
 * Uptime becomes a resource the player manages rather than a coin flip.
 *
 * The cap matters as much as the buffer does. Once the reserve is full
 * the payer has nowhere to put gold, backpressure travels up the whole
 * chain, and the society idles — you cannot simply stockpile your way
 * out of ever caring about the systemic layer.
 */
const RESERVE_CAPACITY = 60;

export const treasury = { reserves: 0, capacity: RESERVE_CAPACITY };

export function bufferCapacity(role) {
  return role === ROLES.MINER ? Infinity : BUFFER_CAPACITY;
}

/** Total gold sitting in mid-chain buffers — what a raid can target. */
export function mobileGold() {
  return PIPELINE_ORDER.reduce((sum, role) => {
    const amount = stageBuffers[role];
    return amount === Infinity ? sum : sum + amount;
  }, 0);
}

/**
 * Steps the chain one tick.
 *
 * Returns `{ coins, taxed, stolen, produced, bottleneck }`:
 *   coins      — units actually paid to the Deity this tick
 *   taxed      — units skimmed by legislation before delivery
 *   stolen      — units siphoned out of mid-chain buffers by the mafia
 *   produced   — units the payer added to the reserve
 *   bottleneck — role that moved the least relative to its capacity,
 *                so the HUD can tell the player where the jam is
 */
export function stepPipeline(dt, modifiers = {}) {
  const {
    wellbeingFactor = 1, // 0..1+ multiplier from worker wellbeing
    throughputMultiplier = 1, // 0..1+ multiplier from active laws/events
    corruptionDrain = 0, // flat units/sec siphoned off by mafia
    taxRate = 0, // 0..1 fraction of delivered coin skimmed by law
    demandRate = 1, // coins/sec the Deity currently expects
    blockedRoles = new Set(), // roles currently on strike/broken
  } = modifiers;

  let produced = 0;
  let bottleneck = null;
  let worstRatio = Infinity;

  // Walk the chain backwards so each stage drains into the room its
  // downstream neighbour freed up *last* tick. Walking forwards would
  // let a unit teleport from mine to Deity within a single tick, which
  // erases the whole point of having buffers.
  for (let i = PIPELINE_ORDER.length - 1; i >= 0; i--) {
    const role = PIPELINE_ORDER[i];
    const nextRole = PIPELINE_ORDER[i + 1];

    if (blockedRoles.has(role)) {
      bottleneck = role;
      worstRatio = -1;
      continue;
    }

    const workers = ableWorkerCount(role);
    if (workers === 0) {
      if (worstRatio > 0) {
        bottleneck = role;
        worstRatio = 0;
      }
      continue;
    }

    const capacityThisTick =
      BASE_THROUGHPUT[role] * workers * wellbeingFactor * throughputMultiplier * dt;

    const available = stageBuffers[role];
    // The payer's "next buffer" is the reserve; when that is full the
    // whole chain backs up behind it.
    const room = nextRole
      ? bufferCapacity(nextRole) - stageBuffers[nextRole]
      : treasury.capacity - treasury.reserves;

    const moved = Math.max(
      0,
      Math.min(
        capacityThisTick,
        available === Infinity ? capacityThisTick : available,
        room
      )
    );

    if (available !== Infinity) {
      stageBuffers[role] -= moved;
    }

    if (nextRole) {
      stageBuffers[nextRole] += moved;
    } else {
      // Payer stage: minted coin lands in the reserve, not in the
      // Deity's hands. Payout happens once, below, at the demanded rate.
      treasury.reserves += moved;
      produced += moved;
    }

    const ratio = capacityThisTick > 0 ? moved / capacityThisTick : 0;
    if (ratio < worstRatio) {
      worstRatio = ratio;
      bottleneck = role;
    }
  }

  // Corruption siphons off gold sitting in mid-chain buffers
  // (mafia intercepts shipments) rather than the final coin count,
  // to keep the "coins delivered" ledger honest.
  let stolen = 0;
  if (corruptionDrain > 0) {
    let remaining = corruptionDrain * dt;
    // Take from the fattest buffers first — thieves go where the gold
    // actually is, and it stops one unlucky stage being drained to zero
    // while the rest of the chain overflows.
    const targets = PIPELINE_ORDER.filter(
      (role) => stageBuffers[role] !== Infinity && stageBuffers[role] > 0
    ).sort((a, b) => stageBuffers[b] - stageBuffers[a]);

    for (const role of targets) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, stageBuffers[role]);
      stageBuffers[role] -= take;
      remaining -= take;
      stolen += take;
    }
  }

  // --- Payout ---
  // The Deity is paid at exactly the demanded rate, out of the reserve,
  // so the tribute stays smooth while there is anything banked. Running
  // dry is the only way the flow visibly stutters — which is precisely
  // the moment the player is supposed to feel.
  const demanded = Math.max(0, demandRate) * dt;
  const withdrawn = Math.min(demanded, treasury.reserves);
  treasury.reserves -= withdrawn;

  const taxed = withdrawn * Math.max(0, Math.min(1, taxRate));

  return { coins: withdrawn - taxed, taxed, stolen, produced, bottleneck };
}

/**
 * Advances every monkey's simple state machine.
 *
 * Blocked and injured states are owned by other systems (the events
 * engine and the hospital respectively); this only drives the ordinary
 * idle <-> working cycle and clears a block once its cause is gone.
 */
export function stepMonkeyStates(dt, blockedRoles = new Set()) {
  for (const entity of allMonkeys) {
    entity.stateTimer += dt;

    if (entity.state === STATES.INJURED) continue; // the hospital owns this

    if (blockedRoles.has(entity.role)) {
      if (entity.state !== STATES.BLOCKED) {
        entity.state = STATES.BLOCKED;
        entity.stateTimer = 0;
      }
      continue;
    }

    if (entity.state === STATES.BLOCKED) {
      // Cause resolved — back to work.
      entity.state = STATES.IDLE;
      entity.stateTimer = 0;
      continue;
    }

    if (entity.stateTimer > 2) {
      entity.state =
        entity.state === STATES.WORKING ? STATES.IDLE : STATES.WORKING;
      entity.stateTimer = 0;
    }
  }
}

/** Snapshot of the chain for the HUD — read-only copy, never mutated. */
export function pipelineSnapshot() {
  return PIPELINE_ORDER.map((role, i) => ({
    stageIndex: i,
    role,
    buffer: stageBuffers[role] === Infinity ? null : stageBuffers[role],
    capacity: bufferCapacity(role) === Infinity ? null : bufferCapacity(role),
    workers: ableWorkerCount(role),
    total: countByRole(role),
  }));
}
