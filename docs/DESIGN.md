# Pixel Office Monitor design reference

Updated 2026-10-10. Existing local design and read-only Session Inspector are implemented. Proposed projection, upload, and provider-control UI changes remain unimplemented. User approval of the final 2D and 3D visual direction remains open.

## Existing visual system

The current Cozy Automation Studio separates environment, role identity, session identity, and semantic status. `src/lib/cozy-theme.json` is the canonical token source. `cozy-theme.ts`, `scripts/cozy_theme.py`, and `cozy-materials.ts` use those tokens for UI, generated assets, and Three.js materials.

| Token family | Current examples |
| --- | --- |
| UI | Canvas `#171411`, surface `#211C18`, text `#F3EBDD`, muted `#B8AA99` |
| Environment | Floor `#D8C8A7`, wood `#8B6044`, lamp `#EDC46A`, plant `#718D67` |
| Semantic | Working `#7FA96B`, error `#DE7467`, success `#58AA91`, selection `#79A8C7` |
| Delegation | Active `#B18AC6`, pending `#7E6A86`, token `#E7D7EC` |
| Session | Six stable session accent colors in `sessionPalette` |

These replace the v2 draft's candidate palette as the current implementation reference. They do not imply final user art approval. Role styling does not override activity or selection. Status uses labels, glyphs, and shape as well as color.

The UI uses Press Start 2P, VT323, and Inter through the app layout. The page owns the monitor header. The desktop navigator is 18rem wide. Header and navigator share the 1024px breakpoint, with a mobile or tablet bottom sheet below it.

Settings has a separate implemented OpenCode discovery section using the existing theme. An independent password input unlocks a short-lived HttpOnly cookie; manual Check and Refresh controls read health and metadata. Exact returned count, first-page limit, native IDs, unresolved parent links and archive times use text. Rows offer read-only recorded-message inspection. Desktop and 390px mobile containment, keyboard submit, status announcements and stale-row clearing are verified. Discovery metadata is not a world-rendering input.

### Read-only Session Inspector

Selection opens an inline Settings pane rather than a new route or monitor floor. The pane shows one disposable page of at most five recorded messages in chronological order. Latest and Older replace the page. Clear remains available while a request is pending. Parent and child buttons use loaded metadata only and label incomplete coverage.

Text uses escaped, wrapping `<pre>` content. Tool details show recorded arguments/output and an explicit recorded status. A saved `running` status never becomes a live activity badge. Reasoning, files, media, errors, and unsupported parts use omission text. Redacted and truncated content has labels. No markup, media, external link, prompt composer, or terminal is rendered.

Selection moves keyboard focus to the Inspector heading. Paging restores focus to its usable control, falling back to Latest when Older becomes unavailable. Controls have 44px minimum height and visible focus rings. New reads remove old content immediately, and generation checks reject late responses. Failure, metadata refresh, Clear, expiry, navigation, and page restoration discard inspection. History does not enter browser storage.

Forty-one runtime checks cover desktop and 390px mobile layout, paging focus, expiry, stale-response disposal, actual navigation/back, inert content, storage isolation, and monitor sequence/entity-count continuity. Synthetic pagehide/pageshow tests also exercise restoration handlers. Ten checks verify the normal port-3001 panel against the existing provider. Screenshots contain fixtures only. No scene, motion, sprite, or renderer change belongs to this Inspector slice.

## Existing layered office

`office-layout.ts` defines a `512×384` scene and a 16px tile unit. Explicit layers cover floor, rear walls, furniture, actors, foreground, task tokens, and labels. The current scene has depth-layered, angled pixel furniture. It is not a confirmed isometric tile engine.

Sixteen anchors form four columns. Eleven default roles occupy seats 0 through 10 in a 4-4-3 arrangement. Optional observed roles occupy seats 11 through 14 in the order `build`, `plan`, `general`, and `scout`. Unknown roles share seat 15. The observed orchestrator stands separately at `{ x: 112, y: 44 }`.

