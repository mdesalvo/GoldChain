import { useGameStore } from "../state/useGameStore.js";
import { wrathLevel, WRATH } from "../simulation/deity.js";
import { Icon, Meter } from "./parts.jsx";

const MOOD_LABELS = {
  [WRATH.DELIGHTED]: "Delighted",
  [WRATH.CONTENT]: "Pleased",
  [WRATH.IMPATIENT]: "Impatient",
  [WRATH.ANGRY]: "Angry",
  [WRATH.WRATHFUL]: "Wrathful",
};

const MOOD_COLORS = {
  [WRATH.DELIGHTED]: "var(--gold-bright)",
  [WRATH.CONTENT]: "var(--good)",
  [WRATH.IMPATIENT]: "var(--warn)",
  [WRATH.ANGRY]: "var(--bad)",
  [WRATH.WRATHFUL]: "var(--bad)",
};

/**
 * Top-right: the concept's red FLOW INTERRUPTED box.
 *
 * It is the same panel in both states rather than one that appears in a
 * crisis, so its position is learned before it is ever needed — a warning
 * box that only exists when things are wrong has to be *found* at the
 * worst possible moment.
 */
export function AlertBox() {
  const flowMet = useGameStore((s) => s.flowMet);
  const currentRate = useGameStore((s) => s.currentRate);
  const targetRate = useGameStore((s) => s.targetRate);
  const deityMood = useGameStore((s) => s.deityMood);
  const bottleneck = useGameStore((s) => s.bottleneck);
  const streakSeconds = useGameStore((s) => s.streakSeconds);
  const coinsDelivered = useGameStore((s) => s.coinsDelivered);

  const mood = wrathLevel(deityMood);
  const wrath = Math.max(0, Math.min(100, 100 - deityMood));

  return (
    <div className={`panel alert${flowMet ? " alert--calm" : ""}`}>
      <div className="alert__head">
        <Icon name="bolt" size="sm" alt="" />
        {flowMet ? "Flow nominal" : "Flow interrupted!"}
      </div>

      <div className="alert__body">
        {flowMet
          ? `Tribute has been arriving for ${streakSeconds.toFixed(0)}s. ` +
            `${coinsDelivered.toFixed(0)} coins delivered so far.`
          : `The Deity is receiving ${currentRate.toFixed(
              3
            )} of ${targetRate.toFixed(3)}.` +
            (bottleneck ? ` The jam is at the ${bottleneck}.` : "")}
      </div>

      <Meter
        label="Wrath"
        value={wrath}
        color={wrath > 60 ? "var(--bad)" : "var(--warn)"}
        format={(v) => `${Math.round(v)}%`}
      />

      <div className="deity" style={{ "--mood": MOOD_COLORS[mood] }}>
        <img src="/art/deity.jpg" alt="The Celebrity Deity" />
        <div>
          <div className="deity__label">Deity mood</div>
          <div className="deity__value" style={{ color: MOOD_COLORS[mood] }}>
            {MOOD_LABELS[mood]}
          </div>
        </div>
      </div>
    </div>
  );
}
