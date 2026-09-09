# Graph Report - pixel-office-monitor  (2026-09-07)

## Corpus Check
- 75 files · ~54,524 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 651 nodes · 1140 edges · 43 communities (34 shown, 9 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.54)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- OfficeScene.tsx
- generate-office.py
- devDependencies
- Pixel Office Monitor
- generate-assets.py
- monitor-store.ts
- compilerOptions
- Pixel Office Monitor — Build Plan & Checklist
- HandoffScheduler
- schema.ts
- Pixel Art Assets — R6–R10 (2026-09-05)
- Sprite.tsx
- route.ts
- page.tsx
- OfficeGrid.tsx
- generate-sprites.py
- getState
- CubicleCard.tsx
- monitor-store.test.ts
- route.ts
- FloorPreview.tsx
- FloorSwitcher.tsx
- DeskProps.tsx
- ErrorBoundary
- ActorInfo
- getSnapshot
- layout.tsx
- AgentInspector.tsx
- AgentTooltip.tsx
- supabase.ts
- AGENTS.md
- eslint.config.mjs
- next.config.ts
- postcss.config.mjs
- types.d.ts
- agents
- PresentationController
- page.tsx
- MonitorScreen.tsx

## God Nodes (most connected - your core abstractions)
1. `rect()` - 27 edges
2. `save()` - 26 edges
3. `main()` - 26 edges
4. `rect()` - 21 edges
5. `px()` - 18 edges
6. `px()` - 17 edges
7. `gen_monitors()` - 17 edges
8. `compilerOptions` - 16 edges
9. `Pixel Office Monitor` - 15 edges
10. `Pixel Office Monitor — Build Plan & Checklist` - 14 edges

## Surprising Connections (you probably didn't know these)
- `AgentActorProps` --references--> `Point`  [EXTRACTED]
  src/components/scene/AgentActor.tsx → src/lib/scene/office-layout.ts
- `CharacterSpriteProps` --references--> `Point`  [EXTRACTED]
  src/components/scene/CharacterSprite.tsx → src/lib/scene/office-layout.ts
- `StaticOfficeDemo()` --calls--> `getAssetUrl()`  [EXTRACTED]
  src/components/scene/StaticOfficeDemo.tsx → src/lib/scene/assets.ts
- `PATCH()` --calls--> `getState()`  [EXTRACTED]
  src/app/api/floor/[sessionID]/rename/route.ts → src/lib/monitor-store.ts
- `POST()` --calls--> `upsert()`  [EXTRACTED]
  src/app/api/ingest/route.ts → src/lib/monitor-store.ts

## Import Cycles
- None detected.

## Communities (43 total, 9 thin omitted)

### Community 0 - "OfficeScene.tsx"
Cohesion: 0.14
Nodes (12): getActorActivityPose(), OfficeScene(), StaticOfficeDemo(), StaticOfficeDemoProps, TILE_REPEAT_X, TILE_REPEAT_Y, DESK_ANCHORS, DeskAnchor (+4 more)

### Community 1 - "generate-office.py"
Cohesion: 0.12
Nodes (47): circle(), gen_chair(), gen_clipboard(), gen_coffee_cup(), gen_coffee_machine(), gen_desk_front(), gen_desk_rear(), gen_door_closed() (+39 more)

### Community 2 - "devDependencies"
Cohesion: 0.04
Nodes (47): eslint, eslint-config-next, motion, next, dependencies, motion, next, react (+39 more)

### Community 3 - "Pixel Office Monitor"
Cohesion: 0.05
Nodes (38): Assumptions / not verified in this pass, Before / After (what changed), Decisions, Files, Office Revamp — Sprint R1–R5 (2026-09-05), Run log excerpt (verified 2026-09-05, revamp code — build not re-run in doc pass), Verification, 1. Clone & enter (+30 more)

### Community 4 - "generate-assets.py"
Cohesion: 0.12
Nodes (38): _blueprint_screen(), _build_screen(), _checklist_screen(), _code_screen(), _doc_screen(), _docs_screen(), gen_cubicle_frame(), gen_door_tile() (+30 more)

### Community 5 - "monitor-store.ts"
Cohesion: 0.15
Nodes (18): connectionsPerIP, deriveActorState(), ensureActor(), ensureFloor(), ensureInvocation(), ensureSession(), eventListeners, getActorActiveInvocations() (+10 more)

### Community 6 - "compilerOptions"
Cohesion: 0.06
Nodes (33): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+25 more)

### Community 7 - "Pixel Office Monitor — Build Plan & Checklist"
Cohesion: 0.06
Nodes (32): 0. How to use this file, 10. Run Log (final — 2026-09-05), 1. Verified Agent → Sprite Mapping, 2. Design Tokens (ui-ux-pro-max verified), 3. Architecture, 4. Sprints & Checklist, 5. Task Breakdown (small tasks — no hallucination), 6. Ownership (assemble-team roster) (+24 more)

### Community 9 - "schema.ts"
Cohesion: 0.08
Nodes (30): extractToken(), GET(), getExpectedToken(), POST(), checkDedupe(), getLatestEvent(), setDedupe(), AnyIngestPayload (+22 more)

### Community 10 - "Pixel Art Assets — R6–R10 (2026-09-05)"
Cohesion: 0.10
Nodes (20): Animation Classes (globals.css), Asset Inventory, Assumptions / Not Verified, Background Tiles (`public/sprites/`), Component Integration, Cubicle Frames (`public/sprites/`), Desk Props (`public/sprites/props/`), How to Add a New Agent Prop (+12 more)

