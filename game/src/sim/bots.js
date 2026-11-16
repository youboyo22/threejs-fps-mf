// bots.js — the bot brain. Ten times a second a bot looks and listens, picks a
// goal for its role and plans a path; every tick it steers, turns its aim at a
// human rate and works the trigger. It writes only its actor's `cmd`, the same
// record the player's input fills, so bots obey every rule the player does.
import { BOT, PHASE, TICK } from './config.js';
import { SITES, POSTS } from './map.js';
import { clearLine } from './collide.js';
import { nodeId, nodeX, nodeZ, nextHop, entryNode, exitNode, canWalk } from './nav.js';
import { weaponOf, ammoOf, eyeHeight, speedOf } from './actor.js';
import { isAttacker } from './state.js';

const THINK_DT = BOT.thinkEvery * TICK;

export function createBrain(slot, index) {
  return {
    slot, offset: index % BOT.thinkEvery, thinkTick: 0,
    // perception
    target: -1, reactT: 0, seenX: 0, seenZ: 0, seenT: -99, alertX: 0, alertZ: 0, alertT: -99, heardTo: 0,
    // aim and trigger
    errYaw: 0, errPitch: 0, aimHead: false, aimOff: 9, crouchFight: false,
    strafe: 1, strafeT: 0, burstLeft: 3, pauseT: 0, lastMag: 0, lobT: 0,
    // orders for the round
    route: [], routeI: 0, site: null, post: null, anchor: false,
    // navigation
    goalX: 0, goalZ: 0, goalNode: -1, wp: -1, tx: 0, tz: 0, arrived: true, holding: false, wantUse: false,
    watchX: 0, watchZ: 0, watchI: 0, watchT: 0,
    lastX: 0, lastZ: 0, moving: false, stuckT: 0, dodgeT: 0, dodgeX: 0, dodgeZ: 0,
  };
}

// Round orders: attackers get a lane to the plan's site, defenders a post to hold.
export function briefBot(state, a) {
  const b = a.bot, r = state.round;
  b.target = -1; b.seenT = -99; b.alertT = -99; b.heardTo = state.noiseCount;
  b.routeI = 0; b.route.length = 0; b.wp = -1; b.goalNode = -1; b.arrived = true;
  b.lobT = 0; b.dodgeT = 0; b.stuckT = 0; b.lastX = a.x; b.lastZ = a.z;
  if (isAttacker(state, a)) {
    for (const name of r.plan.routes[b.slot % r.plan.routes.length]) b.route.push(nodeId(name));
    b.site = SITES[r.plan.site]; b.post = null;
  } else {
    const key = r.setup[b.slot % r.setup.length];
    b.post = POSTS[key]; b.site = SITES[b.post.site];
    b.anchor = r.setup.findIndex((k) => POSTS[k].site === b.post.site) === b.slot;   // one bot never leaves each site
  }
}

function wrap(angle) { return angle - Math.PI * 2 * Math.round(angle / (Math.PI * 2)); }
function hunting(state, b) { return b.target < 0 && state.time - b.seenT < BOT.memory; }

function nearestBot(state, team, x, z) {
  let best = null, bestD = Infinity;
  for (const a of state.actors) {
    if (!a.alive || !a.bot || a.team !== team) continue;
    const d = Math.hypot(a.x - x, a.z - z);
    if (d < bestD) { bestD = d; best = a; }
  }
  return best;
}

