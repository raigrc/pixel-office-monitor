# Pixel Office Monitor architecture

Updated 2026-10-10. Current sections describe inspected local code. Proposed sections describe future work, not available interfaces or a finalized storage schema.

Read-only discovery and Session Inspector are implemented separately from the monitor pipeline described below. Provider control remains proposed.

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
| `POST /api/opencode-discovery` | Independent owner-secret unlock. Issues only a scoped application cookie; no provider request. |
| `GET /api/opencode-discovery` | Cookie-authorized health and first-page metadata read from the configured OpenCode server. |
| `GET /api/opencode-discovery/history` | Cookie-authorized, enrolled, scoped legacy message page. Selection and opaque continuation arrive in headers. |

Ingest accepts `x-monitor-token`, `x-token`, and Authorization token forms. SSE also accepts a query token. Server token selection includes a development fallback. The client uses `NEXT_PUBLIC_PIXEL_MONITOR_TOKEN`, which Next.js exposes in the browser bundle.

This is a local-only compatibility model. It cannot protect a privileged bridge or a remotely exposed service. Local state and health diagnostics, the browser-visible token, absent ingest rate limiting, and existing Supabase read policies require separate review before remote use.

Loopback binding reduces network exposure but does not replace origin validation, authorization, or protection against requests from hostile websites. Reports must not reproduce token-bearing URLs or raw sensitive logs.

## Implemented read-only OpenCode discovery

```text
Settings discovery panel
  -> independent owner-secret unlock and signed HttpOnly cookie
  -> fixed GET /api/opencode-discovery
  -> server-only configured loopback OpenCode boundary
  -> GET /global/health and GET /api/session
  -> validated, stripped metadata DTO
  -> read-only Settings rows
```

`opencode-discovery.ts` owns schema-derived domain types. `opencode-discovery.server.ts` owns configuration, authorization, fixed networking, byte limits and projection. The route adapts HTTP. `OpenCodeDiscoveryPanel.tsx` owns explicit unlock and refresh, status text and metadata presentation. This is a narrow read boundary, not a general provider framework or a process-launch bridge.

`PIXEL_DISCOVERY_ORIGIN` must match the canonical numeric loopback app host and port. `PIXEL_DISCOVERY_ACCESS_SECRET` is independent from every monitor/public/provider credential. Unlock validates a bounded body and issues a 15-minute HMAC-signed, audience-bound HttpOnly, SameSite=Strict cookie scoped to `/api/opencode-discovery`. Host, Origin, Fetch Metadata, fixed custom header and query checks apply before reads. The public monitor token cannot authorize this route.

Provider configuration is `PIXEL_OPENCODE_URL`, `PIXEL_OPENCODE_DIRECTORY`, optional `PIXEL_OPENCODE_PASSWORD`, and optional `PIXEL_OPENCODE_USERNAME`, default `opencode`. Only canonical numeric loopback origins are allowed. Browser values cannot choose a URL, path, workspace, or raw provider cursor. Credentials stay on the server. Metadata discovery has no legacy session-bootstrap fallback. Neither route follows redirects, retries, polls, launches processes, or sends provider writes.

For OpenCode 1.18.35, the service reads health, then `/api/session` with the fixed configured directory, `limit=50`, and descending creation order. Other healthy versions return unsupported listing. The page includes child and archived records. Native session/project/parent/workspace IDs and timestamps remain unchanged; missing parents stay unresolved. Entire-page scope checks reject unrelated directories. Raw directory, cursors, model/cost/token fields, provider errors and credentials are discarded before browser serialization.

The boundary caps health at 4 KiB, listing at 256 KiB and 50 records, and unlock at 1 KiB. One eight-second deadline covers provider calls and body consumption. Two simultaneous provider reads and two simultaneous unlock-body parsers are allowed. Excess unlock parsing returns 429 before reading its body. Missing configuration, invalid configuration, app authentication failure, provider authentication failure, unreachable, unsupported, malformed, response-limit and busy states remain explicit.

Discovery never imports the monitor store, synthesizes ingest events, selects a floor, or assigns execution activity. Verification reads real persisted metadata and confirms monitor sequence, floor and actor counts remain unchanged. The original discovery verifier owns its isolated provider. Inspector verification reads the existing approved provider and starts only an isolated monitor and fixture provider. The agent does not restart user-owned processes. The current production monitor accepts the rotated token; producer and browser reload remain owner actions where old values are cached.

`PIXEL_VERIFY_ISOLATED=1` selects a fixed ignored Next.js output directory and generated TypeScript config for verification only. Scripts set this flag on their child processes. Normal production still uses `.next`. The final gates compare production build identity and manifest fingerprints before and after each command. This addresses the earlier shared-output verification gap without replacing the running production build.

