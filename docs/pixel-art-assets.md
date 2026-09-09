# Pixel Art Assets — R6–R10 (2026-09-05)

> Complete inventory, palette reference, and procedures for the pixel art PNG assets. Verified against code 2026-09-05.

## Asset Inventory

43 PNGs total — 5 background tiles, 2 cubicle frames, 23 desk props, 15 monitor screens.

### Background Tiles (`public/sprites/`)

| File | Size | Description |
|---|---|---|
| `floor-tile.png` | 32×32 | Office carpet — `#0F172A` base, `#334155` border lines, `#1E293B` / `#24324D` dot texture at 8px intervals, `#64748B` corner accents |
| `wall-tile.png` | 32×32 | Wall segment — `#1E293B` body, `#334155` top edge, `#0B1220` baseboard, `#64748B` lip, vertical `#24324D` lines every 8px |
| `door-tile.png` | 32×32 | Door — `#0F172A` floor underneath, `#64748B` frame, `#334155` panel, `#E2E8F0` handle, `#94A3B8` hinges |

### Cubicle Frames (`public/sprites/`)

| File | Size | Description |
|---|---|---|
| `cubicle-idle.png` | 64×64 | Top-down cubicle — `#64748B` partition walls (4px left/right), `#1E293B` desk surface (52×16), `#0F172A` monitor back with `#1E293B` dim screen, `#24324D` chair, `#64748B` wheels |
| `cubicle-working.png` | 64×64 | Same as idle but monitor screen glows `#22C55E`, green glow pixels blend into adjacent walls, `#15803D` screen highlight |

### Desk Props (`public/sprites/props/`)

| File | Size | Colors Used | Agent(s) |
|---|---|---|---|
| `server-rack.png` | 24×16 | `#334155`, `#1E293B`, `#24324D`, `#22C55E`, `#15803D`, `#64748B` | ai-systems, devops |
| `neural-orb.png` | 8×8 | `#22C55E`, `#E5E7EB`, `#15803D` | ai-systems |
| `blueprint-scroll.png` | 16×20 | `#60A5FA`, `#3B82F6`, `#1D4ED8` | architect, plan |
| `t-square.png` | 16×4 | `#E2E8F0`, `#94A3B8`, `#334155` | architect |
| `wrench.png` | 4×16 | `#E2E8F0`, `#94A3B8`, `#1E293B` | automation-engineer |
| `cable-coil.png` | 8×8 | `#64748B`, `#334155`, `#1E293B`, `#22C55E`, `#3B82F6` | automation-engineer |
| `headset.png` | 12×8 | `#111827`, `#64748B`, `#E2E8F0` | devops |
| `paper-stack.png` | 12×12 | `#FEF3C7`, `#E5E7EB`, `#94A3B8` | documentation |
| `pen.png` | 2×12 | `#334155`, `#3B82F6`, `#E2E8F0` | documentation |
| `clipboard.png` | 8×12 | `#FDE68A`, `#FEF3C7`, `#E2E8F0`, `#94A3B8` | project-manager |
| `coffee-mug.png` | 6×8 | `#92400E`, `#78350F`, `(60,30,10)`, `#E5E7EB` | project-manager, general, intern |
| `magnifier.png` | 8×8 | `#E2E8F0`, `#7DD3FC`, `#E5E7EB`, `#92400E` | qa-engineer |
| `stamp.png` | 6×8 | `#EF4444`, `#E2E8F0`, `#E5E7EB` | qa-engineer |
| `book-stack.png` | 12×12 | `#8B5CF6`, `#3B82F6`, `#15803D`, `#3B82F6`, `#E5E7EB` | researcher, scout |
| `globe.png` | 8×8 | `#3B82F6`, `#60A5FA`, `#22C55E`, `#E2E8F0` | researcher |
| `padlock.png` | 6×8 | `#E2E8F0`, `#1E293B`, `#FACC15`, `#FDE68A`, `#0F172A` | security-reviewer |
| `camera.png` | 8×6 | `#334155`, `#1E293B`, `#111827`, `#3B82F6`, `#FDE68A`, `#64748B` | security-reviewer |
| `laptop.png` | 12×6 | `#374151`, `#1F2937`, `#1E293B`, `#22C55E`, `#64748B` | senior-engineer |
| `hard-hat.png` | 10×6 | `#F59E0B`, `#D97706`, `#FDE68A` | build |
| `toolbox.png` | 10×8 | `#EF4444`, `#EF4444`, `#E2E8F0`, `#1E293B` | build |
| `compass.png` | 8×8 | `#E2E8F0`, `#FEF3C7`, `#EF4444`, `#334155`, `#3B82F6` | plan |
| `binoculars.png` | 10×6 | `#111827`, `#64748B`, `#7DD3FC`, `#E5E7EB` | explore |
| `map.png` | 12×8 | `#FEF3C7`, `#94A3B8`, `#EF4444`, `#F97316`, `#22C55E` | explore, scout |