// Sight: nearest enemy inside the view cone with a clear line to its head or chest.
function see(state, a, b) {
  const ex = a.x, ey = a.y + eyeHeight(a), ez = a.z;
  const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw);
  let best = null, bestScore = Infinity, bestDot = 1;
  for (const e of state.actors) {
    if (!e.alive || e.team === a.team) continue;
    const dx = e.x - ex, dz = e.z - ez, d = Math.hypot(dx, dz);
    const dot = d > 0.01 ? (dx * fx + dz * fz) / d : 1;
    if (d > BOT.sightRange || (d > 3.5 && dot < BOT.fovCos)) continue;
    const top = e.y + eyeHeight(e);
    if (!clearLine(ex, ey, ez, e.x, top + 0.05, e.z) && !clearLine(ex, ey, ez, e.x, e.y + (top - e.y) * 0.7, e.z)) continue;
    const score = e.index === b.target ? d * 0.7 : d;
    if (score < bestScore) { bestScore = score; best = e; bestDot = dot; }
  }
  if (!best) { b.target = -1; return; }
  if (best.index !== b.target) {
    // a new contact: time to react, and a first aim that is off by a little
    b.reactT = BOT.reactMin + state.rng() * BOT.reactRand + (bestDot < 0.8 ? BOT.reactSide : 0);
    const sloppy = BOT.aimError * (1 + speedOf(a) / 4);
    b.errYaw = (state.rng() - 0.5) * 2 * sloppy; b.errPitch = (state.rng() - 0.5) * sloppy;
    b.aimHead = state.rng() < 0.35; b.crouchFight = state.rng() < 0.5;
    b.burstLeft = 3; b.pauseT = 0;
  }
  b.target = best.index; b.seenX = best.x; b.seenZ = best.z; b.seenT = state.time;
  // call the contact to the team: which site is it heading for?
  if (best.z < 4 && Math.abs(best.x) > 7) {
    const intel = state.intel[a.team];
    const site = best.x > 0 ? 'A' : 'B';
    if (intel.site !== site || state.time - intel.t > 20) { intel.site = site; intel.t = state.time; }
  }
}

// Hearing: enemy gunfire, running footsteps and grenades inside their range, and being hit.
function hear(state, a, b) {
  const ring = state.noises;
  for (let i = Math.max(b.heardTo, state.noiseCount - ring.length); i < state.noiseCount; i++) {
    const n = ring[i % ring.length];
    if (n.team === a.team || Math.hypot(n.x - a.x, n.z - a.z) > n.range) continue;
    b.alertX = n.x; b.alertZ = n.z; b.alertT = state.time;
  }
  b.heardTo = state.noiseCount;
  if (a.hurtTick >= b.thinkTick) {
    const by = state.actors[a.hurtBy];
    b.alertX = by.x; b.alertZ = by.z; b.alertT = state.time;
  }
}

function setGoal(b, x, z) {
  if (Math.hypot(x - b.goalX, z - b.goalZ) < 0.5 && b.goalNode >= 0) return;
  b.goalX = x; b.goalZ = z; b.goalNode = exitNode(x, z); b.wp = -1;
}

function holdAt(state, b, site, n) {
  const spot = site.holds[n % site.holds.length];
  setGoal(b, spot[0], spot[1]);
  b.holding = true; b.site = site;
  b.watchT -= THINK_DT;
  if (b.watchT <= 0) { b.watchT = 2.5 + state.rng() * 2; b.watchI++; }
  const entry = site.entries[b.watchI % site.entries.length];
  b.watchX = entry[0]; b.watchZ = entry[1];
}

// Pick this moment's goal from the bot's role and the state of the round.
function choose(state, a, b) {
  const beacon = state.beacon;
  b.wantUse = false; b.holding = false;
  if (state.phase !== PHASE.LIVE && state.phase !== PHASE.PLANTED) { setGoal(b, a.x, a.z); return; }

  if (isAttacker(state, a)) {
    if (beacon.state === 'planted') holdAt(state, b, beacon.site, b.slot + 1);
    else if (beacon.state === 'dropped' && nearestBot(state, a.team, beacon.x, beacon.z) === a) setGoal(b, beacon.x, beacon.z);
    else if (hunting(state, b) && beacon.carrier !== a.index) setGoal(b, b.seenX, b.seenZ);
    else if (b.routeI < b.route.length) {
      const n = b.route[b.routeI];
      setGoal(b, nodeX[n], nodeZ[n]);
      if (Math.hypot(nodeX[n] - a.x, nodeZ[n] - a.z) < 1.8) b.routeI++;
    } else if (beacon.carrier === a.index) {
      const spot = b.site.plants[b.slot % b.site.plants.length];
      setGoal(b, spot[0], spot[1]);
      b.wantUse = Math.hypot(spot[0] - a.x, spot[1] - a.z) < 0.6;
    } else holdAt(state, b, b.site, b.slot + 1);
    return;
  }

  if (beacon.state === 'planted') {
    if (nearestBot(state, a.team, beacon.x, beacon.z) === a) {
      setGoal(b, beacon.x, beacon.z);
      b.wantUse = Math.hypot(beacon.x - a.x, beacon.z - a.z) < 1;
    } else holdAt(state, b, beacon.site, b.slot);
    return;
  }
  const intel = state.intel[a.team], age = state.time - intel.t;
  if (intel.site && intel.site !== b.post.site && !b.anchor && age > BOT.rotateDelay && age < 25) {
    holdAt(state, b, SITES[intel.site], b.slot + 2);              // rotate to the called site
  } else {
    setGoal(b, b.post.x, b.post.z);
    b.holding = true; b.watchX = b.post.wx; b.watchZ = b.post.wz;
  }
}

