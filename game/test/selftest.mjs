// selftest.mjs — `node game/test/selftest.mjs [seed]`: plays whole bot-versus-bot matches on
// the real simulation, headless, and checks that rounds are decided every way the rules allow.
import { createState } from '../src/sim/state.js';
import { startMatch } from '../src/sim/round.js';
import { stepSim } from '../src/sim/sim.js';
import { EV, drain } from '../src/sim/events.js';
import { PHASE } from '../src/sim/config.js';
import { SITES } from '../src/sim/map.js';

const reasons = {}, counts = {};
let rounds = 0, ticks = 0, wins = [0, 0];
const t0 = Date.now();
for (let seed = Number(process.argv[2] || 1), n = 0; n < 16; n++, seed++) {
  const state = createState(seed, true);
  startMatch(state);
  let cursor = 0;
  while (state.phase !== PHASE.END && state.tick < 60 * 60 * 40) {
    stepSim(state);
    cursor = drain(state, cursor, (e) => {
      counts[e.type] = (counts[e.type] || 0) + 1;
      if (e.type === EV.ROUND_END) { reasons[e.s] = (reasons[e.s] || 0) + 1; rounds++; }
    });
    for (const a of state.actors) if (!Number.isFinite(a.x + a.y + a.z + a.yaw + a.pitch)) throw new Error('NaN in actor ' + a.index);
  }
  if (state.phase !== PHASE.END) throw new Error('match did not finish, seed ' + seed);
  wins[state.round.score[0] > state.round.score[1] ? 0 : 1]++;
  ticks += state.tick;
  console.log(`seed ${seed}: TIDE ${state.round.score[0]} - ${state.round.score[1]} KILN in ${state.round.number} rounds`);
}
console.log(reasons);
console.log(`shots ${counts[EV.SHOT]}, hits ${counts[EV.HURT]}, downs ${counts[EV.DOWN]}, grenades ${counts[EV.BLAST] || 0}, plants ${counts[EV.PLANTED] || 0}, buys ${counts[EV.BUY]}`);
console.log(`${rounds} rounds, ${ticks} ticks in ${Date.now() - t0} ms, matches won ${wins}`);

// A scripted round: the carrier walks onto site A and holds USE with nobody to stop the uplink.
{
  const state = createState(99, true);
  startMatch(state);
  for (const a of state.actors) a.bot = null;
  while (state.phase === PHASE.BUY) stepSim(state);
  const carrier = state.actors[state.beacon.carrier];
  carrier.x = SITES.A.plants[0][0]; carrier.z = SITES.A.plants[0][1];
  carrier.cmd.use = true;
  let reason = '';
  while (state.phase !== PHASE.POST) { stepSim(state); drain(state, 0, (e) => { if (e.type === EV.ROUND_END) reason = e.s; }); }
  if (reason !== 'Uplink complete' || state.round.score[state.round.attackers] !== 1) throw new Error('scripted plant failed: ' + reason);
  reasons[reason] = 1;
  console.log('scripted plant ->', reason, 'at', state.time.toFixed(1), 's');
}

const need = ['Defenders eliminated', 'Attackers eliminated', 'Beacon defused', 'Uplink complete'];
const missing = need.filter((r) => !reasons[r]);
if (missing.length) { console.log('never happened:', missing); process.exit(1); }
console.log('selftest ok');
