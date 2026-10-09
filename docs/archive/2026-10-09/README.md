# Phase 0 archive inventory

Archived 2026-10-09 from the local working tree on `fix/3d-colony-v1`, HEAD `65923b3`. Existing user edits are the baseline, including changes not present in HEAD. This archive is supporting evidence, not an active product specification.

The five primary documents are [README](../../../README.md), [PLAN](../../../PLAN.md), [PRD](../../PRD.md), [Architecture](../../ARCHITECTURE.md), and [Design](../../DESIGN.md). [Character sprite reference](../../character-sprite-system.md), [contact sheet](../../character-sprites-contact-sheet.png), and [row index](../../character-sprites-contact-sheet.json) are supporting references.

## Verification status

Phase 0 cleanup and monitoring verification are complete. The main agent ran final checks and recorded the evidence below and in `decisions.tsv`. Future renderer acceptance and user visual approval remain separate open work.

All seven original primary documents and all three old supporting plans match their pre-move raw Git blob hashes. Six source archives also match. Eight source archives differ by one appended LF because `apply_patch` adds a terminal newline when the original lacks one. Every original source byte remains intact. The main agent accepts this documented formatting difference for the reversible historical archive; it does not change executable source.

The differing source hashes exactly equal each original Git blob plus one LF. `scripts/audit-phase0.mjs` verifies raw hashes and the precise terminal-LF difference. No shell file write, copy, move, or index change was used for archival edits. The original bytes are recoverable by removing that terminal LF, or from the listed Git blobs. These eight archives are content-preserving, not byte-identical.

## Original primary documents

These are exact local originals, including the user's local plan updates and the five GitHub-based draft files. Internal links, old paths, commands, counts, and credentials-related warnings remain historical text. They are not current setup instructions. Archived v2 drafts are not active duplicates.

| Original path | Archive | Pre-move raw Git blob hash |
| --- | --- | --- |
| `README.md` | [README.original.md](README.original.md) | `0fc6872ee2882439709227cee6a3f24f4012c88c` |
| `PLAN.md` | [PLAN.original.md](PLAN.original.md) | `8a780321738e8daf7ec4b1d5d4d54b2dea9b10d5` |
| `READMEv2.md` | [READMEv2.md](READMEv2.md) | `c8ddb31fccb3a04243ee90846f004de4951b503f` |
| `PLANv2.md` | [PLANv2.md](PLANv2.md) | `c944417fa8ce028fade4f2534127e642695d27a0` |
| `docs/PRDv2.md` | [PRDv2.md](PRDv2.md) | `228a35f5219167b198699ae6f46b4a67c2a1d7a1` |
| `docs/ARCHITECTUREv2.md` | [ARCHITECTUREv2.md](ARCHITECTUREv2.md) | `d352f7ec6d04b491b575d508bdbf1a328f90996a` |
| `docs/DESIGNv2.md` | [DESIGNv2.md](DESIGNv2.md) | `ca0b6a5f6bb9b8b1606c82f3547b27e27bbb87e8` |

Reconciliation uses the inspected local tree and the decision trail through the 2026-09-13 common-room work. Existing local Phase 4 is visual identity and polish. New planned Phase 4 is a possible renderer migration. User visual approval remains open for both existing art and future direction.

## Old supporting plans

Useful current facts and generator ownership were folded into canonical docs before these moves. Detailed obsolete component instructions remain in the originals for historical lookup only.

| Original path | Archive | Retained useful facts | Pre-move raw Git blob hash |
| --- | --- | --- | --- |
| `docs/3d-view-plan.md` | [3d-view-plan.md](3d-view-plan.md) | Three.js ownership, retained scene graph, camera, movement, resources, and historical proposal limits in Architecture and PLAN | `ffd9ce555792968fbf10c99f8fc70e386befc5f1` |
| `docs/office-revamp.md` | [office-revamp.md](office-revamp.md) | Page-owned header and historical card-grid origins in Architecture and Design | `8114639b1d47c4fb394eb43aedfd8f53a9aa1005` |
| `docs/pixel-art-assets.md` | [pixel-art-assets.md](pixel-art-assets.md) | Generator commands, current common-room dimensions, asset ownership, retention, and corrected legacy inventory in README and Design | `c53c5d16469387c6336500e44074236472924d00` |

