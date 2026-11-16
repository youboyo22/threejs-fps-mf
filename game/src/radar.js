// radar.js — the minimap: the map's walls drawn once, then teammates, the beacon
// and the enemies your squad can currently see or hear, redrawn each frame.
import { BOXES, BOUNDS, SITES } from './sim/map.js';
import { PALETTE as P } from './view/palette.js';

const SCALE = 3.2;      // pixels per metre

export function createRadar(canvas, state) {
  const g = canvas.getContext('2d');
  const px = (x) => (x - BOUNDS.x0) * SCALE, pz = (z) => (z - BOUNDS.z0) * SCALE;

  // static layer
  const base = document.createElement('canvas');
  base.width = canvas.width; base.height = canvas.height;
  const b = base.getContext('2d');
  b.fillStyle = 'rgba(20,30,37,0.82)'; b.fillRect(0, 0, base.width, base.height);
  b.font = 'bold 22px sans-serif'; b.textAlign = 'center'; b.textBaseline = 'middle';
  for (const site of [SITES.A, SITES.B]) {
    b.fillStyle = 'rgba(242,194,48,0.22)';
    b.fillRect(px(site.x0), pz(site.z0), (site.x1 - site.x0) * SCALE, (site.z1 - site.z0) * SCALE);
    b.fillStyle = P.hazard; b.fillText(site.name, px((site.x0 + site.x1) / 2), pz((site.z0 + site.z1) / 2));
  }
  for (const box of BOXES) {
    if (box.y0 > 0) continue;                 // roofs and pipes are not obstacles
    b.fillStyle = box.y1 >= 4 ? '#d9ceba' : '#7f8b90';
    b.fillRect(px(box.x0), pz(box.z0), (box.x1 - box.x0) * SCALE, (box.z1 - box.z0) * SCALE);
  }

  function dot(a, color, r) {
    const x = px(a.x), y = pz(a.z);
    g.fillStyle = color; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = color; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y);
    g.lineTo(x - Math.sin(a.yaw) * (r + 5), y - Math.cos(a.yaw) * (r + 5)); g.stroke();
  }

  // An enemy shows while a living teammate bot is looking at it, or just after it fires nearby.
  function spotted(enemy, me) {
    if (enemy.sinceShot < 1 && Math.hypot(enemy.x - me.x, enemy.z - me.z) < 35) return true;
    for (const a of state.actors) if (a.alive && a.team === me.team && a.bot && a.bot.target === enemy.index) return true;
    return false;
  }

  function draw(me) {
    g.drawImage(base, 0, 0);
    const beacon = state.beacon;
    if (beacon.state === 'dropped' || beacon.state === 'planted') {
      const pulse = beacon.state === 'planted' && state.tick % 30 < 15;
      g.fillStyle = pulse ? '#ff3b30' : P.hazard;
      g.fillRect(px(beacon.x) - 4, pz(beacon.z) - 4, 8, 8);
    }
    for (const a of state.actors) {
      if (!a.alive || a === me) continue;
      if (a.team === me.team) dot(a, P.team[a.team], 3.5);
      else if (spotted(a, me)) dot(a, '#ff4d4d', 3.5);
    }
    dot(me, '#ffffff', 4);
  }

  return { draw };
}
