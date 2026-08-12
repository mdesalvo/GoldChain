import { useGameStore } from "../state/useGameStore.js";
import { Icon } from "./parts.jsx";

/**
 * Top-left, as in the concept: the title, then the number the whole game
 * is about, then what is being demanded of it.
 *
 * The two flow readouts are stacked rather than side by side because that
 * is what makes the comparison instant — same column, same alignment, one
 * above the other.
 */
export function BrandPanel() {
  const currentRate = useGameStore((s) => s.currentRate);
  const targetRate = useGameStore((s) => s.targetRate);
  const baseTargetRate = useGameStore((s) => s.baseTargetRate);
  const flowMet = useGameStore((s) => s.flowMet);

  return (
    <div className="brandpanel">
      <div className="panel brandpanel__head">
        <Icon name="crown" size="lg" alt="" />
        <div>
          <div className="brand__name">DIVINE FLOW</div>
          <div className="brand__sub">Keep the Celebrity Deity happy.</div>
        </div>
      </div>

      <div className="panel brandpanel__flow">
        <div className="flowline">
          <div className="flow__label">Current flow</div>
          <div
            className={`flow__value ${
              flowMet ? "flow__value--ok" : "flow__value--off"
            }`}
          >
            {currentRate.toFixed(3)}
          </div>
          <div className="flow__unit">coins / sec</div>
        </div>

        <div className="flowline flowline--target">
          <div>
            <div className="flow__label">Flow target</div>
            <div className="flow__target">{targetRate.toFixed(3)}</div>
            <div className="flow__unit">
              {targetRate > baseTargetRate ? "legislated quota" : "coins / sec"}
            </div>
          </div>
          {flowMet ? (
            <Icon name="check" size="lg" alt="Target met" />
          ) : (
            <span className="flow__miss" title="Tribute is short">
              ✕
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