Furniture-relative actor, monitor, handoff, and prop anchors come from the same layout. `SceneViewport` measures its content container and fits the whole room without a 2D pan or zoom camera. Dark pixel framing fills unused viewport space rather than extending the office floor.

`OfficeEnvironment` renders rear-wall storage, a lounge, a coffee nook, and a four-seat meeting area. Oak flooring, two rugs, four low partitions, and open cross-aisles join those spaces. Sixteen desk footprints remain possible without closing common-room entrances.

The generator adds a 64×24 credenza, a 32×24 lounge table, and a 56×40 conference table. The coffee machine rests on its counter. Four chairs surround the meeting table. Environment geometry and asset-manifest tests cover placement and full-roster clearance.

Local Phase 4C visual-match P1 and P2 delivered wider composition and connected common rooms. P3 cubicle depth, P4 daylight depth, P5 label-noise reduction, and P6 matched user acceptance remain unfinished. Historical screenshots and automated assertions are not final visual approval.

## Character contract

`assets/characters/sprite-contract.json` is the machine-readable authority. [Character sprite reference](character-sprite-system.md) is a supporting reference, not a sixth primary specification.

- Native frames are 48×48 pixels.
- Atlases are 1152×192 RGBA PNGs with 24 columns and four rows.
- Direction order is `down`, `left`, `right`, and `up`.
- Eight poses occupy 96 total frames.
- World anchor is `{ x: 24, y: 46 }`.
- Opaque bounds are limited to 32×38 inside each 48×48 frame.
- Source and output use binary alpha.
- Forty-eight permanent project-original source layers compose 22 output atlases for 21 registered keys plus fallback.

| Pose | Start column | Frame count |
| --- | ---: | ---: |
| idle | 0 | 4 |
| walk | 4 | 8 |
| seat | 12 | 2 |
| work | 14 | 2 |
| give | 16 | 2 |
| receive | 18 | 2 |
| success | 20 | 2 |
| error | 22 | 2 |

`appearances.json` selects layer recipes and palette replacements. `layers/provenance.json` records project origin and review state. Generated `manifest.json` supplies dimensions, frame size, anchor, path, and hash to `assets.ts`. Unknown runtime keys use `fallback.png`.

Status, session, and role colors remain separate from character appearance. Shared `agent-visual-identity.ts` maps role accents, desk props, and six batched 3D accessory families. The fallback remains deterministic without inventing provider identity.

[Contact sheet](character-sprites-contact-sheet.png) and [row index](character-sprites-contact-sheet.json) remain supporting generated references. Each role shows down idle, right walk, down work, down success, and down error, with transparent gutters. `/character-demo` provides live pose review.

## Generator ownership and retained assets

| Generator or source | Current purpose |
| --- | --- |
| `scripts/generate-office.py` | Current office tiles, furniture, props, and common-room sprites |
| `scripts/generate-sprites.py` | Layer validation, character composition, manifest, and contact sheet |
| `scripts/cozy_theme.py` | Canonical theme input for Python generation |
| `scripts/generate-assets.py` | Older procedural tiles, cubicle frames, 23 props, and 15 monitor PNGs |
| `assets/characters/` | Permanent source layers, recipes, provenance, and sprite contract |
| `public/sprites/` | Retained served assets, including legacy PNG URLs |

Current regeneration commands and overwrite warnings are in [README.md](../README.md). The sprite generator's `--check` validates committed output without changing it. Pillow remains an external Python dependency.

The older generator's inventory is three background tiles, two cubicle frames, 23 props, and 15 monitor screens, totaling 43 PNGs. The former asset note incorrectly counted five background tiles plus two additional frames. Its detailed old palette and file inventory remain preserved as a historical reference in the [archive inventory](archive/2026-10-09/README.md).

All public PNGs remain retained, including legacy monitor screens. External URL consumers are uncertain, and `floor-tile.png` still has a global CSS reference. Archived cubicle components are not current extension instructions. Live `DeskDecor` uses shared props and animation modules. `Sprite.tsx` remains because its `SpriteState` type feeds `agent-animations.ts`.

## Motion, semantics, and visibility