The normal monitor/provider connection is also verified. Private settings target the compatible server on 4097; its credentials remain independent of discovery unlock and monitor ingestion. Production browser proof matches 43 provider-owned IDs and count, with no ingest requests or monitor-state change during the read. Next.js dev-resource `allowedDevOrigins` now includes 127.0.0.1; it is separate from this API's authorization boundary.

The independent cookie protects this bounded single-user read capability. It is not approval for future privileged commands, remote access, hostile-local-process protection or multi-user deployment. Future control still requires its own security design.

## Implemented Session Inspector

`OpenCodeDiscoveryPanel.tsx` owns ephemeral selection, fetch cancellation, generation checks, expiry, and page-restoration cleanup. `OpenCodeHistoryPane.tsx` renders one projected page with escaped React text and recorded-status labels. Older pages replace the current page. No history, selection, or cursor is persisted. Relationship navigation uses the loaded metadata page only.

Both HTTP routes share one process-global read service and its two-read admission counter. History accepts only a fixed GET with no query or body. Existing Host, Origin, Fetch Metadata, custom-header, and signed-cookie checks apply. `X-Pixel-History-Session` supplies a validated native ID. Optional `X-Pixel-History-Cursor` carries an encrypted application continuation. The metadata route rejects history-control headers, and explicit history HEAD returns 405 without a read. Dot-segment identities are rejected before constructing provider URLs.

History requires `PIXEL_OPENCODE_HISTORY_PROFILE`, a private SHA-256 enrollment of purpose/version, canonical provider origin, normalized directory, Basic username/password, and pinned OpenCode version. Missing or stale enrollment disables history while metadata stays available. Enrollment records an operator-confirmed `serve --pure` connection. Health alone cannot prove pure mode, and the profile cannot detect a replacement process with identical endpoint and credentials.

One eight-second deadline and read slot cover six fixed GETs:

1. Supported provider health.
2. Fresh configured-directory `/api/session` first page with limit 50.
3. Scoped legacy `/session/:id` metadata for a session found in that page.
4. Scoped legacy `/session/:id/message` with limit five and an optional decrypted native `before` cursor.
5. Legacy metadata again.
6. Fresh global metadata again.

The service compares session/project/directory/parent/creation and reported workspace before releasing content. All message and part identities are validated before clipping, including omitted parts. Cookie and incoming cursor expiry, enrollment, and current configuration are rechecked before release. An unknown selection fails before any legacy bootstrap. Scope drift discards the page.

Legacy history is deliberate. The new message API returned an empty projection for a root with real legacy messages. The legacy external-plugin loader honors pure mode. Location services can still update provider-managed metadata or caches. GET-only inspection therefore does not imply an atomic snapshot or zero filesystem writes.

AES-256-GCM continuations use a fresh 12-byte IV and a purpose-specific HKDF key. Claims bind owner cookie nonce, connection profile, normalized directory, session/project/workspace, fixed five-message limit, backward order, native ID/time, and expiry. Lifetime is at most five minutes and cannot exceed the cookie or incoming continuation. Tokens are capped at 8192 characters, native cursors at 4096. Tampering, scope/owner swaps, expiry, and non-progressing page boundaries fail without returning content. Provider Link headers are ignored.

Private Zod wire schemas validate provider input. Strict schema-derived public DTOs retain only approved recorded fields. Reasoning, files, media, errors, and arbitrary metadata have fixed omission labels. Tool input traversal is bounded by depth and node count. Credentials and known patterns are redacted before UTF-8 clipping. Credential-bearing identities fail instead of being rewritten.

Limits are five messages, 50 projected parts across a page, 4 KiB per text part or combined tool arguments/output, 256 KiB per raw response, and 64 KiB per serialized DTO including its cursor. Projection overflow emits omission markers or an explicit limit failure. Raw overflow always fails. Real 20-message reads exceeded the raw cap for 41 of 48 sessions, so five-message pages replaced the original design after a smaller-page probe.

Runtime evidence covers 41 isolated checks and ten checks on the normal port-3001 monitor. For one selected real session, latest and older pages each contain five messages, including 17 projected recorded tool parts across both pages. Native identity tuples and monitor sequence/entity counts remained unchanged during the read window. These checks do not compare complete state or instrument provider filesystem/database writes. Fixture checks prove shared admission across route bundles, expiry, late-response disposal, actual navigation/back, inert content, mobile fit, and storage isolation. Synthetic lifecycle checks also cover pagehide/pageshow handlers, but use of browser back/forward cache is not guaranteed. Evidence retains no real screenshots, raw history, IDs, credentials, or continuations. Five-message probing still overflowed for five of ten sampled sessions, so bounded availability remains limited.

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
