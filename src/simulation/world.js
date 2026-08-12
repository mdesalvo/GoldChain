import { World } from "miniplex";

/**
 * ECS world for GoldChain.
 *
 * Every monkey is an entity with a `role` component that drives its
 * finite-state machine, plus shared components (position, health,
 * morale) used across systems.
 *
 * Pipeline roles (the production chain):
 *   miner -> hauler -> smelter -> goldsmith -> driver -> banker
 *   -> teller -> payer -> [Deity]
 *
 * Societal roles (systemic layer, not on the direct chain):
 *   unionizer, politician, doctor, nurse, police, mafioso
 */
export const world = new World();

export const ROLES = Object.freeze({
  MINER: "miner",
  HAULER: "hauler",
  SMELTER: "smelter",
  GOLDSMITH: "goldsmith",
  DRIVER: "driver",
  BANKER: "banker",
  TELLER: "teller",
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
  ROLES.HAULER,
  ROLES.SMELTER,
  ROLES.GOLDSMITH,
  ROLES.DRIVER,
  ROLES.BANKER,
  ROLES.TELLER,
  ROLES.PAYER,
];

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
 * Convenience: seed a minimal starting population covering every
 * pipeline stage plus a small societal layer. Numbers are placeholder
 * and meant to be tuned once the loop is playable.
 */
export function seedInitialPopulation() {
  const counts = {
    [ROLES.MINER]: 6,
    [ROLES.HAULER]: 4,
    [ROLES.SMELTER]: 3,
    [ROLES.GOLDSMITH]: 3,
    [ROLES.DRIVER]: 2,
    [ROLES.BANKER]: 2,
    [ROLES.TELLER]: 2,
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
      const x = (Math.random() - 0.5) * 20;
      const z = (Math.random() - 0.5) * 20;
      spawnMonkey(role, [x, 0, z]);
    }
  });
}

// Pre-built queries reused across simulation systems.
export const queries = {
  byRole: (role) => world.with("role").where((e) => e.role === role),
  working: world.with("role", "state").where((e) => e.state === STATES.WORKING),
  blocked: world.with("role", "state").where((e) => e.state === STATES.BLOCKED),
  injured: world.with("health").where((e) => e.health < 100),
};
