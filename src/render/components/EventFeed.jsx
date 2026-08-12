import { useGameStore } from "../../state/useGameStore.js";

const TONE_STYLES = {
  good: { border: "#4dd07a", icon: "✓" },
  bad: { border: "#d0574d", icon: "!" },
  warn: { border: "#e8c15a", icon: "⚠" },
  info: { border: "#7aa7d0", icon: "·" },
  law: { border: "#8e6ad0", icon: "§" },
  deity: { border: "#ffd700", icon: "☼" },
  wrath: { border: "#ff3b3b", icon: "☠" },
};

/**
 * Notification feed for one-shot events.
 *
 * Deliberately separate from the systems panel: that panel answers
 * "what is the state of things", this one answers "what just changed".
 * Entries are dismissible and capped in the store, so a long chaotic
 * run can't grow the overlay without bound.
 */
export function EventFeed() {
  const notifications = useGameStore((s) => s.notifications);
  const dismiss = useGameStore((s) => s.dismissNotification);

  if (notifications.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 16,
        left: 16,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        maxWidth: 420,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {notifications.map((note) => {
        const tone = TONE_STYLES[note.tone] ?? TONE_STYLES.info;
        return (
          <div
            key={note.id}
            onClick={() => dismiss(note.id)}
            style={{
              display: "flex",
              gap: 8,
              alignItems: "baseline",
              color: "#fff",
              fontSize: 12,
              background: "rgba(0,0,0,0.6)",
              borderLeft: `3px solid ${tone.border}`,
              padding: "7px 11px",
              borderRadius: "0 6px 6px 0",
              cursor: "pointer",
            }}
            title="Dismiss"
          >
            <span style={{ color: tone.border }}>{tone.icon}</span>
            <span>{note.message}</span>
          </div>
        );
      })}
    </div>
  );
}
