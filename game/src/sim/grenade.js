// grenade.js — the pulse grenade: thrown on an arc, bounces off the map, bursts on a fuse.
import { GRENADE, GEAR } from './config.js';
import { moveBody, clearLine } from './collide.js';
import { eyeHeight } from './actor.js';
import { EV, emit, makeNoise } from './events.js';
import { hurt } from './damage.js';

export function throwGrenade(state, a) {
  const g = state.grenades.find((slot) => !slot.active);
  if (!g) return;
  a.grenades--; a.throwT = GRENADE.cooldown;
  const cp = Math.cos(a.pitch);
  const dx = -Math.sin(a.yaw) * cp, dy = Math.sin(a.pitch), dz = -Math.cos(a.yaw) * cp;
  g.active = true; g.owner = a.index; g.fuse = GRENADE.fuse; g.grounded = false;
  g.x = a.x + dx * 0.3; g.y = a.y + eyeHeight(a) - 0.1; g.z = a.z + dz * 0.3;
  g.vx = dx * GRENADE.speed + a.vx * 0.5; g.vy = dy * GRENADE.speed + GRENADE.lift; g.vz = dz * GRENADE.speed + a.vz * 0.5;
  emit(state, EV.THROW, a.index, 0, 0, g.x, g.y, g.z);
}

function burst(state, g) {
  g.active = false;
  const owner = state.actors[g.owner];
  emit(state, EV.BLAST, g.owner, 0, 0, g.x, g.y, g.z);
  for (const e of state.actors) {
    if (!e.alive || (e.team === owner.team && e !== owner)) continue;   // no team damage, but mind your own
    const cy = e.y + eyeHeight(e) * 0.6;
    const d = Math.hypot(e.x - g.x, cy - g.y, e.z - g.z);
    if (d >= GRENADE.radius || !clearLine(g.x, g.y + 0.2, g.z, e.x, cy, e.z)) continue;
    hurt(state, e, owner, GRENADE.damage * (1 - d / GRENADE.radius), false, GEAR.pulse.name);
  }
}

export function stepGrenades(state, dt) {
  for (const g of state.grenades) {
    if (!g.active) continue;
    if (g.grounded) { g.vx *= 0.9; g.vz *= 0.9; }
    if (moveBody(g, dt, g.r, g.r * 2, GRENADE.gravity, GRENADE.bounce) && Math.hypot(g.vx, g.vy, g.vz) > 2) {
      emit(state, EV.BOUNCE, 0, 0, 0, g.x, g.y, g.z);
    }
    g.fuse -= dt;
    if (g.fuse <= 0) {
      burst(state, g);
      makeNoise(state, g.x, g.z, state.actors[g.owner].team, GRENADE.loud);
    }
  }
}
