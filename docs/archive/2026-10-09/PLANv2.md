# Pixel Monitor — Active Implementation Plan

**Version:** Draft re-baseline · **Updated:** 2026-10-09 · **Scope:** Small, verifiable changes to an already-built project

> **Do not use this draft to overwrite local progress blindly.** It was prepared using the GitHub `master` snapshot last pushed 2026-09-10 and the owner's later reports. The local working tree, including any uncommitted Phase 4 changes and `decisions.tsv`, was not available. Reconcile `git status`, actual tests and local docs before applying.

## 1. Direction and current baseline

**Current product:** A real-time OpenCode monitor with session grouping, actor/delegation events, SSE, a pixel-art 2D office and an experimental Three.js view. The owner has reported later improvements to 2D/3D roles, 3D movement, visual identity and multi-session UX; confirm locally.

**Target product:** Local-first coding-agent control center with session history and prompting, provider adapters, discovered agents, personalized sprite packs and a cozy 2.5D world. **Remotion replay/export is optional and later.**

**Boundaries:** Preserve the current OpenCode plugin → ingest → store → SSE flow until a replacement demonstrates parity. Do not implement multi-provider, 2.5D migration or an asset-management platform during code cleanup. Protect port 3001. Changes to monitored sessions/processes require explicit user action.

## 2. Progress legend

- `[x]` = demonstrated and verified in the current working tree.
- `[ ]` = not yet verified or completed.
- `LOCAL CHECK` = owner has reported completion, but this draft could not inspect those changes.
- `STOP GATE` = tests + targeted manual proof before the next batch.

Prior S0–R14 and Phase 1–4 work remains in Git history and existing notes. Do not copy all historical task checklists here.

## Phase 0 — Baseline, documentation and safe cleanup **(NEXT)**

**Goal:** Make the current code/documentation trustworthy without behavioral changes.

- [ ] Capture `git status`, branch, last commit, `npm test`, TypeScript, lint and build results from the **local** checkout; record test counts and current warnings (not old reports).
- [ ] Compare this 5-document draft against current local code and existing `PLAN.md` / `decisions.tsv`. Merge locally completed Phase 4 facts; preserve unresolved decisions.
- [ ] Backup/archive the old README/PLAN and relevant `docs/` notes in Git history or a compact `docs/archive/`; avoid keeping duplicate active specs.
- [ ] Keep exactly five primary docs: `README.md`, `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN.md`, `PLAN.md`.
- [ ] Keep `AGENTS.md` and `CLAUDE.md` as small tool instruction entrypoints. Preserve the auto-generated Next.js guidance in `AGENTS.md` where needed.
- [ ] Audit `dev.log`, `dev-test.log`, `graphify-out/`, `scripts/asset-backups/`, demos, obsolete cubicle components, duplicate assets, old generators and unreachable routes. Check references/ownership before marking dead.
- [ ] Review `.gitignore` for generated logs/cache/temporary visual evidence; never commit credentials or raw sensitive transcripts. If tracked files should stop tracking, preserve necessary user data and avoid accidental destructive deletion.
- [ ] Audit Three.js dependencies before freezing it behind an explicit experimental flag. **Do not delete 3D or shared scene modules yet.**
- [ ] Record known 2D↔3D replay and close-zoom defects as verified/unverified against current local code; if 3D is retired, prioritize only shared-state correctness and security.

**STOP GATE:** Tests/TypeScript/build as good as baseline; no new lint errors; current monitor ingests real events and still renders session/actor/delegation; desktop/mobile scenes open; no exposed secrets; docs link correctly. **Do not claim cleanup has been executed merely because these docs exist.**

## Phase 1 — Minimal normalized identity and provider contract

**Goal:** Prepare multi-provider semantics *without* replacing the existing monitoring transport.

- [ ] Define provider-scoped project/session/agent/actor/invocation IDs; preserve existing OpenCode IDs through a compatibility migration.
- [ ] Represent real `parentSessionId`, invocation parentage and unknown nullable sender/recipient/outcome honestly.
- [ ] Add a capability descriptor for provider operations; error explicitly on unsupported actions.
- [ ] Test normalization with nested sessions, duplicate events, reconnects, unknown agents and similar agent names across providers.

**STOP GATE:** Existing OpenCode events and historical view remain correct. No “automatic detected process = active session” inference.

## Phase 2 — Local bridge + OpenCode control MVP

**Goal:** One provider is controllable from Pixel Monitor before adding more.

- [ ] Spike the installed OpenCode version: enumerate/load/create sessions, submit prompt, interrupt, stream messages and attach TUI. Document *actual supported* operations.
- [ ] Implement a narrow loopback privileged bridge only where necessary: validated origins/authorization/workspace boundaries, allowlisted operations, no arbitrary shell endpoint.
- [ ] Add provider/project/session selector; readable current session state and capability availability.
- [ ] Add prompt composer and transcript tied to the selected native session. Require explicit submit and show request errors/status.
- [ ] Add optional terminal attachment only after demonstrating it is the **same** session; avoid accidental new sessions.
- [ ] Reconcile connection loss without re-sending prompts or replaying fake arrivals; keep current ingest/SSE monitoring operational.

**STOP GATE:** Real OpenCode session can be listed, reopened and prompted from Pixel Monitor; the provider and UI agree on identity/output; a separate terminal can attach *if supported*; unsupported operations say so; permission/security tests and manual recovery pass.

