import { useEffect, useRef } from "react";
import { Scene } from "./render/Scene.jsx";
import { Hud } from "./render/components/Hud.jsx";
import { useGameLoop } from "./simulation/useGameLoop.js";
import { seedInitialPopulation } from "./simulation/world.js";

export default function App() {
  const seededRef = useRef(false);

  useEffect(() => {
    if (!seededRef.current) {
      seedInitialPopulation();
      seededRef.current = true;
    }
  }, []);

  useGameLoop();

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <Scene />
      <Hud />
    </div>
  );
}
