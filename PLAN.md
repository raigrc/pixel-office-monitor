# Pixel Office Monitor implementation plan

Updated 2026-10-09. This plan reconciles the local checkout, original local plan, five v2 drafts, and `decisions.tsv`. Phase 0 is documentation and safe archive work only. No future phase is implemented by this pass.

## Status and authority

- `[x]` records completed work supported by evidence.
- `[ ]` records work that is incomplete or not verified.
- Existing implementation means code inspected in this local tree, not a new Phase 0 delivery.
- Historical verification means an earlier local plan or decision-trail result. It is not a fresh browser pass.
- A stop gate remains open until its owner records final results.

The five primary documents are [README.md](README.md), [PRD](docs/PRD.md), [Architecture](docs/ARCHITECTURE.md), [Design](docs/DESIGN.md), and this plan. [Archive inventory](docs/archive/2026-10-09/README.md) preserves the originals. Archived paths and instructions are historical.

## Existing local implementation

The former local roadmap is distinct from the new roadmap below:

| Local milestone | Implementation status and limits |
| --- | --- |
| S0 through R14 | Historical monitor, compatibility ingest, SSE, and early office work. Old room sizes and card-grid descriptions are superseded. |
| Local Phase 1, 1.1, and 1.5 | Renderer-neutral world adapter, Colony placement and fallow history, instancing, resource ownership, shared clock, and staged lighting exist. Historical browser evidence is recorded in the original plan. |
| Local Phase 2.1 and 2.2 | Engine-owned motion, A* routing, ship transit, camera gestures, and reduced-motion behavior exist. |
| Local Phase 2.5 | Shared activity, direct delegation, outcomes, standby, and actor-ID inspection exist. Producer evidence and selected test follow-ups remain open. |
| Local Phase 3 | Grouped multi-session navigation, recent in-memory history, summary comparison, notifications, and stable selection exist. Durable history and cross-tab notification coordination remain deferred. |
| Local Phase 4A through 4C | Cozy theme, shared role props and 3D identity, layered 48px characters, session identity, 512×384 room, responsive framing, and connected common rooms exist. User visual approval remains unresolved. |
| Local Phase 4C visual-match P1 and P2 | Wider composition, 18rem navigator, rear-wall storage, oak floors, rugs, low partitions, and common-room furniture exist. Historical P2 evidence reports 451 tests with two workers and 55 browser assertions across eight captures. |
| Local Phase 4C visual-match P3 through P6 | Cubicle depth, daylight depth, lower label noise, and matched visual acceptance remain unfinished. |
| Local Phase 5 | Hardening, performance, security, and deployment remain future work. |

Existing local Phase 4 is not the new planned Phase 4 renderer migration. Do not reset local progress, revive stale seven-desk or 32px character assumptions, or mark visual approval complete from automated checks.

## Phase 0 progress

Goal. Reconcile documentation and archive audited orphans without changing live behavior.

- [x] Record the main agent's baseline branch `fix/3d-colony-v1` and HEAD `65923b3`. Preserve significant user changes as baseline.
- [x] Reconcile the five v2 drafts with current code, the original local plan, and `decisions.tsv`.
- [x] Preserve byte-exact original README, original PLAN, and five v2 drafts under `docs/archive/2026-10-09/`.
- [x] Establish exactly five primary docs and remove duplicate active v2 drafts.
- [x] Fold useful historical facts and generator instructions into canonical docs and supporting references before archiving old supporting plans.
- [x] Preserve the generated Next.js block in `AGENTS.md`, append project pointers, and retain `CLAUDE.md` as `@AGENTS.md`.
- [x] Reconfirm reference isolation for the fourteen named orphan files. Retain their source content in reversible `.txt` archives outside compilation and lint.
- [x] Verify all fourteen source archives preserve original content. Six are byte-identical; eight differ only by one appended terminal LF. The archive inventory records exact hashes and this accepted historical-formatting difference.
- [x] Record retention decisions for demos, generators, all public assets, `Sprite.tsx`, the Three.js module and test graph, graphify output, backups, and local logs.
- [x] Extend ignore policy for generated development logs, graphify output and caches, and asset backups. Keep existing rules and user data. Do not modify the Git index.
- [x] Audit current Three.js entrypoints and shared dependencies. Record that no explicit experimental flag exists. No flag implementation or 3D removal belongs in Phase 0.
- [x] Record hydration and close-zoom code and unit fixes separately from unverified fresh-browser replay and occlusion acceptance.
- [x] Main agent records final archive integrity, links, scope, tests, TypeScript, lint, and build results.
- [x] Main agent proves real event ingest, actor and delegation rendering, desktop and mobile containment, and current browser limitations.
- [x] Main agent checks configured-token occurrences without printing raw values or removing user data. Zero matches in new documentation and six tracked logs. This does not prove old logs contain no other sensitive data.
- [x] Main agent closes the Phase 0 stop gate after final evidence and independent review. Review found no blocking issue; verification-report cleanup and audit-status gaps were fixed and rechecked.

