import { treasury } from "./pipeline.js";
import {
  ROLES,
  PIPELINE_ORDER,
  STATES,
  byRole,
  ableWorkerCount,
  countByRole,
  spawnMonkey,
  stagePosition,
  world,
} from "./world.js";
import { treatmentCapacity } from "./medical.js";
import { useGameStore } from "../state/useGameStore.js";
import { EVENT_TYPES } from "../events/eventTypes.js";
import { eventsEngine } from "../events/eventsEngine.js";

/**
 * What the player can actually do.
 *
 * Every action is paid for out of the reserve — the same reserve the
 * Deity is paid from. That is the whole game in one resource: there is
 * no separate "social budget" to spend, so funding the hospital, the
 * unions or the police is always coin that does not reach the Deity,
 * and the bill arrives as a dip in cover exactly when you can least
 * afford it.
 *
 * Reassignment actions move a monkey between roles instead of spawning
 * one. The population is fixed: a nurse is a miner who stopped mining.
 * Spawning would make resilience free, which would turn the systemic
 * layer into the upgrade tree the design explicitly rejects.
 */

/**
 * Reassignment goes through remove + add rather than mutating `role` in
 * place, because miniplex only re-evaluates the cached role buckets when
 * an entity enters or leaves the world. Mutating `role` would leave the
 * monkey counted under its old job forever.
 */
function reassign(fromRole, toRole) {
  let donor = null;
  for (const candidate of byRole(fromRole)) {
    // Never pull someone off a stretcher to staff a police station.
    if (candidate.state !== STATES.INJURED) {
      donor = candidate;
      break;
    }
  }
  if (!donor) return false;

  world.remove(donor);
  const count = countByRole(toRole) + 1;
  spawnMonkey(toRole, stagePosition(toRole, count - 1, count));
  return true;
}

/** The pipeline stage with the most hands to spare. */
function deepestStage() {
  let best = null;
  let bestCount = 1; // never strip a stage down to nothing
  for (const role of PIPELINE_ORDER) {
    const n = ableWorkerCount(role);
    if (n > bestCount) {
      bestCount = n;
      best = role;
    }
  }
  return best;
}

/** The societal role with the most slack, for the reverse move. */
function fattestSocietalRole() {
  let best = null;
  let bestCount = 0;
  for (const role of [ROLES.UNIONIZER, ROLES.POLICE, ROLES.NURSE]) {
    const n = ableWorkerCount(role);
    if (n > bestCount) {
      bestCount = n;
      best = role;
    }
  }
  return bestCount > 1 ? best : null;
}

/**
 * The action registry.
 *
 * `available` decides whether the button is live; `perform` returns a
 * notification describing what happened (or null if it turned out to be
 * impossible after all). Neither may assume it is called at any
 * particular point in the tick.
 *
 * Labels are single words wherever possible, as the concept's are: long
 * ones wrapped three buttons onto three rows and pushed the system rail
 * past the box the concept gives it. The hint carries the meaning.
 *
 * Prices are set against the reserve's fill rate, not picked for feel.
 * Surplus production is roughly a quarter of a coin per second, so a
 * 12-cost retraining is about 45 seconds of flawless operation and
 * spending it costs the player most — not all — of their cover. If the
 * chain's throughput changes, these numbers have to move with it, or
 * the whole action layer silently becomes unreachable.
 */