The legacy asset generator produces three background tiles, two cubicle frames, 23 props, and 15 monitor screens. The old note's five-tiles-plus-two-frames arithmetic is not the current inventory. Existing art and generation commands remain supported, but archived `DeskProps` and card-grid extension instructions are obsolete.

## Dead-code audit and source archive

The docs worker reconfirmed symbol and module-path references in `src/` and scripts before moving the named files. Imports into the old card UI remained inside the archive candidate island. There were no live route, demo, scene, test, or generator consumers of these fourteen files. After moving them, the only candidate-name match in live `src/` is a historical `CubicleCard` comment in retained `Sprite.tsx`, not an import.

The old dependency island is `OfficeGrid` to `CubicleCard`, `VacantCubicle`, and `animation-variants`. `CubicleCard` imports `CubicleFrame`, `AgentTooltip`, `SpeechBubble`, `DeskProps`, `MonitorScreen`, and retained `Sprite`. `FloorTabs`, `FloorPreview`, `OfficeFloor`, `OfficeBackground`, and `AgentActor` have no live importer. Outgoing imports from archived files do not make those archived files live.

Exactly fourteen named source files moved under `legacy-source/<original-path>.txt`. Source extensions remain before `.txt`, so these are historical text rather than compiled or linted TypeScript modules. The moves are reversible. No live module or test was migrated to consume the archive.

| Original path | Archived source | Pre-move raw Git blob hash | Byte result |
| --- | --- | --- | --- |
| `src/components/OfficeGrid.tsx` | [OfficeGrid.tsx.txt](legacy-source/src/components/OfficeGrid.tsx.txt) | `2ee46cc97831b07892741e842ba93cf5416946ce` | One terminal LF appended |
| `src/components/CubicleCard.tsx` | [CubicleCard.tsx.txt](legacy-source/src/components/CubicleCard.tsx.txt) | `7214eb16104ab7797d8e21f3dc1e023e5420e55d` | One terminal LF appended |
| `src/components/CubicleFrame.tsx` | [CubicleFrame.tsx.txt](legacy-source/src/components/CubicleFrame.tsx.txt) | `5685d3c12def5116f400863d8f34208daaca6b1e` | One terminal LF appended |
| `src/components/AgentTooltip.tsx` | [AgentTooltip.tsx.txt](legacy-source/src/components/AgentTooltip.tsx.txt) | `fcfc0a61893ad2ee043eb07d5e0a060f035dc8d2` | Exact hash match |
| `src/components/SpeechBubble.tsx` | [SpeechBubble.tsx.txt](legacy-source/src/components/SpeechBubble.tsx.txt) | `8e0a9a198286460467f6de2261d1b1925fdceb25` | One terminal LF appended |
| `src/components/DeskProps.tsx` | [DeskProps.tsx.txt](legacy-source/src/components/DeskProps.tsx.txt) | `417dca697c66c748a970e9a93bd7dee1d6e6d639` | One terminal LF appended |
| `src/components/MonitorScreen.tsx` | [MonitorScreen.tsx.txt](legacy-source/src/components/MonitorScreen.tsx.txt) | `fa5bffb1d24043fbb10f48a4643da8b8cff94712` | One terminal LF appended |
| `src/components/VacantCubicle.tsx` | [VacantCubicle.tsx.txt](legacy-source/src/components/VacantCubicle.tsx.txt) | `f46894040a861c306020d2f7b105daf060156ed1` | Exact hash match |
| `src/components/FloorTabs.tsx` | [FloorTabs.tsx.txt](legacy-source/src/components/FloorTabs.tsx.txt) | `6cdeaae802ff295126b89e2661df27e75dbd771c` | Exact hash match |
| `src/components/FloorPreview.tsx` | [FloorPreview.tsx.txt](legacy-source/src/components/FloorPreview.tsx.txt) | `8e137f0482cd58ac1e468ba58c3445a6d9774686` | One terminal LF appended |
| `src/components/OfficeFloor.tsx` | [OfficeFloor.tsx.txt](legacy-source/src/components/OfficeFloor.tsx.txt) | `d1fe67096fd35a44c5ca96d1c07de7c2d67e4da6` | Exact hash match |
| `src/components/OfficeBackground.tsx` | [OfficeBackground.tsx.txt](legacy-source/src/components/OfficeBackground.tsx.txt) | `f0b3eed7dcf12cb42e7d350a822d5e3391d6c8e8` | Exact hash match |
| `src/lib/animation-variants.ts` | [animation-variants.ts.txt](legacy-source/src/lib/animation-variants.ts.txt) | `87b57f9afb1c9f751ee08882aa7d080d67506cde` | One terminal LF appended |
| `src/components/scene/AgentActor.tsx` | [AgentActor.tsx.txt](legacy-source/src/components/scene/AgentActor.tsx.txt) | `468a5696e05a4f3092f27a2b8649dc9e83d4cf1b` | Exact hash match |

