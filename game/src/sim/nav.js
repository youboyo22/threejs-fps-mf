// nav.js — the waypoint graph: edges wherever two nodes can walk straight to each
// other, all-pairs shortest paths solved once at load, and constant-time lookups after.
import { NODES } from './map.js';
import { clearWalk } from './collide.js';
import { MOVE } from './config.js';

const N = NODES.length;
const WALK_R = MOVE.radius + 0.08;
const MAX_EDGE = 17;

export const nodeX = new Float32Array(N);
export const nodeZ = new Float32Array(N);
const dist = new Float32Array(N * N).fill(Infinity);
const hop = new Int16Array(N * N).fill(-1);
const ids = new Map();

for (let i = 0; i < N; i++) { ids.set(NODES[i][0], i); nodeX[i] = NODES[i][1]; nodeZ[i] = NODES[i][2]; }
for (let i = 0; i < N; i++) {
  dist[i * N + i] = 0; hop[i * N + i] = i;
  for (let j = i + 1; j < N; j++) {
    const d = Math.hypot(nodeX[i] - nodeX[j], nodeZ[i] - nodeZ[j]);
    if (d > MAX_EDGE || !clearWalk(nodeX[i], nodeZ[i], nodeX[j], nodeZ[j], WALK_R)) continue;
    dist[i * N + j] = dist[j * N + i] = d; hop[i * N + j] = j; hop[j * N + i] = i;
  }
}
for (let k = 0; k < N; k++) for (let i = 0; i < N; i++) {
  const ik = dist[i * N + k];
  if (ik === Infinity) continue;
  for (let j = 0; j < N; j++) {
    const d = ik + dist[k * N + j];
    if (d < dist[i * N + j]) { dist[i * N + j] = d; hop[i * N + j] = hop[i * N + k]; }
  }
}

export const nodeCount = N;
export function nodeId(name) { return ids.get(name); }
export function nodeName(i) { return NODES[i][0]; }
export function nodeDist(a, b) { return dist[a * N + b]; }
export function nextHop(from, to) { return hop[from * N + to]; }

// The node to head for first when walking from (x,z) toward node `goal`:
// the reachable node that makes the whole trip shortest.
export function entryNode(x, z, goal) {
  let best = -1, bestD = Infinity, near = 0, nearD = Infinity;
  for (let i = 0; i < N; i++) {
    const d = Math.hypot(nodeX[i] - x, nodeZ[i] - z);
    if (d < nearD) { nearD = d; near = i; }
    const total = d + dist[i * N + goal];
    if (total < bestD && clearWalk(x, z, nodeX[i], nodeZ[i], WALK_R)) { bestD = total; best = i; }
  }
  return best < 0 ? near : best;
}

// The node nearest to a point that can be walked to from it (used to end a trip).
export function exitNode(x, z) {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < N; i++) {
    const d = Math.hypot(nodeX[i] - x, nodeZ[i] - z);
    if (d < bestD && clearWalk(x, z, nodeX[i], nodeZ[i], WALK_R)) { bestD = d; best = i; }
  }
  return best;
}

export function canWalk(ax, az, bx, bz) { return clearWalk(ax, az, bx, bz, WALK_R); }