export const ACTIONS = [
  {
    id: "negotiate",
    label: "Negotiate",
    system: EVENT_TYPES.STRIKE,
    cost: 6,
    cooldown: 6,
    hint: "Concede to the picket line. Speeds the settlement and lifts wellbeing.",
    available: () =>
      ["brewing", "active", "negotiating"].includes(
        eventsEngine.stateOf(EVENT_TYPES.STRIKE)
      ),
    perform: (store) => {
      eventsEngine.send(EVENT_TYPES.STRIKE, { type: "CONCEDE" });
      store.applySystemicDeltas({ workerWellbeing: 7 });
      return {
        tone: "good",
        message: "Concessions offered at the table.",
      };
    },
  },

  {
    id: "back-bill",
    label: "Back",
    system: EVENT_TYPES.LEGISLATION,
    cost: 8,
    cooldown: 5,
    hint: "Whip votes for the bill on the floor.",
    available: () => eventsEngine.stateOf(EVENT_TYPES.LEGISLATION) === "debating",
    perform: () => {
      eventsEngine.send(EVENT_TYPES.LEGISLATION, {
        type: "LOBBY",
        direction: 1,
      });
      return { tone: "law", message: "Votes whipped in favour of the bill." };
    },
  },

  {
    id: "block-bill",
    label: "Block",
    system: EVENT_TYPES.LEGISLATION,
    cost: 8,
    cooldown: 5,
    hint: "Bury the bill in committee. Costs stability.",
    available: () => eventsEngine.stateOf(EVENT_TYPES.LEGISLATION) === "debating",
    perform: (store) => {
      eventsEngine.send(EVENT_TYPES.LEGISLATION, {
        type: "LOBBY",
        direction: -1,
      });
      store.applySystemicDeltas({ politicalStability: -3 });
      return { tone: "info", message: "The bill is being buried in committee." };
    },
  },

  {
    id: "crackdown",
    label: "Raid",
    system: EVENT_TYPES.MAFIA_RAID,
    cost: 8,
    cooldown: 8,
    hint: "Throw the whole force at the convoy routes. Good chance of foiling the job.",
    available: () =>
      ["casing", "raiding"].includes(eventsEngine.stateOf(EVENT_TYPES.MAFIA_RAID)),
    perform: () => {
      eventsEngine.send(EVENT_TYPES.MAFIA_RAID, { type: "CRACKDOWN" });
      return { tone: "info", message: "Every officer is on the convoy routes." };
    },
  },

  {
    id: "investigate",
    label: "Investigate",
    system: EVENT_TYPES.MAFIA_RAID,
    cost: 5,
    cooldown: 12,
    hint: "Root out infiltration. Cuts corruption now, does nothing about why it grows.",
    available: (store) => store.corruption > 5,
    perform: (store) => {
      store.applySystemicDeltas({ corruption: -12 });
      return { tone: "good", message: "Internal affairs made some arrests." };
    },
  },

  {
    id: "staff-hospital",
    label: "Build ward",
    system: "medical",
    cost: 12,
    cooldown: 15,
    hint: "Retrain a chain worker as a nurse. Permanent treatment capacity, permanently fewer hands on the gold.",
    available: () => deepestStage() !== null,
    perform: () => {
      const from = deepestStage();
      if (!from || !reassign(from, ROLES.NURSE)) return null;
      return {
        tone: "good",
        message: `A ${from} retrained as a nurse. Treatment capacity now ${Math.round(
          treatmentCapacity()
        )}.`,
      };
    },
  },

  {
    id: "hire-police",
    label: "Hire",
    system: EVENT_TYPES.MAFIA_RAID,
    cost: 12,
    cooldown: 15,
    hint: "Retrain a chain worker as police. Lowers where corruption settles, at the cost of throughput.",
    available: () => deepestStage() !== null,
    perform: () => {
      const from = deepestStage();
      if (!from || !reassign(from, ROLES.POLICE)) return null;
      return {
        tone: "good",
        message: `A ${from} took the badge. ${ableWorkerCount(
          ROLES.POLICE
        )} officers on duty.`,
      };
    },
  },

  {
    id: "fund-union",
    label: "Fund",
    system: EVENT_TYPES.STRIKE,
    cost: 12,
    cooldown: 15,
    hint: "Retrain a chain worker as a unionizer. Raises baseline wellbeing and gives you someone able to end a strike.",
    available: () => deepestStage() !== null,
    perform: () => {
      const from = deepestStage();
      if (!from || !reassign(from, ROLES.UNIONIZER)) return null;
      return {
        tone: "good",
        message: `A ${from} joined the union office.`,
      };
    },
  },

  {
    id: "back-to-work",
    label: "Rehire",
    system: "chain",
    cost: 3,
    cooldown: 15,
    hint: "Put a union, police or hospital monkey back on the production chain. More throughput now, less resilience later.",
    available: () => fattestSocietalRole() !== null,
    perform: () => {
      const from = fattestSocietalRole();
      if (!from) return null;
      // Reinforce wherever the chain is thinnest.
      let target = PIPELINE_ORDER[0];
      let thinnest = Infinity;
      for (const role of PIPELINE_ORDER) {
        const n = ableWorkerCount(role);
        if (n < thinnest) {
          thinnest = n;
          target = role;
        }
      }
      if (!reassign(from, target)) return null;
      return {
        tone: "warn",
        message: `A ${from} was reassigned to ${target}. Resilience traded for throughput.`,
      };
    },
  },

  {
    id: "emergency-pay",
    label: "Emergency pay",
    system: "deity",
    cost: 0, // priced as a fraction of the reserve, below
    cooldown: 25,
    hint: "Empty a tenth of the reserve into the Deity's hands as an apology. Buys mood, costs your cover.",
    available: (store) => treasury.reserves > 5 && store.deityMood < 60,
    perform: (store) => {
      const tribute = treasury.reserves * 0.1;
      treasury.reserves -= tribute;
      store.deliverCoin(tribute);
      // Placating scales with the size of the gesture, but flattery has
      // diminishing returns — you cannot buy your way to delighted.
      store.applySystemicDeltas({ deityMood: Math.min(18, 4 + tribute) });
      return {
        tone: "deity",
        message: `${tribute.toFixed(
          1
        )} coins pressed into the Deity's hands as an apology.`,
      };
    },
  },
];

