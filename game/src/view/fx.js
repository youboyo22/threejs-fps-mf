// fx.js — short-lived effects, all drawn from fixed pools made at load: tracers,
// impact sparks, muzzle flashes, grenade bursts, and the beacon itself.
import * as THREE from 'three';
import { EV } from '../sim/events.js';
import { eyeHeight } from '../sim/actor.js';
import { GRENADE } from '../sim/config.js';
import { PALETTE as P } from './palette.js';

const UP = new THREE.Vector3(0, 1, 0);
const from = new THREE.Vector3(), to = new THREE.Vector3(), dir = new THREE.Vector3();

function additive(color, opacity = 1) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
}

function pool(scene, n, make) {
  const items = [];
  for (let i = 0; i < n; i++) { const it = make(); it.mesh.visible = false; scene.add(it.mesh); items.push(it); }
  let next = 0;
  return { items, take() { const it = items[next]; next = (next + 1) % n; it.mesh.visible = true; return it; } };
}

export function createFx(scene, state) {
  const tracerGeo = new THREE.BoxGeometry(0.014, 0.014, 1).translate(0, 0, 0.5);
  const tracerMat = additive(P.tracer, 0.9);
  const tracers = pool(scene, 24, () => ({ mesh: new THREE.Mesh(tracerGeo, tracerMat), life: 0 }));

  const sparkGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
  const sparkMats = [additive(P.spark), additive(P.pulse)];
  const sparks = pool(scene, 64, () => ({ mesh: new THREE.Mesh(sparkGeo, sparkMats[0]), life: 0, vx: 0, vy: 0, vz: 0 }));

  const flashGeo = new THREE.OctahedronGeometry(0.16);
  const flashMat = additive('#ffd9a0', 0.95);
  const flashes = pool(scene, 6, () => ({ mesh: new THREE.Mesh(flashGeo, flashMat), life: 0 }));
  const flashLight = new THREE.PointLight('#ffc27a', 0, 14, 1.6);
  scene.add(flashLight);

  const blastGeo = new THREE.SphereGeometry(1, 20, 12);
  const blasts = pool(scene, 3, () => ({ mesh: new THREE.Mesh(blastGeo, additive(P.pulse, 0.7)), life: 0, size: 1 }));
  const blastLight = new THREE.PointLight(P.pulse, 0, 30, 1.4);
  scene.add(blastLight);

  const nadeMat = new THREE.MeshLambertMaterial({ color: P.ink, emissive: P.pulse, emissiveIntensity: 0.6 });
  const nadeGeo = new THREE.SphereGeometry(GRENADE.size, 10, 8);
  const nades = state.grenades.map(() => { const m = new THREE.Mesh(nadeGeo, nadeMat); m.castShadow = true; m.visible = false; scene.add(m); return m; });

  // the uplink beacon: a hazard-yellow case with an antenna and a lamp that blinks on each beep
  const beacon = new THREE.Group();
  const caseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.3), new THREE.MeshLambertMaterial({ color: P.hazard }));
  caseMesh.position.y = 0.1; caseMesh.castShadow = true;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6), new THREE.MeshLambertMaterial({ color: P.ink }));
  mast.position.set(0.14, 0.5, 0);
  const lampMat = new THREE.MeshBasicMaterial({ color: '#ff3b30' });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), lampMat);
  lamp.position.set(0.14, 0.82, 0);
  const lampLight = new THREE.PointLight('#ff3b30', 0, 9, 1.5);
  lampLight.position.copy(lamp.position);
  beacon.add(caseMesh, mast, lamp, lampLight);
  beacon.visible = false;
  scene.add(beacon);
  let blink = 0;

  function burst(x, y, z, n, speed, kind) {
    for (let i = 0; i < n; i++) {
      const s = sparks.take();
      s.mesh.material = sparkMats[kind];
      s.mesh.position.set(x, y, z);
      s.vx = (Math.random() - 0.5) * speed; s.vy = Math.random() * speed * 0.8; s.vz = (Math.random() - 0.5) * speed;
      s.life = 0.25 + Math.random() * 0.25;
    }
  }

  function blast(x, y, z, size) {
    const b = blasts.take();
    b.mesh.position.set(x, y, z); b.life = 0.45; b.size = size;
    blastLight.position.set(x, y + 1, z); blastLight.intensity = 60 * size;
    burst(x, y + 0.3, z, 18, 9, 1);
  }

  // A shot: tracer from the shooter's muzzle to where the round stopped, a flash, sparks.
  function shot(e, viewer) {
    const a = state.actors[e.a];
    dir.set(-Math.sin(a.yaw), 0, -Math.cos(a.yaw));
    from.set(a.x, a.y + eyeHeight(a) - 0.14, a.z).addScaledVector(dir, 0.6);
    from.x -= dir.z * 0.16; from.z += dir.x * 0.16;           // offset to the gun hand
    to.set(e.x, e.y, e.z);
    const len = from.distanceTo(to);
    if (a === viewer && len > 3) from.lerp(to, 1.6 / len);    // own tracers begin past the barrel
    const t = tracers.take();
    t.mesh.position.copy(from); t.mesh.lookAt(to); t.mesh.scale.z = from.distanceTo(to); t.life = 0.07;
    if (a !== viewer) { const f = flashes.take(); f.mesh.position.copy(from); f.life = 0.05; }
    flashLight.position.copy(from); flashLight.intensity = 9;
    burst(e.x, e.y, e.z, e.b ? 5 : 3, e.b ? 3 : 2.2, e.b ? 1 : 0);
  }

  function onEvent(e, viewer) {
    if (e.type === EV.SHOT) shot(e, viewer);
    else if (e.type === EV.BLAST) blast(e.x, e.y, e.z, 1);
    else if (e.type === EV.DETONATED) blast(e.x, e.y + 1, e.z, 2.6);
    else if (e.type === EV.BEEP) blink = 0.12;
    else if (e.type === EV.BOUNCE) burst(e.x, e.y, e.z, 2, 1.5, 0);
  }

  function update(dt) {
    for (const t of tracers.items) if (t.mesh.visible && (t.life -= dt) <= 0) t.mesh.visible = false;
    for (const f of flashes.items) if (f.mesh.visible && (f.life -= dt) <= 0) f.mesh.visible = false;
    flashLight.intensity = Math.max(0, flashLight.intensity - dt * 160);
    blastLight.intensity = Math.max(0, blastLight.intensity - dt * 220);
    for (const s of sparks.items) {
      if (!s.mesh.visible) continue;
      if ((s.life -= dt) <= 0) { s.mesh.visible = false; continue; }
      s.vy -= 12 * dt;
      s.mesh.position.x += s.vx * dt; s.mesh.position.y += s.vy * dt; s.mesh.position.z += s.vz * dt;
    }
    for (const b of blasts.items) {
      if (!b.mesh.visible) continue;
      if ((b.life -= dt) <= 0) { b.mesh.visible = false; continue; }
      const k = 1 - b.life / 0.45;
      b.mesh.scale.setScalar((0.6 + k * 4.2) * b.size);
      b.mesh.material.opacity = 0.7 * (1 - k);
    }
    for (let i = 0; i < nades.length; i++) {
      const g = state.grenades[i];
      nades[i].visible = g.active;
      if (g.active) nades[i].position.set(g.x, g.y + GRENADE.size, g.z);
    }
    const bs = state.beacon;
    beacon.visible = bs.state === 'dropped' || bs.state === 'planted' || bs.state === 'defused';
    if (beacon.visible) beacon.position.set(bs.x, bs.y, bs.z);
    blink = Math.max(0, blink - dt);
    lampMat.color.set(bs.state === 'defused' ? '#3ddc84' : blink > 0 ? '#ff3b30' : '#5a1512');
    lampLight.intensity = blink > 0 ? 14 : 0;
    beacon.rotateOnAxis(UP, dt * 0.4);
  }

  return { onEvent, update };
}
