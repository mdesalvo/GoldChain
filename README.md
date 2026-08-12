# GoldChain

A satirical tycoon/idle game. A society of monkeys exists for a
single purpose: deliver exactly **1 coin per second** to a deified,
astronomically-paid celebrity. The player's job is to keep that
number steady against strikes, breakdowns, mafia sabotage, political
upheaval, and the Deity's inevitable wrath when the flow stops.

<!--img src="https://raw.githubusercontent.com/mdesalvo/GoldChain/master/art-source/GoldChain.jpg" alt="The concept art the whole UI is built from" width="100%" /-->

## Production chain

```
Miners -> Transporters -> Smelters -> Minters -> Payer -> [The Deity]
```

## Societal layer

- **Unionizers** — fight for worker rights; ignoring them too long triggers strikes.
- **Politicians** — legislate, changing game rules at runtime (taxes, safety regs).
- **Doctors / Nurses** — treat injuries from mine collapses, furnace accidents, etc.
- **Police vs. Mafiosi** — security layer; weak policing lets corruption siphon gold.

## Architecture

```
UI Layer        React + CSS            panels over a painted set, no animation
Render Layer    concept art + R3F      painted backdrop; live 3D behind a toggle
Simulation      Miniplex (ECS)         fixed-tick (15Hz) pipeline + monkey FSM
Events Engine   XState (v5)            strikes, breakdowns, mafia raids, laws
```

The simulation runs on a **fixed timestep accumulator**, decoupled
from render framerate, so the game stays deterministic regardless of
device performance (see `src/simulation/useGameLoop.js`).

## Stack

- [Vite](https://vitejs.dev/) — build tooling
- [React](https://react.dev/) — the UI, which is most of the game
- [XState](https://stately.ai/docs) — one state machine per disruption
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) — the live 3D view
- [Miniplex](https://github.com/hmans/miniplex) — ECS for the monkey population
- [Zustand](https://github.com/pmndrs/zustand) — global game state

## Getting started

```bash
npm install
npm run dev
```

Open the printed local URL. The screen is the society in cross-section —
the Deity enthroned above, the chain grinding below — with the panels of
a management game laid over it: the flow you are keeping alive, the four
institutions you can spend on, the work units along the bottom, and the
reserve the tribute is actually paid from.