### Monitor Screens (`public/sprites/monitors/`)

All 16×8 pixels. Each has a `#334155` border frame, `#1E293B` screen area, then agent-specific content:

| File | Content | Key Colors |
|---|---|---|
| `ai-systems.png` | Neural network nodes (5) + connection lines | `#22C55E`, `#15803D` |
| `architect.png` | Blueprint schematic with grid lines | `#1D4ED8`, `#60A5FA`, `#3B82F6` |
| `automation-engineer.png` | 3 workflow nodes with arrows | `#F97316`, `#3B82F6`, `#22C55E`, `#94A3B8` |
| `devops.png` | Terminal lines + blinking LEDs | `#22C55E`, `#94A3B8`, `#15803D` |
| `documentation.png` | Document with text lines | `#FEF3C7`, `#94A3B8` |
| `project-manager.png` | Checklist (2 checked, 2 unchecked) | `#22C55E`, `#334155`, `#94A3B8` |
| `qa-engineer.png` | Test results grid (mostly green, 1 red) | `#22C55E`, `#EF4444` |
| `researcher.png` | Search results list | `#94A3B8`, `#3B82F6` |
| `security-reviewer.png` | Shield icon + status dots | `#3B82F6`, `#60A5FA`, `#22C55E`, `#94A3B8` |
| `senior-engineer.png` | Code editor with syntax coloring | `#3B82F6`, `#22C55E`, `#8B5CF6` |
| `build.png` | Build progress bar (80% full) | `#22C55E`, `#334155`, `#FACC15` |
| `plan.png` | Plan outline with boxes | `#1D4ED8`, `#60A5FA` |
| `general.png` | Terminal with LEDs (same as devops) | `#22C55E`, `#94A3B8` |
| `explore.png` | Directory tree structure | `#94A3B8`, `#22C55E`, `#3B82F6`, `#8B5CF6` |
| `scout.png` | External docs page | `#FEF3C7`, `#334155`, `#94A3B8` |

---

## Palette Reference

All colors match `Sprite.tsx:32 CHAR_TO_HEX` and `scripts/generate-assets.py:11-53`.

