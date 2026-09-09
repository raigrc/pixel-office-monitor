# 3D View Mode — Implementation Plan

> **Source repo studied:** https://github.com/Station-Sciences/bot-crossing  
> **Integration strategy:** Add 3D as a toggleable 3rd view mode inside `SceneViewport`. The existing 2D pixel-art renderer is untouched. Both views consume the same `PresentationController` state.  
> **Created:** 2026-09-09  
> **Status:** Planning — no files changed yet

---

## 0 — Foundations (1–2 days)

**Goal:** Three.js boots cleanly in Next.js 16 without touching the 2D renderer.

### 0.1 Dependencies
- Install: `three`, `@types/three`, `three/addons/postprocessing/EffectComposer`, `RenderPass`, `UnrealBloomPass`, `OutputPass`, `SMAAPass`, `BufferGeometryUtils`
- Dynamic-import the 3D module so the 2D view pays zero bundle cost.

### 0.2 Three.js module skeleton
- New file: `src/lib/scene/three-engine.ts`
  - Wraps `THREE.WebGLRenderer`, `THREE.PerspectiveCamera`, `THREE.Scene`
  - Own `requestAnimationFrame` loop, `mount(container)`, `unmount()`, `resize()`, `setViewMode('2d'|'3d')`
  - `renderer.setAnimationLoop` only while mounted; tears down on unmount to avoid background GPU cost.

### 0.3 Viewport toggle
- Edit `src/components/scene/SceneViewport.tsx`:
  - Add `viewMode` state: `'2d' | '3d'`, default `'2d'`
  - Floating toggle button (top-right of viewport, small, semi-transparent)
  - `viewMode === '3d'` → render Three.js canvas, hide 2D DOM children
  - `viewMode === '2d'` → destroy Three.js context, show DOM children
- No changes to `OfficeScene.tsx` or any other component.

### 0.4 Verify gate
- `npm run build` passes
- `/` renders in 2D, toggle flips to blank canvas, flip back restores 2D
- `npm test` still green

---

## 1 — Scene Shell (2–3 days)

**Goal:** Reproduce bot-crossing's rendering architecture inside your module.

### 1.1 Post-processing chain
- In `three-engine.ts`, build composer lazily (bot-crossing `Engine._ensureComposer` pattern):
  - `RenderPass` → `UnrealBloomPass` (threshold 0.92, strength 0.6) → `OutputPass` → `SMAAPass`
  - Dispose whole composer when bloom/antialias is off — load-bearing for memory on weak machines.
- Render scale: size drawing buffer directly (`renderer.setSize(w * scale, h * scale, false)`), not `setPixelRatio`.

### 1.2 Adaptive quality governor
- Port bot-crossing `_governQuality`:
  - Sample FPS every 1s
  - 3 consecutive slow frames → drop scale by `0.15 * dpr`
  - 8 consecutive fast frames → climb by `0.1 * dpr`, 30s cooldown before climbing
  - Floor: `0.35 * dpr` (not absolute 0.5 CSS pixels)
- Hook into existing settings store (localStorage-backed, same pattern).

### 1.3 Camera rig (Google Earth model)
- New file: `src/lib/scene/three-camera.ts`
  - Spherical: `azimuth`, `polar`, `distance`, `target`
  - Left-drag grabs ground: raycast to y=0 at pointerdown, pin world point
  - Right/ctrl/shift-drag tilts and rotates
  - Scroll zooms at cursor, holding the ground point under the pointer
  - Pinch-zoom on touch
  - Idle: after 2.2s no input, ease azimuth to nearest 45°, polar to 56° (isometric rest)
  - `focus(point, distance)` for fly-to-agent

### 1.4 Day/night sky environment
- New file: `src/lib/scene/three-sky.ts`
  - Procedural sky dome shader = visible sky + `scene.environment` via `PMREMGenerator`
  - Three presets: Luna (grey/neutral), Mars (rust/warm), Terra (blue/green)
  - Time-of-day drives sun along tilted arc (noon at 54° elevation, not overhead — load-bearing for PBR)
  - Live mode: follow system clock
  - Regenerate PMREM only when sky changes, throttle ≤ 3 Hz

