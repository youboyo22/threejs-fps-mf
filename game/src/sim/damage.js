// damage.js — taking damage and going down. One place decides what a hit costs.
import { ARMOR, ECON } from './config.js';
import { EV, emit } from './events.js';

export function hurt(state, victim, attacker, amount, head, cause) {
  if (!victim.alive) return;
  let dmg = amount;
  if (victim.armor > 0 && !head) {            // the vest covers the body, never the head
    const soaked = Math.min(victim.armor, dmg * ARMOR.absorb);
    victim.armor -= soaked; dmg -= soaked;
  }
  victim.hp -= dmg;
  victim.hurtTick = state.tick; victim.hurtBy = attacker.index;
  emit(state, EV.HURT, victim.index, attacker.index, head ? 1 : 0, attacker.x, dmg, attacker.z);
  if (victim.hp > 0) return;

  victim.alive = false; victim.hp = 0; victim.downT = 0; victim.downs++;
  victim.vx = victim.vz = 0; victim.useT = 0; victim.scoped = false;
  if (attacker !== victim) {
    attacker.kills++;
    attacker.money = Math.min(ECON.max, attacker.money + ECON.down);
  }
  const beacon = state.beacon;
  if (beacon.state === 'carried' && beacon.carrier === victim.index) {
    beacon.state = 'dropped'; beacon.carrier = -1;
    beacon.x = victim.x; beacon.y = victim.y; beacon.z = victim.z;
  }
  emit(state, EV.DOWN, victim.index, attacker.index, head ? 1 : 0, victim.x, victim.y, victim.z, cause);
}
