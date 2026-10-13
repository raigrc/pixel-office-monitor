# Pixel Office Monitor

A local-first, game-inspired interface for observing coding-agent sessions. **Today it is an OpenCode-oriented live monitor; the next product direction is a controllable, multi-provider agent workspace.**

> **Status convention:** **Implemented** = supported by inspected code; **Locally reported** = completed in a working copy but not present in the checked GitHub revision; **Planned** = not yet built; **Experimental** = under evaluation. Never treat planned functionality as available.
>
> **Evidence boundary (2026-10-09):** Documentation was drafted against `raigrc/pixel-office-monitor` on GitHub (`master`, last pushed 2026-09-10) and the owner's subsequent implementation reports. The local working tree was not available for direct inspection. Reconcile this draft with local code before replacing the existing README. The inspected GitHub revision is older than recent Phase 4 work.

## What works now

- **Implemented in the inspected revision:** OpenCode plugin events → validated `POST /api/ingest` → in-process monitor store → authenticated SSE → 2D pixel office, per-session floors, agent states, delegation/inspection, and a separate experimental Three.js view.
- **Locally reported afterward:** stronger 3D agent identity, movement/navigation, multi-session controls, visual fixes, and a larger regression suite. Confirm in your local checkout before describing these as verified here.
- **Planned:** create/resume/prompt sessions directly from Pixel Monitor, a local provider bridge, OpenCode/Kilo/Codex/Claude adapters, dynamic agent discovery, uploadable character packs, and cozy 2.5D as the main world.
- **Experimental/future:** Remotion-based session replay/video export. Remotion is **not** the live game renderer.

## Documents

| Document | Read it for |
|---|---|
| [PRD](docs/PRD.md) | Product behavior, users, priorities and what is *not* in scope |
| [Architecture](docs/ARCHITECTURE.md) | Current and target data flows, boundaries, data concepts and provider contracts |
| [Design](docs/DESIGN.md) | Cozy 2.5D direction, sprites, motion, accessibility |
| [Implementation plan](PLAN.md) | The next small, testable work batch |

`AGENTS.md` and `CLAUDE.md` are coding-agent entrypoints, not additional product specifications. Prior notes under `docs/` should be archived only after useful content is folded into the documents above.

## Run the current monitor

**Prerequisites:** Node.js 20+ and npm; an installed OpenCode CLI is useful for real events.

```bash
git clone https://github.com/raigrc/pixel-office-monitor.git
cd pixel-office-monitor
npm install
npm run dev -- -p 3001
```

Open `http://localhost:3001` and run an OpenCode session that has the Pixel Monitor plugin configured. **The app does not yet launch or prompt OpenCode from the browser.** The plugin setup and two installed copies must be checked in the local machine; they are not shipped as tracked files in the inspected GitHub tree.

### Local configuration

Create `.env.local` yourself if needed. The inspected GitHub tree does **not** contain an `.env.example` file; do not follow old README instructions that assume it exists.

```ini
# Use a strong locally generated value; never commit it.
MONITOR_TOKEN=REPLACE_WITH_LOCAL_RANDOM_VALUE

# Existing SSE client uses a browser-exposed token; local-only compatibility.
# NOT a secure secret or authorization boundary for remote deployment.
NEXT_PUBLIC_PIXEL_MONITOR_TOKEN=REPLACE_WITH_SAME_LOCAL_VALUE

# Optional legacy persistence flag; verify behavior before enabling.
NEXT_PUBLIC_USE_SUPABASE=0
```

Set `PIXEL_MONITOR_URL` (normally `http://localhost:3001/api/ingest`) and `PIXEL_MONITOR_TOKEN` in the OpenCode plugin environment as required. Do not expose port 3001 publicly without first redesigning authentication: the inspected code includes a dev-token fallback and browser-readable SSE credentials.

### Commands

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Existing lint warnings should be recorded, not silently converted into passing new work. Verify visually on desktop/mobile and verify the ingest → SSE → office path after changes.

## Current code map

| Location | Responsibility in inspected revision |
|---|---|
| `src/app/page.tsx` | Main UI wiring, session selection and controls |
| `src/components/scene/OfficeScene.tsx` | 2D room, desks and agent display |
| `src/components/scene/CharacterSprite.tsx` | Sprite-sheet playback |
| `src/components/scene/SceneViewport.tsx` | Room framing and 2D/3D mode selection |
| `src/components/scene/ThreeCanvas.tsx` and `src/lib/scene/` | Experimental Three.js presentation and related code |
| `src/hooks/useMonitorStream.ts` | Client monitoring stream/state |
| `src/lib/monitor-store.ts` and `src/lib/monitor-types.ts` | Current runtime state and identities |
| `src/lib/schema.ts` | Versioned ingest payload validation |
| `src/app/api/ingest/route.ts` | Receive and validate events |
| `src/app/api/events/route.ts` | Live SSE with snapshots/replay |
| `public/sprites/` and `src/lib/scene/assets.ts` | Sprite assets and runtime manifest |
| `supabase/migrations/` | Existing optional/legacy schema assets; not the confirmed future persistence design |

## Operating principles

1. **Monitoring truth is authoritative.** Never turn a UI animation into a fabricated provider event.
2. **Provider control is capability-based.** A detected process is not necessarily a readable/controllable session.
3. **Local execution requires a protected bridge.** Browsers must not receive unrestricted command execution.
4. **Preserve before replacing.** Keep OpenCode ingest/SSE working until a new adapter is verified end-to-end.
5. **No forced 3D deletion.** Freeze/archive the working 3D experiment after dependency audit, then add the cozy 2.5D direction incrementally.

## Known documentation / engineering debt

- Earlier historical sprint descriptions and the older README contain stale fixed-roster, room-size and implementation claims.
- The GitHub tree contains `dev.log`, `dev-test.log`, `graphify-out/`, legacy cubicle components and 3D prototypes; **audit their references and tracked content before deletion**. Treat logs as potentially sensitive and do not reproduce their contents in documentation.
- Reported 2D↔3D arrival replay and close-zoom disappearance should be verified in the local tree. If the 3D mode is retired, avoid spending effort on non-blocking visual polish, but prevent regressions to shared state.

**Next step:** Follow [PLAN.md](PLAN.md) Phase 0, confirm the local tree and replace the files only after reviewing the diff.