### 1.5 Lighting
- One directional light (sun), position from sky time
- One ambient light, intensity from sky
- Shadow map tracks camera (not fixed bounds) — roughly doubles effective resolution

### 1.6 Verify gate
- Blank → grey gradient sky → sun arc → bloom on bright pixels → adaptive quality under load
- Camera pans, tilts, zooms, eases to isometric on idle

---

## 2 — Hex Colony Layout (2 days)

**Goal:** Sticky hex-zone system, adapted to your floor metaphor.

### 2.1 Hex grid module
- New file: `src/lib/scene/hex-grid.ts`
  - Flat-top axial (`q`, `r`), `hexToWorld`, `worldToHex` (exact axial, not nearest-centre)
  - `hexDistance`, `hexRing`, `HEX_DIRS`
  - `allocateCells(projects, previous)` — port bot-crossing `plots.js:201-304` exactly:
    - Previous layout is input; unchanged zone keeps same cells
    - Grows outward from root, shrinks from newest cells
    - New repos take innermost free cells
    - `growBlob` hugs root first, then middle
    - Disconnected layout → restart from scratch

### 2.2 Plot/deck geometry
- New file: `src/lib/scene/plot-geometry.ts`
  - Hexagonal prism (deck slab), top at `DECK_TOP = 0.45` (clears worst terrain)
  - Kerb bar (dashed runway-edge texture)
  - Canvas-generated textures: plated metal floor + Sobel normal map
  - Per-plot accent tint via `material.color.multiply`
  - Urgent plots: pulsing emissive rim

### 2.3 Ground terrain
- New file: `src/lib/scene/terrain.ts`
  - Displaced plane, vertex colors, mulberry32 noise at build time
  - Three planet presets with different ramps and relief amplitudes
  - Static after build

### 2.4 Ground scatter
- New file: `src/lib/scene/scatter.ts`
  - Instanced mesh of boulders/props
  - Placed to miss every plot tile and ship apron
  - Rebuilt when zone footprint changes (cheap — no terrain rebuild)

### 2.5 Verify gate
- Three hex plots with raised decks and accent kerbs appear
- Adding a floor claims more cells outward from root
- Removing a floor returns cells; map stable across restarts

---

## 3 — Building Kit + Shaders (2–3 days)

**Goal:** Per-floor buildings that rise from the ground, tinted to accent.

### 3.1 Building composition
- New file: `src/lib/scene/buildings.ts`
  - Port bot-crossing `Composer`: parts list → `mergeGeometries` → single draw call
  - 10 recipes (habitat, solar, antenna, silo, workshop, greenhouse, etc.)
  - Seeded from `hashString(floorId)` — same floor always gets same building
  - Scale against character height (~1.1 units → building scale ~1.45)

### 3.2 Building shader
- New file: `src/lib/scene/building-shader.ts`
  - Vertex: `uProgress` sinks building into ground; fragment discards below deck
  - Per-vertex `aEmissive` for lit windows after dark
  - Per-instance accent tint via `instanceColor` × neutral-grey palette
  - Roughness/metalness per-vertex attribute (painted metal vs glass)
  - Rotor spin in vertex shader — one uniform write turns all colony rotors

### 3.3 Construction progress
- New buildings: `progress 0 → 1.0` over ~3s via `THREE.MathUtils.damp`
- Live working floors creep at `0.004/sec`
- Retiring buildings wind back down, disposed at `progress ≤ 0.02`

### 3.4 Verify gate
- Six floors → six distinct-silhouette buildings
- New floor → building rises from ground over 3s
- Buildings tinted to floor accent; windows glow at night

---

## 4 — Instanced Astronaut Crew (2–3 days)

**Goal:** One draw call for all astronauts, GPU-skinned, per-instance variation.

