# CUBICRAFT

A Minecraft-style voxel game for the family — survival, creative and adventure modes,
every biome, creatures, crafting, redstone, and the Nether and End — with
**peer-to-peer multiplayer over your own Wi-Fi**, no game server and no accounts.

Players pick a club kit (Real Madrid 25/26 or FC Barcelona 25/26) for their avatar.

---

## Current status

| Area | State |
|---|---|
| Content registry | **1,286 blocks · 464 items · 88 mobs · 68 biomes · 43 enchantments · 505 recipes** — validated with zero errors |
| World generation | 68 biomes, caves, ores, trees, structures; **10.5 ms per chunk**; no seams between chunks |
| Voxel engine | Chunked streaming, greedy meshing with ambient occlusion, flood lighting, Minecraft-accurate physics |
| Multiplayer | WebRTC data channel, binary protocol, host authority, chunk/entity sync, IndexedDB world save |
| Avatars | Procedural 64×64 skins, live 3D preview, Real Madrid and Barcelona 25/26 kits with the researched designs |
| Extras | Cameras (place, view, photo mode), lasers, paint bucket, waypoint compass, time control |
| Tests | **179 passing** across 19 files; typecheck clean; production build clean |

---

## Quick start

```bash
npm install
npm run build
npm run lan      # launcher + one-click join relay
```

(`npm start` also works but join codes have to be copied by hand.)

The launcher prints an address like `http://192.168.1.42:8080` and a QR code.

- **On the laptop running the launcher:** open that address, press **Play** —
  or to share the world, press **Join a World → Host a new world**.
- **On the other laptops:** open the same address, press **Join a World** and
  press **Join with code** with the box left empty. The game connects straight
  from laptop to laptop — no code copying.

Without the relay (`npm start`, or the Vite dev server) the same flow works
with manual codes: the host shares the code on screen, the guest pastes it and
sends back the answer code, and the host presses **Accept answer**.

If another laptop cannot connect, the launcher prints the specific thing to fix
(firewall, a router that blocks device-to-device traffic, or a sleeping laptop).

### Development

```bash
npm run dev        # Vite dev server on http://localhost:5173
npm run typecheck  # TypeScript, no emit
npm test           # unit tests
```

### Useful URL flags

| Flag | Effect |
|---|---|
| `?mode=creative` | Start in creative (or survival, adventure, spectator, hardcore, sandbox) |
| `?y=120` | Start at a given height |
| `?debug=1` | Print chunk geometry diagnostics to the console |
| `?basic=1` | Draw the terrain with a flat colour, to separate geometry problems from shading problems |

---

## Playing

| Key | Action |
|---|---|
| `W A S D` | Move |
| Mouse | Look |
| `Space` | Jump / swim up |
| `Shift` | Sneak (and stop falling off ledges) |
| `Ctrl` | Sprint |
| Left click | Mine the block you are looking at (hold) |
| Right click | Place the block you are holding |
| `1`–`9` | Select a hotbar slot |
| `E` | Inventory |
| `F` | Use the held item (eat, place) |
| `F3` | Performance readout |
| `F5` | Cycle first-person → third-person → orbit camera |
| `P` | Photo mode |
| `Esc` | Pause menu |

---

## How it is built

```
cubicraft/
├── src/
│   ├── core/         fixed-timestep loop, input, settings, deterministic RNG
│   ├── engine/
│   │   ├── voxel/    chunk storage, palettes, DDA raycasting, block shapes
│   │   ├── world/    chunk streaming, block edits
│   │   └── physics/  swept AABB collision, the player controller
│   ├── workers/      generation worker + meshing/lighting worker
│   ├── worldgen/     noise, climate, biomes, terrain, caves, ores, decoration
│   ├── content/      the data-driven block/item/mob/biome registries
│   ├── game/         modes, inventory, crafting, survival, mobs, day/night
│   ├── render/       atlas, terrain shader, sky, chunk renderer, mob renderer
│   ├── ui/           HUD, menus, avatar picker
│   ├── net/          WebRTC data channel, wire protocol, persistence
│   └── assets/       club kits, procedural skins, icons
├── tools/
│   ├── launcher.mjs  the LAN launcher (static files + optional pairing relay)
│   ├── make-cert.sh  local HTTPS certificate for the LAN
│   └── fetch-crests.mjs  optional club crest downloader
└── tests/            unit tests for the engine, crafting and the protocol
```

### The parts that matter

**Voxel engine.** Chunks are 16 × 16 × 384 columns split into 16³ sections. Each
section stores a palette of block ids so a chunk costs memory proportional to what
is actually in it. Terrain is generated in a worker and meshed in a second worker,
so neither ever blocks the frame.

**Lighting.** Sky light falls straight down without weakening and loses one level
per horizontal step, exactly like Minecraft. Block light floods out from torches,
lanterns and lava. Ambient occlusion is baked per vertex with the classic
three-neighbour test. Time of day is a single shader uniform, so the sun can move
without re-meshing a single block.

**Meshing.** Greedy meshing merges coplanar faces — but only when the block id,
the light level and the ambient occlusion along the shared edge all agree, so the
corners of the world stay correctly shaded. Textures live in a 2D texture array,
which is what lets a merged quad tile its UVs without bleeding.

**Multiplayer.** Two browsers talk directly over a WebRTC data channel. There is no
game server: the host player's browser owns the world and the save file, and the
guests send their actions to it. The wire format is binary — a chunk is roughly
1–6 KB instead of the 131 KB the same data costs as JSON, and editing one block
only re-encodes one section of one chunk.

**Content.** Everything is data, not code. Around 600 of the 1,286 blocks come from
about a dozen generator functions, so adding a new colour or a new wood type is a
one-line change rather than a rewrite. A validation pass at boot checks that every
drop, recipe and spawn rule points at something that exists.

---

## Adding to the game

- **A new block** — add it to `src/content/blocks/`. Most blocks should use one of
  the family generators (`woodFamily`, `colorFamily`, `shapeFamily`, `oreFamily`, …).
- **A new recipe** — add it to `src/content/crafting/`. Shaped patterns are
  whitespace-separated ingredient ids, and `#tag` matches a tag.
- **A new mob** — add it to `src/content/mobs/`. Pick one of the AI archetypes
  (`wander`, `chase`, `flee`, `flyer`, `swimmer`, `ranged`, `neutral`, `boss`, …).
- **A new texture** — add its name to `src/content/textures.ts`; the atlas
  generates a tile for it automatically.

---

## Notes for parents

- **Keep the host laptop awake.** The host's browser owns the world. Close the tab
  and the session ends. On a Mac: `caffeinate -i -m -s` keeps it running.
- **Allow Node through the firewall** the first time the launcher runs, or the
  other laptops cannot connect.
- **Some routers isolate wireless clients** from each other. If the kids cannot
  connect, that is usually the cause — two laptops on the same Wi-Fi can still
  play by running the world on one machine and opening two tabs.
- **Club crests** are trademarks. The game ships with original crest-style
  artwork; `tools/fetch-crests.mjs` can download freely-licensed crests for
  private family use, with attribution recorded alongside them.
