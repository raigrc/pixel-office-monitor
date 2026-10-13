# Pixel Monitor — Design Brief

**Direction:** Cozy Agent Studio · **Updated:** 2026-10-09 · **Status:** Proposal; visual references/approval pending

## 1. Experience

A friendly, handcrafted pixel workspace that shows coding agents as tiny coworkers. It should feel like a cozy management game, **while preserving the clarity of a live developer tool**. Avoid copying any particular game's sprites, buildings, UI or distinctive assets.

**Keywords:** warm, approachable, tactile, lively, orderly, purposeful, readable.

**Not:** neon cyberpunk, corporate analytics wall, noisy theme park, full 3D tech demo, fake autonomous activity.

## 2. One world, two layers

- **Product UI:** projects/sessions, provider selection, prompt composer, transcript/terminal, inspector, notifications and customization.
- **World renderer:** visualizes observed actors, work, delegation and outcomes. It is supplementary to textual truth, not the only source of status.

The primary target is **2.5D cozy pixel art**; the GitHub-verified existing `OfficeScene` is top-down/layered 2D with 2D sprite sheets, **not a verified isometric 2.5D engine**. The Three.js view is an existing experiment to freeze behind a flag once the new direction is validated. Do not discard its code prematurely.

## 3. Art direction and palettes

Use a restrained palette that separates cozy surroundings from status and identity. **Suggested starting colors, not approved final tokens:**

| Use | Candidate | Notes |
|---|---|---|
| Warm paper / daylight | `#F3E6CE` | Floors and card highlights |
| Toasted wood | `#956E52` | Furniture and room edge |
| Sage | `#819977` | Plants, soft environment accent |
| Dusty teal | `#5B8F92` | Technical equipment accents |
| Muted terracotta | `#C77F68` | Welcoming warm accent |
| Night ink | `#1E2B35` | Dark background with readable fill |
| Soft cream text | `#FFF4E1` | On dark surfaces; contrast test required |

**Semantic colors are separate:** working, error, success, selection, delegation, orchestrator. Preserve their precedence over decorative palette, test WCAG contrast and use icon/text/shape in addition to color. Role colors must not be repurposed as status colors. Session/worksite accent is a different token family again.

## 4. 2.5D scene language

**Projection decision remains open:** evaluate (A) 2:1 isometric tile projection vs (B) oblique/3-quarter layered room. Prototype both with the *same* 4–6 actors before a renderer migration. Prioritize actor legibility, fixed desk relationships, selection and mobile footprint over mathematical isometric purity.

If isometric is chosen, a possible projection is:

```text
screenX = (tileX - tileY) * tileWidth / 2
screenY = (tileX + tileY) * tileHeight / 2 - heightOffset
```

Sort occupants/props by ground contact (feet/base), **not** sprite-top coordinate. Maintain explicit walkable cells and occlusion; avoid giant furniture that blocks actors. Expose viewport pan/zoom within safe bounds only if interaction testing justifies it.

Suggested scene zones: readable desks/work areas at center; pleasant shared area (coffee/meeting board); sparing decorations on the edges. Empty rooms should feel intentional rather than fully populated with fake tasks.

## 5. Characters and sprite studio

### Existing asset contract (GitHub-verified)

`CharacterSprite.tsx` uses **32×32 frames**, four direction rows (`down`, `left`, `right`, `up`) and 24 frame slots per row, for a **768×128** sheet. Current pose slots are:

| Pose | Slot start | Frames |
|---|---:|---:|
| idle | 0 | 4 |
| walk | 4 | 8 |
| seat | 12 | 2 |
| work | 14 | 2 |
| give | 16 | 2 |
| receive | 18 | 2 |
| success | 20 | 2 |
| error | 22 | 2 |

Existing manifest (`src/lib/scene/assets.ts`) has an orchestrator, senior-engineer and fallback sprite definition, plus tile/furniture/prop assets. Later local role visual identities may extend this: verify them before replacing definitions.

### Proposed user sprite pack

- Support **v1 compatible sheet upload first**: RGBA PNG 768×128, 32×32 frames with the exact current pose/direction layout.
- Validate MIME by decoding, dimensions, maximum bytes, transparency and animation indexing. Never run uploaded scripts.
- Provide an animated preview for every direction/state; show warnings for bad/incomplete sheets.
- Unknown agent uses one safe default fallback; assign pack after observing/declaring a real provider agent.
- Store selected pack by stable *provider-scoped agent identity*, with optional workspace override; do not mutate the provider agent name.
- Evolve to a manifest-driven flexible frame format only after v1 import/preview works.
- Save original, validated metadata and assignment in local user data; do not overwrite tracked files under `public/sprites`.

## 6. Information hierarchy

1. **Direct interaction/selection**: unmistakable focused agent and prompt target.
2. **Runtime status**: active, waiting, error, completed, interrupted and unknown.
3. **Delegation relationship**: sender, recipient and task progress.
4. **Orchestrator/special coordinator** when genuinely observed.
5. **Role/agent visual identity** and fallback distinction.
6. **Session/worksite identity**.
7. **Environment decoration**.

If an animation violates that order, remove/reduce the decorative effect. Never show a working animation when runtime evidence says idle.

## 7. UI approach

- Left rail: provider + project/session browser with explicit session state and capabilities.
- Center: 2.5D world / scene view, bounded and inspectable.
- Context inspector: selected agent/session, activity and relationships.
- Prompt composer: clearly bound to the selected session and provider; show which account/workspace receives the prompt before submit.
- Transcript and terminal: text-first, accessible, event-driven; a session transcript is **not** merely raw process stdout.
- Character Studio: browse known/observed agents, choose sprite, preview all poses, upload, reset.
- Keyboard operation and mobile **readability** are required; launching local processes from mobile browser may be unavailable by design.

Cozy UI means soft borders, pixel-aware accents and careful spacing—not sacrificing clear labels, focus treatment or dense developer information.

## 8. Motion and effects

**Live runtime:** use sprite-frame animation, a small deterministic scheduler and a responsive scene renderer (PixiJS is a candidate, **not yet a mandatory dependency**). Animation consumes normalized events; it never initiates execution. Reconnect, mode change or viewport resize must not replay arrivals.

**Examples:** short typing burst while working, soft lamp glow, brief success/error expression, a restrained delegation token, reduced-motion static equivalent. No random roaming that falsely implies agent activity.

**Remotion:** reserved for optional *recorded session replay/MP4 export*; not the primary live animation loop. First ensure the event log actually records sufficient time-stamped information to make honest replays.

## 9. Cozy environment

- Rounded/chunky desks, warm lamps, books, tools, plants and a shared workshop corner.
- Props reinforce task roles but should not create unsupported new agents.
- Day/dusk/night: warm day, gentle dusk, readable dark night, restrained monitor/window glow. Never crush agent visibility.
- Use modular re-usable tiles/sprites. Avoid high-frequency detail, arbitrary asset packs and license-unclear external art.

## 10. Acceptance and reference gates

Before significant art implementation, compare two controlled proofs: **current top-down 2D vs an isometric or oblique 2.5D prototype** with the *same actual actor/selection/delegation fixtures*. Capture desktop, mobile, crowded, working, error, success and reduced-motion states. Approve based on:

- Agent identity and statuses discernible without opening inspector.
- No sprite clipping, depth-sort confusion, actor occlusion or click-target drift.
- Visual state matches provider-reported truth.
- Smooth frame time at realistic actor counts; no leaked loops/resources.
- Accessibility and keyboard/text fallback remain fully usable.

Do not run a full cozy reskin until the scene projection/renderer is approved. See [../PLAN.md](../PLAN.md) for phased gates.
