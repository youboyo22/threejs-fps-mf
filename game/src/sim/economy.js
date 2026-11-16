// economy.js — money: what a round pays, what the shop sells, and how bots spend.
import { WEAPONS, GEAR, ECON, ARMOR, PHASE } from './config.js';
import { EV, emit } from './events.js';
import { isAttacker } from './state.js';

export function priceOf(id) { return (WEAPONS[id] || GEAR[id]).price; }

// Why an operator cannot buy an item right now, or '' when it can.
export function buyBlock(state, a, id) {
  if (state.phase !== PHASE.BUY) return 'Shop is closed';
  if (WEAPONS[id] && (a.primary === id || a.sidearm === id)) return 'Owned';
  if (id === 'vest' && a.armor >= ARMOR.points) return 'Owned';
  if (id === 'pulse' && a.grenades >= GEAR.pulse.max) return 'Full';
  if (id === 'kit' && (a.kit || isAttacker(state, a))) return a.kit ? 'Owned' : 'Defenders only';
  if (a.money < priceOf(id)) return 'Not enough money';
  return '';
}

export function buy(state, a, id) {
  if (buyBlock(state, a, id)) { emit(state, EV.DENY, a.index); return false; }
  a.money -= priceOf(id);
  const w = WEAPONS[id];
  if (w) {
    a[w.slot] = id; a.active = w.slot;
    a.ammo[w.slot].mag = w.mag; a.ammo[w.slot].res = w.reserve;
  } else if (id === 'vest') a.armor = ARMOR.points;
  else if (id === 'pulse') a.grenades++;
  else a.kit = true;
  emit(state, EV.BUY, a.index, 0, 0, 0, 0, 0, id);
  return true;
}

// Bots buy up when they can afford a rifle and a vest, force a cheap SMG on a
// middling bank, and otherwise save.
export function botBuy(state, a) {
  const roll = state.rng();
  if (!a.primary) {
    if (a.money >= 4350 && roll < 0.2) buy(state, a, 'longline');
    else if (a.money >= 3350) buy(state, a, 'halyard');
    else if (a.money >= 1900 && roll < 0.7) buy(state, a, 'skiff');
  }
  if (a.primary && a.armor < 50) buy(state, a, 'vest');
  if (a.primary && state.rng() < 0.6) buy(state, a, 'pulse');
  if (a.primary && !isAttacker(state, a) && state.rng() < 0.5) buy(state, a, 'kit');
}

// End-of-round pay: winners a flat sum, losers a sum that grows with their losing streak.
export function payRound(state, winner) {
  const round = state.round, loser = 1 - winner;
  round.lossStreak[winner] = 0;
  const lossPay = Math.min(ECON.lossMax, ECON.loss + ECON.lossStep * round.lossStreak[loser]);
  round.lossStreak[loser]++;
  for (const a of state.actors) {
    a.money = Math.min(ECON.max, a.money + (a.team === winner ? ECON.win : lossPay));
  }
}

export function reward(a, amount) { a.money = Math.min(ECON.max, a.money + amount); }
