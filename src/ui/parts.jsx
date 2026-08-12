import { invokeAction } from "../simulation/playerActions.js";

/**
 * Shared UI primitives.
 *
 * Kept deliberately small and unopinionated: all the styling lives in
 * `theme.css`, so these only decide structure. Anything that needs a
 * new look gets a class, not a style prop.
 */

export function Icon({ name, size, alt = "" }) {
  return (
    <img
      className={`icon${size ? ` icon--${size}` : ""}`}
      src={`/art/icons/${name}.png`}
      alt={alt}
      draggable={false}
    />
  );
}

export function Meter({ label, value, max = 100, color, format }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="meter">
      <div className="meter__row">
        <span>{label}</span>
        <strong>{format ? format(value) : Math.round(value)}</strong>
      </div>
      <div className="meter__track">
        <div
          className="meter__fill"
          style={{ width: `${pct}%`, "--meter": color }}
        />
      </div>
    </div>
  );
}

/**
 * An action button.
 *
 * The disabled state has to carry its own explanation, because a greyed
 * button with no reason is the single most common way a strategy UI
 * becomes unreadable — the player cannot tell whether they are broke, on
 * cooldown, or looking at something that never applies.
 */
export function ActionButton({ action }) {
  if (!action) return null;

  const onCooldown = action.cooldown > 0;
  const reason = onCooldown
    ? `Ready in ${Math.ceil(action.cooldown)}s`
    : !action.enabled
    ? "Not possible right now, or not enough in the reserve"
    : `Costs ${action.cost} from the reserve`;

  return (
    <button
      type="button"
      className="action"
      disabled={!action.enabled}
      onClick={() => invokeAction(action.id)}
      title={`${action.hint}\n\n${reason}`}
    >
      {action.label}
      {onCooldown ? (
        <span className="action__cost">{Math.ceil(action.cooldown)}s</span>
      ) : action.cost > 0 ? (
        <span className="action__cost">{action.cost}</span>
      ) : null}
    </button>
  );
}

export function pickActions(actions, ids) {
  return ids.map((id) => actions.find((a) => a.id === id)).filter(Boolean);
}

/**
 * A single notification, shown where it happened rather than in a feed.
 *
 * Coloured by the card it's shown on (`--accent`, inherited from `.sys`)
 * rather than by tone, so a popup reads as "this is the union talking"
 * before it reads as good or bad news.
 *
 * Only the most recent one for a card is worth showing — a queue would
 * need its own dismiss/read state, and the point is that this expires on
 * its own (see `NOTIFICATION_TTL` in the store) a few seconds after the
 * thing it describes.
 */
export function Popup({ notification }) {
  if (!notification) return null;
  return <div className="sys__popup">{notification.message}</div>;
}
