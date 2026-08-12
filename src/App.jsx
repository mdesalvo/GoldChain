import "./ui/theme.css";
import { useState } from "react";
import { Backdrop } from "./ui/Backdrop.jsx";
import { BrandPanel } from "./ui/BrandPanel.jsx";
import { ClockBar } from "./ui/ClockBar.jsx";
import { AlertBox } from "./ui/AlertBox.jsx";
import { FeedPanel } from "./ui/FeedPanel.jsx";
import { SystemRail } from "./ui/SystemRail.jsx";
import { StageStrip } from "./ui/StageStrip.jsx";
import { TabBar } from "./ui/TabBar.jsx";
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
 * The painting is the whole window; every panel sits over it, in the place
 * the concept put it. That is what makes the artwork read as a set the
 * game happens inside rather than as an illustration in a box — and it is
 * the only layout in which the art gets the whole window instead of
 * whatever the side rails leave over.
 *
 * Nothing animates. Everything that changes on screen is data being
 * written into a section by JavaScript.
 */
export default function App() {
  const [showScene, setShowScene] = useState(false);
  useGameLoop();

  return (
    <>
      <Backdrop showScene={showScene} />

      <div className="shell">
        <div className="shell__brand">
          <BrandPanel />
        </div>
        <div className="shell__clock">
          <ClockBar
            showScene={showScene}
            onToggleScene={() => setShowScene((on) => !on)}
          />
        </div>
        <div className="shell__alert">
          <AlertBox />
          <FeedPanel />
        </div>
        <div className="shell__rail">
          <SystemRail />
        </div>
        <div className="shell__strip">
          <StageStrip />
        </div>
        <div className="shell__tabs">
          <TabBar />
        </div>
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
