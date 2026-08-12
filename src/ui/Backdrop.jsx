import { useEffect, useState } from "react";
import { useGameStore } from "../state/useGameStore.js";
import { EVENT_TYPES } from "../events/eventTypes.js";
import { ROLES } from "../simulation/world.js";
import { Scene } from "../render/Scene.jsx";
import { BACKDROP_ASPECT, REGIONS } from "./artRegions.js";

/**
 * The set: the concept painting, full window, with everything else layered
 * over it.
 *
 * This is the whole reason the artwork can be this big. The alternative —
 * a cropped plate in a pane, with the panels beside it — cost the picture
 * both the width the side rails took and every region the concept's own UI
 * had been sitting on. Filling those footprints flat (see
 * `scripts/extract-art.py`) means our panels can go exactly where theirs
 * were, and nothing has to be cropped to stay clear of them.
 *
 * Nothing here animates. The badges are pinned to the rooms they describe
 * and appear or disappear with the machine states; that is a state change,
 * not a loop.
 */

// Which room a broken stage lights up.
const STAGE_REGION = {
  [ROLES.MINER]: "mines",
  [ROLES.HAULER]: "mines",
  [ROLES.SMELTER]: "smelter",
  [ROLES.GOLDSMITH]: "smelter",
  [ROLES.DRIVER]: "mines",
};

/**
 * The backdrop is drawn `cover`, so it overflows the window on one axis
 * and a percentage of the image is not a percentage of the window. This
 * returns the image's rendered box so the badges can be placed against
 * the painting rather than against the viewport.
 */
function useCoverBox() {
  const [box, setBox] = useState(() => coverBox());

  useEffect(() => {
    const onResize = () => setBox(coverBox());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return box;
}

function coverBox() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const wide = w / h > BACKDROP_ASPECT;
  // Cover: the axis that would leave a gap is the one that gets scaled up.
  const width = wide ? w : h * BACKDROP_ASPECT;
  const height = wide ? w / BACKDROP_ASPECT : h;
  return { left: (w - width) / 2, top: (h - height) / 2, width, height };
}

export function Backdrop({ showScene }) {
  const events = useGameStore((s) => s.activeEvents);
  const injured = useGameStore((s) => s.injuredCount);
  const flowMet = useGameStore((s) => s.flowMet);
  const box = useCoverBox();

  if (showScene) {
    return (
      <div className="backdrop">
        <Scene />
      </div>
    );
  }

  return (
    <div className={`backdrop${flowMet ? "" : " backdrop--stalled"}`}>
      <img
        className="backdrop__art"
        src="/art/backdrop.jpg"
        alt="The society, in cross-section: the Deity above, the chain below"
        draggable={false}
      />
      <div className="backdrop__vignette" />

      {badges(events, injured).map((badge) => {
        const region = REGIONS[badge.region];
        return (
          <div
            key={badge.key}
            className={`hotspot hotspot--${region.align}`}
            style={{
              left: box.left + (parseFloat(region.left) / 100) * box.width,
              top: box.top + (parseFloat(region.top) / 100) * box.height,
              "--accent": badge.accent,
            }}
            title={badge.detail}
          >
            <i className="hotspot__dot" />
            {badge.label}
          </div>
        );
      })}
    </div>
  );
}

/** Turns machine states into the badges pinned on the painting. */
function badges(events, injured) {
  const out = [];
  const find = (type) => events.find((e) => e.type === type);

  const add = (key, region, accent, event) => {
    if (event && !event.idle) {
      out.push({ key, region, accent, label: event.label, detail: event.detail });
    }
  };

  add("strike", "union", "var(--union)", find(EVENT_TYPES.STRIKE));
  add("law", "politicians", "var(--politics)", find(EVENT_TYPES.LEGISLATION));
  add("raid", "police", "var(--mafia)", find(EVENT_TYPES.MAFIA_RAID));

  const machinery = find(EVENT_TYPES.BREAKDOWN);
  if (machinery && !machinery.idle) {
    const stage = machinery.detail.split(" ")[0];
    out.push({
      key: "breakdown",
      region: STAGE_REGION[stage] ?? "smelter",
      accent: "var(--warn)",
      label: machinery.label,
      detail: machinery.detail,
    });
  }

  if (injured > 0) {
    out.push({
      key: "hospital",
      region: "hospital",
      accent: "var(--medical)",
      label: `${injured} injured`,
      detail: "Monkeys waiting for treatment are off the workforce.",
    });
  }

  return out;
}