The baseline default suite passed 450 tests and timed out in one sprite-generator test. The main agent reports 451 tests across 51 files with `--maxWorkers=2`. Baseline lint has zero errors and 31 warnings. Build and TypeScript passed. Captured default-check evidence is under `Temp/opencode/phase0/baseline/`.

Final evidence is recorded under `Temp/opencode/phase0/` and in the archive inventory. Both final test commands pass 451 tests in 51 files. TypeScript and production build pass. Lint passes with zero errors and 20 warnings, down from 31. An initial final lint timeout was resolved by rerunning lint alone.

The final production build passes 19 browser checks on isolated loopback port 3011. A real installed OpenCode CLI 1.18.35 prompt completes with the expected reply and delivers one new floor and 13 actors. Installed-plugin task-hook fixtures prove child grouping, live inspector state, and invocation completion. These fixtures are not a real delegated model run. Desktop and mobile authenticated SSE, full-room containment, refresh, 3D startup, and single-canvas toggling pass without console errors. Arrival animation replay, individual close-zoom occlusion, and final user visual approval remain open.

Phase 0 stop gate is closed. Independent read-only review confirmed the evidence and the main agent verified the follow-up report fixes. No future-phase implementation or user visual acceptance follows from these automated checks.

## New roadmap

Every phase below is planned and unimplemented. Keep the current OpenCode plugin, ingest, memory store, and SSE path working until a replacement proves parity. No bridge, provider adapter, renderer migration, upload UI, persistence rewrite, or Remotion work belongs in Phase 0.

### New Phase 1. Minimal normalized identity and provider contract

- [ ] Define provider-scoped project, session, agent, actor, invocation, and event identities with compatibility for existing OpenCode IDs.
- [ ] Keep missing parents, endpoints, outcomes, and provenance explicit rather than inferred.
- [ ] Define capabilities and typed unsupported or configuration errors from supported provider operations.
- [ ] Test nested sessions, duplicate and reordered events, reconnects, unknown agents, and name collisions across providers.

Stop gate. Existing monitor behavior remains correct. A detected process does not count as a connected session.

### New Phase 2. Local bridge and OpenCode control MVP

- [ ] Run a small capability spike against the installed OpenCode version. Prove enumeration, loading, creation, prompting, interrupt, event streaming, and terminal attachment separately.
- [ ] Add a narrow privileged loopback bridge only where required. Validate origin, authorization, allowed workspace roots, executables, and operations. Do not expose arbitrary shell strings.
- [ ] Add provider, project, and session selection with explicit capability state.
- [ ] Add a prompt composer and transcript bound to the selected native session. Require explicit submit and show failures.
- [ ] Attach a terminal only after proving it is the same session. Unsupported attachment must remain unavailable.
- [ ] Recover connection loss without resubmitting prompts or replaying fake arrivals.

Stop gate. A real OpenCode session can be listed, reopened, and prompted. Provider output and UI identity agree. Security and recovery checks pass. Browser-visible monitor credentials cannot authorize this bridge.

### New Phase 3. Observed registry and sprite personalization

- [ ] Separate provider-declared definitions from runtime-observed identities and preserve provenance.
- [ ] Keep anonymous actors labeled `Unknown Subagent` until reliable metadata arrives.
- [ ] Persist visual assignments independently from provider identity and session data.
- [ ] Build Sprite Studio upload, validation, preview, reset, and assignment using the current 1152×192 RGBA contract first. Frames are 48×48, with 24 columns, four directions, eight poses, and 96 frames.
- [ ] Store imports outside tracked `public/`. Bound decoded dimensions and bytes, validate PNG content and manifests, and never execute uploaded code.

Stop gate. A previously unseen agent stays recognizable after refresh and can receive and reset a validated pack. Malformed imports fail with useful diagnostics. Current shared visitor-seat limits are not a dynamic registry.

### New Phase 4. Cozy 2.5D renderer migration

This phase is not existing local Phase 4 visual identity and polish. The current office already uses explicit depth layers. A new isometric or oblique renderer remains a proposal.