### 4.1 Crew rig bake
- New file: `src/lib/scene/crew-rig.ts`
  - Port bot-crossing `crew.js` bake:
    - Load mannequin GLB (KayKit CC0 or procedural fallback)
    - Merge body parts, drop head mesh
    - Sample clips at 30fps → skinning matrices into `DataTexture` (float)
    - Bake head/chest/hand world transforms into CPU side-table
  - Clips: idle, walk, run, work/hammer, wave, cheer, sit-down, sit-idle, stand-up, hit, spawn, interact
  - **Procedural fallback:** generate capsule-limb rig with 21 bones, animate via baked keyframe curves

### 4.2 Instanced astronaut mesh
- New file: `src/lib/scene/astronauts.ts`
  - One `InstancedMesh` for body (GPU-skinned via vertex-shader texture lookup)
  - Separate `InstancedMesh` per worn part: helmet, visor, backpack, antenna, lamp, hammer
  - Per-instance: `instanceColor` (suit tint), `aFrame` (anim frame), `aFace` (visor expression)
  - Face atlas: 4×4 canvas of 16 expressions, tinted per-astronaut at draw time

### 4.3 State machine
- Precedence (first match wins):
  - `spawning` → walk down ramp
  - `at-site` + `working` → circle building, hammer, sparks
  - `at-site` + `waiting` → stand still, `?` badge
  - `at-site` + `blocked` → slump, red eyes, `!` badge
  - `at-site` + `celebrating` → jump, confetti, `✓` badge
  - `at-site` + `idle` → potter around plot
  - `at-site` + `sleeping` → sit, `z` particles
  - `leaving` → walk to ship, board
- Locomotion from actual ground distance (not intended velocity) — prevents moonwalking into walls

### 4.4 Verify gate
- 16 agents on one floor = 16 instances, 7 draw calls total
- Each agent walks ship → plot, stands at building, correct pose per state
- Agent-agent separation (1.15u), collision slide, A* routing

---

## 5 — A* Navigation + Crowd Spacing (1–2 days)

**Goal:** Route around buildings and each other, no wall-walking.

### 5.1 Navigation grid
- New file: `src/lib/scene/navigation.ts`
  - Port bot-crossing `Navigation`:
    - 0.5m cells, 112×112 grid (±56m half-extent)
    - Rasterise obstacles: buildings (footprint × 0.8 + agent radius), scatter, ship
    - A* with generation-stamped scratch arrays (no allocation per search)
    - String-pull: straight lines between waypoints, re-route only when blocked
    - `nearestFree(x, z)` — expanding rings

### 5.2 Crowd collision
- Separation force when agents overlap, push along overlap axis
- Arrival radius = `SEPARATION + 0.45 = 1.6` (larger than spacing so agents never stuck shoulder-to-shoulder)
- Blocked-head-on: slide along obstacle normal, don't stop dead
- Last resort: blocked for 6s → adopt ground reached

### 5.3 Work sites
- Standing spot clear of building blocked radius, checked against nav grid
- Spots inside walls are unreachable — astronaut sent there walks at wall forever without this check

### 5.4 Verify gate
- 8 agents around one plot: all reach sites, no penetration, no building crossing
- Wall built between agent and site → routes around
- Target: 288 path legs, 0 crossings, 0 penetrations across 78k frames

---

## 6 — Indicators, Badges, Labels, Particles (1–2 days)

### 6.1 Badges
- New file: `src/lib/scene/indicators.ts`
  - `InstancedMesh` of flat quads (MAX_AGENT_CAP = 320)
  - SDF glyphs on canvas atlas (128×256 per glyph)
  - States: `!` (blocked), `⚒` (working), `?` (waiting), `✓` (celebrating), spawn, leave, none
  - Idle + sleeping get no badge — only states that want something from you

### 6.2 Name plates
- Billboarded in vertex shader
- Hit-tested in screen space (plate anchor in view space, span in NDC)
- Fade in for active plots + hovered plot only
- Canvas-rendered at 4× for retina sharpness

### 6.3 Particles
- New file: `src/lib/scene/particles.ts`
  - Flat typed arrays, swap-removed on death — zero allocation during play
  - Sparks (hammer downbeat, `#9fe8c0`), confetti (celebrate hop, `#ffc86a`), `z` bubbles (sleeping), boot dust (footfall), ship ping

