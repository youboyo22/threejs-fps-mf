// actor.js — one operator, player or bot: its record and how it moves.
// Player and bots share this code; they differ only in who fills `cmd`.
import { MOVE, WEAPONS, PHASE, ECON } from './config.js';
import { moveBody } from './collide.js';
import { EV, emit, makeNoise } from './events.js';

export function createActor(index, team, isPlayer, name) {
  return {
    index, team, isPlayer, name, bot: null,
    x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0, vx: 0, vy: 0, vz: 0,
    yaw: 0, pitch: 0, crouch: 0, grounded: true, stepDist: 0,
    alive: true, hp: 100, armor: 0, money: ECON.start, kills: 0, downs: 0,
    hurtTick: -1, hurtBy: -1, downT: 0,
    primary: null, sidearm: 'marlin', active: 'sidearm',
    ammo: { primary: { mag: 0, res: 0 }, sidearm: { mag: 0, res: 0 } },
    fireT: 0, reloadT: 0, drawT: 0, sinceShot: 9, burst: 0, bloom: 0, recoilP: 0, recoilY: 0,
    triggerHeld: false, scoped: false, grenades: 0, throwT: 0, kit: false, useT: 0,
    // the intent for this tick, written by input.js or bots.js
    cmd: { wishX: 0, wishZ: 0, fire: false, scope: false, crouch: false, jump: false, walk: false, reload: false, use: false, throw: false, slot: '' },
  };
}

export function weaponOf(a) { return WEAPONS[a.active === 'primary' && a.primary ? a.primary : a.sidearm]; }
export function ammoOf(a) { return a.ammo[a.active === 'primary' && a.primary ? 'primary' : 'sidearm']; }
export function eyeHeight(a) { return MOVE.eyeStand + (MOVE.eyeCrouch - MOVE.eyeStand) * a.crouch; }
export function bodyHeight(a) { return MOVE.standH + (MOVE.crouchH - MOVE.standH) * a.crouch; }
export function speedOf(a) { return Math.hypot(a.vx, a.vz); }

export function fillAmmo(a) {
  if (a.primary) { a.ammo.primary.mag = WEAPONS[a.primary].mag; a.ammo.primary.res = WEAPONS[a.primary].reserve; }
  a.ammo.sidearm.mag = WEAPONS[a.sidearm].mag; a.ammo.sidearm.res = WEAPONS[a.sidearm].reserve;
}

export function resetLoadout(a) {
  a.primary = null; a.active = 'sidearm'; a.armor = 0; a.grenades = 0; a.kit = false;
  fillAmmo(a);
}

// Quake-style ground movement: friction, then acceleration toward the wished
// velocity, so a runner needs a moment to stop and a stopped rifle is an accurate one.
export function stepMovement(state, a, dt) {
  a.px = a.x; a.py = a.y; a.pz = a.z;
  const c = a.cmd;
  const frozen = state.phase === PHASE.BUY || state.phase === PHASE.END || a.useT > 0;

  const want = c.crouch ? 1 : 0;
  const step = MOVE.crouchRate * dt;
  a.crouch += Math.max(-step, Math.min(step, want - a.crouch));

  let wx = frozen ? 0 : c.wishX, wz = frozen ? 0 : c.wishZ;
  const len = Math.hypot(wx, wz);
  if (len > 1e-3) { wx /= len; wz /= len; }
  let top = MOVE.run * weaponOf(a).speed;
  if (a.crouch > 0.5) top = MOVE.crouch; else if (c.walk) top = MOVE.walk;
  if (a.scoped) top *= 0.55;
  const wishSpeed = top * Math.min(1, len);

  if (a.grounded) {
    const sp = Math.hypot(a.vx, a.vz);
    if (sp > 1e-4) {
      const k = Math.max(0, sp - Math.max(sp, MOVE.stopSpeed) * MOVE.friction * dt) / sp;
      a.vx *= k; a.vz *= k;
    }
    if (c.jump && !frozen) { a.vy = MOVE.jump; a.grounded = false; }
  }
  c.jump = false;
  const add = wishSpeed - (a.vx * wx + a.vz * wz);
  if (add > 0) {
    const acc = Math.min(add, (a.grounded ? MOVE.accel : MOVE.airAccel) * dt * wishSpeed);
    a.vx += acc * wx; a.vz += acc * wz;
  }
  moveBody(a, dt, MOVE.radius, bodyHeight(a), MOVE.gravity, 0);

  // running is loud, walking and crouching are silent
  const sp = Math.hypot(a.vx, a.vz);
  if (a.grounded && sp > MOVE.walk + 0.8) {
    a.stepDist += sp * dt;
    if (a.stepDist >= MOVE.stepLength) {
      a.stepDist = 0;
      emit(state, EV.STEP, a.index, 0, 0, a.x, a.y, a.z);
      makeNoise(state, a.x, a.z, a.team, 11);
    }
  }
}
