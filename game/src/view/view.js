// view.js — the renderer. It owns the three.js scene and camera and draws the
// state it is handed, interpolated between the last two simulation steps. It never
// changes the state.
import * as THREE from 'three';
import { EV } from '../sim/events.js';
import { eyeHeight, weaponOf } from '../sim/actor.js';
import { buildWorld } from './world.js';
import { createRigs } from './rigs.js';
import { createFx } from './fx.js';
import { createViewmodel } from './viewmodel.js';

const BASE_FOV = 74;

export function createView(canvas, state) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.autoClear = false;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.05, 500);
  camera.rotation.order = 'YXZ';
  buildWorld(scene);
  const rigs = createRigs(scene, state);
  const fx = createFx(scene, state);
  const viewmodel = createViewmodel(state);
  let watched = state.player;       // whose eyes the camera uses
  let orbit = 0.6;

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = viewmodel.camera.aspect = w / h;
    camera.updateProjectionMatrix(); viewmodel.camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  // The player's own eyes while alive, then a living teammate's.
  function pickWatched() {
    if (state.player.alive) return state.player;
    if (watched.alive && watched.team === state.player.team) return watched;
    for (const a of state.actors) if (a.alive && a.team === state.player.team) return a;
    return state.player;
  }

  function onEvent(e) {
    fx.onEvent(e, watched);
    if (e.type === EV.SHOT && state.actors[e.a] === watched) viewmodel.onShot();
  }

  // overview: the slow aerial orbit behind the menu
  function render(alpha, dt, overview) {
    watched = pickWatched();
    let fov = BASE_FOV;
    if (overview) {
      orbit += dt * 0.05;
      camera.position.set(Math.sin(orbit) * 24, 37, Math.cos(orbit) * 24 + 3);
      camera.lookAt(0, 0, 1);
    } else {
      const a = watched;
      camera.position.set(a.px + (a.x - a.px) * alpha, a.py + (a.y - a.py) * alpha + (a.alive ? eyeHeight(a) : 0.35), a.pz + (a.z - a.pz) * alpha);
      camera.rotation.set(a.pitch + a.recoilP, a.yaw + a.recoilY, 0);
      if (a.scoped) fov = weaponOf(a).zoom;
    }
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov += (fov - camera.fov) * Math.min(1, dt * 16);
      camera.updateProjectionMatrix();
    }
    rigs.update(alpha, dt, overview ? null : watched);
    fx.update(dt);
    renderer.clear();
    renderer.render(scene, camera);
    if (!overview) {
      viewmodel.update(watched, dt);
      renderer.clearDepth();
      renderer.render(viewmodel.scene, viewmodel.camera);
    }
  }

  return { render, onEvent, watched: () => watched, setOrbit(v) { orbit = v; } };
}
