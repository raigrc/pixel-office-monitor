# Layered character sprite system

This is a supporting asset reference for [Design](DESIGN.md), not a sixth primary specification. The contact sheet and row index are supporting generated references.

Character sprites use permanent project-original source layers. Runtime atlases are generated files. No downloaded or licensed character art is part of this system.

## Contract

`assets/characters/sprite-contract.json` is the canonical machine-readable contract.

- Each frame is 48 by 48 pixels.
- Each atlas is 1152 by 192 pixels: 24 frame columns and four direction rows.
- Direction rows are `down`, `left`, `right`, then `up`.
- Pose columns are idle 0 through 3, walk 4 through 11, seat 12 through 13, work 14 through 15, give 16 through 17, receive 18 through 19, success 20 through 21, and error 22 through 23.
- The world anchor is x24, y46.
- Opaque frame bounds may not exceed 32 by 38 pixels.
- Source and generated PNGs use RGBA with binary alpha.

## Source art and recipes

`assets/characters/layers/` contains 48 reusable 1152 by 192 layer atlases:

| Layer | Atlases | Purpose |
| --- | ---: | --- |
| `body` | 4 | Skin, head shape, hands, and body proportions |
| `hair` | 7 | Crop, curls, bob, bun, mohawk, swept, and pony styles |
| `top` | 6 | Jacket, hoodie, coat, vest, sweater, and overalls |
| `bottom` | 4 | Boots, sneakers, loafers, and skirt silhouettes |
| `face` | 6 | Calm, glasses, freckles, beard, visor, and smile details |
| `accessory` | 21 | Role-specific worn and carried items |

Source atlases use reserved marker colors. `assets/characters/appearances.json` selects one atlas from each layer and provides only the palette replacements for each character. Status colors, session colors, role accents, desk props, and Three.js astronaut accessories remain owned by their existing TypeScript modules.

`assets/characters/layers/provenance.json` records project origin, authoring method, review state, and required role coverage. New source art must remain project-original and must receive review before generation succeeds.

## Generation

Install Pillow, then run:

```powershell
python scripts/generate-sprites.py
```

The normal command writes 22 character atlases and `manifest.json` under `public/sprites/characters/`. It also refreshes the contact sheet and row index under `docs/`.

Check committed output without changing it:

```powershell
python scripts/generate-sprites.py --check
```

Generate an isolated copy:

```powershell
python scripts/generate-sprites.py --output Temp/sprite-check
```

The generator rejects missing recipe references, wrong image modes or dimensions, non-binary alpha, undeclared source colors, stale committed output, oversized opaque bounds, empty frames, reserved marker colors in final output, missing known roles, and unreviewed provenance. It composes every atlas twice and compares pixel hashes before writing.

## Runtime loading

`public/sprites/characters/manifest.json` supplies dimensions, frame size, anchor, path, and SHA-256 hash to `src/lib/scene/assets.ts`. Known registry keys resolve to their own atlas. Unknown runtime keys resolve to `fallback.png`.

`CharacterSprite.tsx` renders one native 48-pixel world frame and anchors it at x24, y46. `SceneViewport.tsx` may scale the complete 512×384-pixel room to fit the viewport. It does not downscale a character independently inside world coordinates.

## Contact sheet

`docs/character-sprites-contact-sheet.png` has five 48-pixel columns per role: down idle, right-facing walk, down work, down success, and down error. `docs/character-sprites-contact-sheet.json` identifies every row. The sheet retains transparent gutters so clipping and frame overlap remain visible during review.

When reviewing a change, check the contact sheet and the running `/character-demo` route. Also check seated work poses behind a desk front and the 48-pixel inspector portrait.
