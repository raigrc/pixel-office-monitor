# Graph Report - pixel-office-monitor  (2026-09-08)

## Corpus Check
- 79 files · ~58,257 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 670 nodes · 1184 edges · 40 communities (33 shown, 7 thin omitted)
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
- AgentTooltip.tsx
- DeskProps.tsx
- ErrorBoundary
- ActorInfo
- getSnapshot
- layout.tsx
- ErrorBoundary
- MonitorScreen.tsx
- AGENTS.md
- eslint.config.mjs
- next.config.ts
- postcss.config.mjs
- types.d.ts
- agents

## God Nodes (most connected - your core abstractions)
1. `rect()` - 27 edges
2. `save()` - 26 edges
3. `main()` - 26 edges
4. `rect()` - 21 edges
5. `px()` - 18 edges
6. `px()` - 17 edges
7. `gen_monitors()` - 17 edges
8. `upsert()` - 16 edges
9. `compilerOptions` - 16 edges
10. `getState()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `AgentActorProps` --references--> `Point`  [EXTRACTED]
  src/components/scene/AgentActor.tsx → src/lib/scene/office-layout.ts
- `CharacterSpriteProps` --references--> `Point`  [EXTRACTED]
  src/components/scene/CharacterSprite.tsx → src/lib/scene/office-layout.ts
- `GET()` --calls--> `getState()`  [EXTRACTED]
  src/app/api/state/route.ts → src/lib/monitor-store.ts
- `AgentInspectorProps` --references--> `CubicleDTO`  [EXTRACTED]
  src/components/AgentInspector.tsx → src/lib/monitor-store.ts
- `CubicleCardInner()` --calls--> `getAgentMeta()`  [EXTRACTED]
  src/components/CubicleCard.tsx → src/lib/agents.ts

## Import Cycles
- None detected.

## Communities (40 total, 7 thin omitted)

### Community 0 - "OfficeScene.tsx"
Cohesion: 0.18
Nodes (12): OfficeGrid, OfficeGridInner(), OfficeGridProps, VacantCubicle(), VacantCubicleProps, cubicleFrameVariants, cubicleVariants, entranceDelay() (+4 more)

### Community 1 - "generate-office.py"
Cohesion: 0.12
Nodes (48): circle(), gen_chair(), gen_clipboard(), gen_coffee_cup(), gen_coffee_machine(), gen_desk_front(), gen_desk_rear(), gen_door_closed() (+40 more)

### Community 2 - "devDependencies"
Cohesion: 0.04
Nodes (47): eslint, eslint-config-next, motion, next, dependencies, motion, next, react (+39 more)

### Community 3 - "Pixel Office Monitor"
Cohesion: 0.06
Nodes (32): 1. Clone & enter, 2. Environment, 3. Plugin locations, 4. Install, Adding a New Agent Prop, API Reference, Architecture, Background Tiles (+24 more)

### Community 4 - "generate-assets.py"
Cohesion: 0.12
Nodes (38): _blueprint_screen(), _build_screen(), _checklist_screen(), _code_screen(), _doc_screen(), _docs_screen(), gen_cubicle_frame(), gen_door_tile() (+30 more)

### Community 5 - "monitor-store.ts"
Cohesion: 0.12
Nodes (30): connectionsPerIP, deriveActorState(), emitEvent(), emitSSEEvent(), ensureActor(), ensureFloor(), ensureInvocation(), ensureSession() (+22 more)

### Community 6 - "compilerOptions"
Cohesion: 0.06
Nodes (33): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+25 more)

### Community 7 - "Pixel Office Monitor — Build Plan & Checklist"
Cohesion: 0.05
Nodes (39): 0. How to use this file, 10. Run Log, 1. Verified Agent → Sprite Mapping, 2. Design Tokens (ui-ux-pro-max verified), 3. Architecture, 4. Sprints & Checklist, 5. Task Breakdown (small tasks — no hallucination), 6. Ownership (assemble-team roster) (+31 more)

### Community 8 - "HandoffScheduler"
Cohesion: 0.26
Nodes (9): FloorContextMenuProps, FloorSwitcher(), FloorSwitcherProps, FloorTabs(), FloorTabsProps, formatProject(), formatSince(), formatTitle() (+1 more)

### Community 9 - "schema.ts"
Cohesion: 0.10
Nodes (20): AnyIngestPayload, anyIngestPayloadSchema, ingestDetailSchema, ingestDetailV2Schema, IngestKind, ingestKindSchema, IngestKindV2, ingestKindV2Schema (+12 more)

### Community 10 - "Pixel Art Assets — R6–R10 (2026-09-05)"
Cohesion: 0.10
Nodes (20): Animation Classes (globals.css), Asset Inventory, Assumptions / Not Verified, Background Tiles (`public/sprites/`), Component Integration, Cubicle Frames (`public/sprites/`), Desk Props (`public/sprites/props/`), How to Add a New Agent Prop (+12 more)

### Community 11 - "Sprite.tsx"
Cohesion: 0.17
Nodes (18): AGENT_CFG, AgentCfg, applyBase(), buildMatrix(), CHAR_TO_HEX, createEmpty(), fillRect(), getAnimationClass() (+10 more)

### Community 12 - "route.ts"
Cohesion: 0.07
Nodes (27): AgentInspector(), AgentInspectorProps, redactPathsInPrompt(), AgentActor(), AgentActorProps, AnimationState, FrameData, Pose (+19 more)

### Community 13 - "page.tsx"
Cohesion: 0.11
Nodes (13): convertV2ToLegacy(), Home(), redactPathsInPrompt(), ErrorBoundary, Props, State, HeaderProps, SseDisplayStatus (+5 more)

### Community 14 - "OfficeGrid.tsx"
Cohesion: 0.20
Nodes (8): FloorPreview, FloorPreviewProps, MiniCubicle(), AGENT_IDS, AGENT_MAP, AgentMeta, getAgentMeta(), INTERN_META

### Community 15 - "generate-sprites.py"
Cohesion: 0.29
Nodes (13): circle(), draw_body(), draw_character_frame(), draw_head(), ensure_dirs(), generate_character_sprite_sheet(), main(), px() (+5 more)

### Community 16 - "getState"
Cohesion: 0.21
Nodes (13): extractToken(), getExpectedToken(), POST(), extractToken(), getExpectedToken(), PATCH(), closeFloor(), getState() (+5 more)

### Community 17 - "CubicleCard.tsx"
Cohesion: 0.16
Nodes (16): extractToken(), GET(), getExpectedToken(), POST(), checkDedupe(), getDedupeIndex(), getEventsSince(), getLatestEvent() (+8 more)

### Community 18 - "monitor-store.test.ts"
Cohesion: 0.33
Nodes (8): GET(), getActiveSSEConnections(), getFloorsCount(), getSSEMetrics(), getUptimeMs(), IngestPayload, makePayload(), _makePayloadWithDetail()

### Community 19 - "route.ts"
Cohesion: 0.20
Nodes (11): extractToken(), GET(), getExpectedToken(), sanitizeEventPayload(), sanitizeInvocation(), checkAndIncrementIPConnection(), decrementIPConnection(), decrementSSEConnections() (+3 more)

### Community 20 - "FloorPreview.tsx"
Cohesion: 0.20
Nodes (6): CubicleCard, CubicleCardInner(), CubicleCardProps, truncate(), CubicleFrameProps, SpeechBubbleProps

### Community 21 - "AgentTooltip.tsx"
Cohesion: 0.67
Nodes (3): AgentTooltip(), AgentTooltipProps, truncate()

### Community 22 - "DeskProps.tsx"
Cohesion: 0.24
Nodes (8): DeskProps, DeskPropsInner(), DeskPropsProps, AGENT_PROPS, AgentPropsConfig, getAgentProps(), INTERN_PROPS, PropDef

### Community 24 - "ActorInfo"
Cohesion: 0.07
Nodes (34): OfficeScene(), OfficeSceneProps, CameraZoomContext, SceneViewport(), SceneViewportProps, useCameraZoom(), ActorInfo, FloorInfo (+26 more)

### Community 25 - "getSnapshot"
Cohesion: 0.23
Nodes (7): extractToken(), GET(), getExpectedToken(), buildSnapshot(), _clearStore(), getSnapshot(), IngestPayloadV2

### Community 26 - "layout.tsx"
Cohesion: 0.33
Nodes (4): inter, metadata, pressStart, vt323

### Community 28 - "ErrorBoundary"
Cohesion: 0.25
Nodes (7): Assumptions / not verified in this pass, Before / After (what changed), Decisions, Files, Office Revamp — Sprint R1–R5 (2026-09-05), Run log excerpt (verified 2026-09-05, revamp code — build not re-run in doc pass), Verification

### Community 37 - "types.d.ts"
Cohesion: 0.50
Nodes (3): LS_KEYS, SettingsPage(), useBoolSetting()

## Knowledge Gaps
- **227 isolated node(s):** `eslintConfig`, `nextConfig`, `name`, `version`, `private` (+222 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PresentationController` connect `ActorInfo` to `page.tsx`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `ActorInfo` connect `ActorInfo` to `monitor-store.ts`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `InvocationInfo` connect `ActorInfo` to `monitor-store.ts`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `eslintConfig`, `nextConfig`, `name` to the rest of the system?**
  _227 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `generate-office.py` be split into smaller, more focused modules?**
  _Cohesion score 0.11510204081632654 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.041666666666666664 - nodes in this community are weakly interconnected._
- **Should `Pixel Office Monitor` be split into smaller, more focused modules?**
  _Cohesion score 0.058823529411764705 - nodes in this community are weakly interconnected._