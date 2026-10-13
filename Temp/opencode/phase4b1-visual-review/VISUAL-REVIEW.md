# Phase 4B.1 Visual Review

Date: 2026-09-11

Verdict: READY FOR USER APPROVAL

## Scope

Focused 3D correction pass only. Phase 4C did not start.

## Results

| Evidence | Result | Observation |
|---|---|---|
| `01-3d-day-roles.png` | Pass | Suit accents and light accessory details remain visible against daytime terrain. |
| `02-3d-night-roles.png` | Pass | Identity accents survive night lighting while semantic badges and orchestrator rings stay stronger. |
| `03-busy-worksite.png` | Pass | Crowded roster remains legible without adding per-agent accessory meshes. |
| `04-working-state.png` | Pass | Filled `W` badge reads above role decoration. |
| `05-error-state.png` | Pass | Red filled error badge remains the strongest local outcome signal. |
| `06-selected-agent.png` | Partial evidence | Persistent white foot ring is visible and distinct from gold orchestrator rings. Production fixture isolation prevented a clean final inspector-dialog recapture. Automated marker lifecycle and selection wiring tests pass. |
| `07-delegation-crowded.png` | Pass | Bright token and strengthened batched path survive crowded geometry. |
| `08-architect-vs-researcher.png` | Pass | Architect document and researcher sensor use different silhouettes. |
| `09-devops-security-senior.png` | Pass | Comms, shield, and device families remain distinct. |
| `10-mobile-3d.png` | Pass | 390x844 scene remains contained with no horizontal overflow. |
| `11-reduced-motion.png` | Pass | Static scene retains identities and semantic hierarchy. |

## Rendering Correction

Final WebGL review exposed black accessory and backpack details. Cause: materials enabled geometry vertex colors although generated geometry has no color attribute. WebGL default vertex color zero multiplied valid `instanceColor` values to black. Removing `vertexColors` preserves per-instance identity colors without changing batching or draw-call shape.

## Verification

- Night-lighting follow-up: full-night ambient `0.48`, cool fill `0.65`, and brighter blue-black environment colors; regression first failed against prior `0.22` ambient.
- `npm test -- --run` after lighting follow-up: 40 files, 371 tests passed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.
- `npm run lint`: 0 errors, 54 existing warnings.
- Focused astronaut and instancing tests: 34 passed.
- `capture-results.json`: 11 required frames, zero recorded browser errors, no mobile horizontal overflow.

## Harness Note

User-owned development server on port 3001 was not changed. Next.js 16 rejected a second development server in the same working tree. Built production server on port 3011 served final assets, but its route modules do not provide one deterministic shared in-memory fixture store across capture requests. This only affected the clean selection-dialog detail recapture. Source behavior remains covered by focused tests.

## Decision

No Phase 4C work started. Await user visual approval or requested corrections.
