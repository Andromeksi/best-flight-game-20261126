# Archipelago Run — 3D Flight Game

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Andromeksi/best-flight-game-20261126/rank.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Andromeksi/best-flight-game-20261126/reward.svg)](https://make.fun/c/best-flight-game-20261126-0057)

A complete 3D island-hopping flight game — chase view over a seven-island
archipelago at sunset, live instruments, glowing ring course, red drones,
and a runway landing. An entry in [make.fun](https://make.fun)'s
[Make the best flight game](https://make.fun/c/best-flight-game-20261126-0057)
competition. Built with make.fun — referral code `yk3kf01h`.

## How to play

Open `game/index.html` in a desktop browser (or run `node serve.ts` and open
http://localhost:8080). Pick a mission, launch, and fly. No network, no
build step — every file the game loads lives under `game/`.

- **A / D** — bank and turn
- **W / S** — throttle up / down
- **Mouse** — steer (pitch and roll follow the cursor)
- **Space / Click** — fire cannons
- **1 / 2 / 3** — pick a mission on the title screen
- **R / Enter** — fly again after landing or crashing

## Missions

1. **M1 · Ring Run** — fly all 6 glowing rings over the islands, then land on Runway 07.
2. **M2 · Drone Hunt** — down all 5 red drones (they stay down on this sortie),
   then land before your fuel runs out.
3. **M3 · Precision Landing** — fly the single gate ring, then land gently on
   Runway 07. Touchdown vertical speed sets the rating: PERFECT (+300),
   FIRM (+150) or ROUGH (+50).

Fuel burns faster at full throttle and the gauge turns red below 30% — low
fuel forces a glide-or-land decision. Skimming hillsides grazes the airframe
and a drone that gets close rakes the plane, so damage is a risk to manage,
not just a crash verdict. Land too hard (vertical speed 9+) or run out of
airframe and the sortie ends in the sea or the mountainside.

## Sound

All sound is synthesised with WebAudio — no audio files. The engine hum
follows throttle and speed; cannons, ring chimes, drone explosions, the
landing sting and the crash thud are all generated at runtime. Audio starts
only after you click LAUNCH, and the game plays silently (and fine) where no
audio device exists.

## Tech

- Three.js (vendored `game/vendor/three.min.js`, three@0.149.0 UMD)
- Procedural terrain: seven islands, beaches, peaks, snow caps, drifting clouds
- `game/src/terrain.js` — islands, sea, runway, rings, sky
- `game/src/aircraft.js` — the island-hopper (prop, nav lights, muzzle flashes)
- `game/src/hud.js` — altitude / speed / heading / VSPEED, fuel / damage /
  throttle bars, compass tape, live minimap
- `game/src/missions.js` — the three sorties, objectives and landing verdicts
- `game/src/audio.js` — WebAudio synth SFX
- `game/src/engine.js` — scene, chase camera, flight model, combat, landings

## Hand-in

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/`
to `/output` (or `$MAKEFUN_OUTPUT_DIR`) and writes `/output/dossier.json`
with `buildDossier` from `vendor/makefun-game.ts`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Screenshots under `screenshots/` are real renders of this game's own code,
taken in headless Chromium at 1280×720.
