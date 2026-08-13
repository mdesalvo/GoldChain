import { useEffect, useState } from "react";
import { DESIGN } from "./artRegions.js";

// However the page is hosted, never trust the reported viewport to be
// the true visible box down to the pixel — an embedding host (e.g.
// itch.io's HTML embed, which pads its iframe wrapper by 15px a side
// without shrinking the iframe's own reported size to match) can clip
// a few pixels off any edge that isn't given some slack. Filling
// window.innerWidth/innerHeight exactly reproduced that clipping;
// reserving a small margin here — invisible on a normal browser tab,
// where it just widens the existing bleed border a hair — makes the
// fit robust to that instead of exact-but-fragile.
const SAFE_MARGIN = 70;

/**
 * Scales the fixed design space to the window.
 *
 * `min` rather than `max`, deliberately: the whole picture has to be
 * visible. Filling the window instead cropped the top of the Deity's head
 * off on any window wider than 1.79:1, which is most of them. The leftover
 * space is filled by a blurred bleed of the same artwork.
 */
export function useDesignScale() {
  const [scale, setScale] = useState(() => fit());

  useEffect(() => {
    const onResize = () => setScale(fit());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return scale;
}

function fit() {
  return Math.min(
    (window.innerWidth - SAFE_MARGIN) / DESIGN.width,
    (window.innerHeight - SAFE_MARGIN) / DESIGN.height
  );
}
