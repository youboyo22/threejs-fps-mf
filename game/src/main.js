// main.js — the entry point: builds the state, the view and the shell around it,
// then runs the loop. The only module that knows about all the others.
//   ?seed=N   replay a match from a seed      ?auto   bots play the player's operator too
//   ?shot=... pose one of the screenshot scenes (shots.js)
//   ?free     take input without pointer lock (tools/playtest.mjs)
import { createState } from './sim/state.js';
import { startMatch } from './sim/round.js';
import { stepSim } from './sim/sim.js';
import { drain } from './sim/events.js';
import { PHASE } from './sim/config.js';
import { createView } from './view/view.js';
import { createInput } from './input.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { startLoop } from './loop.js';
import { poseShot } from './shots.js';

const params = new URLSearchParams(location.search);
const auto = params.has('auto'), shot = params.get('shot');
const state = createState(Number(params.get('seed')) || (Date.now() % 1e6) + 1, auto);
startMatch(state);

const canvas = document.getElementById('view');
const menu = document.getElementById('menu'), hudEl = document.getElementById('hud');
const view = createView(canvas, state);
const input = createInput(canvas, state, params.has('free'));
const hud = createHud(state, input);
const audio = createAudio(state);

let started = false, cursor = 0;
let posed = null;          // in shot mode: a function that re-stages the frozen scene each frame

function deploy() {
  audio.unlock();
  if (state.phase === PHASE.END) startMatch(state);
  if (!auto) input.lock();
  started = true;
  menu.classList.add('hide'); hudEl.classList.remove('hide');
}
menu.addEventListener('click', deploy);
canvas.addEventListener('click', () => { if (started && (state.phase === PHASE.END || !input.locked())) deploy(); });
document.addEventListener('pointerlockchange', () => {
  if (!started || auto || input.locked()) return;
  // Esc released the mouse: pause behind the menu card
  document.getElementById('menuTag').textContent = 'Paused';
  document.getElementById('menuGo').textContent = 'CLICK TO RESUME';
  menu.classList.remove('hide');
});

if (shot) {
  cursor = state.events.count;        // skip the real match's opening events
  posed = poseShot(state, shot, view);
  started = shot !== 'overview';
  if (started) { menu.classList.add('hide'); hudEl.classList.remove('hide'); }
} else if (auto) deploy();

function dispatch(e) {
  view.onEvent(e);
  hud.onEvent(e);
  audio.onEvent(e, view.watched());
}

// one fixed step; false while the game is not running
function step() {
  if (!started || posed || (!auto && !input.locked())) return false;
  if (!auto) input.apply();
  stepSim(state);
  return true;
}

function draw(alpha, dt) {
  if (posed) posed();
  cursor = drain(state, cursor, dispatch);
  view.render(alpha, dt, !started);
  if (started) hud.update(dt, view.watched());
}

startLoop(step, draw);