Use `git hash-object --no-filters <archive-path>` to compare actual bytes with the table. These are Git blob hashes, not SHA-256 file digests. No source file is claimed byte-exact when its hash differs.

## Retention decisions

| Item | Decision and evidence |
| --- | --- |
| `src/components/Sprite.tsx` | Keep. `agent-animations.ts` imports its live `SpriteState` type, and `DeskDecor` consumes that animation module. A legacy-looking component is not an orphan when its type has a live consumer. |
| `/demo`, `/character-demo`, and `/settings` | Keep live routes and their source. They support asset, pose, settings, and visual review. |
| `generate-assets.py`, `generate-office.py`, `generate-sprites.py`, and `cozy_theme.py` | Keep all generators. README preserves runnable commands and overwrite warnings. |
| All `public/` assets | Keep. External URL use is uncertain, including legacy monitor PNGs. `globals.css` still references `floor-tile.png`. No duplicate-asset deletion occurs. |
| `assets/characters/` | Keep source layers, recipes, provenance, contract, and user work. Current contract is 48px frames, 1152×192 RGBA, 96 frames. |
| Character reference and contact sheet | Keep as supporting references to Design. They are not additional primary specifications. |
| Three.js and entire scene, world, shared module, and test graph | Keep. Three.js 0.186, `ThreeCanvas`, engine and barrel exports, settings, lighting, theme, and identity modules have active consumers or tests. Obsolete allocation helpers with tests remain. No feature flag, module pruning, test deletion, or dependency change occurs. |
| `graphify-out/` | Preserve in place. Existing graph and historical September 8 output are stale archival cache, not authoritative current source topology. No rebuild, deletion, or move occurs. Ignore additions affect future untracked output only. |
| `scripts/asset-backups/` | Preserve user-owned local backups. Ignore future untracked backups, not canonical source art. |
| `dev*.log` and other local logs | Preserve without reading raw sensitive contents. Add narrow generated-development-log policy. Existing tracked logs remain tracked. Credential rotation stays manual if old credentials remain valid. |
| Existing `Temp/opencode/` screenshots and evidence | Preserve. Existing ignore rule does not untrack historical tracked screenshots, including Phase 4B captures. No Git index cleanup occurs. |
| External OpenCode plugins | Preserve untouched. Owner confirms external installation, including user-global plugins. No duplicate-mirror equality claim occurs. |
| `.env.example` and `.env.local` | Preserve locally and keep ignored by `.env*`. The template exists locally, but its contents were not exposed or approved for allowlisting. README also gives placeholder-only configuration independent of the template. |
| Existing deletion of `src/lib/scene/building-shader.ts` | Preserve as baseline user change. It is not one of this worker's archival moves and must not be attributed to Phase 0 cleanup. |

The ignore additions cover root `dev*.log`, root `graphify-out/`, root `.graphify*` caches, and `scripts/asset-backups/`. Existing rules remain. Ignoring tracked files does not remove them from history or the index.

## Reconciled current facts

- The product observes OpenCode events. Browser controls mutate monitor floors, not provider sessions.
- The current room is a 512×384 explicit layered scene with sixteen desk anchors, eleven default desks, four optional role seats, one shared unknown visitor seat, and a separate observed orchestrator.
- Twenty-two generated character atlases cover 21 registered keys plus fallback. Each atlas is 1152×192 RGBA with 48×48 frames, 24 columns, four directions, eight poses, and 96 frames. Forty-eight permanent source layers feed generation.
- Current and proposed initial compatible upload contracts use those 48px dimensions. Old 32px and 768×128 draft text remains only as labeled history.
- Supabase flag helpers and migration exist, but enabled ingest delegation is a placeholder. Runtime monitor storage remains in-process memory.
- After first activation, 3D stays mounted and pauses while hidden. Hidden 2D sprite timers stay active. No explicit experimental feature flag exists.
- Existing hydration and moving-instance bounds fixes have source and unit coverage. Current browser replay, close zoom, and occlusion are still unverified.
- Local Phase 4 theme, role props, session identity, and common rooms exist. New Phase 4 projection and renderer migration remains unimplemented. User visual approval is unresolved.