| Name | Hex | RGB | Usage |
|---|---|---|---|
| `bg` | `#0F172A` | (15, 23, 42) | Background, floor base, monitor back |
| `surface` | `#1E293B` | (30, 41, 59) | Desk surface, screen area, raised bg |
| `raised` | `#24324D` | (36, 50, 77) | Carpet texture dots, rack units, chair back |
| `border` | `#334155` | (51, 65, 85) | Cubicle walls, desk edge, monitor frame, door panel |
| `text` | `#F1F5F9` | (241, 245, 249) | Primary text (hi-contrast) |
| `muted` | `#94A3B8` | (148, 163, 184) | Secondary text, terminal lines, map lines |
| `dim` | `#64748B` | (100, 116, 139) | Desk rail, baseboard, partition top, chair wheels |
| `working` | `#22C55E` | (34, 197, 94) | Active/working state, LED indicators, glow |
| `working_d` | `#15803D` | (21, 128, 61) | Working shadow/darker variant |
| `typing` | `#3B82F6` | (59, 130, 246) | Code, typing state, cable ends, lens glow |
| `accent` | `#F97316` | (249, 115, 22) | Workflow nodes, map routes |
| `error` | `#EF4444` | (239, 68, 68) | Error, stamp, compass N/red needle |
| `white` | `#E5E7EB` | (229, 231, 235) | Lab coat, highlights, book spines, pen cap |
| `white_s` | `#CBD5E1` | (203, 213, 225) | Coat shadow |
| `skin` | `#F5D0A9` | (245, 208, 169) | Skin tone |
| `hair_dark` | `#1A1F2E` | (26, 31, 46) | Dark hair |
| `hair_brown` | `#4B2E14` | (75, 46, 20) | Brown hair |
| `hair_blond` | `#FBBF24` | (251, 191, 36) | Blond hair |
| `yellow` | `#FDE68A` | (253, 230, 138) | Clipboard, coffee mug, hard hat highlight |
| `yellow_d` | `#FACC15` | (250, 204, 21) | Padlock body |
| `red` | `#EF4444` | (239, 68, 68) | Tie, red book, stamp |
| `blue` | `#3B82F6` | (59, 130, 246) | Shield, blue book, globe |
| `blue_l` | `#60A5FA` | (96, 165, 250) | Blueprint scroll, shield highlight, ocean |
| `blue_d` | `#1D4ED8` | (29, 78, 216) | Blueprint lines, plan boxes |
| `green` | `#22C55E` | (34, 197, 94) | Neural orb, continents, cursor |
| `green_d` | `#15803D` | (21, 128, 61) | Green book, LED dark |
| `purple` | `#8B5CF6` | (139, 92, 246) | Purple book |
| `purple_d` | `#5B21B6` | (91, 33, 182) | Purple dark |
| `cyan` | `#7DD3FC` | (125, 211, 252) | Globe, magnifier lens, binocular lenses |
| `metal` | `#E2E8F0` | (226, 232, 240) | Wrench, T-square, padlock shackle, compass body |
| `metal_d` | `#94A3B8` | (148, 163, 184) | Metal shadow |
| `wood` | `#92400E` | (146, 64, 14) | Coffee mug body, magnifier handle |
| `wood_d` | `#78350F` | (120, 53, 15) | Coffee mug inner |
| `paper` | `#FEF3C7` | (254, 243, 199) | Paper, doc page, compass face, map |
| `black` | `#0F172A` | (15, 23, 42) | Monitor back, padlock keyhole |
| `headset` | `#111827` | (17, 24, 39) | Headset, camera, binoculars |
| `laptop` | `#374151` | (55, 65, 81) | Laptop screen |
| `laptop_d` | `#1F2937` | (31, 41, 55) | Laptop base |
| `hat_yellow` | `#F59E0B` | (245, 158, 11) | Hard hat dome |
| `hat_d` | `#D97706` | (217, 119, 6) | Hard hat brim |
| `trans` | `None` | transparent | Transparent pixel |

---

## How to Regenerate

### Prerequisites

```powershell
pip install Pillow
```

### Run

```powershell
cd C:\Users\DELL\Desktop\Rai\pixel-office-monitor
python scripts/generate-assets.py
```

### Output

```
public/sprites/floor-tile.png          32×32
public/sprites/wall-tile.png           32×32
public/sprites/door-tile.png           32×32
public/sprites/cubicle-idle.png        64×64
public/sprites/cubicle-working.png     64×64
public/sprites/props/*.png             23 files
public/sprites/monitors/*.png          15 files
```

The script overwrites existing files. No external images required — all art is procedural.

---

## How to Add a New Agent Prop

