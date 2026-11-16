# SALTLINE

A round-based tactical first-person shooter on three.js, built for the make.fun
`threejs-fps-02` bounty. Two squads of four, TIDE and KILN, fight over two uplink
sites in a coastal salt refinery. Attackers carry a beacon and plant it on site A
or B; defenders hold the sites or defuse it. Money earned each round buys the next
round's weapons. Sides swap after six rounds; first to seven wins.

Single-player against bots. Static files, no build step, no network request.

- **Play:** `node serve.ts`, then open <http://localhost:8080> in desktop Chrome.
- **Hand in:** `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`

## Controls

| Key | Action |
|---|---|
| `W A S D` | move (acceleration and friction, so stopping takes a moment) |
| Mouse | aim; left button fires, right button scopes the Longline DMR |
| `Ctrl` or `C` | crouch: slower, tighter spread |
| `Shift` | walk: silent to bots |
| `Space` | jump |
| `R` | reload |
| `G` | throw a pulse grenade |
| `E` (hold) | plant the beacon on a site, or defuse it |
| `1`–`7` | buy during the buy phase |
| `1` `2` `Q` | switch between primary and sidearm |
| `Tab` | scoreboard |

## What is in it

- **Gunplay.** Hitscan against three hitboxes per operator (head, torso, legs) with
  per-weapon head multipliers; a spread cone that opens when you run, jump or hold
  the trigger and closes when you stop or crouch; recoil that climbs in a fixed
  pattern and recovers. The crosshair gap is the real cone.
- **Economy.** Win and loss pay with a losing-streak bonus, rewards for downs, plants
  and defuses, four guns, a vest, grenades and a defuse kit. Survivors keep their kit.
- **Bots.** They see through a view cone with line-of-sight checks, hear gunfire and
  running footsteps, react after a delay, aim at a limited turn rate with an error
  that settles, fire in bursts, follow lane routes on a waypoint graph, hold posts,
  call contacts to rotate between sites, plant, defuse and throw grenades.
- **Map.** "Saltworks": three lanes (Brine Walk, the Conveyor, Evaporator Row), a
  cross street, a connector behind Mid Gate and two sites with their own cover.
  All textures are painted on canvases at load; all sounds are synthesised.

## Layout

```
game/index.html      page, HUD markup and styles, import map
game/src/sim/        the game as a fixed 60 Hz simulation: no three.js, no DOM
game/src/view/       three.js rendering of that state
game/src/*.js        browser shell: main, loop, input, hud, radar, audio, shots
game/test/           headless checks: node game/test/selftest.mjs
game/vendor/three/   three.js 0.187.0, byte for byte
tools/               capture.mjs (screenshots) and playtest.mjs (input smoke test)
```

The simulation is deterministic from a seed (`?seed=N`) and runs under Node:
`node game/test/selftest.mjs` plays sixteen bot-versus-bot matches in under a second
and checks every way a round can end.

## Screenshots

`screenshots/` holds unedited renders of this code, produced by `node tools/capture.mjs`,
which opens the `?shot=` scenes listed in `shots.json` in headless Chrome. A scene
stages real game state (see `game/src/shots.js`); the normal renderer and HUD draw it.

## License

MIT. three.js is vendored under its own MIT license.