// Walk toward the goal: straight when the way is clear, else along the waypoint graph.
function plan(a, b) {
  b.arrived = Math.hypot(b.goalX - a.x, b.goalZ - a.z) < 0.4;
  if (b.arrived || canWalk(a.x, a.z, b.goalX, b.goalZ)) { b.tx = b.goalX; b.tz = b.goalZ; return; }
  if (b.wp < 0) b.wp = entryNode(a.x, a.z, b.goalNode);
  if (b.wp !== b.goalNode) {
    const next = nextHop(b.wp, b.goalNode);
    const reached = Math.hypot(nodeX[b.wp] - a.x, nodeZ[b.wp] - a.z) < 0.7;
    if (next >= 0 && (reached || canWalk(a.x, a.z, nodeX[next], nodeZ[next]))) b.wp = next;   // cut the corner
  }
  b.tx = nodeX[b.wp]; b.tz = nodeZ[b.wp];
}

function think(state, a, b) {
  see(state, a, b);
  hear(state, a, b);
  b.thinkTick = state.tick;
  choose(state, a, b);
  plan(a, b);

  // lob a grenade at a contact that just broke line of sight
  const lost = state.time - b.seenT, range = Math.hypot(b.seenX - a.x, b.seenZ - a.z);
  if (b.target < 0 && a.grenades > 0 && a.throwT <= 0 && b.lobT <= 0 && lost > 0.6 && lost < 3 && range > 8 && range < 24 && state.rng() < 0.2) b.lobT = 1;

  // wedged on a corner or a teammate: hop sideways and re-plan
  if (b.moving && Math.hypot(a.x - b.lastX, a.z - b.lastZ) < 0.04) b.stuckT += THINK_DT; else b.stuckT = 0;
  b.lastX = a.x; b.lastZ = a.z;
  if (b.stuckT > 0.4) {
    const ang = state.rng() * Math.PI * 2;
    b.dodgeX = Math.cos(ang); b.dodgeZ = Math.sin(ang); b.dodgeT = 0.35; b.stuckT = 0; b.wp = -1;
    a.cmd.jump = true;
  }
}

function steer(state, a, b, target, dt) {
  const c = a.cmd;
  let mx = b.tx - a.x, mz = b.tz - a.z;
  let moving = !b.arrived && Math.hypot(mx, mz) > 0.15;
  c.crouch = false;
  if (target) {
    const dx = target.x - a.x, dz = target.z - a.z, d = Math.hypot(dx, dz);
    if (d > 6 || b.wantUse) {            // far: plant the feet, a still rifle is an accurate one
      moving = false; c.crouch = b.crouchFight && d > 9;
    } else {                              // close: strafe across the enemy's aim
      b.strafeT -= dt;
      if (b.strafeT <= 0) { b.strafe = -b.strafe; b.strafeT = 0.45 + state.rng() * 0.6; }
      mx = -dz * b.strafe; mz = dx * b.strafe; moving = true;
    }
  }
  if (b.dodgeT > 0) { b.dodgeT -= dt; mx = b.dodgeX; mz = b.dodgeZ; moving = true; }
  c.use = b.wantUse && !target;
  if (c.use) moving = false;
  b.moving = moving;
  const len = Math.hypot(mx, mz);
  if (!moving || len < 1e-3) { c.wishX = c.wishZ = 0; return; }
  c.wishX = mx / len; c.wishZ = mz / len;
  for (const mate of state.actors) {     // keep a little room between teammates
    if (mate === a || !mate.alive || mate.team !== a.team) continue;
    const sx = a.x - mate.x, sz = a.z - mate.z, d = Math.hypot(sx, sz);
    if (d < 1 && d > 0.01) { c.wishX += (sx / d) * 0.7; c.wishZ += (sz / d) * 0.7; }
  }
}