## Phase 3 — Observed agent registry + sprite personalization

**Goal:** No hardcoded-role dependency for visual representation.

- [ ] Register provider-declared and runtime-observed agent definitions separately with provenance; use stable provider-scoped keys.
- [ ] Keep anonymous actors as `Unknown Subagent` until reliable identity metadata arrives; render a stable fallback.
- [ ] Persist visual profile assignment independently of provider session data.
- [ ] Implement Sprite Studio with upload/validation/preview/reset using the current 768×128, 32×32, 4-direction, 8-pose contract first.
- [ ] Store imported assets outside repository `public/`, constrain bytes/dimensions and validate decoded PNG.

**STOP GATE:** New previously unseen agent appears safely, remains recognized after refresh, can be assigned a pack and restored; fallback and malformed pack tests pass.

## Phase 4 — Cozy 2.5D migration (small proof first)

**Goal:** Replace the primary world view **only after** proving clarity and parity; keep the operating UI intact.

- [ ] Build one screen-sized spike: same monitored actors and statuses shown in current 2D vs prospective 2.5D (isometric or oblique). Evaluate actor readability/selection/depth sorting on desktop/mobile.
- [ ] Select world renderer (PixiJS is a candidate, not preapproved); justify dependency and rendering cost with evidence.
- [ ] Implement stable desk/agent anchors, camera/framing, walkability and click targets; preserve monitor semantics and reduced motion.
- [ ] Port existing visual identity, role props, statuses, delegation, selection, session grouping and fallback agents.
- [ ] Add cozy tile/prop/palette polish **after** correctness and performance parity.
- [ ] Freeze 3D behind a flag after consumers/shared dependencies are untangled. Preserve its Git history; remove only after explicit approval.

**STOP GATE:** Day/night, mobile, crowded, idle/working/error/success, delegation, selection, dynamic agent and session switching screenshots approved; monitoring truth unchanged; no renderer leak or repeated arrival on mode change; performance equal or acceptable to baseline.

## Phase 5 — Additional provider adapters

**Goal:** Expand breadth only after OpenCode vertical slice proves architecture.

- [ ] Validate Kilo's actual installed transport and capabilities; implement and test first secondary adapter.
- [ ] Separately investigate Codex CLI/app-server and Claude supported APIs/hooks; do not promise desktop-app introspection.
- [ ] Add provider connection/health UI and explicit action capability matrix; test name collisions and simultaneous sessions.

**STOP GATE:** Each integrated provider has a real end-to-end proof and clearly labeled unsupported actions. Provider process detection alone does not count as session integration.

## Phase 6 — Optional replay/export (later)

- [ ] Define privacy-safe event retention and deterministic replay fixtures.
- [ ] Evaluate Remotion **for rendering exported video**, not for live 2.5D world animations.
- [ ] Implement only if a useful product goal justifies the asset/render pipeline.

**STOP GATE:** Replays show recorded events only; export has no fictitious work, credentials or hidden prompts.

## 3. Prioritized defects/debt

| Item | Action | Why |
|---|---|---|
| 2D↔3D toggle replays arrivals | Verify local fix, then preserve world hydration semantics across views | View switching must not create work history |
| Close zoom hides 3D agents | Verify local state; fix only if 3D remains usable during transition | Separate camera/frustum regression |
| Fixed known-role roster / shared unknown desk | Replace incrementally in Phase 3 | Observed agents need stable identities |
| Old docs and legacy cubicle code | Audit in Phase 0, delete only after reference tests | Avoid dead code and accidental regressions |
| Browser-readable token/dev fallback | Redesign before privileged control | Existing local monitor auth insufficient for process execution |
| In-memory state and optional Supabase migration | Decide persistence by need, not by presence of migration file | Avoid speculative schema rewrite |

## 4. Required checks for every change batch

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Use isolated verification server (e.g. port 3011) if port 3001 belongs to the user. Stop only the isolated server. For behavioral changes, test real OpenCode plugin events and refresh/reconnect. For visual changes, capture controlled screenshots (desktop, mobile, reduced motion and meaningful states) under ignored local `Temp/` only if appropriate; report their paths and visual limitations.

**Commit discipline:** Small commits after verified gates, no automatic `git add .` if logs/secrets/generated evidence may be present. Explicitly review staged files. Never overwrite the owner's local `PLAN.md` or `decisions.tsv` without merging later changes.

## 5. Implementation order (single next task)

**Next task is Phase 0 only.** First reconcile this draft with local files and audit cleanup candidates; do **not** start the bridge, provider integration, renderer migration or Remotion in the same pass. After Phase 0 approval, run a *small* OpenCode capability spike to de-risk Phase 2 before building broad abstractions.

## 6. Decisions intentionally deferred

- Process packaging: Node sidecar vs desktop shell (no need to decide during documentation cleanup).
- Persistence: SQLite/local metadata vs existing optional Supabase assets.
- 2.5D look: 2:1 isometric vs oblique/three-quarter projection.
- Rendering library: remain DOM/canvas vs PixiJS, based on prototype.
- Provider integration: version-specific operations and supported desktop-app control.

These questions should be resolved by tests in their phase—not by speculative folders, empty interfaces or extra documents.
