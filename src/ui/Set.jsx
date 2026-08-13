import { useEffect, useState } from "react";
import { useGameStore } from "../state/useGameStore.js";
import { EVENT_TYPES } from "../events/eventTypes.js";
import { ROLES } from "../simulation/world.js";
import { ART_BASE, REGIONS } from "./artRegions.js";

/**
 * The set: the concept painting, untouched, filling the design space.
 *
 * Because the design space is a fixed 1376x768 scaled as one piece, the
 * badges can be placed at plain concept pixel coordinates — no conversion,
 * no drift, and the whole picture is always visible.
 *
 * Nothing here animates. The badges are pinned to the rooms they describe
 * and appear or disappear with the machine states; that is a state change,
 * not a loop.
 */

// Which room a broken stage lights up.
const STAGE_REGION = {
  [ROLES.MINER]: "mines",
  [ROLES.TRANSPORTER]: "mines",
  [ROLES.SMELTER]: "smelter",
  [ROLES.MINTER]: "smelter",
};

export function Set() {
  const events = useGameStore((s) => s.activeEvents);
  const injured = useGameStore((s) => s.injuredCount);

  return (
    <>
      <img
        className="design__art"
        src={`${ART_BASE}backdrop2.jpg`}
        alt="The society, in cross-section: the Deity above, the chain below"
        draggable={false}
      />
      <div className="design__vignette" />

      {badges(events, injured).map((badge) => {
        const region = REGIONS[badge.region];
        return (
          <div
            key={badge.key}
            className={`hotspot hotspot--${region.align}`}
            style={{
              left: region.left,
              top: region.top,
              "--accent": badge.accent,
            }}
            title={badge.detail}
          >
            <i className="hotspot__dot" />
            {badge.label}
          </div>
        );
      })}
    </>
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
