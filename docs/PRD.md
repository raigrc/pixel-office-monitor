# Pixel Office Monitor product requirements

Updated 2026-10-10. This reference distinguishes existing local behavior from the proposed controllable workspace. [PLAN.md](../PLAN.md) owns phase status and verification.

## Current product

Pixel Office Monitor is a local OpenCode activity monitor. Instrumented provider events reach a validated ingest API, an in-memory store, and an authenticated SSE client. The UI displays root-session floors, actors, direct delegation, outcomes, inspection, and a layered pixel office or Three.js view.

Existing local multi-session controls group, search, pin, rename, close, follow, compare, and notify about monitor floors. They do not create, resume, prompt, interrupt, or stop provider sessions. Recent completed-session history depends on the in-memory server lifetime.

Settings independently checks a configured OpenCode 1.18.35 server and displays at most 50 persisted session metadata records. Owner-secret unlock is separate from monitor authentication. Saved records do not create floors or establish activity. Native IDs, parent links, creation/update times, and reported archive times remain visible. Missing parent lineage stays unresolved.

The read-only Session Inspector selects an eligible native session and displays bounded recorded messages from an enrolled plugin-free connection. Each page contains at most five chronological messages. Older and Latest replace the page. Recorded tool states are saved facts, not live execution indicators. Prompting, interruption, and terminal attachment remain unavailable.

The local Cozy visual system, role props, session identity, common rooms, and 48px character system are implemented. Final user visual approval remains unresolved. These facts supersede the v2 drafts' older GitHub-only assumptions.

## Target product

The proposed product is a local-first workspace for coding-agent sessions. A developer selects a supported native session, submits a prompt, reads its messages and events, and sees those facts in a cozy pixel world.

The initial user is one developer running local coding tools. Initial deployment is single-user and local. Multi-user hosting and remote process control are outside the MVP.

The remaining target adds these capabilities beyond verified read-only discovery and inspection:

- Broader provider-owned history and listing, session opening for execution, creation, and prompting.
- Transcript, interrupt, and same-session terminal attachment where supported.
- Provider-scoped identities, observed and declared agent definitions, and explicit capability limits.
- Persistent visual assignments and validated character-pack import.
- A proven cozy 2.5D replacement path that preserves current monitor semantics.
- Additional provider adapters after OpenCode control works.
- Optional recorded replay and Remotion video export later.

## User journeys

### Observe existing activity

The developer starts the monitor and an instrumented OpenCode session. A root session appears as a floor, with child actors grouped under that root. Available actor activity, invocation relationships, outcomes, and metadata appear in the UI.

Missing endpoints do not create delegation edges. Unknown or cancelled outcomes do not imply success. An observed orchestrator is distinct from a synthesized coordinator. System actors do not occupy desks.

### Inspect saved messages

The developer unlocks discovery, checks metadata, and chooses Inspect recorded messages. Selection is eligible only while the native session remains in a fresh approved-workspace first page. Scope changes or unavailable selections return no message content.

The Inspector shows escaped recorded text, recorded agent labels, and credential-redacted tool arguments/output. Reasoning, files, media, and raw errors have omission labels. Parent and child navigation uses loaded metadata only, with incomplete-coverage labels. No history read starts provider execution or creates monitor activity.

One disposable page remains in browser memory for at most five minutes, bounded by the owner cookie. Refresh, new reads, failure, Clear, expiry, navigation, and page restoration discard it. No transcript, selection, or continuation enters browser storage. Oversized raw pages fail explicitly.

### Control a session, planned

The developer selects a connected provider, a workspace, and an enumerated native session. The UI distinguishes an unavailable or archived session from an active one. A deliberate submit sends the prompt to that selected session.

The transcript and world reflect reported events. Reconnect reconciles stable IDs without resending prompts. Interrupt and terminal attachment appear only when supported. A new CLI process does not count as attachment to an existing session.

### Customize an observed agent, planned

