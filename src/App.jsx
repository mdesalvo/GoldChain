import { Scene } from "./render/Scene.jsx";
import { Hud } from "./render/components/Hud.jsx";
import { EventFeed } from "./render/components/EventFeed.jsx";
import { EventsPanel } from "./render/components/EventsPanel.jsx";
import { useGameLoop } from "./simulation/useGameLoop.js";
import { ensureSeeded } from "./simulation/world.js";

// Seeded at module scope, not in an effect: the world must exist before
// the first render and before the first simulation tick. `ensureSeeded`
// is idempotent, so StrictMode's double-invoke is harmless.
ensureSeeded();

export default function App() {
  useGameLoop();

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <Scene />
      <Hud />
      <EventsPanel />
      <EventFeed />
    </div>
  );
}
