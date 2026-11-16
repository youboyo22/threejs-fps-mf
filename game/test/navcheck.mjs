// navcheck.mjs — `node game/test/navcheck.mjs`: every waypoint is reachable and every
// authored point (spawns, posts, plant and hold spots) stands in open floor near the graph.
import { nodeCount, nodeDist, nodeName, exitNode } from '../src/sim/nav.js';
import { SITES, POSTS, SPAWNS, NODES } from '../src/sim/map.js';
import { blocker } from '../src/sim/collide.js';

let bad = 0;
for (let i = 0; i < nodeCount; i++) {
  if (nodeDist(0, i) === Infinity) { console.log('unreachable', nodeName(i)); bad++; }
  if (blocker(NODES[i][1], 0, NODES[i][2], 0.46, 1.8)) { console.log('node in wall', nodeName(i)); bad++; }
}
const points = [];
for (const s of Object.values(SITES)) points.push(...s.plants, ...s.holds, ...s.entries);
for (const p of Object.values(POSTS)) points.push([p.x, p.z]);
points.push(...SPAWNS.attack, ...SPAWNS.defend);
for (const [x, z] of points) {
  if (blocker(x, 0, z, 0.4, 1.8)) { console.log('point in wall', x, z); bad++; }
  const n = exitNode(x, z);
  if (Math.hypot(NODES[n][1] - x, NODES[n][2] - z) > 9) { console.log('far from nav', x, z, nodeName(n)); bad++; }
}
console.log('nav check', bad ? 'FAILED ' + bad : 'ok');
process.exit(bad ? 1 : 0);
