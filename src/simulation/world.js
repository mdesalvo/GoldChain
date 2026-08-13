import { World } from "miniplex";

/**
 * ECS world for GoldChain.
 *
 * Every monkey is an entity with a `role` component that drives its
 * finite-state machine, plus shared components (position, health,
 * morale) used across systems.
 *
 * Pipeline roles (the production chain): five stages, matching the
 * concept art exactly rather than the finer-grained chain an earlier
 * pass invented.
 *   miner -> transporter -> smelter -> minter -> payer -> [Deity]
 *
 * Transporter covers what used to be two roles (hauler, driver) —
 * the concept draws one "TRANSPORT" stage, not a hauling stage and a
 * separate delivery-to-the-mint stage. Minter likewise covers the old
 * goldsmith/banker/teller split: the concept's "MINTS" is one stage.
 *
 * Societal roles (systemic layer, not on the direct chain):
 *   unionizer, politician, doctor, nurse, police, mafioso
 */
export const world = new World();

export const ROLES = Object.freeze({
  MINER: "miner",
  TRANSPORTER: "transporter",
  SMELTER: "smelter",
  MINTER: "minter",
  PAYER: "payer",
  UNIONIZER: "unionizer",
  POLITICIAN: "politician",
  DOCTOR: "doctor",
  NURSE: "nurse",
  POLICE: "police",
  MAFIOSO: "mafioso",
});

// The direct production chain, in order. Used by the simulation
// systems to know what "next stage" means for a given role.
export const PIPELINE_ORDER = [
  ROLES.MINER,
  ROLES.TRANSPORTER,
  ROLES.SMELTER,
  ROLES.MINTER,
  ROLES.PAYER,
];

// The concept names its bottom row by the place (MINES, SMELTERS,
// TRANSPORT, MINTS, DELIVERY), not by the worker's job title — and
// nothing in the game ever calls the payer anything but "Delivery",
// so any player-facing text mentioning a pipeline role (a stage card,
// a strike notification, an alert) must go through this rather than
// the raw ROLES.* slug. Canonical here, not in ui/, so simulation and
// events code can use it too without reaching into the UI layer.
export const STAGE_LABEL = Object.freeze({
  [ROLES.MINER]: "Mines",
  [ROLES.TRANSPORTER]: "Transport",
  [ROLES.SMELTER]: "Smelters",
  [ROLES.MINTER]: "Mints",
  [ROLES.PAYER]: "Delivery",
});

export const STATES = Object.freeze({
  IDLE: "idle",
  WORKING: "working",
  TRANSPORTING: "transporting",
  DELIVERING: "delivering",
  BLOCKED: "blocked", // stuck due to an event (strike, breakdown, etc.)
  INJURED: "injured",
});

/**
 * Spawns a monkey entity with sensible defaults for its role.
 * Position is a simple [x, y, z] tuple consumed by the render layer.
 */
export function spawnMonkey(role, position = [0, 0, 0]) {
  return world.add({
    role,
    state: STATES.IDLE,
    position,
    carrying: 0, // units of gold/coin currently held
    health: 100,
    morale: 70,
    stateTimer: 0,
  });
}

/**
 * Where each role stands on the ground plane.
 *
 * Pipeline roles are laid out left-to-right in `PIPELINE_ORDER` so the
 * scene reads as a chain at a glance; societal roles sit on a back row
 * because they act on the chain rather than in it. This is a render
 * convenience only — nothing in the simulation reads positions, so
 * real pathfinding can replace it without touching the economy.
 */
const STAGE_SPACING = 6;
const SOCIETAL_ROW_Z = -12;

export function stagePosition(role, index = 0, count = 1) {
  const pipelineIndex = PIPELINE_ORDER.indexOf(role);
  // Fan the crew of a stage out around its own centre line.
  const spread = (index - (count - 1) / 2) * 1.6;

  if (pipelineIndex >= 0) {
    const x =
      (pipelineIndex - (PIPELINE_ORDER.length - 1) / 2) * STAGE_SPACING;
    return [x + (index % 2 === 0 ? -0.9 : 0.9), 0, spread];
  }

  const societal = SOCIETAL_ORDER.indexOf(role);
  const slot = societal >= 0 ? societal : SOCIETAL_ORDER.length;
  const x = (slot - (SOCIETAL_ORDER.length - 1) / 2) * STAGE_SPACING;
  return [x + spread, 0, SOCIETAL_ROW_Z];
}

