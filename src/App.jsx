import "./ui/theme.css";
import { useGameStore } from "./state/useGameStore.js";
import { Set } from "./ui/Set.jsx";
import { useDesignScale } from "./ui/Screen.jsx";
import { BrandPanel, FlowPanel } from "./ui/BrandPanel.jsx";
import { AlertBox } from "./ui/AlertBox.jsx";
import { SystemRail } from "./ui/SystemRail.jsx";
import { StageStrip, ReserveCard } from "./ui/StageStrip.jsx";
import { NewsTicker } from "./ui/NewsTicker.jsx";
import { useGameLoop } from "./simulation/useGameLoop.js";
import { ensureSeeded } from "./simulation/world.js";
import {
  stepSimulation,
  publishSnapshot,
  TICK_DT,
  TICK_RATE,
} from "./simulation/tick.js";

// Seeded at module scope, not in an effect: the world must exist before
// the first render and before the first simulation tick. `ensureSeeded`
// is idempotent, so StrictMode's double-invoke is harmless.
ensureSeeded();
fastForwardFromUrl();

/**
 * The game screen.
 *
 * One fixed 1376x768 layout, scaled as a single piece to whatever window
 * it is given. Every panel is absolutely positioned in concept pixels, on
 * top of the concept artwork, in the place the concept put it — which is
 * what lets our panels cover the UI painted into the picture instead of
 * fighting it.
 *
 * Nothing animates, with one deliberate exception: the news ticker at
 * the bottom is a CSS crawl, not a loop the simulation drives — the
 * fixed-tick loop only ever changes what text is inside it. Everything
 * else that changes on screen is data being written into a panel by
 * JavaScript.
 */
export default function App() {
  const scale = useDesignScale();
  const flowMet = useGameStore((s) => s.flowMet);
  useGameLoop();

  return (
    <>
      <div className="bleed" />

      <div
        className={`design${flowMet ? "" : " design--stalled"}`}
        style={{ "--design-scale": scale }}
      >
        <Set />

        <div className="at at--brand"><BrandPanel /></div>
        <div className="at at--flow"><FlowPanel /></div>
        <div className="at at--rail"><SystemRail /></div>
        <div className="at at--alert"><AlertBox /></div>
        <div className="at at--strip"><StageStrip /></div>
        <div className="at at--purse"><ReserveCard /></div>
        <div className="at at--ticker"><NewsTicker /></div>
      </div>
    </>
  );
}

/**
 * `?skip=180` runs 180 simulated seconds before the first paint.
 *
 * A fresh game shows every meter at its starting value and an empty chain,
 * which is the one state that tells you nothing about whether the UI
 * works. Dev-only, so it cannot ship as an accidental cheat.
 */
function fastForwardFromUrl() {
  if (!import.meta.env.DEV) return;
  const seconds = Number(
    new URLSearchParams(window.location.search).get("skip")
  );
  if (!Number.isFinite(seconds) || seconds <= 0) return;

  for (let i = 0; i < Math.min(seconds, 3600) * TICK_RATE; i++) {
    stepSimulation(TICK_DT);
  }
  publishSnapshot();
}
