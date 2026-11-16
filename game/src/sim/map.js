// map.js — "Saltworks", the one map of SALTLINE, as plain data.
// A coastal salt refinery: attackers land on the south quay and push north through
// three lanes (Brine Walk west, the Conveyor mid, Evaporator Row east) to two
// uplink sites, A "Drying Floor" (north-east) and B "Pump Hall" (north-west).
// x runs east, z runs south, y is up; units are metres.

export const BOUNDS = { x0: -30, z0: -25, x1: 30, z1: 25 };

// [x0, z0, x1, z1, top, kind, bottom]
const ROWS = [
  // perimeter
  [-31, -26, 31, -25, 6, 'wall'], [-31, 25, 31, 26, 6, 'wall'],
  [-31, -25, -30, 25, 6, 'wall'], [30, -25, 31, 25, 6, 'wall'],
  // the four refinery blocks that cut the yard into lanes
  [-20, 6, -7, 16, 5, 'block'], [7, 6, 20, 16, 5, 'block'],
  [-20, -10, -7, -1, 5, 'block'], [7, -10, 20, -1, 5, 'block'],
  [-26, 2, -20, 6, 5, 'block'],                      // Brine Walk choke
  // north: walls between the defender yard and the sites, with doorways
  [-8, -25, -7, -15, 5, 'wall'], [7, -25, 8, -15, 5, 'wall'],
  [-8, -15, -7, -10, 5, 'wall', 3], [7, -15, 8, -10, 5, 'wall', 3],
  [-3, -16, 3, -15, 5, 'wall'],                      // back wall of the Connector
  // Mid Gate
  [-7, -10.5, -2.5, -9.5, 5, 'wall'], [2.5, -10.5, 7, -9.5, 5, 'wall'],
  [-2.5, -10.5, 2.5, -9.5, 5, 'wall', 3],
  // roofs and overhead runs
  [20, 2, 30, 12, 3.7, 'roof', 3.4],                 // evaporator shed
  [-30, 7, -20, 8.2, 3.7, 'pipe', 3.2],              // brine pipe bridge
  [-7, 1.6, 7, 2.8, 3.8, 'pipe', 3.4],               // conveyor over the cross street
  // Conveyor (mid)
  [-1.5, 9, 1.5, 12, 5, 'stack'],
  [-6, 3.5, -4, 5.5, 1, 'crate'], [3.5, -5, 5.5, -3, 2, 'tank'],
  [-7, -6, -3, -5.5, 1.1, 'low'],
  // A site, Drying Floor
  [17, -20, 20, -17, 2, 'container'], [22, -14, 24, -12, 1, 'crate'],
  [12, -23, 14, -21, 1, 'crate'], [25, -22, 27, -19.5, 2, 'tank'],
  // B site, Pump Hall
  [-20, -20, -17, -17.5, 2, 'container'], [-14, -15, -12, -13, 1, 'crate'],
  [-27, -16, -25, -14, 1, 'crate'], [-24, -24, -21, -22, 2, 'tank'],
  // Brine Walk (west)
  [-24, 10, -22, 12, 1, 'crate'], [-29, -6, -27.5, -4, 2, 'tank'],
  // Evaporator Row (east)
  [22, 8, 24, 10, 2, 'tank'], [27, -5, 29, -3, 1, 'crate'], [21, -9, 22.5, -7, 1, 'crate'],
  // south quay
  [3, 18.5, 9, 19.5, 1.1, 'low'], [-14, 21, -12, 23, 2, 'container'], [12, 18, 14, 20, 2, 'container'],
  // cross street and defender yard
  [12, 1.5, 14, 3.5, 1, 'crate'], [-15, 2, -13, 4, 2, 'container'], [-1.5, -22, 1.5, -20, 1, 'crate'],
];

export const BOXES = ROWS.map((r) => ({ x0: r[0], z0: r[1], x1: r[2], z1: r[3], y0: r[6] || 0, y1: r[4], kind: r[5] }));

// Uplink sites: the plant zone, spots to plant on, cover to hold from, entrances to watch.
export const SITES = {
  A: {
    name: 'A', label: 'Drying Floor', x0: 13, z0: -24, x1: 24, z1: -13,
    plants: [[18.5, -21.6], [21.2, -18.5], [16, -15.5]],
    holds: [[18.5, -21.6], [28.2, -23], [11, -23.6], [23, -15], [15.8, -18.5]],
    entries: [[26, -9], [9, -12.5], [22, -24]],
  },
  B: {
    name: 'B', label: 'Pump Hall', x0: -25, z0: -24, x1: -13, z1: -13,
    plants: [[-18.5, -21.4], [-15.8, -18.8], [-22, -16.5]],
    holds: [[-18.5, -21.4], [-28.2, -22], [-10, -20.5], [-26, -17.2], [-15.8, -18.8]],
    entries: [[-25, -9], [-9, -12.5], [-19, -24]],
  },
};

export const SPAWNS = {
  attack: [[0, 22.5], [-4, 22], [4, 22], [-8, 23], [8, 23]],
  defend: [[0, -18.5], [-4, -19], [4, -19], [-4.5, -23], [4.5, -23]],
};

