// config.js — every tunable number of SALTLINE in one place. Data only, no logic.

export const TICK = 1 / 60;                 // fixed simulation step, seconds

export const TEAM = { TIDE: 0, KILN: 1 };   // the player's squad is TIDE
export const TEAM_NAME = ['TIDE', 'KILN'];

export const PHASE = { BUY: 'buy', LIVE: 'live', PLANTED: 'planted', POST: 'post', END: 'end' };

export const RULES = {
  teamSize: 4,
  buyTime: 9,          // frozen at spawn, buy menu open
  roundTime: 100,      // attackers must plant or clear the defenders in this time
  fuseTime: 32,        // beacon uplink time after the plant
  plantTime: 3.2,
  defuseTime: 7,
  kitDefuseTime: 3.6,
  postTime: 5,
  halfRounds: 6,       // sides swap after this many rounds
  winRounds: 7,
};

export const ECON = {
  start: 800, max: 12000,
  win: 3000, loss: 1400, lossStep: 500, lossMax: 2900,
  down: 300, plant: 300, defuse: 300,
};

export const MOVE = {
  run: 5.2, walk: 2.5, crouch: 2.0,
  accel: 11, airAccel: 1.4, friction: 8.5, stopSpeed: 2.2,
  gravity: 18, jump: 6.2,
  radius: 0.38, standH: 1.8, crouchH: 1.22,
  eyeStand: 1.62, eyeCrouch: 1.06,
  crouchRate: 7,       // crouch blend per second
  stepLength: 2.3,     // metres of running between audible footsteps
};

// spread values are radians of cone half-angle; recoil values are radians per shot.
export const WEAPONS = {
  marlin: {
    id: 'marlin', name: 'P9 Marlin', kind: 'Sidearm', slot: 'sidearm', price: 0,
    dmg: 27, head: 3.2, legs: 0.8, rpm: 400, auto: false, mag: 12, reserve: 36, reload: 1.7,
    spread: 0.0045, moveSpread: 0.03, airSpread: 0.07, bloom: 0.006, bloomMax: 0.03,
    recoilV: 0.014, recoilH: 0.004, falloff: 16, minFalloff: 0.6, speed: 1, loud: 30, zoom: 0,
  },
  skiff: {
    id: 'skiff', name: 'Skiff-9', kind: 'SMG', slot: 'primary', price: 1250,
    dmg: 22, head: 3.2, legs: 0.8, rpm: 820, auto: true, mag: 30, reserve: 90, reload: 2.1,
    spread: 0.009, moveSpread: 0.022, airSpread: 0.06, bloom: 0.0022, bloomMax: 0.03,
    recoilV: 0.0085, recoilH: 0.005, falloff: 14, minFalloff: 0.55, speed: 0.97, loud: 32, zoom: 0,
  },
  halyard: {
    id: 'halyard', name: 'Halyard AR', kind: 'Rifle', slot: 'primary', price: 2700,
    dmg: 33, head: 4, legs: 0.75, rpm: 600, auto: true, mag: 30, reserve: 90, reload: 2.5,
    spread: 0.0022, moveSpread: 0.075, airSpread: 0.12, bloom: 0.0034, bloomMax: 0.04,
    recoilV: 0.0125, recoilH: 0.0065, falloff: 30, minFalloff: 0.8, speed: 0.9, loud: 40, zoom: 0,
  },
  longline: {
    id: 'longline', name: 'Longline DMR', kind: 'Marksman', slot: 'primary', price: 3700,
    dmg: 82, head: 3, legs: 0.85, rpm: 78, auto: false, mag: 6, reserve: 18, reload: 3.1,
    spread: 0.022, moveSpread: 0.16, airSpread: 0.2, bloom: 0.02, bloomMax: 0.05,
    recoilV: 0.04, recoilH: 0.008, falloff: 60, minFalloff: 0.9, speed: 0.84, loud: 46,
    zoom: 22, zoomSpread: 0.0005,   // scoped (right mouse): tight cone, 22 degree view
  },
};

export const GEAR = {
  vest: { id: 'vest', name: 'Plate Vest', kind: 'Armor', price: 650 },
  pulse: { id: 'pulse', name: 'Pulse Grenade', kind: 'Grenade', price: 300, max: 2 },
  kit: { id: 'kit', name: 'Bypass Kit', kind: 'Defuser', price: 400 },
};

// the buy menu, in key order 1..7
export const SHOP = ['marlin', 'skiff', 'halyard', 'longline', 'vest', 'pulse', 'kit'];

export const GRENADE = {
  speed: 15, lift: 3.5, gravity: 15, bounce: 0.42, fuse: 1.9,
  radius: 7.5, damage: 115, size: 0.12, cooldown: 1.1, loud: 45,
};

export const ARMOR = { points: 100, absorb: 0.5 };   // half of body damage goes to the vest

export const BOT = {
  thinkEvery: 6,          // ticks between decisions (10 Hz), staggered per bot
  fovCos: 0.34,           // about a 140 degree cone
  sightRange: 70,
  reactMin: 0.3, reactRand: 0.35, reactSide: 0.25,
  turnRate: 7.5,          // radians per second
  aimError: 0.11,         // initial aim offset on a new target, radians
  settleRate: 1.5,        // how fast that offset shrinks per second
  memory: 4,              // seconds a lost target is hunted
  rotateDelay: 1.5,
};
