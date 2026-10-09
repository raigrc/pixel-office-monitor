# Pixel Monitor — Product Requirements

**Document:** Lean PRD · **Updated:** 2026-10-09 · **Status:** Proposed direction, not a claim of implementation

## 1. Product statement

Pixel Monitor is a **local-first visual workspace for coding agents**. A developer can discover, open and control supported agent sessions while a cozy pixel-art world depicts *real* session, tool and subagent activity. It evolves from the existing passive OpenCode monitor without sacrificing truthful events or working functionality.

## 2. Problem and goals

Today, developer-agent activity is scattered across terminals, tools and session histories. Existing Pixel Monitor visualizes OpenCode events but does not yet provide provider-independent session control.

**Goals**

- Resume real work from one place: browse projects and session history, select/create/resume a supported session, send a prompt and inspect the reply/events.
- Observe truth: real root/child sessions, tool calls, agent/subagent identity, outcomes and failures; explicitly show unknown/unavailable information.
- Support more than one coding provider with visible capability limitations.
- Personalize avatars safely: default fallback for unknown agents, persistent user visual profiles and validated sprite uploads.
- Use a memorable, accessible, cozy **2.5D** world as the preferred main visualization.
- Keep existing monitor mode useful while control capabilities arrive.

**Primary user:** A developer who runs multiple local coding agents and wants a unified interactive overview. **Initial deployment:** single-user, local machine; multi-user/cloud access is out of scope.

## 3. Core user journeys

### A. Observe (existing foundation)
1. Start the monitor and an instrumented OpenCode session.
2. See project/root-session grouping and live actors.
3. Inspect activity, delegation, success/error and session metadata.
4. If source details are missing, see “unknown,” not invented progress.

### B. Control a session (planned MVP)
1. Select a connected provider and workspace/project.
2. Browse sessions the provider can actually enumerate, including parents/children where exposed.
3. Open an existing session or create a new one; distinguish unavailable/archived sessions.
4. Type a prompt and submit to that session.
5. Observe the reply and events in a transcript/terminal view and corresponding world behavior.
6. Interrupt if the provider supports it; open/attach a terminal when possible.
7. On reconnect, recover the same session without duplicating prompts or agent arrivals.

### C. Discover and customize an agent (planned)
1. A provider reports an agent name or an observed subagent identity.
2. Unknown identities get a stable, clearly labeled fallback sprite.
3. The user assigns an existing sprite pack or uploads one and previews its poses.
4. The assignment persists without changing the underlying provider identity.

## 4. Priority and release scope

| Priority | Requirement | Acceptance signal |
|---|---|---|
| P0 | Existing OpenCode ingest/SSE monitor survives changes | No loss of existing session/actor/delegation events |
| P0 | Clear provider/session identity and states | No cross-provider collisions or fabricated identities |
| P0 | Safe local control boundary | No arbitrary command endpoint exposed to browser |
| P1 | OpenCode session list/open/create/prompt | A prompt sent in Pixel Monitor reaches the selected *same* session |
| P1 | Live transcript, status and interrupt where supported | UI and underlying provider agree after reconnect |
| P1 | Optional terminal/TUI attach | Attached view refers to the selected session, or clearly says unavailable |
| P1 | Dynamic observed-agent registry + fallback | Unknown agent displays safely, remains recognizable across reload |
| P1 | Sprite-pack import/preview/assignment | Invalid packs rejected with useful diagnostics; assignment persists |
| P1 | Cozy 2.5D replacement path | Session/actor semantics, interaction and performance meet parity gate |
| P2 | Additional provider adapters (start with Kilo) | Capability matrix + real integration tests for each |
| P2 | Session search/filter, history enhancements | Works across supported provider capabilities |
| P3 | Replay and Remotion MP4 export | Deterministic timeline from recorded events, not live world runtime |

**MVP cut line:** OpenCode-backed *session control*, current live monitoring, dynamic agent identity, basic customization, and a functional cozy 2.5D world. Multi-provider breadth and video export should not block first usable release.

## 5. Important behavior rules

- “Detected process” ≠ “connected provider session.” Show each separately.
- Session history is provider-owned. Do not promise histories unavailable through a supported API/CLI.
- Parent session, child session, invocation and actor are different concepts. Preserve their relationships when disclosed.
- Each action must show its capability status: supported, unsupported, requires configuration or error.
- Long-running prompts must offer visible ongoing feedback; on reconnect, reconcile by stable IDs rather than send again.
- Stopping/interrupting a session requires an intentional action and provider support; no hidden automatic process termination.
- Avatar selection never alters session permissions, names or provider configurations.
- Unknown agent identities must never be guessed from appearance or process titles.

## 6. Quality requirements

- Local-first; no hosted account required for initial use.
- Keyboard-accessible controls, reduced-motion mode, readable statuses without reliance on color alone, responsive desktop/mobile **viewing**. Local process launch/control may remain desktop-only.
- Privacy by default: paths/prompts/tool output may be sensitive; avoid unnecessary retention and redact secrets in previews/logs.
- Fast feedback and stable animation; background visual effects never block prompts or event ingestion.
- Preserve tests and regression gates. Measure initial world render, multi-agent load and memory before choosing performance budgets.

## 7. Non-goals

- Replacing all features of OpenCode, Kilo, Codex or Claude clients.
- Universal access to private desktop-app conversations merely because their process exists.
- A public remote shell, multi-user SaaS, hosted execution farm or cross-device remote control for MVP.
- Full 3D asset investment before the chosen 2.5D direction is validated.
- Using Remotion as the interactive rendering/game loop.
- A full plug-in marketplace or AI sprite-generation service in MVP.

## 8. Success criteria

The MVP is complete when a developer can **choose an existing OpenCode session, send a prompt from Pixel Monitor, watch real messages/events and agent activity, reconnect without replaying actions, and customize an observed agent's sprite**, while the prior monitor-only workflow still works.

## 9. Open questions (decide only when implementing)

1. Does the local bridge run as a managed sidecar or inside a packaged desktop runtime?
2. Which provider capabilities are genuinely available by version? Prove each adapter experimentally.
3. What is the smallest local persistent store needed for session index, agent registry and sprite assignments?
4. Should the main world be isometric or a depth-layered oblique room? Validate readability with a small prototype before migration.

See [ARCHITECTURE.md](ARCHITECTURE.md) for boundaries and [../PLAN.md](../PLAN.md) for implementation order.
