# GoldChain

A satirical 3D tycoon/idle game. A society of monkeys exists for a
single purpose: deliver exactly **1 coin per second** to a deified,
astronomically-paid celebrity. The player's job is to keep that
number steady against strikes, breakdowns, mafia sabotage, political
upheaval, and the Deity's inevitable wrath when the flow stops.

<img src="https://github.com/mdesalvo/GoldChain/blob/master/art-source/GoldChain.jpg" alt="GoldChain Logo" width="100%" />
</a>

## Production chain

```
Miners -> Haulers -> Smelters -> Goldsmiths -> Drivers
   -> Bankers -> Tellers -> Payer -> [The Deity]
```

## Societal layer

- **Unionizers** — fight for worker rights; ignoring them too long triggers strikes.
- **Politicians** — legislate, changing game rules at runtime (taxes, safety regs).
- **Doctors / Nurses** — treat injuries from mine collapses, furnace accidents, etc.
- **Police vs. Mafiosi** — security layer; weak policing lets corruption siphon gold.

## Architecture

```
UI Layer        React + Zustand        HUD, deity mood, notifications
Render Layer    React Three Fiber      3D scene, instanced monkey meshes
Simulation      Miniplex (ECS)         fixed-tick (15Hz) pipeline + monkey FSM
Events Engine   (planned: XState)      strikes, breakdowns, mafia raids, laws
```

The simulation runs on a **fixed timestep accumulator**, decoupled
from render framerate, so the game stays deterministic regardless of
device performance (see `src/simulation/useGameLoop.js`).

## Stack

- [Vite](https://vitejs.dev/) — build tooling
- [React](https://react.dev/) + [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) — rendering
- [Miniplex](https://github.com/hmans/miniplex) — ECS for the monkey population
- [Zustand](https://github.com/pmndrs/zustand) — global game state

## Getting started

```bash
npm install
npm run dev
```

Open the printed local URL. You should see a green field populated
with color-coded capsule monkeys (placeholder art) and an HUD in the
top-left tracking coins delivered, current rate vs. target, and the
Deity's mood.

## Project status

Early scaffold. Currently implemented:

- [x] Project structure (render / simulation / state layers)
- [x] ECS world with all pipeline + societal roles
- [x] Fixed-tick simulation loop with a basic bucket-chain economy model
- [x] Instanced 3D rendering of the monkey population
- [x] Minimal HUD (coins delivered, rate, streak, deity mood)

Not yet implemented:

- [ ] Events engine (strikes, breakdowns, mafia raids, legislation) — planned with XState
- [ ] Real monkey models/animations (currently colored capsules)
- [ ] Pathfinding / movement between pipeline stages
- [ ] Deity reaction system (visual/audio feedback tied to mood)
- [ ] Save/load, difficulty tuning, win/loss conditions

## Folder structure

```
src/
  render/          Scene, HUD, and all visual components (R3F)
  simulation/       ECS world, pipeline economy, fixed-tick game loop
  state/            Zustand global store
  events/           (planned) event engine for disruptions
```
