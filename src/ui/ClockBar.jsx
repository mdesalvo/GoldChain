import { useGameStore } from "../state/useGameStore.js";
import { Icon } from "./parts.jsx";

// One in-game day per this many simulated seconds. Cosmetic: it gives the
// run a sense of duration that a bare coin counter doesn't.
const SECONDS_PER_DAY = 90;

function gameClock(elapsedSeconds) {
  const day = Math.floor(elapsedSeconds / SECONDS_PER_DAY) + 1;
  const minutesOfDay = Math.floor(
    ((elapsedSeconds % SECONDS_PER_DAY) / SECONDS_PER_DAY) * 24 * 60
  );
  const hour24 = Math.floor(minutesOfDay / 60);
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return {
    day,
    time: `${hour12}:${String(minutesOfDay % 60).padStart(2, "0")} ${
      hour24 < 12 ? "AM" : "PM"
    }`,
  };
}

/**
 * Top-centre-right: the clock and the time controls, where the concept
 * puts them.
 *
 * Speed multiplies how much elapsed time feeds the accumulator, never the
 * tick size, so 4× is the same simulation further along rather than a
 * coarser one.
 */
export function ClockBar({ showScene, onToggleScene }) {
  const elapsedSeconds = useGameStore((s) => s.elapsedSeconds);
  const paused = useGameStore((s) => s.paused);
  const speed = useGameStore((s) => s.speed);
  const togglePaused = useGameStore((s) => s.togglePaused);
  const setSpeed = useGameStore((s) => s.setSpeed);

  const { day, time } = gameClock(elapsedSeconds);

  return (
    <div className="clockbar">
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
          <span className="tbtn__pause" />
        </button>
        <button
          type="button"
          className={`tbtn${!paused && speed === 1 ? " tbtn--on" : ""}`}
          onClick={() => setSpeed(1)}
          title="Normal speed"
        >
          <Icon name="play" size="sm" alt="" />
        </button>
        <button
          type="button"
          className={`tbtn${!paused && speed === 2 ? " tbtn--on" : ""}`}
          onClick={() => setSpeed(2)}
          title="Double speed"
        >
          <Icon name="fastforward" size="sm" alt="" />
        </button>
        <button
          type="button"
          className={`tbtn${!paused && speed === 4 ? " tbtn--on" : ""}`}
          onClick={() => setSpeed(4)}
          title="Quadruple speed"
        >
          <span className="tbtn__x4">4×</span>
        </button>
        <button
          type="button"
          className={`tbtn${showScene ? " tbtn--on" : ""}`}
          onClick={onToggleScene}
          title={
            showScene
              ? "Back to the painted set"
              : "Show the live 3D simulation instead"
          }
        >
          <span className="tbtn__x4">{showScene ? "2D" : "3D"}</span>
        </button>
      </div>
    </div>
  );
}
