import "./ui/theme.css";
import { TopBar } from "./ui/TopBar.jsx";
import { SystemRail } from "./ui/SystemRail.jsx";
import { Viewport } from "./ui/Viewport.jsx";
import { AlertRail } from "./ui/AlertRail.jsx";
import { TabBar } from "./ui/TabBar.jsx";
import { useGameLoop } from "./simulation/useGameLoop.js";
import { ensureSeeded } from "./simulation/world.js";
import { stepSimulation, publishSnapshot, TICK_DT, TICK_RATE } from "./simulation/tick.js";

// Seeded at module scope, not in an effect: the world must exist before
// the first render and before the first simulation tick. `ensureSeeded`
// is idempotent, so StrictMode's double-invoke is harmless.
ensureSeeded();
fastForwardFromUrl();

/**
 * `?skip=180` runs 180 simulated seconds before the first paint.
 *
 * A fresh game shows every meter at its starting value and an empty
 * chain, which is the one state that tells you nothing about whether the
 * UI works. This makes a mid-game state reachable directly — useful for
 * screenshots, for checking a layout against real numbers, and for
 * jumping straight to a disruption. Dev-only, so it cannot ship as an
 * accidental cheat.
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

/**
 * The game shell.
 *
 * A CSS grid frame — top bar, system rail, viewport, alert rail, tab bar —
 * rather than panels floating over a full-screen canvas. The viewport is
 * one pane among several, which is what makes the whole thing read as a
 * game screen instead of a debug overlay on a 3D demo.
 */
export default function App() {
  useGameLoop();

  return (
    <div className="shell">
      <div className="shell__topbar">
        <TopBar />
      </div>
      <div className="shell__rail">
        <SystemRail />
      </div>
      <div className="shell__stage">
        <Viewport />
      </div>
      <div className="shell__alerts">
        <AlertRail />
      </div>
      <div className="shell__tabs">
        <TabBar />
      </div>
    </div>
  );
}
