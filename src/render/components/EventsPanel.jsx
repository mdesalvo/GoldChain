import { useGameStore } from "../../state/useGameStore.js";
import { invokeAction } from "../../simulation/playerActions.js";
import { EVENT_TYPES } from "../../events/eventTypes.js";

const TYPE_LABELS = {
  [EVENT_TYPES.STRIKE]: "Labour",
  [EVENT_TYPES.BREAKDOWN]: "Machinery",
  [EVENT_TYPES.MAFIA_RAID]: "Security",
  [EVENT_TYPES.LEGISLATION]: "Politics",
  medical: "Medical",
  chain: "Chain",
  deity: "Deity",
};

const SEVERITY_COLORS = ["#8a8a8a", "#e8c15a", "#e8874a", "#d0574d"];

// Rows the player can act on that have no disruption machine behind
// them — the hospital, the chain itself, and appeasing the Deity.
const STANDING_SYSTEMS = ["medical", "chain", "deity"];

/**
 * Live readout of the events engine plus the actions attached to each
 * system.
 *
 * A row is always present even when nothing is happening, because the
 * idle text carries the warning signal — "grievance 80%" is the only
 * notice a player gets before a strike, and hiding it until the strike
 * lands would make disruptions feel arbitrary.
 */
export function EventsPanel() {
  const activeEvents = useGameStore((s) => s.activeEvents);
  const actions = useGameStore((s) => s.actions);

  if (activeEvents.length === 0) return null;

  const actionsFor = (system) => actions.filter((a) => a.system === system);

  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        right: 16,
        width: 292,
        color: "#fff",
        fontFamily: "system-ui, sans-serif",
        background: "rgba(0,0,0,0.55)",
        padding: "12px 14px",
        borderRadius: 8,
        backdropFilter: "blur(2px)",
        maxHeight: "calc(100vh - 32px)",
        overflowY: "auto",
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.7, letterSpacing: 1 }}>SYSTEMS</div>

      {activeEvents.map((event) => (
        <SystemRow
          key={event.type}
          accent={SEVERITY_COLORS[Math.min(event.severity, 3)]}
          tag={TYPE_LABELS[event.type]}
          label={event.label}
          detail={event.detail}
          dim={event.idle}
          actions={actionsFor(event.type)}
        />
      ))}

      {STANDING_SYSTEMS.map((system) => (
        <SystemRow
          key={system}
          accent="#6a6a6a"
          tag={TYPE_LABELS[system]}
          label={STANDING_LABELS[system]}
          detail={STANDING_HINTS[system]}
          dim
          actions={actionsFor(system)}
        />
      ))}
    </div>
  );
}

const STANDING_LABELS = {
  medical: "Hospital",
  chain: "Workforce",
  deity: "Appeasement",
};

const STANDING_HINTS = {
  medical: "Treatment capacity is shared across everyone waiting.",
  chain: "Every societal monkey is a monkey not on the gold.",
  deity: "Coin buys mood. It does not buy patience.",
};

function SystemRow({ accent, tag, label, detail, dim, actions }) {
  return (
    <div
      style={{
        marginTop: 10,
        paddingLeft: 8,
        borderLeft: `2px solid ${accent}`,
        opacity: dim ? 0.72 : 1,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 6,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 9, opacity: 0.5, letterSpacing: 1 }}>{tag}</span>
      </div>
      <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}>{detail}</div>
      {actions.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5 }}>
          {actions.map((action) => (
            <ActionButton key={action.id} action={action} />
          ))}
        </div>
      )}
    </div>
  );
}

function ActionButton({ action }) {
  const onCooldown = action.cooldown > 0;

  return (
    <button
      type="button"
      disabled={!action.enabled}
      onClick={() => invokeAction(action.id)}
      title={`${action.hint}${
        action.cost > 0 ? ` (costs ${action.cost} from the reserve)` : ""
      }`}
      style={{
        padding: "3px 8px",
        fontSize: 10,
        color: action.enabled ? "#fff" : "rgba(255,255,255,0.35)",
        background: action.enabled
          ? "rgba(232,193,90,0.18)"
          : "rgba(255,255,255,0.05)",
        border: `1px solid ${
          action.enabled ? "rgba(232,193,90,0.5)" : "rgba(255,255,255,0.12)"
        }`,
        borderRadius: 4,
        cursor: action.enabled ? "pointer" : "default",
        whiteSpace: "nowrap",
      }}
    >
      {action.label}
      {onCooldown ? ` ${Math.ceil(action.cooldown)}s` : ""}
      {action.cost > 0 && !onCooldown && (
        <span style={{ opacity: 0.6 }}> · {action.cost}</span>
      )}
    </button>
  );
}
