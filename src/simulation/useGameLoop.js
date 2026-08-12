import { useEffect, useRef } from "react";
import { useGameStore } from "../state/useGameStore.js";
import { stepPipeline, stepMonkeyStates } from "./pipeline.js";

const TICK_RATE = 15; // Hz — simulation ticks per second
const TICK_DT = 1 / TICK_RATE;

/**
 * Drives the fixed-tick simulation loop independently of render
 * framerate, using an accumulator pattern (classic game-loop
 * technique) so the sim stays deterministic even if the browser
 * tab throttles rendering.
 *
 * Mount this once near the root of the app.
 */
export function useGameLoop() {
  const accumulatorRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const rafRef = useRef(null);

  useEffect(() => {
    function loop(now) {
      const frameDt = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;
      accumulatorRef.current += Math.min(frameDt, 0.25); // clamp to avoid spiral of death

      while (accumulatorRef.current >= TICK_DT) {
        runFixedTick(TICK_DT);
        accumulatorRef.current -= TICK_DT;
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);
}

function runFixedTick(dt) {
  const store = useGameStore.getState();

  stepMonkeyStates(dt);

  // TODO: derive these from union/police/political systems once
  // the events engine lands. Flat placeholders for now so the
  // pipeline is testable end-to-end.
  const wellbeingFactor = 0.5 + store.workerWellbeing / 200; // 0.5..1.0
  const corruptionDrain = store.corruption / 100;

  const coinsThisTick = stepPipeline(dt, {
    wellbeingFactor,
    corruptionDrain,
  });

  if (coinsThisTick > 0) {
    store.deliverCoin(coinsThisTick);
  }
  store.setCurrentRate(coinsThisTick / dt);
  store.tickStreak(dt);
}
