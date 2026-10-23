# Three.js Rake Survival prototype

This browser-playable prototype lives alongside the original Unity project in `threejs-game/`.

## Run locally
Because the game uses ES modules, serve the repository over HTTP rather than opening the HTML as a `file://` URL. For example, from the repository root:

```bash
python -m http.server 8000
```

Then open http://localhost:8000/threejs-game/.

Three.js and its GLTF loader are imported from jsDelivr, so the browser needs internet access.

## Rake model
The loader tries these locations for the requested `thc4.glb` asset:
- `/assets/thc4.glb`
- `/models/thc4.glb`
- `./thc4.glb`
- `./assets/thc4.glb`

Put the model at `threejs-game/assets/thc4.glb` (recommended) or adjust `modelCandidates` in `index.html`. Embedded GLB animation clips are used by name where available; the game continues with a primitive placeholder if the model is missing.

## Prototype controls and behavior
- WASD to move, mouse to look, Shift to sprint.
- Four allied survivor bots follow the player, path around trees, attack the Rake, and respawn after five seconds.
- Day/night cycle: the Rake returns to its initial spawn by day, searches at speed 7 at night, and chases the nearest living survivor/player within 45 world units at speed 19.
- Grid-based A* routes around tree obstacles. This is a lightweight gameplay prototype; tune speeds, damage, and world layout in `index.html`.

The original Unity project and its scripts are unchanged by this addition.
