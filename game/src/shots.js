// shots.js — the scenes behind screenshots/. `?shot=<name>` freezes the simulation
// and stages real game state (operators, weapons, the beacon, score, events), which
// the normal view and HUD then draw. Nothing here draws anything itself.
import { PHASE } from './sim/config.js';
import { SITES } from './sim/map.js';
import { EV, emit } from './sim/events.js';
import { buy } from './sim/economy.js';

function put(a, x, z, lookX, lookZ, crouch = 0) {
  a.x = a.px = x; a.z = a.pz = z; a.crouch = crouch;
  a.yaw = Math.atan2(-(lookX - x), -(lookZ - z));
}
function down(a, x, z) { put(a, x, z, x, z - 1); a.alive = false; a.hp = 0; a.downT = 1; }

function equip(state, a, weapon, vest) {
  a.money = 9000;
  buy(state, a, weapon);
  if (vest) buy(state, a, 'vest');
}

// a round fired at a point: the same event the weapon code emits
function shotAt(state, shooter, x, y, z, part) {
  emit(state, EV.SHOT, shooter.index, part, 0, x, y, z, shooter.primary || shooter.sidearm);
}

const SCENES = {
  // Evaporator Row: pushing toward A under the shed roof, contact at the far crates
  firefight(state, me, mates, foes) {
    state.round.number = 5; state.round.score[0] = 3; state.round.score[1] = 1;
    for (const a of state.actors) equip(state, a, a === foes[2] ? 'skiff' : 'halyard', true);
    buy(state, me, 'pulse');
    state.phase = PHASE.LIVE; state.phaseT = 71.4;
    put(me, 26.4, 8.6, 24.4, -3); me.pitch = -0.03; me.hp = 78; me.armor = 62; me.money = 3150; me.ammo.primary.mag = 21; me.bloom = 0.006;
    put(mates[0], 22.4, 3.2, 24, -4, 1); put(mates[1], 28.6, 4.4, 25, -5); down(mates[2], 4, 14);
    put(foes[0], 24.4, -2.6, 26, 11); put(foes[1], 28, -5.7, 26, 11, 1); put(foes[2], 25.8, -11, 26, 5); down(foes[3], 23, 1.5);
    state.beacon.carrier = mates[0].index;
    emit(state, EV.DOWN, foes[3].index, me.index, 1, 0, 0, 0, 'Halyard AR');
    emit(state, EV.DOWN, mates[2].index, foes[0].index, 0, 0, 0, 0, 'Halyard AR');
    return () => {
      shotAt(state, me, foes[0].x + 0.05, 1.25, foes[0].z, 2);
      if (state.events.count % 3 === 0) shotAt(state, foes[1], 29.6, 2.4, 6, 0);
      if (state.events.count % 40 < 2) emit(state, EV.HURT, foes[0].index, me.index, 0);
    };
  },
  // Drying Floor: the beacon is down on A and the defenders are coming through the door
  planted(state, me, mates, foes) {
    state.round.number = 8; state.round.score[0] = 4; state.round.score[1] = 3;
    for (const a of state.actors) equip(state, a, 'halyard', a !== foes[1]);
    state.phase = PHASE.PLANTED; state.phaseT = 17.3;
    const beacon = state.beacon;
    beacon.state = 'planted'; beacon.carrier = -1; beacon.site = SITES.A; beacon.x = 21.4; beacon.y = 0; beacon.z = -16.4;
    put(me, 27.6, -11.6, 18, -17.5); me.pitch = -0.1; me.hp = 54; me.armor = 31; me.money = 1850; me.ammo.primary.mag = 14;
    put(mates[0], 23.6, -20.2, 10, -13, 1); put(mates[1], 15.4, -22.6, 9, -13); down(mates[2], 25, -4);
    put(foes[0], 10.4, -13.2, 21, -16); put(foes[1], 12.6, -17.4, 21, -16, 1); down(foes[2], 14.5, -12); down(foes[3], -5, -12);
    emit(state, EV.DOWN, foes[2].index, mates[0].index, 0, 0, 0, 0, 'Halyard AR');
    emit(state, EV.DOWN, foes[3].index, me.index, 0, 0, 0, 0, 'Pulse Grenade');
    return () => {
      if (state.events.count % 20 === 0) emit(state, EV.BEEP, 0, 0, 0, beacon.x, 0, beacon.z);
      shotAt(state, mates[0], foes[0].x, 1.3, foes[0].z + 0.4, 0);
    };
  },
  // South Quay: buy phase, round three, the squad lined up facing the Conveyor
  buy(state, me, mates) {
    state.round.number = 3; state.round.score[0] = 1; state.round.score[1] = 1;
    state.phaseT = 6.4;
    me.money = 4100; me.pitch = -0.04;
    put(me, 0.6, 23.6, 0, 10);
    put(mates[0], -4.6, 17.6, -4, 8); put(mates[1], 5.2, 18.4, 4.5, 8); put(mates[2], -7.5, 20.5, -5, 8);
    equip(state, mates[0], 'halyard', true); equip(state, mates[1], 'skiff', true); equip(state, mates[2], 'longline', false);
    return () => {};
  },
  // the menu over the aerial orbit: the whole map in one frame
  overview(state, me, mates, foes, view) {
    view.setOrbit(0.35);
    return () => {};
  },
};

export function poseShot(state, name, view) {
  const me = state.player;
  const mates = state.actors.filter((a) => a.team === me.team && a !== me);
  const foes = state.actors.filter((a) => a.team !== me.team);
  return (SCENES[name] || SCENES.firefight)(state, me, mates, foes, view);
}
