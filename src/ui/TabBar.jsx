import { useGameStore } from "../state/useGameStore.js";
import { Icon } from "./parts.jsx";

/**
 * The bottom bar.
 *
 * Overview is the only tab that exists; the rest are in the concept art
 * and are shown disabled with a "soon" marker rather than omitted. A
 * visible, honestly-labelled gap tells the player (and the next
 * contributor) what the shape of the finished game is — a hidden one just
 * looks finished and isn't.
 */
const TABS = [
  { id: "overview", label: "Overview", icon: "overview", ready: true },
  { id: "build", label: "Build", icon: "build" },
  { id: "workers", label: "Workers", icon: "workers" },
  { id: "research", label: "Research", icon: "research" },
  { id: "decrees", label: "Decrees", icon: "decrees" },
  { id: "stats", label: "Stats", icon: "stats" },
  { id: "achievements", label: "Achievements", icon: "achievements" },
];

export function TabBar() {
  const coinsDelivered = useGameStore((s) => s.coinsDelivered);
  const longestStreak = useGameStore((s) => s.longestStreakSeconds);

  return (
    <div className="panel tabs">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`tab${tab.ready ? " tab--on" : ""}`}
          disabled={!tab.ready}
          title={tab.ready ? tab.label : `${tab.label} — not built yet`}
        >
          <Icon name={tab.icon} size="sm" alt="" />
          {tab.label}
          {!tab.ready && <span className="tab__soon">soon</span>}
        </button>
      ))}

      <div className="tabs__spacer" />

      <div className="purse" title="Best unbroken run of meeting the quota">
        <Icon name="banana" size="sm" alt="" />
        {longestStreak.toFixed(0)}s
      </div>
      <div className="purse" title="Total coin delivered to the Deity">
        <Icon name="coin" size="sm" alt="" />
        {coinsDelivered < 1000
          ? coinsDelivered.toFixed(0)
          : `${(coinsDelivered / 1000).toFixed(2)}K`}
      </div>
    </div>
  );
}
