import { useGameStore } from "../state/useGameStore.js";
import { EVENT_TYPES } from "../events/eventTypes.js";
import { ActionButton, Icon, Meter, pickActions, Popup } from "./parts.jsx";

// Where an engine-generated notification (a strike/law/raid transition,
// an injury) puts it — there's no button to anchor these to, so they
// route on the event type itself.
const SYSTEM_CARD = {
  [EVENT_TYPES.STRIKE]: "union",
  [EVENT_TYPES.LEGISLATION]: "politicians",
  medical: "medical",
  [EVENT_TYPES.MAFIA_RAID]: "police",
};

// Where a player action's outcome puts it: the card its button is listed
// under (mirrors the `pickActions` groupings below), not the action's
// `system` tag. The two disagree for "back-to-work" (labelled Rehire) —
// it lives on the Union card but its system is "chain", since it moves a
// worker out of any societal role, not just the union's — so routing has
// to key off the button the player actually clicked.
const ACTION_CARD = {
  negotiate: "union",
  "fund-union": "union",
  "back-to-work": "union",
  "back-bill": "politicians",
  "block-bill": "politicians",
  "staff-hospital": "medical",
  crackdown: "police",
  investigate: "police",
  "hire-police": "police",
};

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
 * There is no shared activity log. What just happened shows up as a popup
 * on the card it happened to — negotiate a strike and the message appears
 * on Union, not in a feed you have to cross-reference back to a card
 * yourself. A player action's outcome routes through `ACTION_CARD` (the
 * button the player clicked); an engine-only notification, with no button
 * behind it, falls back to `SYSTEM_CARD` (the event type). A notification
 * with no entry in either — the Deity's, a machinery breakdown — has no
 * card to land on and is simply never shown, on the assumption that its
 * own readout (mood/wrath, the stage card) already says so. Each popup
 * clears itself a few seconds after it appears (`NOTIFICATION_TTL` in the
 * store), so there's nothing here to dismiss.
 *
 * Five institutions: Union, Politicians, Medical corps, Police, and the
 * Mafiosi — the last sitting directly under Police, in red, because it is
 * the operation their card exists to counter. The mafia has nothing the
 * player can click on directly (there's no "bribe" or "join" action), and
 * no notifications route to it either — the police-side actions that touch
 * the same raid land on Police instead. It is still a full card rather
 * than a readout, because it is as much a corporation as the others, just
 * one nobody funds on purpose.
 *
 * There is no machinery card: a breakdown shows up on the stage card that
 * stopped and as a badge on the set.
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
  const notifications = useGameStore((s) => s.notifications);
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

  // The latest live notification addressed to each card, if any. A
  // player action's own button wins the routing when it disagrees with
  // its `system` tag; engine-only notifications fall back to that tag.
  const latestFor = (cardKey) => {
    for (let i = notifications.length - 1; i >= 0; i--) {
      const n = notifications[i];
      const card = ACTION_CARD[n.actionId] ?? SYSTEM_CARD[n.system];
      if (card === cardKey) return n;
    }
    return null;
  };

  return (
    <div>
      <SystemCard
        icon="union"
        name="Union"
        description="Unionizers: retrained chain workers who represent the workforce. Keep wellbeing up and they keep the chain calm; starve it too long and grievance boils over into a strike — the one thing on this rail that can stop the flow outright."
        accent="var(--union)"
        plate="union"
        event={strike}
        popup={latestFor("union")}
        actions={pickActions(actions, [
          "negotiate",
          "fund-union",
          "back-to-work",
        ])}
      >
        <Meter label="Worker wellbeing" value={wellbeing} color="var(--union)" />
      </SystemCard>

      <SystemCard
        icon="politicians"
        name="Politicians"
        description="Politicians legislate at runtime — a tribute tax, a production quota, safety regulations, a union crackdown. Every law is a real trade-off folded into the whole chain's numbers, never a straight upgrade."
        accent="var(--politics)"
        plate="politicians"
        event={law}
        popup={latestFor("politicians")}
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
        description="Doctors and nurses treat injuries from mine collapses and furnace accidents. Treatment capacity is shared across everyone waiting, so an understaffed ward doesn't just heal slower — it lets a backlog quietly strip workers off the chain."
        accent="var(--medical)"
        plate="hospital"
        detail={
          injured === 0
            ? "No casualties waiting. Capacity is idle, and paid for anyway."
            : `${injured} monkey${injured === 1 ? "" : "s"} waiting for treatment.`
        }
        popup={latestFor("medical")}
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
        description="Police are the security layer against the Mafiosi. Weak policing lets corruption settle in, and corruption is what lets the mafia siphon gold out of mid-chain buffers unpunished."
        accent="var(--security)"
        plate="police"
        event={raid}
        popup={latestFor("police")}
        actions={pickActions(actions, [
          "crackdown",
          "investigate",
          "hire-police",
        ])}
      >
        <Meter label="Corruption" value={corruption} color="var(--security)" />
      </SystemCard>

      <SystemCard
        icon="mafiosi"
        name="Mafiosi"
        description="Mafiosi siphon gold out of mid-chain buffers when policing is thin and corruption is high. The one institution on this rail nobody funds on purpose — there's no bribe or join action, only Police to counter them."
        accent="var(--mafia)"
        plate="mafia"
        event={raid}
      >
        <Meter
          label="Siphon rate"
          value={siphonRate}
          max={2}
          color="var(--mafia)"
          format={(v) => `${v.toFixed(2)}/s`}
        />
      </SystemCard>

    </div>
  );
}

function SystemCard({
  icon,
  name,
  description,
  accent,
  plate,
  plateDir = "sys",
  event,
  detail,
  popup,
  actions = [],
  children,
}) {
  const hot = event ? HOT_STATES.has(event.state) : false;
  const text = detail ?? event?.detail ?? "";

  return (
    <div
      className={`panel sys${hot ? " sys--hot" : ""}`}
      style={{ "--accent": accent }}
      title={description}
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

      <Popup notification={popup} />
    </div>
  );
}