## Baseline verification facts

The main agent captured default gates before this docs and archive pass. The docs worker inspected `Temp/opencode/phase0/baseline/results.json` and the relevant summary lines in its logs.

| Check | Baseline result | Evidence |
| --- | --- | --- |
| Branch and HEAD | `fix/3d-colony-v1`, `65923b3` | Main capture and worker's read-only Git check |
| `npm test` | 450 passed, one failed on sprite-generator timeout, 51 files | `Temp/opencode/phase0/baseline/test.log` |
| `npm test -- --maxWorkers=2` | 451 passed across 51 files | Main agent's supplied result, not a worker-run check |
| `npm run lint` | Zero errors and 31 warnings | `Temp/opencode/phase0/baseline/lint.log` |
| `npm run build` | Passed | `Temp/opencode/phase0/baseline/build.log` and `results.json` |
| `npx tsc --noEmit` | Passed | `Temp/opencode/phase0/baseline/typescript.log` and `results.json` |

Earlier local plans record browser checks through 2026-09-13, including a P2 set of eight 2D captures and 55 assertions. Those are historical evidence, not a fresh Phase 0 browser run. The default generator timeout must not be rewritten as an unrestricted clean test result.

## Worker checks and final stop gate

The docs worker loaded poteto-mode, technical-writing, and unslop, and read installed Next.js installation, project-structure, and environment-variable guides. Direct source checks reconfirmed the orphan island, live `SpriteState` consumer, CSS tile reference, Supabase placeholder, retained 3D lifecycle, current geometry, and sprite manifest ownership.

Read-only Git checks covered branch, HEAD, status, archive blob hashes, and whitespace. All edits and moves used `apply_patch`. No package, configuration, live application logic, runtime test, generator, public asset, external plugin, verification script, or decision-trail edit belongs to this worker's changes.

The main agent verified the final production build on isolated loopback port 3011. User port 3001 and external plugins were preserved. Browser reports contain check names and aggregate diagnostics rather than raw provider output or credentials.

| Final check | Result | Evidence |
| --- | --- | --- |
| `npm test` | 451 passed in 51 files | `Temp/opencode/phase0/final/test.log` |
| `npm test -- --maxWorkers=2` | 451 passed in 51 files | `Temp/opencode/phase0/final/bounded-test.log` |
| `npx tsc --noEmit` | Passed | `Temp/opencode/phase0/final/typescript.log` |
| `npm run lint` | Zero errors, 20 warnings; initial timeout recovered on isolated rerun | `Temp/opencode/phase0/final/lint.log` |
| `npm run build` | Passed with all current pages and API routes | `Temp/opencode/phase0/final/build.log` |
| Installed OpenCode CLI 1.18.35 | Minimal no-tool prompt completed, exit 0; one new floor and 13 actors observed | `Temp/opencode/phase0/browser/results.json` |
| Installed plugin task-hook fixture | Child grouping, started invocation, inspector update, and completion verified | `scripts/verify-monitor.mjs` |
| Browser | 19 checks passed; desktop and mobile SSE, containment, refresh, 3D startup, single-canvas toggle, zero console errors | `Temp/opencode/phase0/browser/results.json` |
| Archive and links | Ten document and fourteen source archives; sixteen raw matches, eight terminal-LF-only differences; 68 valid local links | `Temp/opencode/phase0/archive-audit.json` |

`scripts/verify-phase0.mjs`, `scripts/verify-monitor.mjs`, and `scripts/audit-phase0.mjs` make these checks repeatable. Browser proof requires locally installed Playwright Core and Chrome, a configured monitor environment, and the external plugin. Running the browser check creates a separate harmless provider session. Fixture delegation does not prove a real delegated model run.

Individual 3D close-zoom occlusion, animation replay, long-run leak checks, and final visual approval remain open. Single-canvas toggling proves renderer ownership, not animation parity. The archive audit checks configured-token occurrences without printing values. Existing tracked logs remain user data and require a separate retention decision.

No commit or PR was created.

Independent read-only review found no blocking issue. Follow-up checks confirmed explicit browser and server cleanup, an audit-ran marker for credential checks, and a complete-set marker for command gates. Final browser cleanup confirms both the browser closed and the isolated server exited. Reviewer model identity is not exposed by the Task API, so no cross-model review is claimed.
