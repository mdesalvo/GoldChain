import { useGameStore } from "../state/useGameStore.js";
import { Icon } from "./parts.jsx";

// One in-game day per this many simulated seconds. Purely cosmetic — it
// gives the run a sense of duration, which a bare coin counter doesn't.
const SECONDS_PER_DAY = 90;

function gameClock(elapsedSeconds) {
  const day = Math.floor(elapsedSeconds / SECONDS_PER_DAY) + 1;
  const fraction = (elapsedSeconds % SECONDS_PER_DAY) / SECONDS_PER_DAY;
  const minutesOfDay = Math.floor(fraction * 24 * 60);
  const hour24 = Math.floor(minutesOfDay / 60);
  const minute = minutesOfDay % 60;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const suffix = hour24 < 12 ? "AM" : "PM";
  return {
    day,
    time: `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`,
  };
}

/**
 * The top bar carries the only number that matters and the controls that
 * change how fast it moves. Everything else in the UI is context for it.
 */
export function TopBar() {
  const currentRate = useGameStore((s) => s.currentRate);
  const targetRate = useGameStore((s) => s.targetRate);
  const baseTargetRate = useGameStore((s) => s.baseTargetRate);
  const elapsedSeconds = useGameStore((s) => s.elapsedSeconds);
  const paused = useGameStore((s) => s.paused);
  const speed = useGameStore((s) => s.speed);
  const togglePaused = useGameStore((s) => s.togglePaused);
  const setSpeed = useGameStore((s) => s.setSpeed);

  const met = currentRate >= targetRate - 0.02;
  const { day, time } = gameClock(elapsedSeconds);

  return (
    <div className="topbar">
      <div className="panel brand">
        <Icon name="crown" size="lg" alt="" />
        <div>
          <div className="brand__name">DIVINE FLOW</div>
          <div className="brand__sub">Keep the Celebrity Deity happy.</div>
        </div>
      </div>

      <div className="panel flow">
        <div className="flow__block">
          <div className="flow__label">Current flow</div>
          <div
            className={`flow__value ${met ? "flow__value--ok" : "flow__value--off"}`}
          >
            {currentRate.toFixed(3)}
          </div>
          <div className="flow__unit">coins / sec</div>
        </div>

        <div className="flow__verdict" title={met ? "Tribute is arriving" : "Tribute is short"}>
          {met ? "✓" : "✕"}
        </div>

        <div className="flow__block">
          <div className="flow__label">Flow target</div>
          <div className="flow__target">{targetRate.toFixed(3)}</div>
          <div className="flow__unit">
            {targetRate > baseTargetRate ? "legislated quota" : "coins / sec"}
          </div>
        </div>
      </div>

      <div className="topbar__spacer" />

      <div className="panel clock">
        <span className="clock__day">Day {day}</span>
        <span className="clock__time">{time}</span>
      </div>

      <div className="panel timectl">
        <button
          type="button"
          className={`tbtn${paused ? " tbtn--on" : ""}`}
          onClick={togglePaused}
          title="Pause"
        >
          ❙❙
        </button>
        {[1, 2, 4].map((multiplier) => (
          <button
            key={multiplier}
            type="button"
            className={`tbtn${!paused && speed === multiplier ? " tbtn--on" : ""}`}
            onClick={() => setSpeed(multiplier)}
            title={`${multiplier}× speed`}
          >
            {multiplier}×
          </button>
        ))}
      </div>
    </div>
  );
}