1. **Create the PNG** — add a drawing function in `scripts/generate-assets.py` using `px()` and `rect()` helpers, then call it from `gen_props()`. Keep dimensions ≤24px.

2. **Register the prop** — add an entry to `AGENT_PROPS` in `src/lib/agent-props.ts`:

```typescript
"my-new-agent": {
  items: [
    { src: "/sprites/props/my-prop.png", x: "10%", y: "25%", w: 16, h: 16, alt: "my prop description" },
  ],
},
```

3. **Regenerate** — run `python scripts/generate-assets.py` to create the PNG.

4. **Verify** — `npm run build` should pass. The `DeskProps` component picks up new props automatically via `getAgentProps(agentId)`.

---

## Naming Conventions

| Category | Pattern | Example |
|---|---|---|
| Background tiles | `{type}-tile.png` | `floor-tile.png`, `wall-tile.png`, `door-tile.png` |
| Cubicle frames | `cubicle-{state}.png` | `cubicle-idle.png`, `cubicle-working.png` |
| Desk props | `{object-name}.png` (kebab-case) | `server-rack.png`, `neural-orb.png`, `coffee-mug.png` |
| Monitor screens | `{agent-id}.png` (matches `agents.ts` keys) | `ai-systems.png`, `senior-engineer.png` |

---

## Technical Specs

### Rendering

All PNGs use `image-rendering: pixelated` (with `crisp-edges` fallback for Firefox). Applied via:

- **CSS class:** `.pixel-img` in `globals.css:52-57` — used on `<img>` elements
- **Inline style:** `style={{ imageRendering: "pixelated" }}` — used on background images and `<img>` elements
- **CSS utility:** `.pixelated` — legacy class, still present

### Why Plain `<img>` Not `next/image`

- Pixel art PNGs are tiny (largest: `cubicle-*.png` at 64×64, ~1KB)
- `next/image` adds optimization overhead unnecessary for sub-1KB assets
- `image-rendering: pixelated` may conflict with `next/image`'s resize/sharpen pipeline
- Static import of PNGs at these sizes provides no build-time benefit
- `public/sprites/` is served as static files — no CDN optimization needed at local dev scale

### Animation Classes (globals.css)

| Class | Keyframe | Duration | Applied To |
|---|---|---|---|
| `animate-monitor-glow` | `monitor-glow` (green box-shadow pulse) | 2s infinite | `MonitorScreen` when working |
| `animate-prop-float` | `prop-float` (translateY -2px) | 1.5s infinite | `DeskProps` children when working |
| `animate-working` | `pulse-live` (opacity + glow) | 1.6s infinite | Header LIVE dot, cubicle status dot |
| `animate-floatZ` | `floatZ` (translateY -6px) | 1.8s infinite | Sprite Zzz text |

### Reduced Motion

All animation classes are frozen under `prefers-reduced-motion: reduce` (`globals.css:142-161`). `CubicleCard` also checks `matchMedia` at mount time to skip entrance animations.

### Component Integration

```
page.tsx
  └─ OfficeBackground    (z-0, floor-tile.png repeating)
  └─ Header              (wall-tile.png as background-image)
  └─ OfficeGrid
       └─ CubicleCard
            └─ CubicleFrame    (cubicle-idle/working.png background)
                 └─ MonitorScreen   (monitors/{agent}.png + glow)
                 └─ DeskProps       (props/*.png + float)
                 └─ SpeechBubble    (prompt text)
                 └─ Sprite          (CSS grid character)
            └─ AgentTooltip     (hover info)
```

---

## Assumptions / Not Verified

- Pillow dependency not listed in `package.json` (Python, not Node) — must be installed separately
- No `npm run build` was executed during this documentation pass (orchestrator verifies)
- Monitor screen `onError` fallback hides missing PNGs gracefully — not visually tested for all 15 agents
- Desktop browser zoom may alias at 2×+ — `image-rendering: pixelated` prevents interpolation but won't add resolution
