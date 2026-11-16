// world.js — turns map.js's boxes into the static scene: walls, cover, roofs,
// floor, site markings, the skyline beyond the walls, sun and sky light.
import * as THREE from 'three';
import { BOXES, BOUNDS, SITES } from '../sim/map.js';
import { PALETTE as P } from './palette.js';
import { wallTexture, floorTexture, crateTexture, ribTexture, brickTexture, siteTexture, signTexture, skyTexture } from './textures.js';

// A box whose UVs tile in world units, so one texture fits every size of wall.
// tileV = 0 marks wall art: it is anchored to the ground and spans 5 m of height,
// so the painted band sits at the same level on every wall, lintels included.
function tiledBox(w, h, d, tile, tileV, y0) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv;
  const sides = [d, d, w, w, w, w];           // face order: +x -x +y -y +z -z
  for (let face = 0; face < 6; face++) {
    const flat = face === 2 || face === 3;
    for (let i = face * 4; i < face * 4 + 4; i++) {
      const u = uv.getX(i) * sides[face] / tile, v = uv.getY(i);
      uv.setXY(i, u, flat ? v * d / tile : tileV ? v * h / tileV : (y0 + v * h) / 5);
    }
  }
  return geo;
}

function lambert(map, color = '#ffffff') { return new THREE.MeshLambertMaterial({ map, color }); }

function makeMaterials() {
  const wallSide = lambert(wallTexture());
  const cap = lambert(null, P.plasterDark);
  const crate = lambert(crateTexture(P.crate, P.crateDark));
  const container = lambert(ribTexture(P.container, P.containerDark));
  const tank = lambert(ribTexture(P.tank, P.tankDark));
  const roof = lambert(ribTexture(P.roof, P.metal));
  const brick = lambert(brickTexture());
  const low = lambert(null, P.quay);
  return {
    wall: { mat: [wallSide, wallSide, cap, cap, wallSide, wallSide], tile: 4, tileV: 0 },
    block: { mat: [wallSide, wallSide, cap, cap, wallSide, wallSide], tile: 4, tileV: 0 },
    stack: { mat: brick, tile: 2, tileV: 2 },
    crate: { mat: crate, tile: 1, tileV: 1 },
    container: { mat: container, tile: 2, tileV: 2 },
    tank: { mat: tank, tile: 2, tileV: 2 },
    roof: { mat: roof, tile: 4, tileV: 4 },
    pipe: { mat: lambert(null, P.band), tile: 1, tileV: 1 },
    low: { mat: low, tile: 1, tileV: 1 },
  };
}

function addStatic(scene, mesh, shadow = true) {
  mesh.castShadow = shadow; mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false; mesh.updateMatrix();
  scene.add(mesh);
  return mesh;
}

function addBoxes(scene, mats) {
  const hazard = new THREE.MeshLambertMaterial({ color: P.hazard });
  for (const b of BOXES) {
    const w = b.x1 - b.x0, h = b.y1 - b.y0, d = b.z1 - b.z0;
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, cz = (b.z0 + b.z1) / 2;
    const style = mats[b.kind];
    let mesh;
    if (b.kind === 'pipe') {                  // overhead runs draw as twin pipes, collide as their box
      const along = w > d, len = along ? w : d, r = h / 2;
      mesh = new THREE.Group();
      for (const side of [-0.3, 0.3]) {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), style.mat);
        pipe.rotation.z = along ? Math.PI / 2 : 0; pipe.rotation.x = along ? 0 : Math.PI / 2;
        pipe.position.set(along ? 0 : side, 0, along ? side : 0);
        pipe.castShadow = true;
        mesh.add(pipe);
      }
    } else mesh = new THREE.Mesh(tiledBox(w, h, d, style.tile, style.tileV, b.y0), style.mat);
    mesh.position.set(cx, cy, cz);
    addStatic(scene, mesh);
    if (b.kind === 'low') {                   // a hazard stripe along the top of low barriers
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.12, d + 0.02), hazard);
      stripe.position.set(cx, b.y1 - 0.06, cz);
      addStatic(scene, stripe, false);
    }
  }
}

