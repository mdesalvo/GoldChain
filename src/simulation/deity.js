/**
 * The Deity.
 *
 * Does no work, receives all the coin, and is the only entity in the
 * game whose opinion has consequences. Mood tracks whether tribute is
 * arriving at the demanded rate; nothing else about the society enters
 * into it — not injuries, not strikes, not who died in the mine.
 *
 * Two ratchets keep the loop from ever settling:
 *   - a long clean streak makes the Deity raise the quota ("clearly
 *     you had capacity to spare")
 *   - hitting bottom triggers wrath: the quota goes up *and* stability
 *     drops, because the punishment lands on the society, not on them
 */

export const WRATH = Object.freeze({
  DELIGHTED: "delighted",
  CONTENT: "content",
  IMPATIENT: "impatient",
  ANGRY: "angry",
  WRATHFUL: "wrathful",
});

export function wrathLevel(mood) {
  if (mood >= 85) return WRATH.DELIGHTED;
  if (mood >= 60) return WRATH.CONTENT;
  if (mood >= 40) return WRATH.IMPATIENT;
  if (mood >= 15) return WRATH.ANGRY;
  return WRATH.WRATHFUL;
}

// Mood points/sec gained when tribute fully arrives.
const RECOVERY_RATE = 1.6;
// Mood points/sec lost at a total stoppage.
const MAX_DECAY_RATE = 6;
// A streak this long convinces the Deity the quota was too generous.
// Kept gentle on purpose: until the player can actually buy capacity
// (hiring, hospital, more of the chain), a steep ratchet just guarantees
// a loss on a timer instead of creating pressure. Revisit these two
// numbers when the build/hire layer lands.
const QUOTA_RAISE_STREAK = 90;
const QUOTA_RAISE_STEP = 0.02;
// Wrath re-fires no more often than this, so a long slump is a series
// of punishments rather than one continuous drain.
const WRATH_COOLDOWN = 20;

let quotaStreakCredit = 0;
let wrathCooldown = 0;

/** Resets the Deity's bookkeeping (new game / new run). */
export function resetDeity() {
  quotaStreakCredit = 0;
  wrathCooldown = 0;
}

/**
 * Steps the Deity for one tick. Pure with respect to the world — it
 * reads the tribute numbers and returns deltas for the store to apply.
 */
export function stepDeity(dt, { currentRate, targetRate, streakSeconds }) {
  const effects = {
    moodDelta: 0,
    targetRateDelta: 0,
    stabilityDelta: 0,
    notifications: [],
  };

  const fulfilment = targetRate > 0 ? Math.min(1, currentRate / targetRate) : 1;
  const shortfall = 1 - fulfilment;

  if (shortfall <= 0.02) {
    effects.moodDelta = RECOVERY_RATE * dt;
  } else {
    // Deficit hurts more than surplus helps, and it hurts
    // superlinearly — a trickle is barely better than nothing.
    effects.moodDelta = -MAX_DECAY_RATE * shortfall ** 1.5 * dt;
  }

  // --- Quota ratchet on sustained success ---
  if (streakSeconds > 0) {
    quotaStreakCredit += dt;
    if (quotaStreakCredit >= QUOTA_RAISE_STREAK) {
      quotaStreakCredit = 0;
      effects.targetRateDelta = QUOTA_RAISE_STEP;
      effects.notifications.push({
        tone: "deity",
        message:
          "The Deity has noticed the coin arriving early. The quota is now higher.",
      });
    }
  } else {
    quotaStreakCredit = Math.max(0, quotaStreakCredit - dt * 2);
  }

  // --- Wrath on sustained failure ---
  wrathCooldown = Math.max(0, wrathCooldown - dt);
  return effects;
}

/**
 * Called by the loop when mood is at rock bottom. Separated from
 * `stepDeity` because it mutates the world's expectations rather than
 * just nudging numbers, and because it must be rate-limited.
 */
export function maybeUnleashWrath(mood) {
  if (mood > 5 || wrathCooldown > 0) return null;

  wrathCooldown = WRATH_COOLDOWN;
  return {
    moodDelta: 12, // venting helps, apparently
    // Deliberately *not* a quota rise. Punishing failure by demanding
    // more created a runaway: mood bottoms out, wrath fires every 20s,
    // the quota climbs past anything the chain can physically produce,
    // and recovery becomes arithmetically impossible. A 40-minute run
    // ended on a demand of 8.6 coins/sec against a ceiling of 1.3.
    //
    // The quota ratchet is now driven only by *success*, which is
    // self-limiting — it needs a streak, and streaks stop happening once
    // the demand exceeds capacity. Wrath instead lands on the society,
    // which is the joke anyway: the Deity never suffers the consequences
    // of the Deity's displeasure.
    stabilityDelta: -14,
    wellbeingDelta: -8,
    notification: {
      tone: "wrath",
      message:
        "WRATH: tribute stopped. The Deity is displeased, and the society absorbs the blame.",
    },
  };
}
