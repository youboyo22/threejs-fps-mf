// events.js — the one-way channel from simulation to presentation.
// The simulation writes what happened into a fixed ring of reused records; the
// renderer, audio and HUD read them later. Nothing in sim/ ever calls a view.

export const EV = {
  SHOT: 1, HURT: 2, DOWN: 3, STEP: 4, RELOAD: 5, DRY: 6, THROW: 7, BOUNCE: 8, BLAST: 9,
  PLANTING: 10, PLANTED: 11, DEFUSED: 12, DETONATED: 13, ROUND_START: 14, LIVE: 15,
  ROUND_END: 16, BUY: 17, DENY: 18, PICKUP: 19, BEEP: 20, SWAP: 21, SWITCH: 22,
};

const SIZE = 256;

export function createEvents() {
  const ring = [];
  for (let i = 0; i < SIZE; i++) ring.push({ type: 0, a: 0, b: 0, c: 0, x: 0, y: 0, z: 0, s: '' });
  return { ring, count: 0 };
}

export function emit(state, type, a = 0, b = 0, c = 0, x = 0, y = 0, z = 0, s = '') {
  const q = state.events;
  const e = q.ring[q.count % SIZE];
  e.type = type; e.a = a; e.b = b; e.c = c; e.x = x; e.y = y; e.z = z; e.s = s;
  q.count++;
}

// Call `fn(event)` for everything emitted since `from`; returns the new cursor.
export function drain(state, from, fn) {
  const q = state.events;
  let i = Math.max(from, q.count - SIZE);
  for (; i < q.count; i++) fn(q.ring[i % SIZE]);
  return q.count;
}

// A sound bots can hear: who made it, where, and how far it carries.
export function makeNoise(state, x, z, team, range) {
  const n = state.noises[state.noiseCount % state.noises.length];
  n.x = x; n.z = z; n.team = team; n.range = range;
  state.noiseCount++;
}
