# Block World Sandbox

This project is a compact browser game built around the core Minecraft loop:
explore a block world, break blocks, place blocks, and switch between
`Survival` and `Creative`.

## What it includes

- Chunk-streamed terrain that keeps generating around the player
- Persistent block edits even after chunks unload and reload
- Procedurally generated biomes, trees, lakes, and coastlines
- Passive overworld animals inspired by Minecraft mobs: cows, pigs, sheep, and chickens
- First-person mouse look with pointer lock
- `Survival` mode with gravity, jumping, and collision
- `Creative` mode with free flight
- Block breaking and block placement
- Hotbar selection with number keys or mouse wheel
- Day and night lighting cycle

## Run it

```powershell
node server.js
```

Then open `http://localhost:3000`.

## Controls

- `W A S D`: move
- `Mouse`: look
- `Space`: jump in `Survival`, fly up in `Creative`
- `Shift`: sprint in `Survival`, fly down in `Creative`
- `Left Click`: break block
- `Right Click`: place selected block
- `1-5` or mouse wheel: choose block
- `M`: toggle `Survival` / `Creative`
- `Esc`: unlock cursor