A provider declares an agent or reports an observed identity. Anonymous actors remain `Unknown Subagent` until reliable metadata arrives. A stable fallback keeps the actor visible.

The user assigns an existing pack or validates and previews an imported one. Assignment persists separately from native provider identity. Avatar choices do not rename agents, change permissions, or alter provider configuration.

## Priorities and acceptance

| Priority | Requirement | Acceptance evidence |
| --- | --- | --- |
| P0 | Preserve existing OpenCode monitoring | No lost session, actor, or delegation facts through migration |
| P0 | Honest identity and state | No cross-provider collisions or invented endpoints, outcomes, or parentage |
| P0 | Protected local control | No arbitrary command endpoint or browser-public privileged credential |
| P1 | OpenCode list, open, create, and prompt | Pixel Monitor sends a prompt to the same selected native session |
| P1 | Transcript, supported interrupt, and recovery | UI and provider agree after disconnect and reconnect |
| P1 | Optional same-session terminal | Attachment identity is proven, or the action is unavailable |
| P1 | Observed registry and fallback | Previously unseen identities remain recognizable after refresh |
| P1 | Pack preview, import, assignment, and reset | Malformed packs fail usefully and valid assignments persist |
| P1 | Cozy 2.5D replacement | Semantics, interaction, accessibility, and measured performance meet parity |
| P2 | Kilo, then other provider adapters | Each adapter has version-specific capability and integration proof |
| P2 | Broader history and search | Results reflect histories actually exposed by supported providers |
| P3 | Replay and video export | Timeline contains recorded events only and passes privacy checks |

The proposed MVP includes OpenCode session control, current monitoring, dynamic identity, basic customization, and a functional cozy world. Additional provider breadth and video export do not block that first usable release. Current monitor completion does not mean this proposed MVP is complete.

## Behavior constraints

- Process detection and connected session state are separate facts.
- Providers own execution and session history. Pixel Monitor cannot promise history unavailable through a supported interface.
- Sessions, actors, invocations, and agent definitions are separate entities.
- Action availability distinguishes supported, unsupported, requires configuration, and error states.
- Prompt submission, launch, interrupt, and termination require explicit user intent and provider support.
- Reconnect never automatically resubmits a prompt.
- Rendering, switching views, and resizing never create provider events.
- Appearance never determines identity or activity.
- Prompt text never supplies missing parentage or delegation endpoints.

## Quality requirements

The initial product works locally without a hosted account. Status remains readable through text and shape, not color alone. Keyboard operation, reduced motion, focus behavior, and responsive desktop and mobile viewing remain required. Local process control can remain desktop-only when capability or security limits require it.

Paths, prompts, and tool output can contain private data. Retention stays bounded and purpose-specific. Previews and reports exclude credentials. The existing browser-visible monitor token is not suitable for the future privileged bridge.

Performance budgets require measurement of initial rendering, crowded scenes, long sessions, and memory. Decorative effects cannot delay ingestion or prompts. Current hidden 2D timers and other known debt remain documented rather than represented as fixed.

## Non-goals

- Replace every OpenCode, Kilo, Codex, or Claude client feature.
- Read private desktop conversations merely because a process exists.
- Expose a public remote shell, multi-user service, hosted execution farm, or cross-device control in the MVP.
- Invest in a full new 3D asset pipeline before validating the chosen 2.5D direction.
- Use Remotion as the interactive live world renderer.
- Build an asset marketplace or AI sprite-generation service for the MVP.

## Completion and open decisions

The proposed MVP is complete only when a developer can reopen a native OpenCode session, prompt it, observe real output, reconnect without replaying actions, and customize an observed agent. The existing monitor-only workflow must still work.

Bridge packaging, persistence, provider capabilities, projection, renderer choice, and asset limits remain undecided. [Architecture](ARCHITECTURE.md) describes the boundaries. [Design](DESIGN.md) describes current art contracts and future comparisons. Phase 0 documentation and cleanup verification is complete. User visual approval remains open.
