import { useGameStore } from "../state/useGameStore.js";
import { wrathLevel, WRATH } from "../simulation/deity.js";
import { ActionButton, Icon, Meter, pickActions } from "./parts.jsx";

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

const TONE_MARKS = {
  good: { mark: "✓", color: "var(--good)" },
  bad: { mark: "!", color: "var(--bad)" },
  warn: { mark: "▲", color: "var(--warn)" },
  info: { mark: "·", color: "var(--politics)" },
  law: { mark: "§", color: "var(--union)" },
  deity: { mark: "☼", color: "var(--gold-bright)" },
  wrath: { mark: "☠", color: "var(--bad)" },
};

/**
 * The right rail: what is going wrong, how much cover is left, and what
 * just happened.
 *
 * Ordered by how urgently the player needs it. The alert comes first
 * because it is the thing that ends the run, the reserve second because
 * it is the thing that buys time, and the feed last because it is
 * history.
 */
export function AlertRail() {
  const currentRate = useGameStore((s) => s.currentRate);
  const targetRate = useGameStore((s) => s.targetRate);
  const deityMood = useGameStore((s) => s.deityMood);
  const reserves = useGameStore((s) => s.reserves);
  const reserveCapacity = useGameStore((s) => s.reserveCapacity);
  const bottleneck = useGameStore((s) => s.bottleneck);
  const taxedTotal = useGameStore((s) => s.taxedTotal);
  const stolenTotal = useGameStore((s) => s.stolenTotal);
  const streakSeconds = useGameStore((s) => s.streakSeconds);
  const coinsDelivered = useGameStore((s) => s.coinsDelivered);
  const notifications = useGameStore((s) => s.notifications);
  const actions = useGameStore((s) => s.actions);
  const dismiss = useGameStore((s) => s.dismissNotification);

  const met = currentRate >= targetRate - 0.02;
  const mood = wrathLevel(deityMood);
  const wrath = Math.max(0, Math.min(100, 100 - deityMood));
  const cover = reserves / Math.max(0.01, targetRate);

  return (
    <div>
      <div className={`panel alert${met && mood !== WRATH.WRATHFUL ? " alert--calm" : ""}`}>
        <div className="alert__head">
          {met ? "⚡ Flow nominal" : "⚡ Flow interrupted"}
        </div>
        <div className="alert__body">
          {met
            ? `Tribute has been arriving for ${streakSeconds.toFixed(0)}s. ${
                coinsDelivered.toFixed(0)
              } coins delivered so far.`
            : `The Deity is receiving ${currentRate.toFixed(3)} of ${targetRate.toFixed(
                3
              )}.${bottleneck ? ` The jam is at the ${bottleneck}.` : ""}`}
        </div>
        <div className="deity" style={{ "--mood": MOOD_COLORS[mood] }}>
          <img src="/art/deity.jpg" alt="The Celebrity Deity" />
          <div>
            <div className="deity__label">Deity mood</div>
            <div className="deity__value" style={{ color: MOOD_COLORS[mood] }}>
              {MOOD_LABELS[mood]}
            </div>
          </div>
        </div>
        <Meter
          label="Wrath"
          value={wrath}
          color={wrath > 60 ? "var(--bad)" : "var(--warn)"}
          format={(v) => `${Math.round(v)}%`}
        />
      </div>

      <div className="panel reserve">
        <div className="panel__title">
          <Icon name="chest" size="sm" alt="" />
          Reserves
        </div>
        <div className="reserve__row">
          <div
            className="reserve__value"
            style={{ color: cover < 6 ? "var(--bad)" : "var(--gold-bright)" }}
          >
            {reserves.toFixed(1)}
          </div>
          <div className="reserve__cover">
            of {reserveCapacity}
            <br />
            {cover.toFixed(0)}s of cover
          </div>
        </div>
        <div className="sys__actions">
          {pickActions(actions, ["emergency-pay"]).map((action) => (
            <ActionButton key={action.id} action={action} />
          ))}
        </div>
        <div className="alert__body">
          Skimmed by law: {taxedTotal.toFixed(1)} · stolen: {stolenTotal.toFixed(1)}
        </div>
      </div>

      {notifications.length > 0 && (
        <div className="feed">
          {notifications.map((note) => {
            const tone = TONE_MARKS[note.tone] ?? TONE_MARKS.info;
            return (
              <div
                key={note.id}
                className="feed__item"
                style={{ "--tone": tone.color }}
                onClick={() => dismiss(note.id)}
                title="Dismiss"
              >
                <span className="feed__mark">{tone.mark}</span>
                <span>{note.message}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
