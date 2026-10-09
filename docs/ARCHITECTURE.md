# Pixel Office Monitor architecture

Updated 2026-10-09. Current sections describe inspected local code. Proposed sections describe future work, not available interfaces or a finalized storage schema.

## Current data flow

```text
External OpenCode plugin
  -> POST /api/ingest
  -> Zod v1 or v2 payload validation and event deduplication
  -> in-process monitor store
  -> GET /api/events authenticated SSE
  -> useMonitorState in page.tsx, via useMonitorStream
  -> shared ActivityModel and renderer-neutral WorldState projection
  -> OfficeScene or retained ThreeCanvas and ThreeEngine
```

`GET /api/state` and `GET /api/health` provide local diagnostics. Monitor-floor rename and close routes change monitor state, not provider execution.

### Ownership

| Location | Current responsibility |
| --- | --- |
| `src/lib/schema.ts` | Validates compatibility v1 and identity-rich v2 ingest payloads |
| `src/lib/monitor-types.ts` | Session, floor, actor, invocation, snapshot, and delta contracts |
| `src/lib/monitor-store.ts` | Runtime maps, normalization, dedupe, prune, bounded event ring, and SSE metrics |
| `src/app/api/ingest/route.ts` | Authenticated event ingress and validation |
| `src/app/api/events/route.ts` | Authenticated initial and live snapshots, replay, heartbeat, and connection limits |
| `src/hooks/useMonitorStream.ts` | EventSource lifetime, persisted cursor, reconnect, and stream freshness |
| `src/app/page.tsx` | One monitor subscription, session selection, activity and world projections, and inspection |
| `src/lib/activity/` | Shared activity, endpoint, outcome, and standby semantics |
| `src/lib/world/` | Neutral desired 3D world state and projection from monitor facts |
| `src/lib/multi-session/` | Grouping, summary comparison, and transition notifications |
| `src/components/scene/SceneViewport.tsx` | Full-room fit and retained view lifetime |
| `src/components/scene/OfficeScene.tsx` | Current layered office, desks, actors, and 2D handoffs |
| `src/components/scene/OfficeEnvironment.tsx` | Common rooms and fixed environment geometry |
| `src/components/scene/CharacterSprite.tsx` | Manifest-driven 48px pose playback |
| `src/components/scene/ThreeCanvas.tsx` | 3D mount, resize, synchronization, activation, and cleanup |
| `src/lib/scene/three-engine.ts` | WebGL meshes, render loop, composer, quality, and resource ownership |
| `src/lib/scene/walkers.ts` | Engine-owned `AgentMotionController` lifecycle, standby, routes, and transit |
| `src/lib/cozy-theme.json` | Shared UI, semantic, environment, session, and material tokens |

### Identity and unknown facts

V2 floors derive from `projectId:rootSessionId`. Actors derive from `projectId:sessionId:agentKey`. Invocations derive from `projectId:senderSessionId:callId`. These IDs are not provider-scoped. V1 retains compatibility behavior keyed by its `sessionID`.

Root sessions own floors. Child sessions retain their own identities while sharing the root floor. Repeated same-role invocation counts do not create extra canonical role desks. Unknown roles share a visitor desk today, so the current layout is not an unlimited dynamic-agent registry.

Missing sender, recipient, parent invocation, and outcome remain unknown. Direct delegation requires reliable distinct endpoints on the same floor. Nested delegation additionally requires a valid parent relationship. Timing and lineage fallbacks in external producer attribution do not prove invocation parentage.

The current shared outcome model gives explicit success and failure temporary beats. Cancelled and unknown outcomes stay neutral. New active work interrupts outcome presentation. The 3D error presentation uses a blocked badge rather than a dedicated astronaut error clip.

### Transport and runtime storage

The ingest route accepts v1 and v2 contracts. V2 adds event identity, project and session lineage, and invocation facts. Source schemas remain authoritative for required fields and enums. A duplicate event does not create a second invocation.

