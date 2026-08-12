import { useGameStore } from "../state/useGameStore.js";
import { ROLES } from "../simulation/world.js";
import { ActionButton, Icon, pickActions } from "./parts.jsx";

// One plate per stage, and one label — the concept names its bottom row
// by the place (MINES, SMELTERS, TRANSPORT, MINTS, DELIVERY), not by the
// worker's job title, so the card shows that rather than `stage.role`.
const STAGE_ART = {
  [ROLES.MINER]: "mines",
  [ROLES.TRANSPORTER]: "transport",
  [ROLES.SMELTER]: "smelters",
  [ROLES.MINTER]: "mints",
  [ROLES.PAYER]: "delivery",
};

const STAGE_LABEL = {
  [ROLES.MINER]: "Mines",
  [ROLES.TRANSPORTER]: "Transport",
  [ROLES.SMELTER]: "Smelters",
  [ROLES.MINTER]: "Mints",
  [ROLES.PAYER]: "Delivery",
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

/**
 * The work units, in a strip under the set: the concept's bottom row.
 *
 * The reserve is its own panel to the right of them, in the concept's own
 * position for it, and belongs there rather than with the alert readouts
 * because it is the last link of the chain — everything to its left fills
 * it, and the Deity is paid out of it.
 */
export function StageStrip() {
  const stages = useGameStore((s) => s.stages);
  const blockedRoles = useGameStore((s) => s.blockedRoles);
  const bottleneck = useGameStore((s) => s.bottleneck);

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
        />
      ))}
    </div>
  );
}

function StageCard({ stage, blocked, jammed }) {
  const fill = stage.capacity ? Math.min(1, stage.buffer / stage.capacity) : 1;
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
        `${STAGE_LABEL[stage.role]}: ${stage.workers} of ${stage.total} able\n` +
        (stage.capacity
          ? `buffer ${stage.buffer.toFixed(1)} / ${stage.capacity}`
          : "source stage — unlimited input") +
        `\nrunning at ${Math.round(stage.load * 100)}% of capacity`
      }
    >
      <div
        className="stagecard__art"
        style={{ "--plate": `url(/art/stage/${STAGE_ART[stage.role]}.jpg)` }}
      />
      <div className="stagecard__body">
        <div className="stagecard__name">
          <Icon name={STAGE_ICON[stage.role]} size="sm" alt="" />
          {STAGE_LABEL[stage.role]}
        </div>
        <div className="stagecard__stat">
          <span>
            {stage.workers} hand{stage.workers === 1 ? "" : "s"}
          </span>
          <span>{Math.round(stage.load * 100)}%</span>
        </div>
        <div className="stagecard__rate">
          {blocked ? "STOPPED" : `${stage.rate.toFixed(3)}/s`}
        </div>
        <div className="stagecard__buffer">
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
