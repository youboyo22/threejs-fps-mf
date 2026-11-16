// viewmodel.js — the first-person weapon: one small model per gun, drawn in its
// own scene over the world so it never clips into walls, and animated from the
// actor record (bob, sway, recoil kick, reload dip, draw).
import * as THREE from 'three';
import { WEAPONS } from '../sim/config.js';
import { weaponOf } from '../sim/actor.js';
import { PALETTE as P } from './palette.js';

const dark = new THREE.MeshLambertMaterial({ color: P.gunBody });
const steel = new THREE.MeshLambertMaterial({ color: P.gunSteel });
const glove = new THREE.MeshLambertMaterial({ color: P.suit });

function piece(group, mat, w, h, d, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  group.add(m);
}

// [material, w, h, d, x, y, z] per part; -z is toward the muzzle
const BLUEPRINTS = {
  marlin: { muzzle: -0.3, parts: [[dark, 0.045, 0.06, 0.26, 0, 0.03, -0.14], [steel, 0.04, 0.03, 0.24, 0, 0.07, -0.14], [dark, 0.045, 0.13, 0.06, 0, -0.05, -0.03]] },
  skiff: { muzzle: -0.5, parts: [[dark, 0.06, 0.09, 0.4, 0, 0.02, -0.2], [steel, 0.035, 0.035, 0.14, 0, 0.03, -0.46], [dark, 0.04, 0.2, 0.05, 0, -0.12, -0.2], [dark, 0.05, 0.12, 0.06, 0, -0.07, -0.02], [steel, 0.02, 0.03, 0.2, 0, 0.08, -0.15]] },
  halyard: { muzzle: -0.78, parts: [[dark, 0.06, 0.1, 0.5, 0, 0.02, -0.25], [steel, 0.03, 0.03, 0.3, 0, 0.035, -0.64], [dark, 0.045, 0.19, 0.08, 0, -0.12, -0.22], [dark, 0.05, 0.12, 0.06, 0, -0.07, -0.03], [dark, 0.05, 0.08, 0.2, 0, 0, 0.1], [steel, 0.07, 0.07, 0.28, 0, 0.0, -0.5], [steel, 0.02, 0.04, 0.05, 0, 0.09, -0.46]] },
  longline: { muzzle: -0.95, parts: [[dark, 0.055, 0.09, 0.6, 0, 0.02, -0.3], [steel, 0.028, 0.028, 0.4, 0, 0.035, -0.78], [dark, 0.05, 0.1, 0.26, 0, -0.01, 0.12], [dark, 0.04, 0.1, 0.07, 0, -0.08, -0.16], [steel, 0.05, 0.05, 0.3, 0, 0.11, -0.22], [dark, 0.065, 0.065, 0.05, 0, 0.11, -0.38]] },
};

export function createViewmodel(state) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, 1, 0.02, 10);
  scene.add(new THREE.HemisphereLight(P.skyLight, P.bounce, 1.6));
  const key = new THREE.DirectionalLight(P.sun, 2);
  key.position.set(-1, 2, 1);
  scene.add(key);

  const rig = new THREE.Group();
  scene.add(rig);
  const sleeves = P.team.map((c) => new THREE.MeshLambertMaterial({ color: c }));
  // forearms: each runs from a hand on the weapon back to the bottom corners of the view
  const arms = new THREE.Group();
  const sleeveR = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.36), sleeves[0]);
  sleeveR.position.set(0.05, -0.13, 0.16); sleeveR.lookAt(0, -0.07, -0.02);
  const sleeveL = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.065, 0.42), sleeves[0]);
  sleeveL.position.set(-0.17, -0.15, -0.1); sleeveL.lookAt(-0.01, -0.05, -0.3);
  arms.add(sleeveR, sleeveL);
  piece(arms, glove, 0.06, 0.08, 0.07, 0, -0.075, -0.02);
  piece(arms, glove, 0.07, 0.05, 0.09, -0.01, -0.05, -0.3);
  rig.add(arms);
  rig.scale.setScalar(0.78);

  const guns = {};
  for (const id of Object.keys(WEAPONS)) {
    const g = new THREE.Group();
    for (const [mat, w, h, d, x, y, z] of BLUEPRINTS[id].parts) piece(g, mat, w, h, d, x, y, z);
    g.visible = false;
    rig.add(g);
    guns[id] = g;
  }
  const flash = new THREE.Mesh(new THREE.OctahedronGeometry(0.045),
    new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  rig.add(flash);
  const flashLight = new THREE.PointLight('#ffc27a', 0, 3);
  rig.add(flashLight);

  let kick = 0, flashT = 0, bob = 0, shown = '', lastYaw = 0, sway = 0;

  function onShot() { kick = 1; flashT = 0.045; }

  function update(actor, dt) {
    const w = weaponOf(actor);
    if (w.id !== shown) {
      if (shown) guns[shown].visible = false;
      guns[w.id].visible = true; shown = w.id;
      flash.position.set(0, 0.035, BLUEPRINTS[w.id].muzzle - 0.06);
      flashLight.position.copy(flash.position);
    }
    sleeveR.material = sleeveL.material = sleeves[actor.team];
    rig.visible = actor.alive && !actor.scoped && state.phase !== 'end';
    kick = Math.max(0, kick - dt * 9);
    flashT -= dt;
    flash.visible = flashT > 0; flash.rotation.z += 1.7;
    flashLight.intensity = flashT > 0 ? 4 : 0;

    const speed = Math.hypot(actor.vx, actor.vz);
    bob += speed * dt * 1.9;
    const yawDelta = actor.yaw - lastYaw; lastYaw = actor.yaw;
    sway += (Math.max(-0.05, Math.min(0.05, yawDelta * 0.6)) - sway) * Math.min(1, dt * 10);
    const reload = actor.reloadT > 0 ? Math.sin(Math.PI * (1 - actor.reloadT / w.reload)) : 0;
    const lower = Math.max(reload, actor.drawT / 0.45, actor.throwT > 0.7 ? 1 : 0, actor.useT > 0 ? 1 : 0);
    rig.position.set(
      0.2 + Math.cos(bob) * 0.006 * Math.min(1, speed / 3) + sway,
      -0.2 - Math.abs(Math.sin(bob)) * 0.008 * Math.min(1, speed / 3) - lower * 0.22 - actor.crouch * 0.015,
      -0.45 + kick * 0.05);
    rig.rotation.set(kick * 0.07 + lower * 0.5 + actor.recoilP * 0.5, 0.09 + sway * 2, lower * 0.3);
  }

  return { scene, camera, update, onShot };
}
