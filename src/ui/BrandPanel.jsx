import { useGameStore } from "../state/useGameStore.js";
import { EVENT_TYPES } from "../events/eventTypes.js";
import { Icon } from "./parts.jsx";

/**
 * The title plate, top-left, where the concept has it.
 */
export function BrandPanel() {
  return (
    <div className="panel brandpanel__head">
      <Icon name="crown" size="lg" alt="" />
      <div>
        <div className="brand__name">GOLD CHAIN</div>
        <div className="brand__sub">Keep the Celebrity Deity happy</div>
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
  const activeEvents = useGameStore((s) => s.activeEvents);

  // Only a law can move the target off the standing quota (see
  // legislationModifiers — only "enacted" ever sets targetRateBonus),
  // so this diff doubles as "is one live right now" without needing to
  // separately track which law kind is in force.
  const legislated = targetRate > baseTargetRate;
  const law = activeEvents.find((e) => e.type === EVENT_TYPES.LEGISLATION);

  return (
    <div className="panel brandpanel__flow">
      <div
        className="flowline"
        title="What is actually leaving the reserve for the Deity right now. The reserve keeps this smooth even if the chain behind it stalls — the stress shows up in the reserve's own balance and cover time first, this number only slips once it runs dry."
      >
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

      <div
        className="flowline flowline--target"
        title="What the Deity currently demands: the standing quota (raised only by long clean streaks, never lowered) plus whatever a currently active law temporarily adds on top."
      >
        <div>
          <div className="flow__label">Flow target</div>
          <div className="flow__target">{targetRate.toFixed(3)}</div>
          <div className="flow__unit">
            {legislated ? "legislated quota" : "coins / sec"}
            {legislated && law && (
              <i
                className="flow__lawhint"
                title={`${law.label}\n${law.detail}`}
              />
            )}
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
