import { useGameStore } from "../state/useGameStore.js";

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
 * What just changed, under the alert box.
 *
 * The concept has no feed — its right column is alert and nothing else —
 * but a society this eventful needs one: the system cards say what the
 * state *is*, and nothing else would say what happened. Entries are
 * dismissible and capped in the store.
 */
export function FeedPanel() {
  const notifications = useGameStore((s) => s.notifications);
  const dismiss = useGameStore((s) => s.dismissNotification);

  if (notifications.length === 0) return null;

  return (
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
  );
}