// Turn the view toward whatever deserves attention, at a limited rate.
function aim(state, a, b, target, dt) {
  const eyeY = a.y + eyeHeight(a);
  let px = 0, py = eyeY, pz = 0, has = true, offYaw = 0, offPitch = 0;
  if (target) {
    px = target.x; pz = target.z; py = target.y + eyeHeight(target) * (b.aimHead ? 1.03 : 0.72);
    const settle = Math.min(1, BOT.settleRate * dt);
    b.errYaw -= b.errYaw * settle; b.errPitch -= b.errPitch * settle;
    offYaw = b.errYaw; offPitch = b.errPitch - a.recoilP * 0.7;      // pulls down against recoil, imperfectly
  } else if (b.lobT > 0) {
    px = b.seenX; pz = b.seenZ;
    const d = Math.hypot(px - a.x, pz - a.z);
    py = eyeY + Math.tan(Math.min(0.5, d * 0.02)) * d;
  } else if (hunting(state, b)) { px = b.seenX; pz = b.seenZ; py = 1.3; }
  else if (state.time - b.alertT < 2.5) { px = b.alertX; pz = b.alertZ; py = 1.3; }
  else if (b.holding && b.arrived) { px = b.watchX; pz = b.watchZ; py = 1.3; }
  else if (b.moving) { px = a.x + a.cmd.wishX * 6; pz = a.z + a.cmd.wishZ * 6; }
  else has = false;
  if (!has) { b.aimOff = 9; return; }
  const dx = px - a.x, dy = py - eyeY, dz = pz - a.z;
  const dYaw = wrap(Math.atan2(-dx, -dz) + offYaw - a.yaw);
  const dPitch = Math.atan2(dy, Math.hypot(dx, dz)) + offPitch - a.pitch;
  const step = BOT.turnRate * dt;
  a.yaw += Math.max(-step, Math.min(step, dYaw));
  a.pitch += Math.max(-step, Math.min(step, dPitch));
  b.aimOff = Math.max(0, Math.abs(dYaw) - step) + Math.max(0, Math.abs(dPitch) - step);
}

function trigger(state, a, b, target, dt) {
  const c = a.cmd, w = weaponOf(a), am = ammoOf(a);
  c.fire = false; c.reload = false; c.throw = false; c.scope = false;
  if (target) {
    const d = Math.hypot(target.x - a.x, target.z - a.z);
    b.reactT -= dt; b.pauseT -= dt;
    if (am.mag < b.lastMag) b.burstLeft--;
    if (b.burstLeft <= 0) {               // short bursts at range, longer sprays up close
      const far = d > 12;
      b.pauseT = far ? 0.25 + state.rng() * 0.3 : 0.08;
      b.burstLeft = far ? 2 + Math.floor(state.rng() * 3) : 5 + Math.floor(state.rng() * 5);
    }
    c.scope = w.zoom > 0 && d > 10;
    if (b.reactT <= 0 && b.pauseT <= 0 && b.aimOff < 0.05) c.fire = w.auto || !a.triggerHeld;
    if (am.mag === 0) { if (a.active === 'primary' && d < 9) c.slot = 'sidearm'; else c.reload = true; }
  } else {
    if (a.active === 'sidearm' && a.primary) c.slot = 'primary';
    else if (am.mag < w.mag * 0.45 && state.time - b.seenT > 1.5) c.reload = true;
    if (b.lobT > 0) {
      b.lobT -= dt;
      if (b.aimOff < 0.08) { c.throw = true; b.lobT = 0; }
    }
  }
  b.lastMag = am.mag;
}

export function driveBot(state, a, dt) {
  const b = a.bot;
  if ((state.tick + b.offset) % BOT.thinkEvery === 0) think(state, a, b);
  let target = b.target >= 0 ? state.actors[b.target] : null;
  if (target && !target.alive) { target = null; b.target = -1; }
  steer(state, a, b, target, dt);
  aim(state, a, b, target, dt);
  trigger(state, a, b, target, dt);
}
