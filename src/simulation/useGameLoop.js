import { useEffect, useRef } from "react";
import { useGameStore } from "../state/useGameStore.js";
import { stepSimulation, publishSnapshot, TICK_DT } from "./tick.js";

// The HUD's heavier readouts (per-stage buffers, active event list) are
// rebuilt at a slower cadence than the simulation: they are arrays of
// objects, and republishing them 15 times a second re-renders the whole
// overlay for changes no player can perceive.
const SNAPSHOT_INTERVAL = 0.2;

/**
 * Drives the fixed-tick simulation loop independently of render
 * framerate, using an accumulator pattern (classic game-loop
 * technique) so the sim stays deterministic even if the browser
 * tab throttles rendering.
 *
 * This hook owns *when* the simulation runs; `tick.js` owns *what* it
 * does. Mount this once near the root of the app.
 */
export function useGameLoop() {
  const accumulatorRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const rafRef = useRef(null);
  const snapshotClockRef = useRef(0);

  useEffect(() => {
    function loop(now) {
      const frameDt = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      if (useGameStore.getState().paused) {
        // Drop the elapsed time on the floor rather than banking it, so
        // unpausing doesn't fast-forward through the whole pause.
        accumulatorRef.current = 0;
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      // Speed multiplies how much time we feed the accumulator, not the
      // tick size, so the simulation is identical at 1x and 4x — just
      // further along.
      const speed = useGameStore.getState().speed;
      accumulatorRef.current += Math.min(frameDt, 0.25) * speed; // clamp to avoid spiral of death

      while (accumulatorRef.current >= TICK_DT) {
        stepSimulation(TICK_DT);
        accumulatorRef.current -= TICK_DT;

        snapshotClockRef.current += TICK_DT;
        if (snapshotClockRef.current >= SNAPSHOT_INTERVAL) {
          snapshotClockRef.current = 0;
          publishSnapshot();
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);
}