// Named posts a defender can open the round on: position, then the point to watch.
export const POSTS = {
  a1: { site: 'A', x: 18.5, z: -21.6, wx: 26, wz: -9 },
  a2: { site: 'A', x: 28.2, z: -6.4, wx: 25, wz: 12 },
  a3: { site: 'A', x: 11, z: -23.6, wx: 9, wz: -12.5 },
  b1: { site: 'B', x: -18.5, z: -21.4, wx: -25, wz: -9 },
  b2: { site: 'B', x: -28.3, z: -7.2, wx: -28, wz: 4 },
  b3: { site: 'B', x: -10, z: -20.5, wx: -9, wz: -12.5 },
  m1: { site: 'A', x: 4.5, z: -6.2, wx: 0, wz: 8 },
  m2: { site: 'B', x: -5, z: -7, wx: -1, wz: 6 },
};
export const SETUPS = [
  ['a1', 'b1', 'm1', 'a2'], ['a1', 'b1', 'm2', 'b2'], ['a3', 'b3', 'm1', 'a2'],
  ['a1', 'a2', 'b1', 'm2'], ['a1', 'b1', 'b2', 'm1'],
];

// Waypoints. Edges are found at load by nav.js wherever two nodes can walk straight to each other.
export const NODES = [
  ['quayW', -25, 20], ['quayMW', -10, 18.5], ['quay', 0, 22.5], ['quayN', 0, 17.2], ['quayME', 10, 22], ['quayE', 25, 20],
  ['walkS', -25.5, 13.5], ['walkChoke', -28, 4], ['walkX', -23, 0.4], ['walkN', -25, -5.5],
  ['midSW', -4.5, 13.5], ['midSE', 4.5, 13.5], ['midW', -4.5, 7.5], ['midE', 4.5, 7.5],
  ['mid', 0.5, 3], ['midN', 0, -7], ['gate', 0, -10],
  ['crossW', -10, 0.6], ['crossWW', -17.5, 0.4], ['crossE', 9.5, 2.5], ['crossEE', 17, 4.6],
  ['rowS', 26, 13.5], ['rowC', 26, 3], ['rowN', 24.6, -5.2],
  ['con', 0, -12.6], ['conW', -5, -12.8], ['conE', 5, -12.8], ['yardW', -5, -19], ['yardE', 5, -19], ['yard', 0, -18],
  ['aDoor', 10, -12.5], ['aLane', 26.2, -11.5], ['aMid', 15.5, -15.5], ['aBack', 22, -23.2], ['aWest', 10.5, -19.5], ['aEast', 28.3, -17],
  ['bDoor', -10, -12], ['bLane', -24, -11.5], ['bMid', -15.8, -16.6], ['bBack', -15, -23], ['bWest', -28.2, -19.5], ['bEast', -10, -18.5],
];

// Attack plans: the site, and the lanes (as waypoint names) the squad splits across.
export const PLANS = [
  { site: 'A', call: 'A through Evaporator Row', routes: [['rowS', 'rowN', 'aLane'], ['rowS', 'rowN', 'aLane'], ['rowS', 'rowN', 'aLane'], ['mid', 'gate', 'aDoor']] },
  { site: 'A', call: 'A split, Row and Mid Gate', routes: [['rowS', 'rowN', 'aLane'], ['mid', 'gate', 'aDoor'], ['rowS', 'rowN', 'aLane'], ['mid', 'gate', 'aDoor']] },
  { site: 'B', call: 'B through Brine Walk', routes: [['walkS', 'walkChoke', 'walkN', 'bLane'], ['walkS', 'walkChoke', 'walkN', 'bLane'], ['crossWW', 'walkN', 'bLane'], ['mid', 'gate', 'bDoor']] },
  { site: 'B', call: 'B split, Walk and Mid Gate', routes: [['walkS', 'walkChoke', 'walkN', 'bLane'], ['mid', 'gate', 'bDoor'], ['crossWW', 'walkN', 'bLane'], ['mid', 'gate', 'bDoor']] },
];

// Callout regions for the HUD location line, first match wins.
const REGIONS = [
  ['Drying Floor (A)', 8, -25, 30, -10], ['Pump Hall (B)', -30, -25, -8, -10],
  ['Defender Yard', -7, -25, 7, -15], ['Connector', -7, -15, 7, -10.5],
  ['South Quay', -30, 16, 30, 25], ['Brine Walk', -30, -10, -20, 16],
  ['Evaporator Row', 20, -10, 30, 16], ['Conveyor', -7, -10.5, 7, 16], ['Cross Street', -20, -1, 20, 6],
];
export function regionName(x, z) {
  for (const r of REGIONS) if (x >= r[1] && x <= r[3] && z >= r[2] && z <= r[4]) return r[0];
  return 'Saltworks';
}

export function inSite(site, x, z) {
  return x >= site.x0 && x <= site.x1 && z >= site.z0 && z <= site.z1;
}
export function siteAt(x, z) {
  if (inSite(SITES.A, x, z)) return SITES.A;
  if (inSite(SITES.B, x, z)) return SITES.B;
  return null;
}
