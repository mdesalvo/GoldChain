<img src="https://raw.githubusercontent.com/mdesalvo/GoldChain/master/art-source/GoldChain.jpg" width="100%" />

# 🪙 Gold Chain - Satirical capitalist simulator

Welcome to a society built for one single purpose. **Deliver exactly one coin every second to your Deity.**

The Deity is an astronomically-paid, deified mega-celebrity. Your sole job is to keep that counter steady.

## ⚡ THE CHALLENGES
* **Quash** violent monkey strikes before they halt production.
* **Repair** catastrophic infrastructure breakdowns in real-time.
* **Outsmart** brutal mafia sabotage and sudden political upheavals.
* **Automate** the ultimate, satirical capitalist simulator.

## ⚠️ THE GOLDEN RULE
> **Never let the flow stop, or face divine wrath.**"

# Production chain

```
Miners -> Transporters -> Smelters -> Minters -> Payer -> [The Deity]
```

# Societal layer

- **Unionizers** — fight for worker rights; ignoring them too long triggers strikes.
- **Politicians** — legislate, changing game rules at runtime (taxes, safety regs).
- **Doctors / Nurses** — treat injuries from mine collapses, furnace accidents, etc.
- **Police vs. Mafiosi** — security layer; weak policing lets corruption siphon gold.

## Architecture

```
UI Layer        React + CSS         panels over a painted set, no animation
Render Layer    concept art         painted backdrop
Simulation      Miniplex (ECS)      fixed-tick (15Hz) pipeline + monkey FSM
Events Engine   XState (v5)         strikes, breakdowns, mafia raids, laws
```

The simulation runs on a **fixed timestep accumulator**, decoupled
from render framerate, so the game stays deterministic regardless of
device performance (see `src/simulation/useGameLoop.js`).

## Stack

- [Vite](https://vitejs.dev/) — build tooling
- [React](https://react.dev/) — the UI, which is most of the game
- [XState](https://stately.ai/docs) — one state machine per disruption
- [Miniplex](https://github.com/hmans/miniplex) — ECS for the monkey population
- [Zustand](https://github.com/pmndrs/zustand) — global game state

## Getting started

```bash
npm install
npm run dev
```

Open the printed URL. The screen is the society in cross-section —
the Deity enthroned above, the chain grinding below — with the panels of
a management game laid over it: the flow you are keeping alive, the four
institutions you can spend on, the work units along the bottom, and the
reserve the tribute is actually paid from.