### Community 11 - "Sprite.tsx"
Cohesion: 0.17
Nodes (18): AGENT_CFG, AgentCfg, applyBase(), buildMatrix(), CHAR_TO_HEX, createEmpty(), fillRect(), getAnimationClass() (+10 more)

### Community 12 - "route.ts"
Cohesion: 0.15
Nodes (16): AgentActor(), AgentActorProps, AnimationState, FrameData, Pose, POSE_FRAMES, CharacterSprite(), CharacterSpriteProps (+8 more)

### Community 13 - "page.tsx"
Cohesion: 0.06
Nodes (27): convertV2ToLegacy(), Home(), redactPathsInPrompt(), CubicleCard, ErrorBoundary, Props, State, HeaderProps (+19 more)

### Community 14 - "OfficeGrid.tsx"
Cohesion: 0.16
Nodes (13): MonitorStreamCallbacks, CubicleLegacy, DeltaEnvelope, EventType, IngestAck, InvocationStatus, MonitorEvent, RuntimeState (+5 more)

### Community 15 - "generate-sprites.py"
Cohesion: 0.29
Nodes (13): circle(), draw_body(), draw_character_frame(), draw_head(), ensure_dirs(), generate_character_sprite_sheet(), main(), px() (+5 more)

### Community 16 - "getState"
Cohesion: 0.18
Nodes (14): extractToken(), getExpectedToken(), PATCH(), closeFloor(), emitEvent(), emitSSEEvent(), getDedupeIndex(), getEventsSince() (+6 more)

### Community 17 - "CubicleCard.tsx"
Cohesion: 0.22
Nodes (5): CubicleCardInner(), CubicleCardProps, truncate(), CubicleFrameProps, SpeechBubbleProps

### Community 18 - "monitor-store.test.ts"
Cohesion: 0.26
Nodes (11): GET(), _clearStore(), getActiveSSEConnections(), getFloorsCount(), getSSEMetrics(), getStore(), _getStoreSize(), getUptimeMs() (+3 more)

### Community 19 - "route.ts"
Cohesion: 0.19
Nodes (11): extractToken(), GET(), getExpectedToken(), sanitizeEventPayload(), sanitizeInvocation(), checkAndIncrementIPConnection(), decrementIPConnection(), decrementSSEConnections() (+3 more)

### Community 20 - "FloorPreview.tsx"
Cohesion: 0.20
Nodes (8): FloorPreview, FloorPreviewProps, MiniCubicle(), AGENT_IDS, AGENT_MAP, AgentMeta, getAgentMeta(), INTERN_META

### Community 21 - "FloorSwitcher.tsx"
Cohesion: 0.27
Nodes (8): FloorContextMenuProps, FloorSwitcher(), FloorSwitcherProps, FloorTabs(), FloorTabsProps, formatProject(), formatSince(), formatTitle()

### Community 22 - "DeskProps.tsx"
Cohesion: 0.24
Nodes (8): DeskProps, DeskPropsInner(), DeskPropsProps, AGENT_PROPS, AgentPropsConfig, getAgentProps(), INTERN_PROPS, PropDef

### Community 23 - "ErrorBoundary"
Cohesion: 0.33
Nodes (9): getDeskAnchor(), getRoute(), calculateFacing(), getDistance(), getRecipientHandoffPosition(), getRoute(), getSenderReturnPosition(), getSenderStartPosition() (+1 more)

### Community 24 - "ActorInfo"
Cohesion: 0.23
Nodes (12): OfficeSceneProps, ActorInfo, FloorInfo, InvocationInfo, HandoffJob, HandoffPhase, PHASE_DURATIONS, Point (+4 more)

### Community 25 - "getSnapshot"
Cohesion: 0.27
Nodes (9): extractToken(), getExpectedToken(), POST(), extractToken(), GET(), getExpectedToken(), buildSnapshot(), getSnapshot() (+1 more)

### Community 26 - "layout.tsx"
Cohesion: 0.33
Nodes (4): inter, metadata, pressStart, vt323

### Community 27 - "AgentInspector.tsx"
Cohesion: 0.47
Nodes (5): AgentInspector(), AgentInspectorProps, redactPathsInPrompt(), CubicleDTO, FloorDTO

### Community 28 - "AgentTooltip.tsx"
Cohesion: 0.67
Nodes (3): AgentTooltip(), AgentTooltipProps, truncate()

### Community 29 - "supabase.ts"
Cohesion: 0.29
Nodes (3): DIRECTIONS, PILOT_CHARACTERS, POSES

### Community 41 - "page.tsx"
Cohesion: 0.50
Nodes (3): LS_KEYS, SettingsPage(), useBoolSetting()

## Knowledge Gaps
- **223 isolated node(s):** `eslintConfig`, `nextConfig`, `name`, `version`, `private` (+218 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PresentationController` connect `PresentationController` to `ActorInfo`, `HandoffScheduler`, `page.tsx`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `ActorInfo` connect `ActorInfo` to `OfficeScene.tsx`, `monitor-store.ts`, `OfficeGrid.tsx`, `ErrorBoundary`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `getAssetUrl()` connect `route.ts` to `OfficeScene.tsx`, `AgentInspector.tsx`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `eslintConfig`, `nextConfig`, `name` to the rest of the system?**
  _223 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `OfficeScene.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.14035087719298245 - nodes in this community are weakly interconnected._
- **Should `generate-office.py` be split into smaller, more focused modules?**
  _Cohesion score 0.11904761904761904 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.041666666666666664 - nodes in this community are weakly interconnected._