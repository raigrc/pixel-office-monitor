# Pixel Office Monitor

Pixel Office Monitor shows observed OpenCode sessions as a live pixel office. It does not create, resume, prompt, interrupt, or attach to provider sessions.

Settings also provides independent read-only OpenCode connection health and persisted-session metadata discovery. Discovery does not create monitor floors or infer activity from saved records.

The local checkout is the implementation baseline as of 2026-10-09. The former GitHub-based v2 drafts are historical proposals, not evidence of available features. [PLAN.md](PLAN.md) separates existing local work from the new roadmap.

## Primary documents

Exactly five documents define the project:

| Document | Purpose |
| --- | --- |
| [README.md](README.md) | Run the current monitor |
| [Product requirements](docs/PRD.md) | Current scope, target behavior, and acceptance criteria |
| [Architecture](docs/ARCHITECTURE.md) | Current data flow and proposed control boundaries |
| [Design](docs/DESIGN.md) | Existing visual system and deferred renderer choices |
| [Implementation plan](PLAN.md) | Phase status, next work, and stop gates |

[Character sprite reference](docs/character-sprite-system.md) and its contact sheet are supporting asset references, not additional primary specifications. [Archive inventory](docs/archive/2026-10-09/README.md) records original documents, source archives, retention decisions, and verification limits. `AGENTS.md` and `CLAUDE.md` are agent entrypoints.

## Run the local monitor

Use Node.js 20.9 or later and npm. The installed Next.js 16.3.4 guide requires Node.js 20.9 or later. OpenCode and an externally installed monitor plugin supply real events.

1. Open a terminal in `C:\Development\pixel-office-monitor`.
2. Install dependencies.

```powershell
npm install
```

3. Configure `.env.local` in the repository root. A local `.env.example` exists but is ignored by `.env*`. Review that template locally before using it. It is not a tracked setup dependency, and this phase does not allowlist it.

Use your own local token in place of the placeholders:

```ini
MONITOR_TOKEN=REPLACE_WITH_LOCAL_RANDOM_VALUE
NEXT_PUBLIC_PIXEL_MONITOR_TOKEN=REPLACE_WITH_SAME_LOCAL_VALUE
NEXT_PUBLIC_USE_SUPABASE=0
```

4. Set these values in the environment of the OpenCode process that loads the plugin:

```ini
PIXEL_MONITOR_URL=http://localhost:3001/api/ingest
PIXEL_MONITOR_TOKEN=REPLACE_WITH_SAME_LOCAL_VALUE
```

The server reads `MONITOR_TOKEN`, then `PIXEL_MONITOR_TOKEN`, then its development fallback. Configure a real local value instead of relying on that fallback. The browser reads `NEXT_PUBLIC_PIXEL_MONITOR_TOKEN`. These token values must match.

5. Start the monitor on loopback.

```powershell
npm run dev -- --hostname 127.0.0.1 -p 3001
```

6. Open `http://localhost:3001`. Start an instrumented OpenCode session and run a task. A root session appears as a floor when the monitor receives its events. Inspect an actor to see available activity details.

Keep port 3001 protected. Do not stop or restart a user-owned process to run verification. Use an isolated loopback server on port 3011 when needed, and stop only the server you started.

The browser token is public client data, not a production secret. Existing token checks are insufficient for privileged provider control or internet exposure. Do not expose the monitor to the LAN or internet without a separate authentication and authorization design.

### External plugin installation

