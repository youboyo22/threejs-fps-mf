// weapons.js — gunfire: the trigger, spread, recoil, the hitscan against bodies
// and walls, reloads and weapon switching. Damage itself is damage.js.
import { MOVE, PHASE } from './config.js';
import { rayWorld, rayBox } from './collide.js';
import { weaponOf, ammoOf, eyeHeight, speedOf } from './actor.js';
import { EV, emit, makeNoise } from './events.js';
import { hurt } from './damage.js';
import { throwGrenade } from './grenade.js';

const RANGE = 140;
const PART = { NONE: 0, LEGS: 1, BODY: 2, HEAD: 3 };
let hitPart = PART.NONE;   // which hitbox the last rayActor call struck

// The cone half-angle right now. Standing still and crouched it is the weapon's
// own; running, jumping and sustained fire all open it up.
export function currentSpread(a) {
  const w = weaponOf(a);
  const base = a.scoped ? w.zoomSpread : w.spread;
  const moving = Math.min(1, speedOf(a) / MOVE.run);
  const cone = base + a.bloom + w.moveSpread * moving * moving + (a.grounded ? 0 : w.airSpread);
  return a.crouch > 0.5 ? cone * 0.65 : cone;
}

// Ray against one operator's three hitboxes: head sphere, torso box, legs box.
function rayActor(e, ox, oy, oz, dx, dy, dz, max) {
  const eye = eyeHeight(e), hip = eye * 0.5;
  let best = max;
  hitPart = PART.NONE;
  // head: sphere of radius 0.18 just above eye level
  const cx = e.x - ox, cy = e.y + eye + 0.06 - oy, cz = e.z - oz;
  const along = cx * dx + cy * dy + cz * dz;
  const off2 = cx * cx + cy * cy + cz * cz - along * along;
  if (along > 0 && off2 < 0.0324) {
    const t = along - Math.sqrt(0.0324 - off2);
    if (t < best) { best = t; hitPart = PART.HEAD; }
  }
  let t = rayBox(ox, oy, oz, dx, dy, dz, e.x - 0.27, e.y + hip, e.z - 0.27, e.x + 0.27, e.y + eye - 0.13, e.z + 0.27, best);
  if (t < best) { best = t; hitPart = PART.BODY; }
  t = rayBox(ox, oy, oz, dx, dy, dz, e.x - 0.21, e.y, e.z - 0.21, e.x + 0.21, e.y + hip, e.z + 0.21, best);
  if (t < best) { best = t; hitPart = PART.LEGS; }
  return best;
}

function fire(state, a, w) {
  const am = ammoOf(a);
  am.mag--;
  a.fireT += 60 / w.rpm;
  a.sinceShot = 0;

  // aim = view + recoil offset, then a random point inside the spread cone
  const cone = currentSpread(a);
  const ang = state.rng() * Math.PI * 2, rad = Math.sqrt(state.rng()) * cone;
  const pitch = a.pitch + a.recoilP + Math.sin(ang) * rad;
  const yaw = a.yaw + a.recoilY + Math.cos(ang) * rad;
  const cp = Math.cos(pitch);
  const dx = -Math.sin(yaw) * cp, dy = Math.sin(pitch), dz = -Math.cos(yaw) * cp;
  const ox = a.x, oy = a.y + eyeHeight(a), oz = a.z;

  let best = rayWorld(ox, oy, oz, dx, dy, dz, RANGE);
  let victim = null, part = PART.NONE;
  for (const e of state.actors) {
    if (!e.alive || e.team === a.team) continue;
    const t = rayActor(e, ox, oy, oz, dx, dy, dz, best);
    if (t < best) { best = t; victim = e; part = hitPart; }
  }
  emit(state, EV.SHOT, a.index, part, 0, ox + dx * best, oy + dy * best, oz + dz * best, w.id);
  makeNoise(state, a.x, a.z, a.team, w.loud);

  if (victim) {
    const far = Math.max(0, best - w.falloff) / w.falloff;
    const scale = Math.max(w.minFalloff, 1 - far * (1 - w.minFalloff));
    const mult = part === PART.HEAD ? w.head : part === PART.LEGS ? w.legs : 1;
    hurt(state, victim, a, w.dmg * mult * scale, part === PART.HEAD, w.name);
  }

  // recoil climbs with each shot of a burst and drifts side to side in a fixed pattern
  a.burst++;
  a.recoilP = Math.min(0.22, a.recoilP + w.recoilV * (1 + Math.min(a.burst, 8) * 0.14));
  a.recoilY += w.recoilH * Math.sin(a.burst * 0.85) + (state.rng() - 0.5) * w.recoilH;
  a.bloom = Math.min(w.bloomMax, a.bloom + w.bloom);
}

function startReload(state, a, w) {
  a.reloadT = w.reload; a.scoped = false;
  emit(state, EV.RELOAD, a.index, 0, 0, a.x, a.y, a.z);
}

export function stepWeapon(state, a, dt) {
  const c = a.cmd;
  if (c.slot && c.slot !== a.active && (c.slot === 'sidearm' || a.primary)) {
    a.active = c.slot; a.drawT = 0.45; a.reloadT = 0; a.burst = 0;
    emit(state, EV.SWITCH, a.index);
  }
  c.slot = '';
  const w = weaponOf(a), am = ammoOf(a);

  a.fireT = Math.max(-dt, a.fireT - dt);
  a.drawT = Math.max(0, a.drawT - dt);
  a.throwT = Math.max(0, a.throwT - dt);
  a.sinceShot += dt;
  if (a.sinceShot > 0.28) a.burst = 0;
  const settle = Math.min(1, (a.sinceShot > 0.12 ? 9 : 3) * dt);
  a.recoilP -= a.recoilP * settle; a.recoilY -= a.recoilY * settle;
  a.bloom = Math.max(0, a.bloom - w.bloomMax * 2.4 * dt);

  if (a.reloadT > 0) {
    a.reloadT -= dt;
    if (a.reloadT <= 0) { const n = Math.min(w.mag - am.mag, am.res); am.mag += n; am.res -= n; a.reloadT = 0; }
  }
  const held = state.phase === PHASE.BUY || state.phase === PHASE.END || a.useT > 0;
  const ready = !held && a.drawT <= 0 && a.reloadT <= 0;
  a.scoped = c.scope && w.zoom > 0 && ready;

  if (c.reload && ready && am.mag < w.mag && am.res > 0) startReload(state, a, w);
  else if (c.throw && !held && a.grenades > 0 && a.throwT <= 0) throwGrenade(state, a);
  else if (c.fire && ready && a.fireT <= 0 && (w.auto || !a.triggerHeld)) {
    if (am.mag > 0) fire(state, a, w);
    else if (!a.triggerHeld) {
      emit(state, EV.DRY, a.index);
      if (am.res > 0) startReload(state, a, w);
    }
  }
  a.triggerHeld = c.fire;
}
