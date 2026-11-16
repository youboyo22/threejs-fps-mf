// round.js — the match: buy phase, live round, the beacon objective, who wins
// and why, the half-time side swap and the final score.
import { RULES, PHASE, TEAM, ECON } from './config.js';
import { SPAWNS, PLANS, SETUPS, siteAt } from './map.js';
import { EV, emit } from './events.js';
import { isAttacker, aliveCount } from './state.js';
import { resetLoadout, fillAmmo } from './actor.js';
import { botBuy, payRound, reward } from './economy.js';
import { briefBot } from './bots.js';

function pick(state, list) { return list[Math.floor(state.rng() * list.length)]; }

function resetEconomy(state) {
  state.round.lossStreak[0] = state.round.lossStreak[1] = 0;
  for (const a of state.actors) { a.money = ECON.start; a.alive = false; }   // "not alive" drops last half's gear
}

export function startMatch(state) {
  const r = state.round;
  r.number = 0; r.score[0] = r.score[1] = 0; r.attackers = TEAM.TIDE;
  for (const a of state.actors) { a.kills = 0; a.downs = 0; }
  resetEconomy(state);
  startRound(state);
}

export function startRound(state) {
  const r = state.round;
  r.number++; r.winner = -1; r.reason = '';
  r.plan = pick(state, PLANS); r.setup = pick(state, SETUPS);
  state.phase = PHASE.BUY; state.phaseT = RULES.buyTime;
  state.intel[0].site = state.intel[1].site = null;
  for (const g of state.grenades) g.active = false;

  let nAttack = 0, nDefend = 0;
  for (const a of state.actors) {
    const attacking = isAttacker(state, a);
    const spawn = attacking ? SPAWNS.attack[nAttack++] : SPAWNS.defend[nDefend++];
    if (a.alive) fillAmmo(a); else resetLoadout(a);     // survivors keep their kit
    if (attacking) a.kit = false;
    a.alive = true; a.hp = 100;
    a.x = a.px = spawn[0]; a.z = a.pz = spawn[1]; a.y = a.py = 0;
    a.vx = a.vy = a.vz = 0; a.yaw = attacking ? 0 : Math.PI; a.pitch = 0; a.crouch = 0;
    a.fireT = a.reloadT = a.drawT = a.throwT = a.useT = 0; a.bloom = a.recoilP = a.recoilY = 0; a.burst = 0;
    if (a.primary) a.active = 'primary';
  }
  const beacon = state.beacon;
  beacon.state = 'carried'; beacon.site = null; beacon.beepT = 0;
  beacon.carrier = r.attackers * RULES.teamSize + Math.floor(state.rng() * RULES.teamSize);
  for (const a of state.actors) if (a.bot) { botBuy(state, a); briefBot(state, a); }
  emit(state, EV.ROUND_START, r.number);
}

function endRound(state, winner, reason) {
  const r = state.round;
  r.winner = winner; r.reason = reason; r.score[winner]++;
  payRound(state, winner);
  state.phase = PHASE.POST; state.phaseT = RULES.postTime;
  emit(state, EV.ROUND_END, winner, 0, 0, 0, 0, 0, reason);
}

function plant(state, a) {
  const beacon = state.beacon;
  beacon.state = 'planted'; beacon.carrier = -1; beacon.site = siteAt(a.x, a.z);
  beacon.x = a.x; beacon.y = a.y; beacon.z = a.z; beacon.beepT = 0;
  state.phase = PHASE.PLANTED; state.phaseT = RULES.fuseTime;
  a.useT = 0;
  for (const mate of state.actors) if (mate.team === a.team) reward(mate, ECON.plant);
  emit(state, EV.PLANTED, a.index, 0, 0, beacon.x, beacon.y, beacon.z, beacon.site.name);
}

// Planting and defusing are the same act: stand still and hold USE until the bar fills.
function stepBeacon(state, dt) {
  const beacon = state.beacon, attackers = state.round.attackers;
  for (const a of state.actors) {
    const attacking = a.team === attackers;
    let using = a.alive && a.cmd.use && a.grounded;
    if (using && attacking) using = state.phase === PHASE.LIVE && beacon.carrier === a.index && siteAt(a.x, a.z) !== null;
    else if (using) using = beacon.state === 'planted' && Math.hypot(a.x - beacon.x, a.z - beacon.z) < 1.5;
    if (!using) { a.useT = 0; continue; }
    if (a.useT === 0) emit(state, EV.PLANTING, a.index, attacking ? 0 : 1, 0, a.x, a.y, a.z);
    a.useT += dt;
    if (attacking && a.useT >= RULES.plantTime) plant(state, a);
    else if (!attacking && a.useT >= (a.kit ? RULES.kitDefuseTime : RULES.defuseTime)) {
      beacon.state = 'defused'; a.useT = 0;
      reward(a, ECON.defuse);
      emit(state, EV.DEFUSED, a.index, 0, 0, beacon.x, beacon.y, beacon.z);
      endRound(state, a.team, 'Beacon defused');
      return;
    }
  }
  if (beacon.state === 'dropped') {
    for (const a of state.actors) {
      if (!a.alive || a.team !== attackers || Math.hypot(a.x - beacon.x, a.z - beacon.z) > 1.1) continue;
      beacon.state = 'carried'; beacon.carrier = a.index;
      emit(state, EV.PICKUP, a.index);
      break;
    }
  } else if (beacon.state === 'planted') {
    beacon.beepT -= dt;
    if (beacon.beepT <= 0) {
      beacon.beepT = 0.14 + 0.9 * Math.max(0, state.phaseT / RULES.fuseTime);
      emit(state, EV.BEEP, 0, 0, 0, beacon.x, beacon.y, beacon.z);
    }
  }
}

function judge(state) {
  const attackers = state.round.attackers, defenders = 1 - attackers;
  const nDefend = aliveCount(state, defenders);
  if (state.phase === PHASE.PLANTED) {
    if (state.phaseT <= 0) {
      const beacon = state.beacon;
      beacon.state = 'done';
      emit(state, EV.DETONATED, 0, 0, 0, beacon.x, beacon.y, beacon.z);
      endRound(state, attackers, 'Uplink complete');
    } else if (nDefend === 0) endRound(state, attackers, 'Defenders eliminated');
  } else if (state.phase === PHASE.LIVE) {
    if (nDefend === 0) endRound(state, attackers, 'Defenders eliminated');
    else if (aliveCount(state, attackers) === 0) endRound(state, defenders, 'Attackers eliminated');
    else if (state.phaseT <= 0) endRound(state, defenders, 'Time ran out');
  }
}

function advance(state) {
  const r = state.round;
  if (Math.max(r.score[0], r.score[1]) >= RULES.winRounds) { state.phase = PHASE.END; return; }
  if (r.number === RULES.halfRounds) {
    r.attackers = 1 - r.attackers;
    resetEconomy(state);
    emit(state, EV.SWAP, r.attackers);
  }
  startRound(state);
}

export function stepRound(state, dt) {
  if (state.phase === PHASE.END) return;
  state.phaseT -= dt;
  if (state.phase === PHASE.BUY) {
    if (state.phaseT <= 0) { state.phase = PHASE.LIVE; state.phaseT = RULES.roundTime; emit(state, EV.LIVE); }
  } else if (state.phase === PHASE.POST) {
    if (state.phaseT <= 0) advance(state);
  } else {
    stepBeacon(state, dt);
    judge(state);
  }
}