The owner confirmed plugins are installed externally, including the user-global OpenCode plugin directory at `C:\Users\DELL\.config\opencode\plugins\`. Plugin code is not shipped by this repository. This phase does not establish that any project-level copy matches the user-global copy.

If events do not arrive, check the plugin loaded in the actual OpenCode process, its configured ingest URL, and its token. Restart OpenCode after changing plugin configuration. Do not copy over an external plugin from a historical path without reviewing its version and ownership.

### Production preview

Do not build against a user-owned development server using the same `.next` directory without coordination. Previous local notes report stale chunks after a build.

```powershell
npm run build
npm run start -- --hostname 127.0.0.1 -p 3001
```

Set `NEXT_PUBLIC_*` values before building. Next.js inlines them into the browser bundle. Changing `.env.local` afterward does not update an existing production bundle.

## Current monitor behavior

- Root sessions own floors. Child sessions resolve to their root floor. System actors stay hidden.
- The fixed layered office is `512×384`, with sixteen desk anchors. Eleven roles seed default desks. Observed `build`, `plan`, `general`, and `scout` use optional seats 11 through 14. Unknown roles share visitor seat 15. The observed orchestrator stands separately.
- Character playback uses 48×48 RGBA frames in 1152×192 sheets. Twenty-four columns, four direction rows, and eight poses give 96 frames per atlas. There are 22 generated atlases for 21 registered keys plus fallback.
- SSE provides authenticated snapshots, epoch and sequence cursors, reconnect replay, and freshness labels `WAITING`, `LIVE`, and `QUIET`.
- Session navigation supports grouping, search, pinning, monitor-floor rename and close, follow mode, two-summary comparison, and lifecycle notifications. Closing a monitor floor does not stop an OpenCode session.
- Both renderers use shared activity and role identity. A view switch must not fabricate provider events.
- Three.js 0.186 remains a live dependency. `SceneViewport` mounts 3D after first activation and retains it, pausing hidden 3D rendering. Hidden 2D sprite timers remain active. There is no explicit experimental feature flag today.
- Supabase helpers, clients, a migration, and a flag exist. The flag branch in `monitor-store.ts` is a placeholder. Flipping the flag does not switch monitor persistence away from memory.

`/demo`, `/character-demo`, and `/settings` remain available. Settings control prompt preview, display path redaction, and CRT overlay. Reduced motion follows the operating-system preference.

## Configure read-only OpenCode discovery

The first discovery slice supports OpenCode `1.18.35`. It reads an explicitly configured loopback server using `GET /global/health` and `GET /api/session`. It does not launch a provider server automatically. An existing headless server can read the provider's persisted database without owning work executing in another process.

Add these server-only values to ignored `.env.local`. Replace placeholders locally; do not reuse the monitor token as the discovery secret:

```ini
PIXEL_DISCOVERY_ORIGIN=http://127.0.0.1:3001
PIXEL_DISCOVERY_ACCESS_SECRET=REPLACE_WITH_INDEPENDENT_RANDOM_SECRET
PIXEL_OPENCODE_URL=http://127.0.0.1:4096
PIXEL_OPENCODE_DIRECTORY=C:\Development\pixel-office-monitor
PIXEL_OPENCODE_USERNAME=opencode
PIXEL_OPENCODE_PASSWORD=REPLACE_WITH_PROVIDER_SERVER_PASSWORD
```

Use at least 32 random bytes for the independent discovery secret. A 43-character base64url encoding is suitable. `PIXEL_OPENCODE_PASSWORD` is optional only when the configured provider server does not require Basic authentication. The username defaults to `opencode`. Neither credential enters the browser bundle.

If no provider server exists, start one yourself on an unused loopback port. Set its `OPENCODE_SERVER_PASSWORD` and optional `OPENCODE_SERVER_USERNAME` in that terminal to match the server-side discovery credentials. Do not replace an existing user-owned process.

```powershell
opencode serve --pure --hostname 127.0.0.1 --port 4096 --no-mdns
```

After your own monitor restart, open `http://127.0.0.1:3001/settings`. The configured app origin must match the exact browser host and port. Enter the independent secret, choose **Unlock discovery**, then **Check OpenCode**. Unlock creates a 15-minute HttpOnly, SameSite=Strict cookie for this read-only API and does not contact the provider.

Production discovery is now verified on this machine. Its prepared provider URL uses port 4097 because port 4096 reports version 7.8.1 and was left untouched. Seven production-panel checks passed against OpenCode 1.18.35, with 43 records matching native IDs and count. The verifier started or stopped no process. `scripts/configure-opencode-discovery.mjs --apply` adds only missing private settings and independent credentials without printing values. `scripts/verify-production-discovery.mjs` checks an already running provider and normal monitor without restarting them.

Development allows `127.0.0.1` through Next.js `allowedDevOrigins` for dev-only resources such as HMR. This does not change the discovery API's exact Origin, Host, cookie or credential checks. Restart the development server yourself if it has not reloaded the updated config.

The panel shows health/version and at most 50 metadata records, newest by creation time. Native session, project, parent and workspace IDs, update times, and reported archive times remain visible. Missing parents remain unresolved. Raw directories, provider cursors, unused provider fields, and credentials stay server-side. Rows have no selection, prompt, transcript, interrupt, or terminal action. Another provider version can report healthy while listing remains explicitly unsupported.

## Log-security housekeeping

Phase 0 is checkpointed at `267cee9`, `chore: consolidate docs and archive legacy code`. Later security housekeeping found ten full configured monitor-token occurrences across `dev-test.log` and `dev-smoke-3dfix.log`. Both logs were redacted. Six generated logs were removed from the Git index and retained locally under ignore rules. Existing Git history was not rewritten.

Stored `MONITOR_TOKEN`, `PIXEL_MONITOR_TOKEN`, and `NEXT_PUBLIC_PIXEL_MONITOR_TOKEN` now share a newly generated value. The agent did not restart user-owned processes. A read-only check confirms the current production monitor accepts the stored rotated token. Reload the browser and restart any OpenCode process or shell that still holds the old value. Refresh shell-level token overrides. Rebuild a production monitor if its browser token predates rotation. No token value appears in the reports.

