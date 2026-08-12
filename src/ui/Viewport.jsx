import { useEffect, useRef, useState } from "react";
import { useGameStore } from "../state/useGameStore.js";
import { EVENT_TYPES } from "../events/eventTypes.js";
import { ROLES } from "../simulation/world.js";
import { Icon } from "./parts.jsx";
import { Scene } from "../render/Scene.jsx";

/**
 * The centre pane.
 *
 * By default it shows the concept art's cross-section as a painted
 * backdrop with live state pinned over the regions it refers to — a
 * strike lights up the picket line, a raid lights up the police station.
 * A pre-rendered backdrop with live overlays is the standard way a
 * fixed-camera game gets a rich set for no art budget, and it reads as a
 * place instead of a field of capsules.
 *
 * The R3F scene is still here behind a toggle. It is the honest view of
 * the simulation — every capsule is a real entity — and it stays until
 * there is real art to replace the placeholders with. Neither view can
 * affect the simulation; both only read it.
 */

// Where each region sits on the backdrop, in percentages of the plate.
// Derived from the crop box in `public/art/diorama.jpg`.
const REGIONS = {
  union: { left: "13%", top: "26%" },
  politicians: { left: "77%", top: "27%" },
  hospital: { left: "73%", top: "51%" },
  police: { left: "90%", top: "73%" },
  mines: { left: "15%", top: "48%" },
  smelter: { left: "14%", top: "75%" },
};

// Which region a broken stage should light up.
const STAGE_REGION = {
  [ROLES.MINER]: "mines",
  [ROLES.HAULER]: "mines",
  [ROLES.SMELTER]: "smelter",
  [ROLES.GOLDSMITH]: "smelter",
  [ROLES.DRIVER]: "mines",
};

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

// Cycled by the button in the corner. The still is the default on
// purpose: the animated plate is prettier but the generative pass garbled
// every sign in the set and dropped the Deity's salary placard, so the
// still is the more *readable* backdrop. Motion is never the default for
// a second reason: a permanently moving background is a poor thing to
// force on anyone who would rather it held still.
const MODES = ["plate", "motion", "scene"];

const MODE_LABEL = {
  plate: { next: "Play the set", badge: "2D" },
  motion: { next: "Show the live simulation", badge: "LIVE" },
  scene: { next: "Back to the painted set", badge: "3D" },
};

export function Viewport() {
  const [mode, setMode] = useState("plate");
  const targetRate = useGameStore((s) => s.targetRate);
  const events = useGameStore((s) => s.activeEvents);
  const stages = useGameStore((s) => s.stages);
  const blockedRoles = useGameStore((s) => s.blockedRoles);
  const bottleneck = useGameStore((s) => s.bottleneck);
  const injured = useGameStore((s) => s.injuredCount);

  const blocked = new Set(blockedRoles);

  return (
    <div className="stage">
      <div className="stage__frame">
        <div className="stage__marquee">
          The society, in cross-section
          <span className="stage__marquee-demand">
            <Icon name="coin" size="sm" alt="" />
            {targetRate.toFixed(3)} demanded / sec
          </span>
        </div>

        {mode === "scene" ? (
          <Scene />
        ) : (
          <div className="stage__set">
            {mode === "motion" ? (
              /* Same crop box as the still, so the hotspots below land on
                 the same rooms in either mode. */
              <video
                className="stage__plate"
                src="/art/diorama.webm"
                poster="/art/diorama.jpg"
                autoPlay
                muted
                loop
                playsInline
              />
            ) : (
              <img
                className="stage__plate"
                src="/art/diorama.jpg"
                alt="The society, in cross-section"
                draggable={false}
              />
            )}
            {mode === "plate" && <ConveyorBelt />}
            <div className="stage__vignette" />
            {hotspots(events, injured).map((spot) => (
              <div
                key={spot.key}
                className="hotspot"
                style={{ ...REGIONS[spot.region], "--accent": spot.accent }}
                title={spot.detail}
              >
                <i className="hotspot__dot" />
                {spot.label}
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          className="tbtn stage__toggle"
          onClick={() =>
            setMode((current) => MODES[(MODES.indexOf(current) + 1) % MODES.length])
          }
          title={MODE_LABEL[mode].next}
        >
          {MODE_LABEL[mode].badge}
        </button>
      </div>

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
    </div>
  );
}

/**
 * The conveyor belt, overlaid on the still plate and driven by the actual
 * tribute rate.
 *
 * Playback rate rather than a CSS animation because the belt is real
 * footage, and rather than a fixed loop because a belt that always moves
 * at the same speed while the flow collapses is actively misleading. Kept
 * in its own component so the 15Hz rate updates re-render this and
 * nothing else.
 */
function ConveyorBelt() {
  const currentRate = useGameStore((s) => s.currentRate);
  const targetRate = useGameStore((s) => s.targetRate);
  const ref = useRef(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    const ratio = targetRate > 0 ? currentRate / targetRate : 0;
    if (ratio < 0.02) {
      video.pause();
      return;
    }
    // Clamped: below a quarter speed the coins judder, above double they
    // blur into a stripe.
    video.playbackRate = Math.max(0.25, Math.min(2, ratio));
    if (video.paused) video.play().catch(() => {});
  }, [currentRate, targetRate]);

  return (
    <video
      ref={ref}
      className="stage__belt"
      src="/art/belt.webm"
      autoPlay
      muted
      loop
      playsInline
    />
  );
}

/** Turns machine states into the badges pinned on the backdrop. */
function hotspots(events, injured) {
  const spots = [];
  const find = (type) => events.find((e) => e.type === type);

  const strike = find(EVENT_TYPES.STRIKE);
  if (strike && !strike.idle) {
    spots.push({
      key: "strike",
      region: "union",
      accent: "var(--union)",
      label: strike.label,
      detail: strike.detail,
    });
  }

  const law = find(EVENT_TYPES.LEGISLATION);
  if (law && !law.idle) {
    spots.push({
      key: "law",
      region: "politicians",
      accent: "var(--politics)",
      label: law.label,
      detail: law.detail,
    });
  }

  const raid = find(EVENT_TYPES.MAFIA_RAID);
  if (raid && !raid.idle) {
    spots.push({
      key: "raid",
      region: "police",
      accent: "var(--mafia)",
      label: raid.label,
      detail: raid.detail,
    });
  }

  const machinery = find(EVENT_TYPES.BREAKDOWN);
  if (machinery && !machinery.idle) {
    const stage = machinery.detail.split(" ")[0];
    spots.push({
      key: "breakdown",
      region: STAGE_REGION[stage] ?? "smelter",
      accent: "var(--warn)",
      label: machinery.label,
      detail: machinery.detail,
    });
  }

  if (injured > 0) {
    spots.push({
      key: "hospital",
      region: "hospital",
      accent: "var(--medical)",
      label: `${injured} injured`,
      detail: "Monkeys waiting for treatment are off the workforce.",
    });
  }

  return spots;
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
        style={{
          "--plate": `url(/art/stage/${STAGE_ART[stage.role]}.webp)`,
          "--plate-still": `url(/art/stage/${STAGE_ART[stage.role]}.jpg)`,
        }}
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