The event ring is bounded to 2,000 entries. Epoch and sequence cursors support replay through `Last-Event-ID` or `lastEventId`. The stream sends initial snapshots, live sanitized snapshots, and heartbeat comments every fifteen seconds. The client persists its cursor under `pixel:monitorCursor` and reconnects with backoff.

The monitor store is in-process memory. The Supabase flag and helper clients exist, but `upsert()` has only a placeholder branch for enabled Supabase. Enabling the flag does not delegate runtime writes to a database. The migration is retained as an existing asset, not a selected persistence design.

Browser preferences, Colony placement history, and retained renderer state are separate from durable provider history. Closed monitor floors can remain in recent client summaries but are filtered at renderer boundaries. Comparison uses two summaries rather than two active WebGL scenes. Notifications suppress initial-baseline alerts and deduplicate transitions.

### Renderer lifetime and 3D retention

`SceneViewport` starts in 2D. It dynamically loads `ThreeCanvas` when 3D first activates, then retains the mounted engine. Hidden 3D rendering pauses. The 2D DOM remains mounted and hidden while 3D is active, and its sprite timers remain active.

Three.js 0.186 is a live package dependency. `ThreeCanvas`, `three-engine.ts`, scene barrel exports, `settings3d.ts`, world modules, shared identity, theme, and lighting modules have active consumers or tests. There is no explicit experimental feature flag. Adding one requires a later dependency audit and a separate implementation phase.

Colony owns persisted plot anchors and fallow placement history. ThreeEngine owns active meshes and resources. AgentMotionController owns movement state keyed by stable world-agent IDs. Desired `WorldState` does not store navigation routes or invocation presentation timers. Shared `ActivityModel` supplies activity semantics to both renderers.

2D handoffs can route a sender between desks. 3D invocation arcs do not route astronauts to each other. Both presentations remain subordinate to reported facts.

Hydration-aware synchronization and shared moving-instance bounds fixes exist in code and unit tests. Phase 0 verifies fresh production-browser startup and single-canvas toggling. These checks do not verify arrival-animation replay or individual close-zoom occlusion. Those acceptance tasks remain open.

## Current API and security boundary

| Route | Purpose and limit |
| --- | --- |
| `POST /api/ingest` | Token-authenticated validated observation ingress |
| `GET /api/events` | Token-authenticated SSE, with query-token support for EventSource |
| `GET /api/state` | Legacy snapshot is unauthenticated; v2 Accept header requires a token. Neither provides a privileged control boundary. |
| `GET /api/health` | Local health and stream metrics |
| `PATCH /api/floor/[sessionID]/rename` | Authenticated monitor-floor title mutation |
| `POST /api/floor/[sessionID]/close` | Authenticated monitor-floor closure, not provider termination |

Ingest accepts `x-monitor-token`, `x-token`, and Authorization token forms. SSE also accepts a query token. Server token selection includes a development fallback. The client uses `NEXT_PUBLIC_PIXEL_MONITOR_TOKEN`, which Next.js exposes in the browser bundle.

This is a local-only compatibility model. It cannot protect a privileged bridge or a remotely exposed service. Local state and health diagnostics, the browser-visible token, absent ingest rate limiting, and existing Supabase read policies require separate review before remote use.

Loopback binding reduces network exposure but does not replace origin validation, authorization, or protection against requests from hostile websites. Reports must not reproduce token-bearing URLs or raw sensitive logs.

## Proposed control architecture

The target adds a logical control boundary only when real provider capabilities justify it:

```text
Session and prompt UI
  -> authenticated application intent
  -> narrow local bridge where privileged operations require one
  -> version-specific provider adapter
  -> native provider session, messages, and events
  -> provider-scoped normalized state
  -> existing monitoring presentation
```

This separation does not require microservices or empty framework directories. A Node sidecar and a packaged desktop runtime remain options. OpenCode, Kilo, Codex, and Claude do not necessarily share ACP, app-server, CLI, or desktop capabilities.

