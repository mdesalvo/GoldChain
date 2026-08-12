import {
  allMonkeys,
  queries,
  ROLES,
  STATES,
  ableWorkerCount,
} from "./world.js";
import { chancePerSecond, pick, randomRange } from "./rng.js";

/**
 * The hospital.
 *
 * Injuries take monkeys out of the workforce; doctors and nurses put
 * them back. The trade-off the design asks for lives in the treatment
 * capacity: healing throughput is finite and shared across everyone
 * waiting, so an understaffed hospital doesn't merely heal slower — it
 * lets a backlog build that quietly strips workers off the chain.
 */

// Healing units/sec contributed per medic. Doctors treat, nurses
// support; a nurse without a doctor is much less effective, which is
// why the doctor term is multiplicative on the nurse term.
const DOCTOR_CAPACITY = 26;
const NURSE_CAPACITY = 9;

// Ambient accident rate at zero wellbeing, in injuries/sec across the
// whole workforce. Safe workplaces cost throughput; unsafe ones cost
// monkeys.
const BASE_ACCIDENT_RATE = 0.055;

const INJURY_PRONE_ROLES = [
  ROLES.MINER,
  ROLES.TRANSPORTER,
  ROLES.SMELTER,
  ROLES.MINTER,
];

export function treatmentCapacity() {
  const doctors = ableWorkerCount(ROLES.DOCTOR);
  const nurses = ableWorkerCount(ROLES.NURSE);
  if (doctors === 0) {
    // No doctor on shift: nurses can only stabilise, not discharge.
    return nurses * NURSE_CAPACITY * 0.25;
  }
  return doctors * DOCTOR_CAPACITY + nurses * NURSE_CAPACITY;
}

/**
 * Injures one monkey, preferring the hazardous trades. Returns the
 * entity so callers (e.g. a furnace breakdown) can report who got hurt,
 * or null if there was nobody available to injure.
 */
export function injureRandomWorker(roles = INJURY_PRONE_ROLES, severity = 1) {
  const candidates = [];
  for (const role of roles) {
    for (const e of queries.byRole(role)) {
      if (e.state !== STATES.INJURED) candidates.push(e);
    }
  }
  if (candidates.length === 0) return null;

  const victim = pick(candidates);
  victim.state = STATES.INJURED;
  victim.health = Math.max(5, 60 - randomRange(0, 35) * severity);
  victim.stateTimer = 0;
  return victim;
}

/**
 * Steps accidents and treatment for one tick.
 *
 * `hazardMultiplier` lets events and laws raise or lower the accident
 * rate (a furnace breakdown raises it; safety regulations lower it)
 * without any of them reaching into entity state directly.
 */
export function stepMedical(dt, { workerWellbeing = 70, hazardMultiplier = 1 } = {}) {
  const result = { newInjuries: 0, recovered: 0, waiting: 0 };

  // --- Accidents ---
  const unsafety = Math.max(0, 1 - workerWellbeing / 100);
  const accidentRate = BASE_ACCIDENT_RATE * unsafety * hazardMultiplier;
  if (chancePerSecond(accidentRate, dt) && injureRandomWorker()) {
    result.newInjuries++;
  }

  // --- Treatment ---
  const injured = queries.injured();
  result.waiting = injured.length;
  if (injured.length === 0) return result;

  // Capacity is shared, so a long queue means each patient heals
  // slowly. Worst-off first: triage.
  const perPatient = (treatmentCapacity() / injured.length) * dt;
  injured.sort((a, b) => a.health - b.health);

  for (const patient of injured) {
    patient.health = Math.min(100, patient.health + perPatient);
    if (patient.health >= 100) {
      patient.state = STATES.IDLE;
      patient.stateTimer = 0;
      result.recovered++;
    }
  }

  return result;
}

/** Fraction of the pipeline workforce currently out of action. */
export function injuredFraction() {
  let injured = 0;
  let total = 0;
  for (const e of allMonkeys) {
    total++;
    if (e.state === STATES.INJURED) injured++;
  }
  return total === 0 ? 0 : injured / total;
}
