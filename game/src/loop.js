// loop.js — the frame loop. Simulation advances in fixed steps of TICK however
// fast the display runs; drawing happens once per frame with the leftover
// fraction (alpha) used to interpolate between the last two steps.
import { TICK } from './sim/config.js';

const MAX_FRAME = 0.1;     // a long stall is dropped rather than simulated in one burst

export function startLoop(step, draw) {
  let last = performance.now(), acc = 0;
  function frame(now) {
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    acc += dt;
    while (acc >= TICK) {
      if (!step()) { acc = 0; break; }     // step() returns false while paused
      acc -= TICK;
    }
    draw(acc / TICK, dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