### Proposed responsibilities

| Component | Owns | Excludes |
| --- | --- | --- |
| Web UI | Provider, workspace, and session selection, explicit intent, transcript, inspection, and appearance choices | Arbitrary shell execution |
| Local bridge | Allowed provider connections and supported privileged actions | Generic command strings and private desktop scraping |
| Provider adapter | Version-specific session, message, event, and cancel translation | Invented unsupported operations |
| Normalizer | Provider-scoped identity, provenance, and nullable relationships | Identity guesses from labels, prompts, or process titles |
| Runtime state and stream | Idempotent reconciliation and bounded replay | Ownership of provider execution truth |
| Visual layer | Presentation of observed facts | Provider actions caused by animation or mode switching |
| Pack and profile storage | Validated assets and user-owned assignments | Implicit changes to provider configuration |

### Proposed data concepts

These concepts are not a finalized SQL schema:

| Entity | Identity and ownership |
| --- | --- |
| `ProviderConnection` | Provider, workspace scope, connection state, and capabilities |
| `Project` | Provider-scoped workspace identity and display metadata |
| `Session` | Provider, workspace, and native session ID, with disclosed parent and root links |
| `AgentDefinition` | Provider and native agent key, with declared or observed provenance |
| `ActorInstance` | Session-specific observed actor linked to an agent definition |
| `Invocation` | Native call identity, nullable endpoints and parent, lifecycle, and outcome |
| `NormalizedEvent` | Stable event key, source, occurred and received times, type, and provenance |
| `SpritePack` | Validated files, version, dimensions, directions, and pose metadata |
| `VisualProfile` | Pack reference and user appearance preferences |
| `AgentVisualAssignment` | Provider-scoped agent to visual-profile link, with optional workspace override |

Existing OpenCode IDs need a compatibility migration before multiple providers can ingest without collisions. Native IDs remain available for round-trip provider calls. Visual assignment does not alter execution identity.

### Proposed capabilities and recovery

Adapters report supported session listing, creation, loading, prompting, interrupt, event streaming, agent listing, and terminal attachment. They return explicit unsupported and not-configured errors. A process appearing in the OS does not prove any of those capabilities.

Prompt requests bind to a selected native session and an action identity. Recovery queries supported state and reconciles IDs. It does not automatically send a prompt again. Terminal attachment must prove selected-session identity before launch.

## Deferred persistence and bridge protection

Providers remain the source of session history. Pixel Monitor can persist preferences, agent definitions, visual assignments, and a justified replay cache. It does not mirror conversations by default.

SQLite is a candidate for compact local metadata, not an approved choice. Imported packs require a safe user-data directory outside tracked `public/`, a bounded persistent index, and decode-based PNG validation. Initial compatible packs use 1152×192 RGBA atlases with 48×48 frames.

The proposed bridge requires loopback binding, origin checks, non-public authorization, workspace boundaries, executable and argument allowlists, bounded process streams, and deliberate user actions. A browser-public monitor token must never authorize privileged command execution. Remote access requires a separate security design.

## Supporting history and open verification

[Archive inventory](archive/2026-10-09/README.md) records the old 3D implementation proposal, office revamp history, and legacy asset reference. Some old 3D allocation helpers still have tests. This phase retains their whole module graph rather than deleting them from an obsolete plan.

Existing ownership lessons remain current. Use one subscription, separate desired state from movement state, retain returning Colony ground, synchronize atomically, compact surviving instances, and dispose explicitly owned resources. The original plan and decision trail record the rationale and historical evidence.

Fresh-browser startup, refresh, and single-canvas toggling pass Phase 0 checks. Animation hydration parity, close zoom, occlusion, leak checks, and user visual acceptance remain open. Modal focus trapping, hidden 2D timers, page-level handoff updates, PMREM frequency, and `preserveDrawingBuffer` remain known debt. [PLAN.md](../PLAN.md) owns these follow-ups.
