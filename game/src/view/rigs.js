// rigs.js — the operators' bodies: blocky suited figures with a visor in the team
// colour, posed each frame from the actor record (walk cycle, crouch, going down).
import * as THREE from 'three';
import { PALETTE as P } from './palette.js';

const HIP = 0.82;
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
// geometry shared by all eight rigs
const GEO = {
  leg: box(0.17, HIP, 0.2).translate(0, -HIP / 2, 0),
  torso: box(0.5, 0.62, 0.28).translate(0, 0.31, 0),
  vest: box(0.54, 0.36, 0.33).translate(0, 0.36, 0),
  head: box(0.24, 0.26, 0.25),
  helmet: box(0.3, 0.14, 0.31),
  visor: box(0.25, 0.08, 0.04),
  arm: box(0.13, 0.5, 0.14).translate(0, -0.2, 0),
  gun: box(0.07, 0.12, 0.72),
  pack: box(0.3, 0.34, 0.14),
  mark: new THREE.OctahedronGeometry(0.11),
};
const MAT = {
  suit: new THREE.MeshLambertMaterial({ color: P.suit }),
  skin: new THREE.MeshLambertMaterial({ color: P.skin }),
  gun: new THREE.MeshLambertMaterial({ color: P.gun }),
  pack: new THREE.MeshLambertMaterial({ color: P.hazard }),
  team: P.team.map((c) => new THREE.MeshLambertMaterial({ color: c })),
  glow: P.team.map((c) => new THREE.MeshBasicMaterial({ color: c })),
};

function part(parent, geo, mat, x, y, z) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function createRig(scene, actor, ally) {
  const root = new THREE.Group(), body = new THREE.Group(), upper = new THREE.Group();
  root.add(body); body.add(upper);
  const team = MAT.team[actor.team];
  const legL = part(body, GEO.leg, MAT.suit, -0.12, HIP, 0);
  const legR = part(body, GEO.leg, MAT.suit, 0.12, HIP, 0);
  part(upper, GEO.torso, MAT.suit, 0, 0, 0);
  part(upper, GEO.vest, team, 0, 0, 0);
  part(upper, GEO.head, MAT.skin, 0, 0.8, 0);
  part(upper, GEO.helmet, team, 0, 0.93, 0);
  part(upper, GEO.visor, MAT.glow[actor.team], 0, 0.82, -0.13);
  const armL = part(upper, GEO.arm, team, -0.31, 0.55, -0.05);
  const armR = part(upper, GEO.arm, team, 0.31, 0.55, -0.05);
  armL.rotation.x = 1.25; armL.rotation.z = 0.5; armR.rotation.x = 1.1; armR.rotation.z = -0.15;
  part(upper, GEO.gun, MAT.gun, 0.2, 0.42, -0.45);
  const pack = part(upper, GEO.pack, MAT.pack, 0, 0.36, 0.22);
  // a floating marker over teammates so friend reads from foe at any range
  const mark = ally ? part(root, GEO.mark, MAT.glow[actor.team], 0, 2.15, 0) : null;
  if (mark) mark.castShadow = false;
  scene.add(root);
  return { root, body, upper, legL, legR, pack, mark, stride: 0 };
}

export function createRigs(scene, state) {
  const rigs = state.actors.map((a) => createRig(scene, a, a.team === state.player.team && !a.isPlayer));

  // Pose every rig; `hidden` is the actor whose eyes the camera is using.
  function update(alpha, dt, hidden) {
    for (let i = 0; i < rigs.length; i++) {
      const rig = rigs[i], a = state.actors[i];
      rig.root.visible = a !== hidden;
      if (!rig.root.visible) continue;
      rig.root.position.set(a.px + (a.x - a.px) * alpha, a.py + (a.y - a.py) * alpha, a.pz + (a.z - a.pz) * alpha);
      rig.root.rotation.y = a.yaw;
      const fall = a.alive ? 0 : Math.min(1, a.downT / 0.4);
      rig.body.rotation.x = fall * Math.PI / 2;
      rig.body.position.y = fall * 0.18;
      const hip = HIP - 0.34 * a.crouch;
      rig.upper.position.y = hip;
      rig.upper.rotation.x = -0.3 * a.crouch - (a.alive ? a.pitch * 0.4 : 0);
      rig.legL.position.y = rig.legR.position.y = hip;
      rig.legL.scale.y = rig.legR.scale.y = hip / HIP;
      const speed = a.alive ? Math.hypot(a.vx, a.vz) : 0;
      rig.stride += speed * dt * 2.1;
      const swing = Math.sin(rig.stride) * Math.min(0.75, speed * 0.16);
      rig.legL.rotation.x = swing - 0.5 * a.crouch; rig.legR.rotation.x = -swing + 0.5 * a.crouch;
      rig.pack.visible = state.beacon.state === 'carried' && state.beacon.carrier === i;
      if (rig.mark) { rig.mark.visible = a.alive; rig.mark.rotation.y += dt * 2; }
    }
  }
  return { update };
}