function addGround(scene) {
  const w = BOUNDS.x1 - BOUNDS.x0, d = BOUNDS.z1 - BOUNDS.z0;
  const tex = floorTexture(); tex.repeat.set(w / 4, d / 4);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lambert(tex));
  floor.rotation.x = -Math.PI / 2;
  addStatic(scene, floor, false);

  // beyond the walls: sand, the sea off the south quay, salt heaps and refinery silhouettes
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), lambert(null, P.sand));
  sand.rotation.x = -Math.PI / 2; sand.position.y = -0.05;
  addStatic(scene, sand, false);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(600, 260), new THREE.MeshLambertMaterial({ color: P.sea }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(0, -0.02, 160);
  addStatic(scene, sea, false);

  const salt = new THREE.MeshLambertMaterial({ color: P.salt });
  const dark = new THREE.MeshLambertMaterial({ color: P.roof });
  const heaps = [[-48, -8, 9], [-44, 14, 6], [46, -16, 10], [50, 6, 7], [-14, -42, 11], [16, -46, 13], [40, -38, 8], [-40, -36, 7]];
  for (const [x, z, r] of heaps) {
    const heap = new THREE.Mesh(new THREE.ConeGeometry(r, r * 0.75, 7), salt);
    heap.position.set(x, r * 0.37, z);
    addStatic(scene, heap, false);
  }
  const towers = [[-38, -24, 14], [38, 22, 17], [2, -36, 20], [-36, 30, 12], [34, -30, 15]];
  for (const [x, z, h] of towers) {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(1.6, h, 1.6), dark);
    tower.position.set(x, h / 2, z);
    addStatic(scene, tower, false);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(8, 0.5, 0.5), dark);
    arm.position.set(x + 3, h - 1, z);
    addStatic(scene, arm, false);
  }
}

function addSiteMarks(scene) {
  for (const site of [SITES.A, SITES.B]) {
    const w = site.x1 - site.x0, d = site.z1 - site.z0;
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({ map: siteTexture(site.name), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    pad.rotation.x = -Math.PI / 2;
    pad.position.set((site.x0 + site.x1) / 2, 0.02, (site.z0 + site.z1) / 2);
    addStatic(scene, pad, false);
  }
  // wall signs pointing the way: [text, x, y, z, yaw]
  const signs = [
    ['A', 20.02, 3.2, 12, Math.PI / 2], ['A', 29.97, 3.6, -17, -Math.PI / 2], ['A', 6.98, 3.3, -5, -Math.PI / 2],
    ['B', -20.02, 3.2, 12, -Math.PI / 2], ['B', -29.97, 3.6, -18, Math.PI / 2], ['B', -6.98, 3.3, -5, Math.PI / 2],
    ['MID', 0, 3.6, 12.02, 0], ['A', 4.8, 3.7, -9.48, 0], ['B', -4.8, 3.7, -9.48, 0],
  ];
  const mats = {};
  for (const [text, x, y, z, yaw] of signs) {
    mats[text] = mats[text] || new THREE.MeshBasicMaterial({ map: signTexture(text, P.hazard) });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(text.length > 2 ? 2.4 : 1.6, text.length > 2 ? 1.2 : 0.8), mats[text]);
    sign.position.set(x, y, z); sign.rotation.y = yaw;
    addStatic(scene, sign, false);
  }
}

function addLights(scene) {
  scene.add(new THREE.HemisphereLight(P.skyLight, P.bounce, 1.25));
  const sun = new THREE.DirectionalLight(P.sun, 2.6);
  sun.position.set(-38, 46, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const cam = sun.shadow.camera;
  cam.left = -44; cam.right = 44; cam.top = 40; cam.bottom = -40; cam.near = 10; cam.far = 130;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
  scene.add(sun);
}

export function buildWorld(scene) {
  scene.background = skyTexture();
  scene.fog = new THREE.Fog(P.fog, 55, 210);
  addLights(scene);
  addGround(scene);
  addBoxes(scene, makeMaterials());
  addSiteMarks(scene);
}
