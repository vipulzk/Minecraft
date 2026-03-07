# Block World Sandbox

This project is a compact browser game built around the core Minecraft loop:
explore a block world, break blocks, place blocks, and switch between
`Survival` and `Creative`.

## What it includes

- Chunk-streamed terrain that keeps generating around the player
- Persistent block edits even after chunks unload and reload
- Procedurally generated biomes, trees, lakes, and coastlines
- Passive overworld animals inspired by Minecraft mobs: cows, pigs, sheep, and chickens
- Mob health bars and death animation when a mob is defeated
- JSON blueprint import with hologram preview and Creative auto-build
- Included sample blueprint at `blueprints/starter-cabin.json`
- Minecraft-style tools in the hotbar: sword, axe, pickaxe, hoe, mace, and spear
- First-person mouse look with pointer lock
- `Survival` mode with gravity, jumping, and collision
- `Creative` mode with free flight
- Player health in the HUD with fall damage in `Survival`
- Tool-based combat, block harvesting, hoe tilling, and spear throws
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
- `E`: open or close inventory
- `Left Click`: break blocks or hit mobs
- `Right Click`: place selected block, till soil with the hoe, or throw the spear
- `1-9` or mouse wheel: choose hotbar slot
- `M`: toggle `Survival` / `Creative`
- `R`: rotate loaded blueprint
- `[ ]`: move blueprint hologram down or up
- `G`: auto-build the loaded blueprint in `Creative`
- `Esc`: unlock cursor

## Tools

- `Sword`: strongest general melee weapon
- `Axe`: best for wood and leaves
- `Pickaxe`: best for stone
- `Hoe`: right-click grass or dirt to turn it into farmland
- `Mace`: heavy melee hit with bonus damage while falling
- `Spear`: longer reach and throwable ranged attack

## Blueprints

- Use `Load Sample` to preview the included starter cabin
- Use `Import JSON` to load a custom blueprint file
- Aim at terrain to move the hologram placement point
- Green hologram blocks are already satisfied
- Cyan hologram blocks will be placed
- Red hologram blocks are blocked by other blocks