Repeat the broad retained-log scan with `node scripts/audit-logs.mjs`. Explicit `--redact` sanitizes findings without deleting other log content. The scanner identifies known provider-key formats, credentials in authorization headers and URL queries, assignments, private keys, JWTs, and configured values. Pattern matches do not prove every secret format is detectable. The rotation helper's `--apply` rotates stored monitor values only; it never restarts processes or rotates unrelated provider credentials.

## Commands and verification status

`package.json` defines these commands:

```powershell
npm test
npm test -- --maxWorkers=2
npx tsc --noEmit
npm run lint
npm run build
```

The main agent captured the Phase 0 baseline on branch `fix/3d-colony-v1` at `65923b3`:

| Check | Baseline result |
| --- | --- |
| `npm test` | 450 passed, one sprite-generator test timed out, 51 files |
| `npm test -- --maxWorkers=2` | 451 passed across 51 files |
| `npm run lint` | Zero errors, 31 warnings |
| `npm run build` | Passed |
| `npx tsc --noEmit` | Passed |

Evidence for the captured default checks is under `Temp/opencode/phase0/baseline/`. After archival changes, both test commands pass 451 tests across 51 files. TypeScript and production build pass. Final lint has zero errors and 20 warnings. Evidence is under `Temp/opencode/phase0/final/`.

The final production build passes 19 browser checks, including desktop and mobile SSE, actor and fixture-delegation updates, refresh, and single-canvas 3D toggling. A real OpenCode CLI 1.18.35 no-tool prompt completes and delivers session and actor events. The monitor remains observation-only; this CLI run is verification tooling, not browser session control.

Repeat the checks with [verify-phase0.mjs](scripts/verify-phase0.mjs), [audit-phase0.mjs](scripts/audit-phase0.mjs), and [verify-monitor.mjs](scripts/verify-monitor.mjs). The browser check needs Chrome, locally installed Playwright Core, configured monitor credentials, and the external plugin. It uses port 3011 and creates a separate harmless provider session. Reports remain under ignored `Temp/opencode/phase0/`. See the archive inventory for assumptions and limits.

The read-only discovery slice passes 520 tests across 52 files, TypeScript, production build, and lint with zero errors and the same 20 warnings. [verify-discovery.mjs](scripts/verify-discovery.mjs) passes 30 runtime/browser checks, including 41 real persisted records, credential isolation, desktop/mobile states, and unchanged monitor sequence and floors. It creates no provider sessions or prompts. It starts only isolated verification servers on ports 3011, 4097, and 4098, then confirms cleanup. Evidence is under ignored `Temp/opencode/discovery/`.

Use `node scripts/verify-phase0.mjs discovery` before the discovery browser check. Verification sets `PIXEL_VERIFY_ISOLATED=1`, writes Next.js output under ignored `Temp/opencode/next-verification/`, and uses a separate generated TypeScript config. Normal production output remains `.next`. The verifier checks that production build identity and manifests stay unchanged. Do not run an ordinary shared-output production build alongside an existing user-owned production server.

## Generate and review assets

Install Python and Pillow separately from npm. Generators overwrite output, so inspect the diff after running them.

```powershell
pip install Pillow
python scripts/generate-office.py
python scripts/generate-sprites.py
python scripts/generate-sprites.py --check
```

`scripts/cozy_theme.py` reads the shared theme for generation. `scripts/generate-assets.py` remains the procedural generator for older tiles, cubicle frames, props, and monitor PNGs. All public assets remain retained because external URL consumers are unknown. `floor-tile.png` still has a global CSS reference.

See [Design](docs/DESIGN.md) for generator ownership and [Character sprite reference](docs/character-sprite-system.md) for source layers, provenance, validation, and the contact sheet.

## Troubleshoot event flow

1. Check `http://localhost:3001/api/health` for local health diagnostics.
2. Check the plugin's ingest URL and token. A rejected ingest or SSE request requires correcting authentication, not disabling token checks.
3. Inspect `/api/state` locally to distinguish missing ingest data from a client-stream problem. State and health are local diagnostics, not private remote APIs.
4. Check that the browser token matches the configured server token. Restart development after environment changes, or rebuild production when public values change.
5. If 3D replays arrivals or actors disappear at close zoom, record a fresh-browser reproduction. Existing hydration and bounds fixes have code and unit coverage, but current browser replay and occlusion acceptance remain unverified.

Do not paste token-bearing URLs, logs, raw prompts, or credentials into reports. Existing ignored logs and tracked screenshots remain user data. Ignore rules do not untrack files already in Git.