### 6.4 Verify gate
- Badges over working/waiting agents, absent over idle/sleeping
- Name plates fade in on hover for quiet plots
- Particles emit on correct triggers, no GC spikes

---

## 7 — Ship + Polish (1 day)

### 7.1 Ship geometry
- New file: `src/lib/scene/ship.ts`
  - Procedural open shells: bowl, engine bell, airlock collar
  - Double-sided `BackSide` shadow side (open shells cannot shadow-map single-sided)
  - Ramp: walkable incline from ship door to ground

### 7.2 Spawning / leaving
- New agents walk down ramp (`spawning`)
- Archived agents walk back up (`leaving`), then board
- Entrance cap: max 6 per reconcile; rest placed on plots directly (prevents ramp pile-up on reload)

### 7.3 Verify gate
- New floor → astronaut walks ship → plot over ~6s
- Archive floor → astronaut walks back to ship and vanishes
- Reload 20 agents → 6 walk out, 14 appear on plots

---

## 8 — Integration + Settings (1–2 days)

### 8.1 View mode toggle
- `SceneViewport` renders either:
  - 2D: existing DOM tree (`OfficeScene`, `CharacterSprite`, etc.)
  - 3D: Three.js canvas + overlay HTML for sidebar card (positioned by `screenOf()` projection)
- Crossfade 300ms between modes

### 8.2 Settings panel
- Extend existing localStorage-backed settings with 3D controls:
  - Render scale (0.35–2.0, default 1.0)
  - Bloom on/off + strength
  - Antialias (SMAA) on/off
  - Auto quality on/off
  - Shadow quality (off/low/med/high → shadow map size)
  - Planet preset (Luna/Mars/Terra)
  - Time of day (slider + Live mode)
  - Show labels on/off
  - Show FPS counter
  - Max agents slider
  - Tilt shift on/off + strength/angle

### 8.3 Quality presets
- Potato: scale 0.35, no bloom, no shadows, no AA, scatter off
- Low: scale 0.5, no bloom, low shadows, no AA
- Medium: scale 0.75, bloom off, med shadows, SMAA
- High: scale 1.0, bloom on, high shadows, SMAA, tilt-shift off
- Ultra: scale 1.5, bloom on, high shadows, SMAA, tilt-shift on, full particles

### 8.4 Browser compat
- WebKit (Safari): `preserveDrawingBuffer: true`
- Detect WebGL2; fall back to 2D with warning
- DPR change listener (retina ↔ non-retina drag between displays)

### 8.5 Memory management
- Dispose all geometries, materials, textures, render targets on unmount
- Composer render targets disposed when post chain off
- Terrain + scatter rebuilt on planet change; old geometry disposed first

---

## 9 — Assets Pipeline (parallel with Phases 3–5)

### Option A: KayKit CC0 packs (recommended)
- Download Kay Lousberg free tiers:
  - `KayKit : Space Base Bits` — buildings, pads, rovers, crates
  - `KayKit : Character Animations` — mannequin + 161 clips
  - `KayKit : Forest Nature Pack` — boulders, trees, bushes
- Port `tools/build-assets.mjs` to `scripts/build-3d-assets.mjs`
- Built GLBs → `public/assets/3d/`, raw packs gitignored
- License: CC0, credit Kay Lousberg

### Option B: Procedural fallback
- Buildings: `BoxGeometry`, `SphereGeometry`, `CylinderGeometry` via `Composer`
- Mannequin: capsule+sphere rig, 21 bones, baked keyframe curves
- Scatter: icosahedron boulders, cone+cylinder trees

---

## 10 — Tests + Verification (1 day)

### 10.1 Unit tests
- `src/lib/scene/__tests__/hex-grid.test.ts` — hex math, allocation stability, grow/shrink round-trip
- `src/lib/scene/__tests__/navigation.test.ts` — A* routing, collision, nearestFree
- `src/lib/scene/__tests__/buildings.test.ts` — Composer output count, merge correctness
- `src/lib/scene/__tests__/astronauts.test.ts` — separation, work site placement, state precedence

