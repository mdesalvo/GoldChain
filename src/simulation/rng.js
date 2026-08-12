/**
 * Seeded PRNG for the simulation.
 *
 * The fixed-tick loop already makes the economy independent of
 * framerate; a seeded generator closes the remaining hole, so a given
 * seed + tick count always produces the same run. That matters for
 * balancing: without it, two playtests of the same build can't be
 * compared, because strikes and mafia raids fire at different times.
 *
 * Render code must never call these — pulling numbers from here
 * changes the simulation for everyone downstream in the same tick.
 */

const DEFAULT_SEED = 0x601dc4a1;

let state = DEFAULT_SEED;

/** Reseeds the generator (use before a scripted/repeatable run). */
export function setSeed(seed) {
  state = seed >>> 0;
}

/** mulberry32 — small, fast, good enough for gameplay randomness. */
export function random() {
  state = (state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Integer in [min, maxExclusive). */
export function randomInt(min, maxExclusive) {
  return min + Math.floor(random() * (maxExclusive - min));
}

/** Uniform float in [min, max). */
export function randomRange(min, max) {
  return min + random() * (max - min);
}

export function pick(items) {
  return items[randomInt(0, items.length)];
}

/**
 * Converts a "once every N seconds on average" rate into a per-tick
 * coin flip. Using the exponential form keeps the expected frequency
 * identical whatever the tick rate is — a naive `random() < rate * dt`
 * drifts as soon as TICK_RATE changes.
 */
export function chancePerSecond(ratePerSecond, dt) {
  if (ratePerSecond <= 0) return false;
  return random() < 1 - Math.exp(-ratePerSecond * dt);
}
