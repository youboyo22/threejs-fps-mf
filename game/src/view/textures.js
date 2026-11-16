// textures.js — every surface in the game is painted here on a canvas at load:
// no image files, so the art is this code's own and the game ships as text.
import * as THREE from 'three';
import { PALETTE as P } from './palette.js';
import { makeRng } from '../sim/rng.js';

function paint(w, h, draw, repeat = true) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  draw(canvas.getContext('2d'), w, h, makeRng(w * 31 + h));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;
  return tex;
}

// soft blotches and specks so flat colour reads as weathered material
function grime(g, w, h, rng, n, light, dark) {
  for (let i = 0; i < n; i++) {
    g.globalAlpha = 0.03 + rng() * 0.06;
    g.fillStyle = rng() < 0.5 ? light : dark;
    const s = 4 + rng() * 40;
    g.fillRect(rng() * w, rng() * h, s, s * (0.3 + rng()));
  }
  g.globalAlpha = 1;
}

// Plaster wall, 4 m wide by 5 m tall: teal dado band at the foot, salt staining above it.
export function wallTexture() {
  return paint(256, 320, (g, w, h, rng) => {
    g.fillStyle = P.plaster; g.fillRect(0, 0, w, h);
    grime(g, w, h, rng, 160, '#ffffff', P.plasterDark);
    g.fillStyle = P.band; g.fillRect(0, h - 76, w, 76);
    g.fillStyle = P.bandDark; g.fillRect(0, h - 80, w, 5); g.fillRect(0, h - 10, w, 10);
    for (let x = 0; x < w; x += 9) {           // salt creeping up from the ground
      g.fillStyle = 'rgba(251,247,238,' + (0.15 + rng() * 0.3) + ')';
      g.fillRect(x, h - 10 - rng() * 26, 9, 36);
    }
    g.fillStyle = 'rgba(28,42,51,0.18)'; g.fillRect(0, 0, 2, h); g.fillRect(0, 22, w, 3);   // panel joints
  }, false);
}

export function floorTexture() {
  return paint(256, 256, (g, w, h, rng) => {
    g.fillStyle = P.floor; g.fillRect(0, 0, w, h);
    grime(g, w, h, rng, 220, '#ffffff', P.floorLine);
    g.strokeStyle = P.floorLine; g.lineWidth = 3; g.strokeRect(0, 0, w, h);
    g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
  });
}

export function crateTexture(base, dark) {
  return paint(128, 128, (g, w, h, rng) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    grime(g, w, h, rng, 40, '#ffffff', dark);
    g.strokeStyle = dark; g.lineWidth = 12; g.strokeRect(6, 6, w - 12, h - 12);
    g.lineWidth = 9; g.beginPath(); g.moveTo(10, 10); g.lineTo(w - 10, h - 10); g.stroke();
    g.fillStyle = P.salt; g.font = 'bold 20px sans-serif'; g.fillText('NaCl', 40, 100);
  });
}

// corrugated sheet: vertical ribs
export function ribTexture(base, dark) {
  return paint(128, 128, (g, w, h, rng) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) { g.fillStyle = dark; g.fillRect(x, 0, 6, h); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x + 8, 0, 3, h); }
    grime(g, w, h, rng, 50, '#ffffff', P.ink);
    g.fillStyle = 'rgba(28,42,51,0.35)'; g.fillRect(0, 0, w, 5); g.fillRect(0, h - 5, w, 5);
  });
}

export function brickTexture() {
  return paint(128, 128, (g, w, h, rng) => {
    g.fillStyle = P.brickDark; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) for (let x = -32; x < w; x += 32) {
      g.fillStyle = rng() < 0.3 ? '#c4674a' : P.brick;
      g.fillRect(x + ((y / 16) % 2) * 16 + 1, y + 1, 30, 14);
    }
  });
}

// The painted pad that marks an uplink site: hazard border and a big letter.
export function siteTexture(letter) {
  return paint(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = P.hazard; g.lineWidth = 14; g.setLineDash([26, 16]); g.strokeRect(12, 12, w - 24, h - 24);
    g.fillStyle = 'rgba(242,194,48,0.14)'; g.fillRect(12, 12, w - 24, h - 24);
    g.fillStyle = P.hazard; g.font = 'bold 150px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(letter, w / 2, h / 2 + 8);
  }, false);
}

// A wall sign: a letter or word on a dark plate.
export function signTexture(text, color) {
  return paint(256, 128, (g, w, h) => {
    g.fillStyle = P.ink; g.fillRect(0, 0, w, h);
    g.strokeStyle = color; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = color; g.font = 'bold ' + (text.length > 2 ? 44 : 92) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 4);
  }, false);
}

export function skyTexture() {
  const tex = paint(16, 256, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, P.skyTop); grad.addColorStop(0.42, '#7fb0bd'); grad.addColorStop(0.5, P.skyMid); grad.addColorStop(0.56, P.skyLow); grad.addColorStop(1, P.skyLow);
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
  }, false);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
}
