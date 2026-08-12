import { useGameStore } from "../../state/useGameStore.js";
import { eventsEngine } from "../../events/eventsEngine.js";
import { EVENT_TYPES } from "../../events/eventTypes.js";

const TYPE_LABELS = {
  [EVENT_TYPES.STRIKE]: "Labour",
  [EVENT_TYPES.BREAKDOWN]: "Machinery",
  [EVENT_TYPES.MAFIA_RAID]: "Security",
  [EVENT_TYPES.LEGISLATION]: "Politics",
};

const SEVERITY_COLORS = ["#8a8a8a", "#e8c15a", "#e8874a", "#d0574d"];

/**
 * Live readout of the events engine: one row per disruption machine,
 * showing which state it is in right now.
 *
 * The row is always present even when nothing is happening, because the
 * idle text carries the warning signal — "grievance 80%" is the only
 * notice a player gets before a strike, and hiding it until the strike
 * lands would make disruptions feel arbitrary.
 *
 * The trigger buttons force a machine to the start of its lifecycle.
 * They exist for testing and scripted scenarios: a forced event still
 * has to run its whole course, so this cannot skip the rules.
 */
export function EventsPanel() {
  const activeEvents = useGameStore((s) => s.activeEvents);
  if (activeEvents.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        right: 16,
        width: 260,
        color: "#fff",
        fontFamily: "system-ui, sans-serif",
        background: "rgba(0,0,0,0.55)",
        padding: "12px 14px",
        borderRadius: 8,
        backdropFilter: "blur(2px)",
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.7, letterSpacing: 1 }}>
        SYSTEMS
      </div>

      {activeEvents.map((event) => (
        <div
          key={event.type}
          style={{
            marginTop: 10,
            paddingLeft: 8,
            borderLeft: `2px solid ${
              SEVERITY_COLORS[Math.min(event.severity, 3)]
            }`,
            opacity: event.idle ? 0.6 : 1,
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
            <span style={{ fontSize: 13, fontWeight: 600 }}>{event.label}</span>
            <span style={{ fontSize: 9, opacity: 0.5, letterSpacing: 1 }}>
              {TYPE_LABELS[event.type]}
            </span>
          </div>
          <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}>
            {event.detail}
          </div>
          {event.idle && <TriggerButton type={event.type} />}
        </div>
      ))}
    </div>
  );
}

function TriggerButton({ type }) {
  return (
    <button
      type="button"
      onClick={() => eventsEngine.force(type, useGameStore.getState())}
      style={{
        marginTop: 5,
        padding: "2px 7px",
        fontSize: 10,
        color: "#fff",
        background: "rgba(255,255,255,0.1)",
        border: "1px solid rgba(255,255,255,0.2)",
        borderRadius: 4,
        cursor: "pointer",
      }}
    >
      trigger
    </button>
  );
}