### 10.2 Integration tests
- Mount `SceneViewport`, toggle viewMode, assert canvas appears/disappears
- Feed fake SSE events, assert 3D astronauts reach correct positions
- Resize observer triggers `renderer.setSize` correctly

### 10.3 Performance tests
- 64 agents: ≤ 120 draw calls, ≤ 5ms frame at 1080p
- 320 agents (MAX_AGENT_CAP): ≤ 10 draw calls for crew, ≤ 50 total
- Adaptive quality drops under load, climbs after cooldown
- No allocation in frame loop

### 10.4 Verify gate
- `npm test` green (existing 140 + ~30 new)
- `npm run build` clean
- `npx tsc --noEmit` clean
- Toggle 2D↔3D, both views show same data, no layout shift

---

## What This Plan Does NOT Do

- Does **not** touch the 2D renderer (`OfficeScene.tsx`, `CharacterSprite.tsx`, `CubicleCard.tsx` untouched)
- Does **not** change the store or API (`monitor-store.ts`, `/api/ingest`, SSE unchanged)
- Does **not** change the plugin (`pixel-monitor.js` continues posting to `/api/ingest`)
- Does **not** require Supabase

---

## File Inventory

### New files (15)

| File | Purpose |
|---|---|
| `src/lib/scene/three-engine.ts` | Renderer, composer, adaptive quality, frame loop |
| `src/lib/scene/three-camera.ts` | Google Earth camera rig |
| `src/lib/scene/three-sky.ts` | Procedural sky + PMREM environment |
| `src/lib/scene/hex-grid.ts` | Axial hex math + sticky allocation |
| `src/lib/scene/plot-geometry.ts` | Deck slab + kerb generation |
| `src/lib/scene/terrain.ts` | Displaced terrain mesh |
| `src/lib/scene/scatter.ts` | Instanced ground clutter |
| `src/lib/scene/buildings.ts` | Composer + 10 building recipes |
| `src/lib/scene/building-shader.ts` | Vertex sink + fragment discard + accent tint |
| `src/lib/scene/crew-rig.ts` | GLB bake → bone-matrix texture |
| `src/lib/scene/astronauts.ts` | Instanced crew + worn parts |
| `src/lib/scene/navigation.ts` | A* grid + collision |
| `src/lib/scene/indicators.ts` | Badge instanced mesh |
| `src/lib/scene/particles.ts` | Spark/confetti/dust particles |
| `src/lib/scene/ship.ts` | Landing pad + ramp |
| `src/lib/scene/__tests__/hex-grid.test.ts` | Hex math tests |
| `src/lib/scene/__tests__/navigation.test.ts` | Nav tests |
| `src/lib/scene/__tests__/buildings.test.ts` | Building tests |
| `src/lib/scene/__tests__/astronauts.test.ts` | Astronaut tests |
| `scripts/build-3d-assets.mjs` | GLB packer (port of bot-crossing tools) |

### Modified files (3)

| File | Change |
|---|---|
| `src/components/scene/SceneViewport.tsx` | viewMode toggle, Three.js mount/unmount |
| `src/lib/scene/index.ts` | Re-export new modules |
| `package.json` | Add `three`, `@types/three` |
| `src/app/globals.css` | `.bot-crossing-canvas` styles |

---

## Effort Estimate

| Phase | Days | Cumulative |
|---|---|---|
| 0 — Foundations | 1–2 | 2 |
| 1 — Scene shell | 2–3 | 5 |
| 2 — Hex layout | 2 | 7 |
| 3 — Buildings | 2–3 | 10 |
| 4 — Astronaut crew | 2–3 | 13 |
| 5 — Navigation | 1–2 | 15 |
| 6 — Indicators + particles | 1–2 | 17 |
| 7 — Ship + polish | 1 | 18 |
| 8 — Integration + settings | 1–2 | 20 |
| 9 — Assets (parallel) | — | 20 |
| 10 — Tests | 1 | 21 |

**~20 working days** for one engineer. Assets pipeline runs in parallel. The 2D view stays fully functional at every gate.