Animation consumes observed facts. It does not start provider work. Idle and waiting poses do not mean active execution. Explicit successful and failed outcomes produce temporary beats. Unknown outcomes remain neutral, and new work interrupts an outcome beat.

2D delegation can move a sender through the existing handoff route and play give and receive gestures. A 3D invocation uses an arc and token while astronauts remain at their worksites. Selection and inspection resolve by stable actor identity.

Reduced motion follows the system preference and freezes spatial and decorative motion while preserving semantic state and delays. The 3D renderer pauses while hidden and remains mounted after first activation. Hidden 2D sprite timers remain active, which is known performance debt.

The current 3D implementation retains shared instance bounds and frustum culling. Hydration and close-zoom code and unit fixes exist. Phase 0 verifies fresh-browser 3D startup and single-canvas toggling, but not arrival-animation replay, close-zoom visibility, or individual actor occlusion. No explicit experimental feature flag exists today.

Local staged 3D lighting uses day, dusk, and night profiles. Later local night tuning raised the ambient floor to 0.48 and cool directional fill to 0.65. The earlier 0.22 and 0.3 measurements remain historical. Night readability still requires current browser evidence and user review.

## Proposed projection and renderer choice

The target remains a cozy 2.5D world with clear operational information. A new renderer is not approved. Comparison candidates remain 2:1 isometric projection and an oblique or three-quarter layered room.

A possible isometric projection is:

```text
screenX = (tileX - tileY) * tileWidth / 2
screenY = (tileX + tileY) * tileHeight / 2 - heightOffset
```

This formula is a proposal, not current code. Prototype the same four to six actors in both candidate projections and compare against the current room. Selection, readable poses, desk relationships, feet-based sorting, furniture occlusion, walkability, mobile fit, and measured cost determine the choice.

DOM, canvas, and PixiJS remain options. PixiJS is not a selected dependency. Viewport pan or zoom needs interaction evidence rather than automatic inclusion. Three.js remains live until shared dependencies are audited and later retirement or flagging is approved.

## Proposed Sprite Studio

The initial compatible upload proposal uses the current 1152×192 RGBA atlas contract, 48×48 frames, four directions, eight poses, and 96 frames. The archived draft's 768×128 and 32×32 baseline is obsolete.

Pack validation requires decoding the PNG, checking dimensions, frame indexing, transparency, manifest consistency, and bounded byte size. Final numeric byte limits remain undecided. Imported scripts never execute.

Preview covers every pose and direction. Assignment binds to provider-scoped agent identity, with an optional workspace override. Reset restores a valid fallback. Storage preserves original import and validated metadata outside tracked `public/`. None of this upload or persistence UI exists today.

## Proposed control UI and hierarchy

The future rail adds provider and capability-aware session selection. A prompt composer clearly names the receiving provider, workspace, and native session. The transcript is text-first and is not equivalent to raw process stdout. Terminal attachment remains a separate supported action.

The world supplements textual truth. Priority remains selection and prompt target, runtime state, delegation, an observed orchestrator, role identity, session identity, then environment decoration. Decorative motion cannot obscure status or imply work.

Keyboard operation, visible focus, non-color status, and mobile viewing remain requirements. Current modals restore focus and close on Escape but lack Tab trapping. A shared focus scope remains a later accessibility task.

## Acceptance limits

Future renderer acceptance compares controlled current and candidate scenes with matching actors and invocation facts. Required frames cover desktop, tablet, mobile, crowded rooms, sidebar states, day, dusk, night, working, success, error, delegation, selection, and reduced motion.

Acceptance requires readable identity, accurate status, unclipped sprites, correct depth and click targets, no mode-change arrival replay, bounded frame cost, no leaked loops, and accessible text and keyboard alternatives. User approval is separate from automated containment and runtime assertions.

Remotion remains optional recorded replay or video export. It is not the live sprite scheduler or renderer. Privacy-safe retained events must exist before honest replay can be promised. [PLAN.md](../PLAN.md) keeps all future work unimplemented and records the open stop gates.
