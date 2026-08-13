import { useGameStore } from "../state/useGameStore.js";
import { ROLES, STAGE_LABEL } from "../simulation/world.js";
import { ActionButton, Icon, pickActions } from "./parts.jsx";
import { ART_BASE } from "./artRegions.js";

export { STAGE_LABEL };

// One plate per stage, keyed the same way STAGE_LABEL is.
const STAGE_ART = {
  [ROLES.MINER]: "mines",
  [ROLES.TRANSPORTER]: "transport",
  [ROLES.SMELTER]: "smelters",
  [ROLES.MINTER]: "mints",
  [ROLES.PAYER]: "delivery",
};

// The concept marks each stage with a small glyph next to its name, the
// same way the rail cards do — a hard hat for the mines, a cart for
// transport, and so on.
const STAGE_ICON = {
  [ROLES.MINER]: "pickaxe",
  [ROLES.TRANSPORTER]: "cart",
  [ROLES.SMELTER]: "flame",
  [ROLES.MINTER]: "coinstage",
  [ROLES.PAYER]: "delivery",
};

// What each specialisation actually does, first line of the card's
// tooltip — the stats below it say how well, this says what.
const STAGE_DESCRIPTION = {
  [ROLES.MINER]: "Miners extract raw gold from the mountain.",
  [ROLES.TRANSPORTER]: "Transporters haul the gold from the mines to the smelters.",
  [ROLES.SMELTER]: "Smelters melt the gold down, ready to be minted.",
  [ROLES.MINTER]: "Minters strike the molten gold into coin.",
  [ROLES.PAYER]: "Delivery runs the conveyor belt that carries coin from the reserve up to the Deity — no monkey is fit to hand it over in person.",
};

/**
 * The work units, in a strip under the set: the concept's bottom row.
 *
 * The reserve is its own panel to the right of them, in the concept's own
 * position for it, and belongs there rather than with the alert readouts
 * because it is the last link of the chain — everything to its left fills
 * it, and the Deity is paid out of it.
 */
// One line per cause, in the same words the notification feed uses for
// that system, so the dot and the feed never disagree with each other.
const HINT_LABEL = {
  union: "The union is behind this — a walkout here.",
  breakdown: "Machinery seized up on this line.",
  mafia: "The mafia siphoned gold out of this stage's buffer.",
  medical: "A worker from this stage is in hospital.",
};

export function StageStrip() {
  const stages = useGameStore((s) => s.stages);
  const blockedRoles = useGameStore((s) => s.blockedRoles);
  const bottleneck = useGameStore((s) => s.bottleneck);
  const roleHints = useGameStore((s) => s.roleHints);

  if (stages.length === 0) return null;
  const blocked = new Set(blockedRoles);

  return (
    <div className="strip">
      {stages.map((stage) => (
        <StageCard
          key={stage.role}
          stage={stage}
          blocked={blocked.has(stage.role)}
          jammed={stage.role === bottleneck}
          hint={roleHints[stage.role]}
        />
      ))}
    </div>
  );
}

function StageCard({ stage, blocked, jammed, hint }) {
  const fill = stage.capacity ? Math.min(1, stage.buffer / stage.capacity) : 1;
  // A buffer nearing full is backpressure arriving from downstream —
  // often before the stage that's actually stuck shows anything at
  // all. The source stage (no capacity, unlimited input) never reads
  // this way; there's no buffer there to back up.
  const congestion = !stage.capacity
    ? "normal"
    : fill >= 0.97
    ? "critical"
    : fill >= 0.8
    ? "warn"
    : "normal";
  const className = [
    "stagecard",
    blocked ? "stagecard--dead" : jammed ? "stagecard--jam" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={className}
      title={
        `${STAGE_DESCRIPTION[stage.role]}\n\n` +
        `${STAGE_LABEL[stage.role]}: ${stage.workers} of ${stage.total} able\n` +
        (stage.capacity
          ? `buffer ${stage.buffer.toFixed(1)} / ${stage.capacity}`
          : "source stage — unlimited input") +
        `\noutput: ${Math.round(stage.load * 100)}% of what its current crew could produce` +
        " if nothing were blocking them (a full downstream buffer, an empty upstream one)"
      }
    >
      {hint && (
        <span
          className={`stagecard__hint stagecard__hint--${hint}`}
          title={HINT_LABEL[hint]}
        />
      )}
      <div
        className="stagecard__art"
        style={{ "--plate": `url(${ART_BASE}stage/${STAGE_ART[stage.role]}.jpg)` }}
      />
      <div className="stagecard__body">
        <div className="stagecard__name">
          <Icon name={STAGE_ICON[stage.role]} size="sm" alt="" />
          {STAGE_LABEL[stage.role]}
        </div>
        <div className="stagecard__stat">
          <span>
            {stage.workers} worker{stage.workers === 1 ? "" : "s"}
          </span>
          <span title="Share of what this stage's current crew could produce if nothing downstream or upstream were holding them back">
            {Math.round(stage.load * 100)}% output
          </span>
        </div>
        <div className="stagecard__rate">
          {blocked ? "STOPPED" : `${stage.rate.toFixed(3)} coins/s`}
        </div>
        <div
          className={`stagecard__buffer stagecard__buffer--${congestion}`}
          title={
            congestion === "normal"
              ? undefined
              : "Buffer backing up — whatever's downstream isn't draining it fast enough. Left unchecked this backs up the whole chain behind it, stage by stage."
          }
        >
          <i style={{ width: `${fill * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

/**
 * The reserve: sixth box in the bottom row, right where the concept
 * puts it — next to Delivery, the same height as the stage cards,
 * rather than sharing a panel with an unrelated readout the way it
 * once shared one with the mafia.
 */
export function ReserveCard() {
  const reserves = useGameStore((s) => s.reserves);
  const reserveCapacity = useGameStore((s) => s.reserveCapacity);
  const targetRate = useGameStore((s) => s.targetRate);
  const taxedTotal = useGameStore((s) => s.taxedTotal);
  const stolenTotal = useGameStore((s) => s.stolenTotal);
  const actions = useGameStore((s) => s.actions);

  const cover = reserves / Math.max(0.01, targetRate);

  return (
    <div
      className="panel reservebar"
      title={
        `Coin banked between the chain and the Deity.\n` +
        `Skimmed by law: ${taxedTotal.toFixed(1)} · stolen: ${stolenTotal.toFixed(1)}`
      }
    >
      <div className="reservebar__label">
        <Icon name="chest" size="sm" alt="" />
        Reserves
      </div>
      <strong
        className="reservebar__value"
        style={{ color: cover < 6 ? "var(--bad)" : "var(--gold-bright)" }}
      >
        {reserves.toFixed(1)}
      </strong>
      <span className="reservebar__cover">
        of {reserveCapacity} · {cover.toFixed(0)}s of cover
      </span>
      <div className="reservebar__actions">
        {pickActions(actions, ["emergency-pay"]).map((action) => (
          <ActionButton key={action.id} action={action} />
        ))}
      </div>
    </div>
  );
}
