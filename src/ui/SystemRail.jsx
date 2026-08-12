import { useGameStore } from "../state/useGameStore.js";
import { EVENT_TYPES } from "../events/eventTypes.js";
import { ActionButton, Icon, Meter, pickActions } from "./parts.jsx";

/**
 * The left rail: one card per societal system, each showing the metric
 * the player is actually managing, what that system is doing right now,
 * and the buttons that let them do something about it.
 *
 * Layout and content follow the concept art: metric first, state second,
 * actions last, five cards. The art plate behind each card comes from the
 * matching region of the concept's cross-section, so a card looks like the
 * place it governs.
 *
 * There is no machinery card, also as in the concept: a breakdown shows up
 * on the stage card that stopped, as a badge on the set, and in the feed.
 * A sixth card for it pushed the rail past the bottom of the window, which
 * cost more than it explained.
 */

// States that mean "this system is currently a problem".
const HOT_STATES = new Set([
  "brewing",
  "active",
  "negotiating",
  "broken",
  "repairing",
  "casing",
  "raiding",
]);

export function SystemRail() {
  const events = useGameStore((s) => s.activeEvents);
  const actions = useGameStore((s) => s.actions);
  const wellbeing = useGameStore((s) => s.workerWellbeing);
  const corruption = useGameStore((s) => s.corruption);
  const stability = useGameStore((s) => s.politicalStability);
  const injured = useGameStore((s) => s.injuredCount);
  const capacity = useGameStore((s) => s.treatmentCapacity);
  const siphonRate = useGameStore((s) => s.siphonRate);

  const eventOf = (type) => events.find((e) => e.type === type);
  const strike = eventOf(EVENT_TYPES.STRIKE);
  const law = eventOf(EVENT_TYPES.LEGISLATION);
  const raid = eventOf(EVENT_TYPES.MAFIA_RAID);

  return (
    <div>
      <SystemCard
        icon="union"
        name="Union"
        accent="var(--union)"
        plate="union"
        event={strike}
        actions={pickActions(actions, [
          "negotiate",
          "fund-union",
          "back-to-work",
        ])}
      >
        <Meter label="Worker wellbeing" value={wellbeing} color="var(--good)" />
      </SystemCard>

      <SystemCard
        icon="politicians"
        name="Politicians"
        accent="var(--politics)"
        plate="politicians"
        event={law}
        actions={pickActions(actions, ["back-bill", "block-bill"])}
      >
        <Meter
          label="Political stability"
          value={stability}
          color="var(--politics)"
        />
      </SystemCard>

      <SystemCard
        icon="medical"
        name="Medical corps"
        accent="var(--medical)"
        plate="hospital"
        detail={
          injured === 0
            ? "No casualties waiting. Capacity is idle, and paid for anyway."
            : `${injured} monkey${injured === 1 ? "" : "s"} waiting for treatment.`
        }
        actions={pickActions(actions, ["staff-hospital"])}
      >
        <Meter
          label="Treatment capacity"
          value={capacity}
          max={120}
          color="var(--medical)"
          format={(v) => Math.round(v)}
        />
      </SystemCard>

      <SystemCard
        icon="police"
        name="Police"
        accent="var(--security)"
        plate="police"
        event={raid}
        actions={pickActions(actions, [
          "crackdown",
          "investigate",
          "hire-police",
        ])}
      >
        <Meter label="Corruption" value={corruption} color="var(--bad)" />
      </SystemCard>

      <SystemCard
        icon="mafiosi"
        name="Mafiosi"
        accent="var(--mafia)"
        plate="mafia"
        detail={
          siphonRate > 0
            ? `Siphoning ${siphonRate.toFixed(3)} units/sec out of the convoys.`
            : "Quiet. Watching the buffers fill, waiting for a jam."
        }
      />

    </div>
  );
}

function SystemCard({
  icon,
  name,
  accent,
  plate,
  plateDir = "sys",
  event,
  detail,
  actions = [],
  children,
}) {
  const hot = event ? HOT_STATES.has(event.state) : false;
  const text = detail ?? event?.detail ?? "";

  return (
    <div
      className={`panel sys${hot ? " sys--hot" : ""}`}
      style={{ "--accent": accent }}
    >
      {plate && (
        <>
          <div
            className="sys__plate"
            style={{ "--plate": `url(/art/${plateDir}/${plate}.jpg)` }}
          />
          <div className="sys__wash" />
        </>
      )}

      <div className="sys__head">
        <Icon name={icon} />
        <span className="sys__name">{name}</span>
        {event && (
          <span className={`sys__state${hot ? " sys__state--hot" : ""}`}>
            {event.label}
          </span>
        )}
      </div>

      {children}

      <div className="sys__detail">{text}</div>

      {actions.length > 0 && (
        <div className="sys__actions">
          {actions.map((action) => (
            <ActionButton key={action.id} action={action} />
          ))}
        </div>
      )}
    </div>
  );
}
