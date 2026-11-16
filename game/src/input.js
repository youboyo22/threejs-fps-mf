// input.js — keyboard and mouse. Mouse look turns the player's view at once;
// everything else becomes the player's `cmd` once per simulation step.
import { SHOP, PHASE } from './sim/config.js';
import { buy } from './sim/economy.js';

const SENSITIVITY = 0.0022;
const PITCH_LIMIT = 1.5;

// free: accept input without pointer lock (headless playtests, where no lock is granted)
export function createInput(canvas, state, free) {
  const keys = new Set();
  const buttons = [false, false, false];
  let jump = false, grenade = false, slot = '', wanted = '';
  const locked = () => free || document.pointerLockElement === canvas;

  window.addEventListener('keydown', (e) => {
    if (locked()) e.preventDefault();          // keep Tab, Space and Ctrl combos in the game
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'Space') jump = true;
    else if (e.code === 'KeyG') grenade = true;
    else if (e.code === 'KeyQ') slot = state.player.active === 'primary' ? 'sidearm' : 'primary';
    else if (e.code.startsWith('Digit')) {
      const n = Number(e.code.slice(5));
      if (state.phase === PHASE.BUY) wanted = SHOP[n - 1] || '';
      else if (n === 1) slot = 'primary'; else if (n === 2) slot = 'sidearm';
    }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); buttons.fill(false); });
  document.addEventListener('pointerlockchange', () => { if (!locked()) { keys.clear(); buttons.fill(false); } });
  canvas.addEventListener('mousedown', (e) => { if (locked()) buttons[e.button] = true; });
  window.addEventListener('mouseup', (e) => { buttons[e.button] = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('mousemove', (e) => {
    const p = state.player;
    if (!locked() || !p.alive) return;
    const k = SENSITIVITY * (p.scoped ? 0.32 : 1);
    p.yaw -= e.movementX * k;
    p.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, p.pitch - e.movementY * k));
  });

  // Called once per fixed step, before the simulation runs.
  function apply() {
    const p = state.player, c = p.cmd, on = locked();
    const fwd = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
    const side = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
    c.wishX = on ? -sin * fwd + cos * side : 0;
    c.wishZ = on ? -cos * fwd - sin * side : 0;
    c.fire = on && buttons[0];
    c.scope = on && buttons[2];
    c.crouch = keys.has('ControlLeft') || keys.has('KeyC');
    c.walk = keys.has('ShiftLeft');
    c.reload = keys.has('KeyR');
    c.use = keys.has('KeyE');
    c.jump = jump; c.throw = grenade; c.slot = slot;
    if (wanted) buy(state, p, wanted);
    jump = grenade = false; slot = wanted = '';
  }

  return { apply, locked, lock: () => { if (!free) canvas.requestPointerLock(); }, held: (code) => keys.has(code) };
}
