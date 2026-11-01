# Cubicraft — build & status

A Minecraft-style voxel game built for the family. This document covers how the
game is built, what was fixed and added in the latest pass, and what is still
missing relative to full Minecraft.

## How it's built

- **Stack**: TypeScript + [Three.js](https://threejs.org) + [Vite](https://vite.dev). No game engine — a custom voxel engine.
- **Rendering**: WebGL, chunked greedy meshing with baked per-vertex ambient occlusion and flood-filled sky/block light. All block textures are procedurally painted into a single `DataArrayTexture` atlas — zero image assets. Custom shaders drive terrain lighting, fog and animated water.
- **Worldgen**: runs in a Web Worker (seeded climate → biome → terrain → caves → ores → structures → decoration pipeline). Meshing runs in a second worker. ~10 ms per chunk.
- **Content**: code-generated registries — 1,286 blocks, 464 items, 88 mobs, 68 biomes, 43 enchantments, 505 recipes, all self-validated at boot.
- **Multiplayer**: WebRTC data channels, host-authoritative, binary protocol. On LAN, `npm run lan` starts the launcher with a pairing relay so a second player joins with one click — no accounts, no server.
- **Audio**: procedural WebAudio SFX (oscillators + filtered noise) — no audio files.
- **Tests**: Vitest, 179 tests across 19 files (mesher, worldgen, crafting, registry self-checks).

### Commands

```bash
npm install        # dependencies
npm run dev        # dev server → http://localhost:5173
npm run lan        # LAN launcher + join relay → http://<lan-ip>:8080
npm test           # 179 tests
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + production bundle
```

### Map of the code

| Path | Contents |
|---|---|
| `src/workers/mesher.ts` | Greedy mesher + lighting bake (worker) |
| `src/workers/genWorker.ts` | Chunk generation (worker) |
| `src/worldgen/` | Climate → biome → terrain → caves → ores → structures → decoration |
| `src/render/` | Atlas painter, terrain shader, sky, chunk/mob renderers |
| `src/engine/` | ChunkManager streaming, voxel raycast/shapes, player physics |
| `src/game/` | Game loop orchestration, entities/AI, survival, crafting, furnace, redstone, extras (camera/laser/paint/waypoints), day/night, multiplayer session |
| `src/content/` | All registries: blocks, items, mobs, biomes, enchantments, recipes |
| `src/ui/` | Menus, HUD, crafting/enchanting/furnace/chest screens, avatar picker |
| `src/audio/sfx.ts` | Procedural sound effects |
| `tools/launcher.mjs` | Static server + `/pair` join relay (`npm run lan`) |

## What was done (this pass)

**Rendering fixes**
- Fixed greedy-mesher merged quads collapsing to 1×1 — ~99% of surface faces were missing; the world looked like black speckles into caves. Root cause of the "2D/broken" screenshot.
- Fixed AO triangulation comparing the wrong vertex-data channel.
- Fixed the plant texture painter turning every plant into a red flower (now green tufts, per-flower colors, mushrooms, corals) and painting opaque plant blocks transparent.

**Playability**
- Grounded spawn: you used to fall from y=90 while chunks streamed — now you spawn on the surface.
- Mouse-look fallback: drag-to-look when pointer lock is unavailable (iframes, remote sessions), plus a "click to capture the mouse" hint.
- Melee combat both ways: left-click hits mobs (was impossible), and mobs now damage the player on contact (was impossible to die). Death respawns; hardcore death → spectator.

**Survival progression (was unreachable)**
- 3×3 crafting table UI (only 2×2 existed → no tools/swords/armor were craftable).
- Armor equip slots + real damage reduction (4%/point).
- Furnace UI: smeltable-item list, fuel consumption, timed jobs that finish while you walk away.
- Enchanting table UI: spend XP levels + lapis; sharpness/efficiency/fortune/unbreaking/protection all wired to real effects.
- Chest / ender chest / barrel storage UI (27 slots, persisted per position).

**Dimensions**
- Nether and End travel: craftable portal blocks (obsidian×3 + flint; end stone×3 + ender pearl), stand inside ~1.2 s to travel; world restreams with per-dimension sky/fog and dimension-aware mob spawning; stale worker results are dropped on switch.

**Multiplayer & modes**
- "Accept answer" step in the Join UI (the handshake could never complete before) + `/pair` relay auto-join via `npm run lan`.
- Mode picker cards on the main menu + runtime `setMode` (all 6: survival, creative, hardcore, adventure, sandbox, spectator).
- Dirt-family blocks drop random surprises (seeds, veggies, nuggets, rare emeralds/diamonds).

**Audio**
- Procedural SFX: dig, break, place, footsteps, hurt, eat, craft, pickup, level-up, death.

## What's still missing

- **Brewing/potions** — stand + potion items exist; no brewing UI or wired effects.
- **Beds / sleeping** — no bed blocks; can't skip the night (time_control item exists).
- **Item entities** — drops go straight to the inventory instead of popping into the world.
- **Ranged mobs** — skeletons/archers face you but don't shoot arrows.
- **Bosses** — boss mobs exist in the registry but have no spawn mechanics or fights.
- **Fishing, villager trading, farming growth** — not wired.
- **Weather particles** — rain/thunder states exist but no visible rain/snow.
- **Multiplayer depth** — block changes and player positions sync; inventories, chests, furnaces, dimensions and survival state do not.
- **World save/load UI** — IndexedDB persistence exists for multiplayer snapshots but there is no save/restore flow for single-player.

## Honest assessment

The registry counts are real, and the core loop (mine → craft → smelt → enchant → travel) now works end-to-end. It plays like early-alpha Minecraft rather than a visual demo, but it is not feature-complete: the "missing" list above is roughly the difference between a solid family game and actual Minecraft parity.