- [ ] Compare the current layered room with two small projection proofs using the same actors, selection, and delegation fixtures.
- [ ] Choose DOM, canvas, or PixiJS only after measuring readability, input, depth sorting, mobile fit, and cost.
- [ ] Preserve stable anchors, walkability, click targets, reduced motion, and observed monitor semantics.
- [ ] Port existing role and session identity, props, statuses, delegation, selection, grouping, and fallbacks.
- [ ] Add art polish only after correctness and performance parity.
- [ ] Audit and separate shared 3D consumers before adding an explicit experimental flag. Preserve 3D and its tests until removal receives explicit approval.

Stop gate. Controlled desktop, mobile, crowded, day, dusk, night, outcome, delegation, selection, and session-switching frames receive user approval. No arrival replay or resource leak occurs on mode changes. Performance meets an agreed measured budget.

### New Phase 5. Additional provider adapters

- [ ] Validate installed Kilo capabilities and transport before implementing the first secondary adapter.
- [ ] Investigate Codex CLI or app-server and Claude supported APIs or hooks separately. Do not promise desktop-app conversation access from process detection.
- [ ] Add provider health and capability displays. Test simultaneous sessions and collisions.

Stop gate. Each provider has a real end-to-end proof and clearly labeled unsupported actions.

### New Phase 6. Optional replay and export

- [ ] Define privacy-safe retention and deterministic recorded-event fixtures.
- [ ] Evaluate Remotion for exported video, not live world rendering.
- [ ] Build replay or export only when a useful product requirement justifies the pipeline.

Stop gate. Output contains recorded events only, with no invented work, credentials, or hidden prompts.

## Open decisions and known debt

- Packaging remains open between a Node sidecar and a desktop runtime.
- Persistence remains open between local metadata storage, including SQLite, and existing Supabase assets. The current monitor store remains memory even when its Supabase helper flag is enabled.
- Projection remains open between 2:1 isometric and oblique layered rooms. Renderer choice is also open.
- Provider capabilities are version-specific and unproven for the new control workflow.
- Task child attribution and parent invocation identity remain producer limitations. Timing and lineage fallbacks are not proof of nested parentage. Failed and cancelled outcomes need captured provider evidence.
- Local Phase 2.5 still has open producer capture, fact-matrix, contract-fixture, pose interruption, component, multi-floor, and standby test follow-ups in the preserved original plan.
- Producer silence and the stale-activity fallback complicate claims of truly idle actors. Missing outcomes stay neutral.
- Current 3D errors use a blocked badge rather than a dedicated error clip.
- Hydration and instance-bounds fixes exist, but fresh-browser 2D-to-3D replay, close zoom, frustum behavior, and furniture occlusion still need verification.
- Modal dialogs restore focus and close on Escape but do not trap Tab.
- Hidden 2D sprites retain timers. Active handoffs update page-level state each animation frame. ThreeSky refreshes PMREM about three times per second, and the renderer retains `preserveDrawingBuffer`.
- The earlier all-in-one 3D capture set exceeded its 120-second limit. Startup proof and previous lighting captures do not replace complete current browser evidence or user approval.
- User approval remains open for local lighting, composition, visual identity, and final 2D and 3D direction. Image 2 visual-match P3 through P6 remain open.
- Durable completion history, cross-tab notification coordination, remote authentication, private read authorization, origin controls, ingest rate limiting, and any live Supabase integration remain deferred.
- Credential rotation is the owner's manual responsibility if prior token-bearing logs contain still-valid credentials. Do not print credentials, sanitize logs, or alter tracked evidence without separate approval.
- Ignore rules do not untrack existing development logs, graphify artifacts, or historical `Temp/opencode/phase4b*` screenshots. No index cleanup happens in this phase.

## Handoff and verification ownership

The main agent owns `decisions.tsv`, the three Phase 0 verification scripts, final checks, and the stop-gate decision. The scripts retain command output and aggregate browser and archive reports under ignored `Temp/opencode/phase0/`. The docs worker did not run a concurrent full suite or build.

Use `npm test`, `npm test -- --maxWorkers=2`, `npx tsc --noEmit`, `npm run lint`, and `npm run build` with recorded results. Use a loopback server isolated from user port 3001 for browser proof. Preserve user changes and compare the scoped diff with the baseline before any later commit. No commit or PR is authorized by this phase.

Phase 0 is complete. A small OpenCode capability spike follows only after the owner's Phase 0 approval and separate authorization. No later phase was started.
