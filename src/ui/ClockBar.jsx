import { useGameStore } from "../state/useGameStore.js";

/**
 * Top-right: the pause control, in the box the concept puts it in.
 */
export function ControlPanel() {
  const paused = useGameStore((s) => s.paused);
  const togglePaused = useGameStore((s) => s.togglePaused);

  return (
    <div className="panel timectl">
      <button
        type="button"
        className={`tbtn${paused ? " tbtn--on" : ""}`}
        onClick={togglePaused}
        title="Pause"
        >
        <span className="tbtn__pause" />
        </button>
    </div>
  );
}
