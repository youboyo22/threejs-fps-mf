// sim.js — one fixed step of the whole simulation. No three.js, no DOM: this
// runs the same in the browser and under `node game/test/selftest.mjs`.
import { TICK } from './config.js';
import { driveBot } from './bots.js';
import { stepMovement } from './actor.js';
import { stepWeapon } from './weapons.js';
import { stepGrenades } from './grenade.js';
import { stepRound } from './round.js';

export function stepSim(state) {
  for (const a of state.actors) {
    if (!a.alive) { a.downT += TICK; a.px = a.x; a.py = a.y; a.pz = a.z; continue; }
    if (a.bot) driveBot(state, a, TICK);
    stepMovement(state, a, TICK);
    stepWeapon(state, a, TICK);
  }
  stepGrenades(state, TICK);
  stepRound(state, TICK);
  state.tick++;
  state.time += TICK;
}
