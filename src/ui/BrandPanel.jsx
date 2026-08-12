import { useGameStore } from "../state/useGameStore.js";
import { Icon } from "./parts.jsx";

/**
 * The title plate, top-left, where the concept has it.
 */
export function BrandPanel() {
  return (
    <div className="panel brandpanel__head">
      <Icon name="crown" size="lg" alt="" />
      <div>
        <div className="brand__name">DIVINE FLOW</div>
        <div className="brand__sub">Keep the Celebrity Deity happy.</div>
      </div>
    </div>
  );
}

/**
 * Current flow over flow target, stacked in one panel under the title.
 *
 * Stacked rather than side by side because that is what makes the
 * comparison instant: same column, same alignment, one above the other.
 */
export function FlowPanel() {
  const currentRate = useGameStore((s) => s.currentRate);
  const targetRate = useGameStore((s) => s.targetRate);
  const baseTargetRate = useGameStore((s) => s.baseTargetRate);
  const flowMet = useGameStore((s) => s.flowMet);

  return (
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
  );
}
