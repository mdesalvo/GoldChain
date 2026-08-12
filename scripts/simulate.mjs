/**
 * Headless balance harness.
 *
 * Runs the real simulation — same tick function the game calls — for a
 * given number of in-game minutes and prints a timeline of what the
 * society did to itself. This is the tool for tuning the placeholder
 * numbers in `pipeline.js` / `society.js` without clicking through the
 * browser for ten minutes per experiment.
 *
 *   npm run sim              # 5 minutes, default seed
 *   npm run sim -- 20 1234   # 20 minutes, seed 1234
 */
import { ensureSeeded } from "../src/simulation/world.js";
import { stepSimulation, TICK_DT, TICK_RATE } from "../src/simulation/tick.js";
import { useGameStore } from "../src/state/useGameStore.js";
import { setSeed } from "../src/simulation/rng.js";
import { eventsEngine } from "../src/events/eventsEngine.js";

const minutes = Number(process.argv[2] ?? 5);
const seed = process.argv[3] ? Number(process.argv[3]) : null;

if (seed !== null) setSeed(seed);
ensureSeeded();

const totalTicks = Math.round(minutes * 60 * TICK_RATE);
const machineStates = new Map();
let reported = 0;

const pad = (value, width) => String(value).padStart(width);
const clock = (tick) => {
  const seconds = tick / TICK_RATE;
  return `${pad(Math.floor(seconds / 60), 2)}:${pad(
    Math.floor(seconds % 60),
    2
  ).replace(" ", "0")}`;
};

console.log(
  `GoldChain — ${minutes} min at ${TICK_RATE}Hz` +
    (seed !== null ? `, seed ${seed}` : ", default seed")
);
console.log("-".repeat(78));

for (let tick = 1; tick <= totalTicks; tick++) {
  stepSimulation(TICK_DT);

  // Report every machine state change: this is the run's story.
  for (const type of eventsEngine.actors.keys()) {
    const state = eventsEngine.stateOf(type);
    if (machineStates.get(type) !== state) {
      machineStates.set(type, state);
      if (tick > 1) {
        console.log(`${clock(tick)}  ${pad(type, 11)} -> ${state}`);
        reported++;
      }
    }
  }

  // A status line every 30 in-game seconds.
  if (tick % (TICK_RATE * 30) === 0) {
    const s = useGameStore.getState();
    console.log(
      `${clock(tick)}  rate ${s.currentRate.toFixed(3)}/${s.targetRate.toFixed(
        2
      )}  mood ${pad(s.deityMood.toFixed(0), 3)}  wellbeing ${pad(
        s.workerWellbeing.toFixed(0),
        3
      )}  corruption ${pad(s.corruption.toFixed(0), 3)}  stability ${pad(
        s.politicalStability.toFixed(0),
        3
      )}  coins ${s.coinsDelivered.toFixed(0)}`
    );
  }
}

const final = useGameStore.getState();
console.log("-".repeat(78));
console.log(`state changes:      ${reported}`);
console.log(`coins delivered:    ${final.coinsDelivered.toFixed(1)}`);
console.log(`taxed / stolen:     ${final.taxedTotal.toFixed(1)} / ${final.stolenTotal.toFixed(1)}`);
console.log(`longest streak:     ${final.longestStreakSeconds.toFixed(0)}s`);
console.log(`standing quota:     ${final.baseTargetRate.toFixed(2)} coins/sec`);
console.log(`final deity mood:   ${final.deityMood.toFixed(0)}/100`);