const byId = new Map(ACTIONS.map((action) => [action.id, action]));

// Remaining cooldown per action id, in seconds. Ticked by the
// simulation, so it is paused when the game is and unaffected by
// framerate.
const cooldowns = new Map();

export function stepActionCooldowns(dt) {
  for (const [id, remaining] of cooldowns) {
    const next = remaining - dt;
    if (next <= 0) cooldowns.delete(id);
    else cooldowns.set(id, next);
  }
}

function priceOf(action) {
  return action.id === "emergency-pay" ? 0 : action.cost;
}

/**
 * Attempts an action. Returns a notification to show the player, or a
 * refusal explaining why nothing happened — the UI disables unaffordable
 * buttons, but the check has to live here too, because availability can
 * change between the render and the click.
 */
export function performAction(id, store) {
  const action = byId.get(id);
  if (!action) return null;

  if (cooldowns.has(id)) {
    return { tone: "info", message: `${action.label} is not ready yet.` };
  }
  if (!action.available(store)) {
    return { tone: "info", message: `${action.label} is not possible right now.` };
  }

  const price = priceOf(action);
  if (treasury.reserves < price) {
    return {
      tone: "warn",
      message: `Not enough in the reserve for ${action.label} (needs ${price}).`,
    };
  }

  treasury.reserves -= price;
  const outcome = action.perform(store);
  if (!outcome) {
    treasury.reserves += price; // nothing happened, nothing charged
    return { tone: "info", message: `${action.label} found nobody to move.` };
  }

  cooldowns.set(id, action.cooldown);
  return outcome;
}

/**
 * Entry point for the UI: perform an action and report it in the feed.
 *
 * Runs on click, i.e. between ticks rather than inside one. That is
 * safe because everything it touches — the reserve, entity roles,
 * machine context, the store — is read fresh at the start of each tick,
 * so an action lands as if it had happened just before the next one.
 */
export function invokeAction(id) {
  const store = useGameStore.getState();
  const outcome = performAction(id, store);
  const action = byId.get(id);
  if (outcome) {
    // `actionId` is what a popup actually routes on (see `ACTION_CARD` in
    // SystemRail.jsx): it's the button the player clicked, which is not
    // always the same card as `action.system` implies. "Rehire" lives on
    // the Union card because that's where the concept puts it, but its
    // system is "chain" — it moves a worker out of *any* societal role,
    // not just the union's. Routing on `system` alone left its outcome
    // with nowhere to land.
    store.pushNotifications([{ system: action?.system, actionId: id, ...outcome }]);
  }
  return outcome;
}

/** UI-facing view of every action: affordable, ready, allowed. */
export function actionSnapshot(store) {
  return ACTIONS.map((action) => {
    const price = priceOf(action);
    return {
      id: action.id,
      label: action.label,
      hint: action.hint,
      system: action.system,
      cost: price,
      cooldown: cooldowns.get(action.id) ?? 0,
      enabled:
        !cooldowns.has(action.id) &&
        action.available(store) &&
        treasury.reserves >= price,
    };
  });
}
