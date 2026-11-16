// collide.js — the only code that tests geometry: bodies against the map's boxes,
// rays against boxes (bullets, sight) and walkable segments (navigation).
import { BOXES } from './map.js';

const EPS = 1e-4;

// the first box a body (square footprint r, height h, feet at y) overlaps, or null
export function blocker(x, y, z, r, h) {
  for (let i = 0; i < BOXES.length; i++) {
    const b = BOXES[i];
    if (x + r > b.x0 && x - r < b.x1 && z + r > b.z0 && z - r < b.z1 && y + h > b.y0 && y < b.y1) return b;
  }
  return null;
}

// Move a body by its velocity one axis at a time, sliding along what it meets.
// `o` needs x,y,z,vx,vy,vz and gets `grounded`; `bounce` > 0 reflects (grenades).
export function moveBody(o, dt, r, h, gravity, bounce) {
  let hit = false;
  let nx = o.x + o.vx * dt;
  let b = blocker(nx, o.y, o.z, r, h);
  if (b) { nx = o.vx > 0 ? b.x0 - r - EPS : b.x1 + r + EPS; o.vx *= -bounce; hit = true; }
  o.x = nx;

  let nz = o.z + o.vz * dt;
  b = blocker(o.x, o.y, nz, r, h);
  if (b) { nz = o.vz > 0 ? b.z0 - r - EPS : b.z1 + r + EPS; o.vz *= -bounce; hit = true; }
  o.z = nz;

  o.vy -= gravity * dt;
  let ny = o.y + o.vy * dt;
  o.grounded = false;
  b = ny > 0 ? blocker(o.x, ny, o.z, r, h) : null;
  if (ny <= 0 || (b && o.vy <= 0)) {
    ny = b ? b.y1 : 0;
    if (bounce > 0 && o.vy < -2) { o.vy *= -bounce; hit = true; } else { o.vy = 0; o.grounded = true; }
  } else if (b) { ny = b.y0 - h - EPS; o.vy = 0; }
  o.y = ny;
  return hit;
}

// Distance along a ray to an axis-aligned box, or `max` when it misses within max.
export function rayBox(ox, oy, oz, dx, dy, dz, x0, y0, z0, x1, y1, z1, max) {
  let t0 = 0, t1 = max;
  if (Math.abs(dx) < EPS) { if (ox < x0 || ox > x1) return max; } else {
    let a = (x0 - ox) / dx, c = (x1 - ox) / dx; if (a > c) { const s = a; a = c; c = s; }
    if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) return max;
  }
  if (Math.abs(dz) < EPS) { if (oz < z0 || oz > z1) return max; } else {
    let a = (z0 - oz) / dz, c = (z1 - oz) / dz; if (a > c) { const s = a; a = c; c = s; }
    if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) return max;
  }
  if (Math.abs(dy) < EPS) { if (oy < y0 || oy > y1) return max; } else {
    let a = (y0 - oy) / dy, c = (y1 - oy) / dy; if (a > c) { const s = a; a = c; c = s; }
    if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) return max;
  }
  return t0;
}

// Distance along a ray to the nearest map box or the floor, capped at max.
export function rayWorld(ox, oy, oz, dx, dy, dz, max) {
  let best = max;
  if (dy < -EPS) { const t = -oy / dy; if (t >= 0 && t < best) best = t; }
  for (let i = 0; i < BOXES.length; i++) {
    const b = BOXES[i];
    best = rayBox(ox, oy, oz, dx, dy, dz, b.x0, b.y0, b.z0, b.x1, b.y1, b.z1, best);
  }
  return best;
}

// true when nothing solid lies between two points
export function clearLine(ax, ay, az, bx, by, bz) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (len < EPS) return true;
  return rayWorld(ax, ay, az, dx / len, dy / len, dz / len, len) >= len - 0.01;
}

// true when a body of radius r can walk the straight segment (anything below head height blocks)
export function clearWalk(ax, az, bx, bz, r) {
  const dx = bx - ax, dz = bz - az;
  for (let i = 0; i < BOXES.length; i++) {
    const b = BOXES[i];
    if (b.y0 > 1.8) continue;
    let t0 = 0, t1 = 1;
    const x0 = b.x0 - r, x1 = b.x1 + r, z0 = b.z0 - r, z1 = b.z1 + r;
    if (Math.abs(dx) < EPS) { if (ax <= x0 || ax >= x1) continue; } else {
      let a = (x0 - ax) / dx, c = (x1 - ax) / dx; if (a > c) { const s = a; a = c; c = s; }
      if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 >= t1) continue;
    }
    if (Math.abs(dz) < EPS) { if (az <= z0 || az >= z1) continue; } else {
      let a = (z0 - az) / dz, c = (z1 - az) / dz; if (a > c) { const s = a; a = c; c = s; }
      if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 >= t1) continue;
    }
    return false;
  }
  return true;
}
