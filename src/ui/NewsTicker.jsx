import { useEffect, useRef } from "react";
import { useGameStore } from "../state/useGameStore.js";
import { EVENT_TYPES } from "../events/eventTypes.js";

// Coloured by institution, the same convention `Popup` uses in
// `parts.jsx`: a headline reads as "this is the union talking" before
// it reads as good or bad news. A mafia raid is reported here the way
// `SystemRail` shows it too — on Police, in police blue — since it's
// the police side of that story the player has a card (and, now, a
// ticker colour) for; the mafia has no institution of its own to
// speak from. Falls back to `tone` for the two sources with no
// `system` of their own — the Deity's mood swings.
const SOURCE_COLOR = {
  [EVENT_TYPES.STRIKE]: "var(--union)",
  [EVENT_TYPES.LEGISLATION]: "var(--politics)",
  [EVENT_TYPES.MAFIA_RAID]: "var(--security)",
  [EVENT_TYPES.BREAKDOWN]: "var(--warn)",
  medical: "var(--medical)",
  chain: "var(--gold)",
  deity: "var(--gold-bright)",
  wrath: "var(--bad)",
};

const HEADLINE_COUNT = 5;
const SCROLL_SPEED = 42; // design px/sec — a slow, readable crawl
// A backgrounded/occluded tab still advances real time even though it
// isn't painting, so an interval or a wall-clock CSS animation comes
// back from a minute away and instantly snaps to wherever that much
// time says it should be. Clamping the per-frame delta is the same
// fix `useGameLoop` applies to the simulation clock for the same
// reason: dropped time is dropped, never banked and dumped back in
// as a single jump.
const MAX_FRAME_DT = 0.1;

/**
 * The bottom strip: a right-to-left news crawl over the last few
 * headlines, so nothing that just happened is more than a glance away —
 * including the things that have no card of their own to land a popup
 * on (a breakdown, the Deity's moods).
 *
 * Reads `newsLog` rather than `notifications`: the latter self-expires
 * after `NOTIFICATION_TTL` seconds so the rail's per-card popups clear
 * themselves, which would leave the ticker blank between bursts of
 * events.
 *
 * The crawl is a tiny rAF loop, not a CSS `animation`. A pure CSS
 * crawl was tried first and had two failure modes: its target had to
 * be either a percentage of the track's own width (which shifts by a
 * few pixels every time the headlines change, so the animation
 * quietly retargets mid-crawl and reads as a stutter of speed) or a
 * fixed guess at that width (wrong as soon as real headlines are
 * longer or shorter than the guess) — and, being wall-clock-driven,
 * it has no way to not snap forward after the tab spends a minute
 * occluded. None of that touches the simulation: this loop only ever
 * writes a `transform` to one element.
 */
export function NewsTicker() {
  const newsLog = useGameStore((s) => s.newsLog);
  const headlines = newsLog.slice(-HEADLINE_COUNT);
  const hasNews = headlines.length > 0;

  const trackRef = useRef(null);
  const offsetRef = useRef(0);

  useEffect(() => {
    if (!hasNews) return undefined;

    let raf = requestAnimationFrame(frame);
    let last = null;

    function frame(now) {
      if (last == null) last = now;
      const dt = Math.min((now - last) / 1000, MAX_FRAME_DT);
      last = now;

      const track = trackRef.current;
      if (track) {
        // The content is rendered twice back to back, so wrapping at
        // exactly one copy's width is always seamless, whatever that
        // width happens to be this render.
        const wrap = track.scrollWidth / 2 || 1;
        let next = offsetRef.current + SCROLL_SPEED * dt;
        if (next >= wrap) next -= wrap;
        offsetRef.current = next;
        track.style.transform = `translateX(${-next}px)`;
      }
      raf = requestAnimationFrame(frame);
    }

    return () => cancelAnimationFrame(raf);
  }, [hasNews]);

  return (
    <div className="panel ticker">
      <div className="ticker__label">GoldChain News</div>
      <div className="ticker__window">
        {hasNews ? (
          <div className="ticker__track" ref={trackRef}>
            {[...headlines, ...headlines].map((n, i) => (
              <span
                key={`${n.id}-${i}`}
                className="ticker__item"
                style={{ "--source": SOURCE_COLOR[n.system ?? n.tone] ?? "var(--gold)" }}
              >
                <i className="ticker__dot" />
                {n.message}
              </span>
            ))}
          </div>
        ) : (
          <div className="ticker__track">
            <span className="ticker__item">All quiet on the chain.</span>
          </div>
        )}
      </div>
    </div>
  );
}
