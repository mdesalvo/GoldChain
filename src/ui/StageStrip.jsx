import { useGameStore } from "../state/useGameStore.js";
import { ROLES } from "../simulation/world.js";
import { ActionButton, Icon, pickActions } from "./parts.jsx";

// Five illustrations for eight stages, reused the way the concept reuses
// its own five: the art identifies the kind of work, not the exact role.
const STAGE_ART = {
  [ROLES.MINER]: "mines",
  [ROLES.HAULER]: "transport",
  [ROLES.SMELTER]: "smelters",
  [ROLES.GOLDSMITH]: "mints",
  [ROLES.DRIVER]: "transport",
  [ROLES.BANKER]: "mints",
  [ROLES.TELLER]: "mints",
  [ROLES.PAYER]: "delivery",
};

/**
 * The work units, in a strip under the set, with the reserve at the end —
 * the concept's bottom row.
 *
 * The reserve belongs here rather than with the alert readouts because it
 * is the last link of the chain: everything to its left fills it, and the
 * Deity is paid out of it.
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
      <ReserveCard />
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
        `${stage.role}: ${stage.workers} of ${stage.total} able\n` +
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
        <div className="stagecard__name">{stage.role}</div>
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

function ReserveCard() {
  const reserves = useGameStore((s) => s.reserves);
  const reserveCapacity = useGameStore((s) => s.reserveCapacity);
  const targetRate = useGameStore((s) => s.targetRate);
  const taxedTotal = useGameStore((s) => s.taxedTotal);
  const stolenTotal = useGameStore((s) => s.stolenTotal);
  const actions = useGameStore((s) => s.actions);

  const cover = reserves / Math.max(0.01, targetRate);

  return (
    <div
      className="stagecard stagecard--reserve"
      title={
        `Coin banked between the chain and the Deity.\n` +
        `Skimmed by law: ${taxedTotal.toFixed(1)} · stolen: ${stolenTotal.toFixed(1)}`
      }
    >
      <div className="stagecard__body reserve">
        <div className="stagecard__name">
          <Icon name="chest" size="sm" alt="" /> Reserves
        </div>
        <div
          className="reserve__value"
          style={{ color: cover < 6 ? "var(--bad)" : "var(--gold-bright)" }}
        >
          {reserves.toFixed(1)}
        </div>
        <div className="reserve__cover">
          of {reserveCapacity} · {cover.toFixed(0)}s of cover
        </div>
        <div className="sys__actions">
          {pickActions(actions, ["emergency-pay"]).map((action) => (
            <ActionButton key={action.id} action={action} />
          ))}
        </div>
      </div>
    </div>
  );
}
