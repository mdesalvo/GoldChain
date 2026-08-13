import { useGameStore } from "../state/useGameStore.js";
import { wrathLevel, WRATH } from "../simulation/deity.js";
import { ROLES, STAGE_LABEL } from "../simulation/world.js";
import { Icon, Meter } from "./parts.jsx";
import { ART_BASE } from "./artRegions.js";

const MOOD_LABELS = {
  [WRATH.DELIGHTED]: "Delighted",
  [WRATH.CONTENT]: "Pleased",
  [WRATH.IMPATIENT]: "Impatient",
  [WRATH.ANGRY]: "Angry",
  [WRATH.WRATHFUL]: "Wrathful",
};

const MOOD_COLORS = {
  [WRATH.DELIGHTED]: "var(--gold-bright)",
  [WRATH.CONTENT]: "var(--good)",
  [WRATH.IMPATIENT]: "var(--warn)",
  [WRATH.ANGRY]: "var(--bad)",
  [WRATH.WRATHFUL]: "var(--bad)",
};

/**
 * Top-right: the concept's red FLOW INTERRUPTED box.
 *
 * It is the same panel in both states rather than one that appears in a
 * crisis, so its position is learned before it is ever needed — a warning
 * box that only exists when things are wrong has to be *found* at the
 * worst possible moment.
 */
export function AlertBox() {
  const flowMet = useGameStore((s) => s.flowMet);
  const currentRate = useGameStore((s) => s.currentRate);
  const targetRate = useGameStore((s) => s.targetRate);
  const deityMood = useGameStore((s) => s.deityMood);
  const bottleneck = useGameStore((s) => s.bottleneck);
  const streakSeconds = useGameStore((s) => s.streakSeconds);
  const coinsDelivered = useGameStore((s) => s.coinsDelivered);
  const blockedRoles = useGameStore((s) => s.blockedRoles);
  const reserves = useGameStore((s) => s.reserves);

  const mood = wrathLevel(deityMood);
  const wrath = Math.max(0, Math.min(100, 100 - deityMood));

  // The reserve insulates the Deity from every other stage stalling —
  // but Delivery is the one link with nothing after it to absorb a
  // stall of its own: the belt jamming backs the whole chain up
  // behind it, tick by tick, well before the reserve itself runs
  // low enough for the Deity to ever notice. Flow is still "met" in
  // that narrow sense, so this sits between calm and the full red
  // crisis rather than under either.
  const deliveryJammed = blockedRoles.includes(ROLES.PAYER);
  const atRisk = flowMet && deliveryJammed;
  const panelClass = !flowMet ? "" : atRisk ? " alert--warn" : " alert--calm";

  return (
    <div className={`panel alert${panelClass}`}>
      <div className="alert__head">
        <Icon name="bolt" size="sm" alt="" />
        {!flowMet ? "Flow interrupted!" : atRisk ? "Delivery jammed!" : "Flow nominal"}
      </div>

      <div className="alert__body">
        {!flowMet
          ? `The Deity is receiving ${currentRate.toFixed(
              3
            )} of ${targetRate.toFixed(3)}.` +
            (bottleneck ? ` The jam is at ${STAGE_LABEL[bottleneck]}.` : "")
          : atRisk
          ? `Delivery's conveyor has stopped. Gold is backing up the whole ` +
            `chain behind it, stage by stage — the reserve (${reserves.toFixed(
              1
            )} banked) is covering the Deity for now, but nothing is ` +
            `refilling it. Settle it at the Union before that runs out.`
          : `Tribute has been arriving for ${streakSeconds.toFixed(0)}s. ` +
            `${coinsDelivered.toFixed(0)} coins delivered so far.`}
      </div>

      <Meter
        label="Wrath"
        value={wrath}
        color={wrath > 60 ? "var(--bad)" : "var(--warn)"}
        format={(v) => `${Math.round(v)}%`}
        title="100 minus the Deity's mood. At rock bottom it triggers Wrath: a burst of relief for the Deity's own mood, paid for by worker wellbeing and political stability — never by the quota, and never by the Deity."
      />

      <div
        className="deity"
        style={{ "--mood": MOOD_COLORS[mood] }}
        title="Mood tracks one thing only: whether the tribute is arriving at the demanded rate. Nothing else in the society enters into it — not injuries, not strikes, not who died in the mine. It recovers steadily while flow is met and decays faster than proportionally the longer it falls short."
      >
        <img src={`${ART_BASE}deity.jpg`} alt="The Celebrity Deity" />
        <div>
          <div className="deity__label">Deity mood</div>
          <div className="deity__value" style={{ color: MOOD_COLORS[mood] }}>
            {MOOD_LABELS[mood]}
          </div>
        </div>
      </div>
    </div>
  );
}
