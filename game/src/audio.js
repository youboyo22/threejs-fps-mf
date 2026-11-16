// audio.js — every sound is synthesised with WebAudio from noise and sine sweeps:
// no audio files. World sounds are placed by distance and stereo pan from the listener.
import { EV } from './sim/events.js';

// per weapon: [noise seconds, low-pass Hz, thump from Hz, thump to Hz]
const SHOTS = { marlin: [0.09, 2600, 220, 90], skiff: [0.06, 3400, 260, 120], halyard: [0.13, 1900, 150, 55], longline: [0.26, 1300, 100, 38] };

export function createAudio(state) {
  let ctx = null, master = null, hiss = null;

  function unlock() {
    if (ctx) { ctx.resume(); return; }
    ctx = new AudioContext();
    master = ctx.createGain(); master.gain.value = 0.45; master.connect(ctx.destination);
    hiss = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = hiss.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  function out(vol, pan, dur, delay) {
    const t = ctx.currentTime + delay;
    const gain = ctx.createGain(), panner = ctx.createStereoPanner();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    panner.pan.value = pan;
    gain.connect(panner).connect(master);
    return gain;
  }

  function tone(from, to, dur, vol, pan = 0, type = 'sine', delay = 0) {
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    osc.connect(out(vol, pan, dur, delay));
    osc.start(t); osc.stop(t + dur);
  }

  function noise(dur, cutoff, vol, pan = 0, delay = 0) {
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource(), filter = ctx.createBiquadFilter();
    src.buffer = hiss; filter.type = 'lowpass'; filter.frequency.value = cutoff;
    src.connect(filter).connect(out(vol, pan, dur, delay));
    src.start(t, Math.random() * 0.5, dur);
  }

  let vol = 1, pan = 0;
  // Sets vol and pan for a sound at (x,z) heard by the listener; false when out of earshot.
  function place(x, z, listener, reach) {
    const dx = x - listener.x, dz = z - listener.z, d = Math.hypot(dx, dz);
    if (d > reach) return false;
    vol = 1 / (1 + (d * d) / (reach * 2.2));
    pan = d < 0.5 ? 0 : (dx * Math.cos(listener.yaw) - dz * Math.sin(listener.yaw)) / d * 0.8;
    return true;
  }

  function onEvent(e, listener) {
    if (!ctx) return;
    const who = state.actors[e.a], mine = who === listener;
    switch (e.type) {
      case EV.SHOT: {
        if (!place(who.x, who.z, listener, 90)) break;
        const s = SHOTS[e.s];
        noise(s[0], s[1], 0.9 * vol, pan); tone(s[2], s[3], s[0] * 1.2, 0.8 * vol, pan);
        break;
      }
      case EV.HURT:
        if (mine) tone(140, 60, 0.16, 0.7);
        else if (state.actors[e.b] === listener) tone(e.c ? 2100 : 1400, e.c ? 1500 : 1100, 0.07, 0.35, 0, 'triangle');
        break;
      case EV.STEP: if (!mine && place(e.x, e.z, listener, 16)) noise(0.05, 520, 0.5 * vol, pan); else if (mine) noise(0.04, 420, 0.1); break;
      case EV.RELOAD: if (place(e.x, e.z, listener, 12)) { tone(900, 700, 0.03, 0.2 * vol, pan, 'square'); tone(600, 500, 0.04, 0.2 * vol, pan, 'square', 0.35); } break;
      case EV.DRY: if (mine) tone(1200, 900, 0.02, 0.2, 0, 'square'); break;
      case EV.SWITCH: if (mine) noise(0.08, 3000, 0.12); break;
      case EV.THROW: if (place(e.x, e.z, listener, 20)) noise(0.18, 5000, 0.2 * vol, pan); break;
      case EV.BOUNCE: if (place(e.x, e.z, listener, 25)) tone(700, 420, 0.05, 0.25 * vol, pan, 'triangle'); break;
      case EV.BLAST: if (place(e.x, e.z, listener, 120)) { noise(0.7, 600, 1.2 * vol, pan); tone(90, 30, 0.6, vol, pan); } break;
      case EV.DETONATED: noise(1.4, 500, 1.3); tone(70, 24, 1.2, 1); break;
      case EV.BEEP: if (place(e.x, e.z, listener, 70)) tone(1250, 1250, 0.07, 0.4 * vol, pan); break;
      case EV.PLANTING: if (place(e.x, e.z, listener, 14)) tone(500, 760, 0.12, 0.3 * vol, pan, 'triangle'); break;
      case EV.PLANTED: tone(660, 660, 0.12, 0.4); tone(880, 880, 0.12, 0.4, 0, 'sine', 0.14); tone(660, 660, 0.2, 0.4, 0, 'sine', 0.28); break;
      case EV.DEFUSED: tone(880, 440, 0.4, 0.4); break;
      case EV.PICKUP: if (mine) tone(520, 780, 0.1, 0.3); break;
      case EV.BUY: if (mine) { tone(1300, 1300, 0.04, 0.25, 0, 'triangle'); tone(1700, 1700, 0.06, 0.25, 0, 'triangle', 0.06); } break;
      case EV.DENY: if (mine) tone(160, 120, 0.12, 0.3, 0, 'square'); break;
      case EV.ROUND_START: tone(440, 440, 0.1, 0.3); break;
      case EV.LIVE: tone(660, 990, 0.25, 0.35); break;
      case EV.ROUND_END: {
        const won = e.a === state.player.team;
        tone(won ? 523 : 392, won ? 523 : 370, 0.3, 0.35); tone(won ? 784 : 311, won ? 784 : 262, 0.5, 0.35, 0, 'sine', 0.2);
        break;
      }
    }
  }

  return { unlock, onEvent };
}
