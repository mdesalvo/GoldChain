import { useEffect, useState } from "react";
import { DESIGN } from "./artRegions.js";

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
    window.innerWidth / DESIGN.width,
    window.innerHeight / DESIGN.height
  );
}
