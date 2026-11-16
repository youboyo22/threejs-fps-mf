// state.js — the whole game in one object. Every module in sim/ reads and writes
// this and nothing else; the views only read it.
import { RULES, TEAM, PHASE, GRENADE } from './config.js';
import { makeRng } from './rng.js';
import { createEvents } from './events.js';
import { createActor } from './actor.js';
import { createBrain } from './bots.js';

const CALLSIGNS = [['You', 'Marsh', 'Odile', 'Brandt', 'Sable'], ['Vesper', 'Kato', 'Rooke', 'Imre', 'Dune']];

// auto: the player's operator is driven by a bot brain too (self-test and attract mode)
export function createState(seed = 1, auto = false) {
  const state = {
    seed, tick: 0, time: 0, rng: makeRng(seed),
    phase: PHASE.BUY, phaseT: RULES.buyTime,
    round: { number: 0, score: [0, 0], lossStreak: [0, 0], attackers: TEAM.TIDE, winner: -1, reason: '', plan: null, setup: null },
    actors: [], player: null,
    // the uplink beacon: 'carried' | 'dropped' | 'planted' | 'defused' | 'done'
    beacon: { state: 'carried', carrier: -1, x: 0, y: 0, z: 0, site: null, beepT: 0 },
    grenades: [], noises: [], noiseCount: 0,
    intel: [{ site: null, t: -99 }, { site: null, t: -99 }],   // each team's latest site call
    events: createEvents(),
  };
  for (let team = 0; team < 2; team++) {
    for (let i = 0; i < RULES.teamSize; i++) {
      const isPlayer = team === TEAM.TIDE && i === 0;
      const actor = createActor(state.actors.length, team, isPlayer, CALLSIGNS[team][i]);
      if (!isPlayer || auto) actor.bot = createBrain(i, state.actors.length);
      state.actors.push(actor);
    }
  }
  state.player = state.actors[0];
  for (let i = 0; i < 8; i++) state.grenades.push({ active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, fuse: 0, owner: 0, grounded: false, r: GRENADE.size });
  for (let i = 0; i < 32; i++) state.noises.push({ x: 0, z: 0, team: 0, range: 0 });
  return state;
}

export function isAttacker(state, actor) { return actor.team === state.round.attackers; }

export function aliveCount(state, team) {
  let n = 0;
  for (const a of state.actors) if (a.alive && a.team === team) n++;
  return n;
}
