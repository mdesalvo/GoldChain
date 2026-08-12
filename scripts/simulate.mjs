/**
 * Headless balance harness.
 *
 * Runs the real simulation — same tick function the game calls — for a
 * given number of in-game minutes and prints a timeline of what the
 * society did to itself. This is the tool for tuning the placeholder
 * numbers in `pipeline.js` / `society.js` without clicking through the
 * browser for ten minutes per experiment.
 *
 *   npm run sim                      # 5 minutes, default seed, no player
 *   npm run sim -- 20 1234           # 20 minutes, seed 1234
 *   npm run sim -- 20 1234 invest    # ...with an investing player
 *
 * The strategies exist to test the central design claim: that
 * neglecting the systemic layer maximises short-term flow and makes the
 * society fragile, while investing costs throughput and buys survival.
 * If `exploit` ever out-performs `invest` over a long run, the
 * trade-off is broken and the numbers need moving — that is exactly the
 * kind of regression this harness is for.
 */
import { ensureSeeded } from "../src/simulation/world.js";
import { stepSimulation, TICK_DT, TICK_RATE } from "../src/simulation/tick.js";
import { useGameStore } from "../src/state/useGameStore.js";
import { setSeed } from "../src/simulation/rng.js";
import { PIPELINE_ORDER, ableWorkerCount, allMonkeys } from "../src/simulation/world.js";
import { eventsEngine } from "../src/events/eventsEngine.js";
import { invokeAction, actionSnapshot } from "../src/simulation/playerActions.js";
import { treasury } from "../src/simulation/pipeline.js";

const chainWorkforce = () =>
  PIPELINE_ORDER.reduce((sum, role) => sum + ableWorkerCount(role), 0);

const minutes = Number(process.argv[2] ?? 5);
const seed = process.argv[3] ? Number(process.argv[3]) : null;
const strategy = process.argv[4] ?? "watch";

/**
 * Priority lists, tried in order once a second. Every strategy takes
 * whatever crisis response is available first — nobody sensibly ignores
 * a live strike — and they differ in what they do with spare reserve.
 *
 * `invest` is guarded rather than greedy. An unguarded version strips
 * the chain to fund the hospital and then cannot meet the quota at all,
 * which measures the strategy's stupidity instead of the game's balance.
 * A competent player keeps a floor under both the workforce and the
 * reserve, and only then buys resilience.
 */
const CHAIN_FLOOR = 20; // don't retrain below this many chain workers
const RESERVE_FLOOR = 18; // don't spend cover down to nothing

const RETRAINING = new Set(["fund-union", "staff-hospital", "hire-police"]);

const STRATEGIES = {
  watch: [],
  invest: [
    "negotiate",
    "crackdown",
    "investigate",
    "fund-union",
    "staff-hospital",
    "hire-police",
    "emergency-pay",
  ],
  exploit: ["emergency-pay", "back-to-work"],
};

function allowed(id) {
  if (!RETRAINING.has(id)) return true;
  return (
    chainWorkforce() > CHAIN_FLOOR && treasury.reserves >= RESERVE_FLOOR
  );
}

if (!STRATEGIES[strategy]) {
  console.error(`unknown strategy "${strategy}" — use watch, invest or exploit`);
  process.exit(1);
}

let actionsTaken = 0;

function playOneSecond() {
  const priorities = STRATEGIES[strategy];
  if (priorities.length === 0) return;

  const snapshot = actionSnapshot(useGameStore.getState());
  for (const id of priorities) {
    const action = snapshot.find((a) => a.id === id);
    if (action?.enabled && allowed(id)) {
      invokeAction(id);
      actionsTaken++;
      return; // one decision per second, like a human would
    }
  }
}

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
    (seed !== null ? `, seed ${seed}` : ", default seed") +
    `, player: ${strategy}`
);
console.log("-".repeat(78));

for (let tick = 1; tick <= totalTicks; tick++) {
  stepSimulation(TICK_DT);
  if (tick % TICK_RATE === 0) playOneSecond();

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
console.log(`actions taken:      ${actionsTaken}`);
console.log(`chain workforce:    ${chainWorkforce()} of ${allMonkeys.size}`);
console.log(`coins delivered:    ${final.coinsDelivered.toFixed(1)}`);
console.log(`taxed / stolen:     ${final.taxedTotal.toFixed(1)} / ${final.stolenTotal.toFixed(1)}`);
console.log(`longest streak:     ${final.longestStreakSeconds.toFixed(0)}s`);
console.log(`standing quota:     ${final.baseTargetRate.toFixed(2)} coins/sec`);
console.log(`final deity mood:   ${final.deityMood.toFixed(0)}/100`);