// Back-row ordering for the systemic layer (unions, politics,
// medical, security). Not a chain — order here is purely visual.
export const SOCIETAL_ORDER = [
  ROLES.UNIONIZER,
  ROLES.POLITICIAN,
  ROLES.DOCTOR,
  ROLES.NURSE,
  ROLES.POLICE,
  ROLES.MAFIOSO,
];

/**
 * Convenience: seed a minimal starting population covering every
 * pipeline stage plus a small societal layer. Numbers are placeholder
 * and meant to be tuned once the loop is playable.
 */
export function seedInitialPopulation() {
  const counts = {
    [ROLES.MINER]: 6,
    [ROLES.TRANSPORTER]: 6, // was hauler(4) + driver(2)
    [ROLES.SMELTER]: 3,
    [ROLES.MINTER]: 7, // was goldsmith(3) + banker(2) + teller(2)
    [ROLES.PAYER]: 1,
    [ROLES.UNIONIZER]: 2,
    [ROLES.POLITICIAN]: 1,
    [ROLES.DOCTOR]: 1,
    [ROLES.NURSE]: 2,
    [ROLES.POLICE]: 3,
    [ROLES.MAFIOSO]: 2,
  };

  Object.entries(counts).forEach(([role, count]) => {
    for (let i = 0; i < count; i++) {
      spawnMonkey(role, stagePosition(role, i, count));
    }
  });
}

let seeded = false;

/**
 * Seeds the population exactly once, synchronously.
 *
 * Callers must be able to rely on the world being populated *before*
 * the first render: the render layer builds instanced meshes sized to
 * the population, and the game loop starts ticking immediately. Doing
 * this in an effect would let both run once against an empty world.
 */
export function ensureSeeded() {
  if (seeded) return;
  seeded = true;
  seedInitialPopulation();
}

/**
 * Every monkey. A component-presence archetype, so miniplex keeps it up
 * to date automatically.
 */
export const allMonkeys = world.with("role", "state");

/**
 * Buckets are cached per role, because `world.with(...).where(...)`
 * *creates* a derived bucket every time it is called and registers it
 * with the world forever. Calling it inside the tick — as the systems
 * do, several times per role per tick — leaks thousands of buckets and
 * makes every entity change O(buckets). Roles never change after spawn,
 * so one bucket per role is both correct and cheap.
 */
const roleBuckets = new Map();

export function byRole(role) {
  let bucket = roleBuckets.get(role);
  if (!bucket) {
    bucket = world.with("role").where((e) => e.role === role);
    roleBuckets.set(role, bucket);
  }
  return bucket;
}

/** How many monkeys currently hold a given role. */
export function countByRole(role) {
  return byRole(role).size;
}

/**
 * Monkeys of a role that can actually do work right now. Injured
 * monkeys are out of the workforce until the hospital gets to them,
 * which is what makes an understaffed hospital a real bottleneck
 * rather than a cosmetic detail.
 */
export function ableWorkerCount(role) {
  let n = 0;
  for (const e of byRole(role)) {
    if (e.state !== STATES.INJURED) n++;
  }
  return n;
}

/**
 * Monkeys currently in a given `STATES` value.
 *
 * Deliberately a filter over a presence archetype rather than a
 * `.where()` bucket: `state` is mutated in place by the simulation, and
 * miniplex only re-evaluates predicate buckets on an explicit reindex.
 * A predicate bucket here would silently go stale — which is worse than
 * a loop over a few hundred entities.
 */
export function withState(state) {
  const found = [];
  for (const e of allMonkeys) {
    if (e.state === state) found.push(e);
  }
  return found;
}

// Pre-built queries reused across simulation systems.
export const queries = {
  byRole,
  all: allMonkeys,
  working: () => withState(STATES.WORKING),
  blocked: () => withState(STATES.BLOCKED),
  injured: () => withState(STATES.INJURED),
};
