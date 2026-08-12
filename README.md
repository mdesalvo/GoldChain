# GoldChain

*(working title — the game will probably ship as **Divine Flow**.)*

A satirical tycoon/idle game. A society of monkeys exists for a
single purpose: deliver exactly **1 coin per second** to a deified,
astronomically-paid celebrity. The player's job is to keep that
number steady against strikes, breakdowns, mafia sabotage, political
upheaval, and the Deity's inevitable wrath when the flow stops.

<img src="https://raw.githubusercontent.com/mdesalvo/GoldChain/master/art-source/GoldChain.jpg" alt="The concept art the whole UI is built from" width="100%" />

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
a management game laid over it: the flow you are keeping alive, the five
institutions you can spend on, the work units along the bottom, and the
reserve the tribute is actually paid from.

Add `?skip=180` to fast-forward 180 simulated seconds before the first
paint. A fresh game shows every meter at its starting value, which is the
one state that tells you nothing.

Nothing on screen animates. Everything that moves is a number being
written into a panel.

### Watching a run without a browser

```bash
npm run sim -- 20 42 invest     # 20 minutes, seed 42, an investing player
```

The harness drives the real simulation and prints a timeline of every
disruption. Strategies are `watch`, `invest` and `exploit`; comparing them
is how the central design claim gets tested — that neglecting the
societal layer maximises short-term flow and makes the society fragile.

### Regenerating the art

```bash
python3 scripts/extract-art.py
```

Everything in `public/art/` is cut from the concept image in
`art-source/`, including the backdrop, which is the whole concept with the
regions its own UI occupied painted back out. Never edit the output by
hand. Requires Pillow; uses `optipng` and `jpegoptim` if present.

## Project status

Playable loop, no progression. Implemented:

- [x] ECS world with every pipeline and societal role
- [x] Fixed-tick simulation, deterministic and seeded, runnable headless
- [x] Bucket-chain economy with finite buffers, backpressure, and a reserve
      the Deity is paid from at exactly the demanded rate
- [x] Events engine — one XState machine per disruption type
- [x] Medical system, societal drift, deity mood and wrath, quota ratchet
- [x] Player actions, all paid for out of the same reserve the Deity is
- [x] Full UI over the painted set, built from the concept art
- [x] Headless balance harness with scripted strategies

Not yet implemented:

- [ ] Progression: the Build, Workers, Research, Decrees, Stats and
      Achievements tabs are visible and disabled
- [ ] Concurrent laws — the legislature passes one at a time
- [ ] Save/load, difficulty tuning, win/loss conditions
- [ ] Real monkey models for the 3D view (still coloured capsules)

**Known balance gap.** Over forty minutes, doing nothing currently beats
both investing and exploiting, and ends with the Deity delighted. The
design tension is in the code but not yet in the numbers. See `CLAUDE.md`.

## Folder structure

```
src/
  ui/               the game screen: panels, rails, strip. All CSS + JS
  render/           R3F scene for the live 3D view
  simulation/       ECS world, economy, player actions, fixed-tick loop
  events/           XState machines per disruption + the engine over them
  state/            Zustand global store
scripts/
  extract-art.py    cuts every asset out of the concept image
  simulate.mjs      headless balance harness
art-source/         the concept still and clip. Not served
```
