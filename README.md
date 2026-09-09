# Pixel Office Monitor

> Local real-time monitor that turns OpenCode sessions and delegated tasks into a live pixel office.

Each OpenCode **root session is one office floor**. Child sessions remain on their root floor, system actors stay hidden, and real agent actors occupy seven fixed desks. Active delegation shows sender/recipient links and task handoffs. Working actors type at lit monitors; resting actors hold still with `Zzz`.

**Current runtime (2026-09-08):** `OfficeScene` renders a fixed `384×256` room through `SceneViewport`, fitted to desktop or mobile without drag controls. Data arrives through authenticated SSE snapshots with persisted epoch/sequence cursors, replay on reconnect, exponential backoff, and `WAITING`/`LIVE`/`QUIET` freshness states. Character sheets provide 8 poses × 4 directions in 32×32 frames. Monitor assets have explicit off/on/working states and no baked duplicate monitor.

Older card/cubicle components and their generated assets remain as legacy prototypes. Current `/` rendering uses `OfficeScene`, `CharacterSprite`, `FloorSwitcher`, and `AgentInspector`.

Sprint plan & checklist: [`PLAN.md`](./PLAN.md) · Stack: **Next.js 16** (App Router, Turbopack) · **Tailwind 4** · **TypeScript 5** · **swr** · **zod** · **Supabase** (flag-gated) · **Vitest 5**

---

## Architecture

```
[OpenCode event + task hooks]
          |
          v  global plugin, debounced non-blocking POST
[POST /api/ingest]
          |
          v  zod v1/v2 validation, dedupe, root-session grouping
[global runtime store]
  floors + sessions + actors + invocations + epoch/sequence event ring
          |
          +--> GET /api/state   snapshot/debug API
          +--> GET /api/health  uptime + SSE metrics
          +--> GET /api/events  authenticated SSE
                    initial snapshot + live snapshots + 15s heartbeat
                    replay from Last-Event-ID or ?lastEventId=
                              |
                              v
[useMonitorState]
          |
          v
[page.tsx -> FloorSwitcher -> SceneViewport -> OfficeScene]
                               CharacterSprite + handoff controller
```

**Contract v2** (verified in `src/lib/schema.ts:48` + `src/lib/monitor-types.ts`): `POST /api/ingest` accepts both v1 and v2 payloads. v2 adds `eventId`, `producerId`, `projectId`, `sessionId`, `rootSessionId`, `parentSessionId`, `occurredAt`, `kind: session.upsert|actor.activity|invocation.requested|invocation.started|invocation.finished`, and detailed `detail` with `callId`, `senderActorId`, `recipientActorId`, `invocationStatus`, `outcome`, `taskCategory`, `promptPreview`. Acknowledgment returns `{ accepted, duplicate, epoch, sequence, eventId }`. v1 payloads are still accepted for backward compatibility.

**Server-side identity & state** (`src/lib/monitor-store.ts`, `src/lib/monitor-types.ts`): Each root session gets a `floorId = projectId:rootSessionId`. Child sessions share their parent's floor. Actors have stable `actorId = projectId:sessionId:agentKey` with `seatIndex`. Invocations tracked by `invocationId = projectId:senderSessionId:callId` with `parentInvocationId` for nested delegation. Epoch/sequence for SSE replay. Deduplication via `eventId`.

Floor status derivation: `session.upsert` sets floor status; invocations derive cubicle state (`working|thinking|delegating|idle`). Prune: closed floors `>24h`, idle cubicles `>24h`, empty floors `>1h` (see `monitor-store.ts`).

---

## Prerequisites

| Requirement | Version | Note |
|---|---|---|
| Node.js | `>=20` | Next.js 16 requires 18.18+; 20 LTS verified (`node -v`) |
| npm | `>=10` | ships with Node 20 (`npm -v`) |
| OpenCode | any | for live signal — plugin auto-loads |

No database required for local MVP — in-memory `Map` is default.

---

## Setup

### 1. Clone & enter

```powershell
cd C:\Users\DELL\Desktop\Rai\pixel-office-monitor
```

### 2. Environment

Copy the example and fill placeholders — **never commit real keys** (see `.env.example`):

```powershell
copy .env.example .env.local
```

`.env.local` (verified keys — do not paste real token, use placeholder):

```ini
MONITOR_TOKEN=<YOUR_TOKEN>                  # server expects this (also reads PIXEL_MONITOR_TOKEN, fallback dev-token)
NEXT_PUBLIC_PIXEL_MONITOR_TOKEN=<YOUR_TOKEN> # browser SSE token; must match MONITOR_TOKEN
NEXT_PUBLIC_USE_SUPABASE=0                 # 0 = Map (local), 1 = Supabase
NEXT_PUBLIC_SUPABASE_URL=                  # required only when flag=1
NEXT_PUBLIC_SUPABASE_ANON_KEY=             # required only when flag=1
SUPABASE_SERVICE_ROLE_KEY=                 # required only when flag=1 (server-only, never prefix NEXT_PUBLIC_)
PIXEL_MONITOR_URL=http://localhost:3001/api/ingest
PIXEL_MONITOR_TOKEN=<YOUR_TOKEN>           # must match MONITOR_TOKEN
```

| Var | Where | Purpose |
|---|---|---|
| `MONITOR_TOKEN` | server `.env.local` | token checked by `POST /api/ingest` (also accepts `PIXEL_MONITOR_TOKEN`) |
| `NEXT_PUBLIC_PIXEL_MONITOR_TOKEN` | browser bundle | token used by `EventSource`; must match `MONITOR_TOKEN` (local-only, publicly visible) |
| `PIXEL_MONITOR_TOKEN` | plugin env | sent as `x-monitor-token` + `x-token` + `Bearer` |
| `PIXEL_MONITOR_URL` | plugin env | ingest URL (hardcoded fallback `http://localhost:3001/api/ingest`) |
| `NEXT_PUBLIC_USE_SUPABASE` | `0`/`1` | `0` Map, `1` Supabase — `isSupabaseEnabled()` checks `1`/`true` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project | only when flag `1` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project | only when flag `1` |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | only when flag `1`, never expose to client |

> Token mapping: server routes read `MONITOR_TOKEN || PIXEL_MONITOR_TOKEN || "dev-token"`; plugin uses `PIXEL_MONITOR_TOKEN`; browser SSE uses `NEXT_PUBLIC_PIXEL_MONITOR_TOKEN`. All three values must match locally.

### 3. Plugin locations

The signal layer is a **global OpenCode plugin** — two mirrored copies (PLAN §3, verified both exist):

```
C:\Users\DELL\Desktop\Rai\.opencode\plugins\pixel-monitor.js      (project global)
C:\Users\DELL\.config\opencode\plugins\pixel-monitor.js            (user global, 11,728 B)
```

Both are identical. The plugin uses a single `event` hook + `tool.execute.before/after` for `task`, debounce `300ms` per `(sessionID,agent)`, `keepalive:true`, `2s` abort, never throws (verified `pixel-monitor.js:40-87`). Edit one and copy to the other, or keep both in sync:

```powershell
copy C:\Users\DELL\Desktop\Rai\.opencode\plugins\pixel-monitor.js C:\Users\DELL\.config\opencode\plugins\pixel-monitor.js
```

No `npm` deps for the plugin — plain `fetch`.

### 4. Install

```powershell
npm install
```

---

## How to run

```powershell
# 1. start monitor (port 3001 — not 3000)
npm run dev -- -p 3001
# → http://localhost:3001

# 2. in another terminal, trigger a live signal
#    from any OpenCode session in C:\Users\DELL\Desktop\Rai
opencode
# then inside OpenCode:
@explore find auth logic

# 3. watch http://localhost:3001 — floor appears within 1s, cubicle shows working → sleeping after ~10s idle
```

* Primary transport: authenticated `EventSource("/api/events")` through `useMonitorState`.
* Reconnect: persisted `pixel:monitorCursor`, exponential backoff with jitter, maximum 5 automatic retries, then manual retry.
* Empty state: `◧ no active floor` inside the fitted room viewport.

Build/preview:

```powershell
npm run build
npm run start -- -p 3001
```

Settings UI: `http://localhost:3001/settings`

---

## API Reference

Base: `http://localhost:3001`

All routes: `runtime = "nodejs"`, `dynamic = "force-dynamic"`, `Cache-Control: no-store`.

### `POST /api/ingest` — ingest a signal

**Auth** — one of (all accepted, verified `src/app/api/ingest/route.ts:16`):

```
x-monitor-token: <YOUR_TOKEN>
x-token: <YOUR_TOKEN>
Authorization: Bearer <YOUR_TOKEN>
Authorization: <YOUR_TOKEN>          # raw token also accepted
```

`401 { ok:false, error:"unauthorized" }` on missing/mismatch. `400` on invalid JSON or zod failure with `issues[]`. `405` on `GET`.

**Payload v1** — zod `ingestPayloadSchema` (`src/lib/schema.ts:48`):

```json
{
  "v": 1,
  "ts": 1700000000000,
  "sessionID": "ses_abc123",
  "project": "pixel-office-monitor",
  "title": "Explore auth",
  "agent": "explore",
  "kind": "subtask.start",
  "status": "working",
  "detail": {
    "prompt": "find auth logic",
    "tool": "grep",
    "todos": [{ "content": "scan src", "status": "in_progress" }]
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `v` | `1` | yes | literal |
| `ts` | `int ≥0` | yes | `Date.now()` ms |
| `sessionID` | `string ≥1` | yes | floor key |
| `project` | `string ≥1` | yes | display basename via `formatProject()` |
| `title` | `string ≤200` | no | session title |
| `agent` | `string ≥1` | yes | cubicle key per floor |
| `kind` | enum | yes | `subtask.start` \| `subtask.end` \| `session.busy` \| `session.idle` \| `session.created` \| `tool.before` \| `tool.after` \| `todo.updated` |
| `status` | `working`\|`idle` | yes | drives floor + cubicle state |
| `detail.prompt` | `string` | no | trimmed `trim().slice(0,200)` via transform |
| `detail.tool` | `string` | no | `lastTool` ≤100 chars in store |
| `detail.todos` | `Todo[]` | no | passthrough, capped 20 in store; each `{content?, text?, status?, state?, priority?, activeForm?}` |

**Payload v2** — zod `ingestPayloadV2Schema` (`src/lib/schema.ts:100`), adds reliable delegation identity:

```json
{
  "v": 2,
  "eventId": "abc123-xyz",
  "producerId": "opencode-plugin",
  "projectId": "pixel-office-monitor",
  "sessionId": "ses_child_001",
  "rootSessionId": "ses_root_001",
  "parentSessionId": "ses_root_001",
  "occurredAt": 1700000000000,
  "kind": "invocation.requested",
  "detail": {
    "callId": "call_123",
    "parentInvocationId": "inv_parent",
    "agentKey": "senior-engineer",
    "senderActorId": "pixel-office-monitor:ses_root_001:orchestrator",
    "recipientActorId": "pixel-office-monitor:ses_child_001:senior-engineer",
    "invocationStatus": "requested",
    "outcome": null,
    "taskCategory": "implementation",
    "promptPreview": "Implement auth..."
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `v` | `2` | yes | literal |
| `eventId` | `string` | yes | unique, for deduplication |
| `producerId` | `string` | no | plugin instance ID |
| `projectId` | `string` | yes | project namespace |
| `sessionId` | `string` | yes | actual calling session |
| `rootSessionId` | `string` | yes | root session for floor grouping |
| `parentSessionId` | `string` | no | immediate parent session |
| `occurredAt` | `int ≥0` | yes | event timestamp ms |
| `kind` | enum | yes | `session.upsert` \| `actor.activity` \| `invocation.requested` \| `invocation.started` \| `invocation.finished` |
| `detail.callId` | `string` | no | stable call identifier |
| `detail.parentInvocationId` | `string` | no | for nested delegation |
| `detail.agentKey` | `string` | no | agent role |
| `detail.senderActorId` | `string` | no | explicit sender |
| `detail.recipientActorId` | `string` | no | explicit recipient |
| `detail.invocationStatus` | enum | no | `requested`\|`started`\|`finished`\|`failed`\|`cancelled` |
| `detail.outcome` | enum | no | `succeeded`\|`failed`\|`cancelled`\|`unknown` |
| `detail.taskCategory` | enum | no | `research`\|`design`\|`implementation`\|`testing`\|`operations`\|`other` |
| `detail.promptPreview` | `string` | no | sanitized preview for UI |

**Response v2** — `200 { accepted, duplicate, epoch, sequence, eventId }`. `duplicate: true` means event was already processed (idempotent). v1 returns `200 { ok: true }`.

**cURL (copy-pasteable):**

```powershell
# good token
curl -X POST http://localhost:3001/api/ingest `
  -H "Content-Type: application/json" `
  -H "x-monitor-token: <YOUR_TOKEN>" `
  -d "{\"v\":1,\"ts\":1700000000000,\"sessionID\":\"ses_test_001\",\"project\":\"pixel-office-monitor\",\"agent\":\"explore\",\"kind\":\"subtask.start\",\"status\":\"working\",\"detail\":{\"prompt\":\"find auth\",\"tool\":\"grep\"}}"

# bad token → 401
curl -X POST http://localhost:3001/api/ingest -H "x-monitor-token: wrong" -d "{}"

# via Bearer
curl -X POST http://localhost:3001/api/ingest -H "Authorization: Bearer <YOUR_TOKEN>" -H "Content-Type: application/json" -d "{\"v\":1,\"ts\":1700000000000,\"sessionID\":\"ses_1\",\"project\":\"p\",\"agent\":\"explore\",\"kind\":\"tool.before\",\"status\":\"working\"}"
```

Success: `200 { ok:true }`.

Rate / flood note: no `429` — plugin debounce `300ms` per `(sessionID,agent)` + store prune covers flood (verified `pixel-monitor.js:40, ingest/route.ts:73`).

### `GET /api/state` — current office snapshot

```powershell
curl http://localhost:3001/api/state
```

Response `200` (sorted `floors` by `updatedAt` desc, cubicles by `agent`):

```json
{
  "floors": [
    {
      "sessionID": "ses_abc123",
      "title": "Explore auth",
      "project": "pixel-office-monitor",
      "status": "working",
      "updatedAt": 1700000000000,
      "cubicles": [
        { "agent": "explore", "kind": "subtask.start", "status": "working", "since": 1700000000000, "lastTool": "grep", "prompt": "find auth logic", "todos": [] }
      ]
    }
  ]
}
```

Headers: `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate`.

### `GET /api/events` — SSE live stream

```powershell
curl -N "http://localhost:3001/api/events?token=<YOUR_TOKEN>"
```

* Requires the same token forms as ingest, plus `?token=` for browser `EventSource`.
* Sends an immediate `snapshot`, a fresh sanitized snapshot after each store event, and a heartbeat comment every 15 seconds.
* Replays event-ring entries after `Last-Event-ID` or `?lastEventId=epoch:sequence`, then sends the current snapshot.
* Limits concurrent SSE connections per IP and returns `429` with `Retry-After: 30` over the cap.
* Sanitizes invocation prompt previews before streaming and cleans up counters/listeners on abort.

### `GET /api/health` — uptime & floor count

```powershell
curl http://localhost:3001/api/health
# {"ok":true,"floorsCount":2,"uptime":12345,"timestamp":1700000000000}
```

Source: `getFloorsCount()` + `getUptimeMs()` from `monitor-store.ts` (`globalThis.__PIXEL_MONITOR_STORE__` singleton + `__PIXEL_MONITOR_START__`).

---

## Settings

Route: `/settings` (`src/app/settings/page.tsx`). All client-only, `localStorage` + same-tab sync via `StorageEvent` + `CustomEvent("pixel-settings")`. No server write.

| Toggle | localStorage key | Default | Effect (verified `src/app/page.tsx:44-140`) |
|---|---|---|---|
| **Show prompt preview** | `pixel:showPromptPreview` | `true` | When `false`, strips `cubicle.prompt` → `undefined` before render (hides 40-char line). Server still stores prompt (200-char cap); client trims only. |
| **Redact file paths** | `pixel:redactPaths` | `false` | Regex replaces absolute paths with `[…]`: `/(?:\/[\w.\-]+)+(?:\/)?/g` and `[A-Za-z]:\\[^\s]*/` — applied display-only, store keeps original for debug. |
| **CRT scanline overlay** | `pixel:crt` | `false` | Adds `.crt` class to `main` container. CSS `repeating-linear-gradient 6%` at `opacity:.6` (`globals.css:53-68`). `6%` token per PLAN §2. |

**Reduce motion** — read-only mirror of OS `prefers-reduced-motion: reduce` (`matchMedia`). When active: sprite 200ms tick and `Zzz 1800ms` freeze (`Sprite.tsx:400-418`, `globals.css:118-128`, `page.tsx` banner). Change in OS settings; no app toggle needed.

**Keys to clear in DevTools:** Application → Local Storage → `pixel:showPromptPreview`, `pixel:redactPaths`, `pixel:crt`. Hydration: `page.tsx:63` reads on mount, listens to `storage` + `pixel-settings`.

> Note: to fully omit prompt server-side (before zod), gate `detail.prompt` in `pixel-monitor.js:54 send()` — currently render-only per plugin header comment `pixel-monitor.js:7-11`.

---

## Character Sprites

Current scene sheets live in `public/sprites/characters/`: `orchestrator.png`, `senior-engineer.png`, and `fallback.png`. Each sheet is `768×128`: 24 columns of 32×32 pose frames across four direction rows (`down`, `left`, `right`, `up`). Pose ranges are idle 0–3, walk 4–11, seat 12–13, work 14–15, give 16–17, receive 18–19, success 20–21, and error 22–23.

Regenerate current scene assets:

```powershell
pip install Pillow
python scripts/generate-office.py
python scripts/generate-sprites.py
```

### Legacy CSS Sprite Library

15 agents + `intern`/`unknown` fallback — mapping verified `PLAN.md §1` ↔ `src/lib/agents.ts` ↔ `src/components/Sprite.tsx` (CSS grid 16×16 @ 48px, `image-rendering:pixelated`). States: `working` (2-frame alt, `setInterval 200ms` per `Sprite.tsx:430`) and `sleeping`/`idle` (X eyes + three `Z` at `14/12/10px` floating `1800ms` `floatZ`, staggered `0/0.4/0.8s`). Reduced-motion: frozen (`useReducedMotion`).

| Agent ID | Label | Role | Pixel Character | Prop / Working cue |
|---|---|---|---|---|
| `ai-systems` | AI Systems | AI Scientist | lab coat, neural node | 2×2 node pulse green `V`/`v` + white highlight on frame 0 |
| `architect` | Architect | Architect | blueprint roll, T-square | `l` roll shifts + highlight |
| `automation-engineer` | Automation | Technician | wrench, cables | wrench T shifts `y ±1` |
| `devops` | DevOps | Operator | headset, rack LEDs | earcups `N` + LEDs `V` blink |
| `documentation` | Documentation | Scribe | papers, pen | stack `U` + pen toggles `py` |
| `project-manager` | Project Manager | Manager | clipboard, tie | tie `R` + clipboard `Y`, check `V` on frame 1 |
| `qa-engineer` | QA Engineer | Inspector | magnifier, stamp | magnifier `M`/`I` shifts; handle `T` |
| `researcher` | Researcher | Researcher | books, globe | `Q`/`q` stack + open page white on frame 1; globe pixel `V` |
| `security-reviewer` | Security | Guard | shield, lock | shield `L`/`J` shimmer + lock `Y`/`O` |
| `senior-engineer` | Senior Engineer | Engineer | laptop, hoodie | laptop `F` + screen `l`; hands `S` toggles with typing |
| `build` | Build | Builder | hard hat, hammer | hammer handle `T` + head `W` moves `y ±1`; hard hat `H`/`h` |
| `plan` | Plan | Planner | blueprints lite | `l` 2×3 shifts |
| `general` | General | Generalist | hoodie, coffee | cup `T` + steam `W` rises |
| `explore` | Explore | Scout | binoculars, lens | binoculars `N` + lenses `I` scan `L/R` |
| `scout` | Scout | Librarian | book stack | `Q` stack + page line `W` |
| `intern` / `unknown` | Intern | Intern | cap | cap `L` + brim; pocket highlight `w` (fallback) |

**Props palette** (`Sprite.tsx:32 CHAR_TO_HEX`): `S#F5D0A9` skin, `K` black hair, `H#F59E0B` hat, `W#E5E7EB` coat, `L#3B82F6` shield, `V#22C55E` green, `R#EF4444` tie, `P#1E293B` pants, etc.

**Sprite as component:**

```tsx
import Sprite from "@/components/Sprite";
<Sprite spriteKey="senior-engineer" state="working" size={48} />   // 48 default (16×3px)
<Sprite spriteKey="explore" state="sleeping" />
// role=img aria-label="{spriteKey} {state}", title same
```

**Future PNG swap** (documented `Sprite.tsx:16-18`, `CubicleCard` ready): place sprites at

```
public/sprites/<spriteKey>.png   # e.g. public/sprites/explore.png
# recommended sheet: 144×48 (3 frames × 48), image-rendering:pixelated
```

Replace grid `div` with `<img>` + `background-position` per frame; keep `spriteKey` naming identical so `CubicleCard.tsx` needs no change. Add `<img onError>` fallback to CSS grid to keep crisp at 1.5× zoom.

---

## Legacy Cubicle Assets

These 43 PNGs were generated for the older card/cubicle UI by `scripts/generate-assets.py`. They remain available to legacy components. Current `OfficeScene` assets are under `public/sprites/office/` and `public/sprites/characters/`.

### Background Tiles

| File | Size | Purpose |
|---|---|---|
| `public/sprites/floor-tile.png` | 32×32 | Office carpet — repeating pattern, OLED dark `#0F172A` base with subtle grid lines and dot texture |
| `public/sprites/wall-tile.png` | 32×32 | Wall segment — `#1E293B` body, `#334155` top edge, `#0B1220` baseboard, vertical line texture |
| `public/sprites/door-tile.png` | 32×32 | Door — `#64748B` frame, `#334155` panel, `#E2E8F0` handle, hinge hints |

### Cubicle Frames

| File | Size | Purpose |
|---|---|---|
| `public/sprites/cubicle-idle.png` | 64×64 | Top-down cubicle — partition walls, desk, monitor (dim), chair; `#334155` border |
| `public/sprites/cubicle-working.png` | 64×64 | Working state — green glow around monitor screen, `#22C55E` accent |

### Desk Props (23 PNGs in `public/sprites/props/`)

| File | Size | Agent(s) |
|---|---|---|
| `server-rack.png` | 24×16 | ai-systems, devops |
| `neural-orb.png` | 8×8 | ai-systems |
| `blueprint-scroll.png` | 16×20 | architect, plan |
| `t-square.png` | 16×4 | architect |
| `wrench.png` | 4×16 | automation-engineer |
| `cable-coil.png` | 8×8 | automation-engineer |
| `headset.png` | 12×8 | devops |
| `paper-stack.png` | 12×12 | documentation |
| `pen.png` | 2×12 | documentation |
| `clipboard.png` | 8×12 | project-manager |
| `coffee-mug.png` | 6×8 | project-manager, general, intern |
| `magnifier.png` | 8×8 | qa-engineer |
| `stamp.png` | 6×8 | qa-engineer |
| `book-stack.png` | 12×12 | researcher, scout |
| `globe.png` | 8×8 | researcher |
| `padlock.png` | 6×8 | security-reviewer |
| `camera.png` | 8×6 | security-reviewer |
| `laptop.png` | 12×6 | senior-engineer |
| `hard-hat.png` | 10×6 | build |
| `toolbox.png` | 10×8 | build |
| `compass.png` | 8×8 | plan |
| `binoculars.png` | 10×6 | explore |
| `map.png` | 12×8 | explore, scout |

### Monitor Screens (15 PNGs in `public/sprites/monitors/`)

Each is 16×8 pixels — a pixel-art monitor displaying agent-specific content:

| File | Screen Content |
|---|---|
| `ai-systems.png` | Neural network nodes with connections |
| `architect.png` | Blueprint schematic with grid |
| `automation-engineer.png` | n8n workflow nodes with arrows |
| `devops.png` | Terminal lines with blinking LEDs |
| `documentation.png` | Document with text lines |
| `project-manager.png` | Checklist with check marks |
| `qa-engineer.png` | Test results grid (green/red) |
| `researcher.png` | Search results list |
| `security-reviewer.png` | Shield status display |
| `senior-engineer.png` | Code editor with syntax coloring |
| `build.png` | Build progress bar |
| `plan.png` | Plan outline with boxes |
| `general.png` | Terminal (same as devops) |
| `explore.png` | Directory tree |
| `scout.png` | External docs page |

### How to Regenerate

```powershell
pip install Pillow
python scripts/generate-assets.py
# Output: public/sprites/**/*.png (43 files)
```

The script uses the same palette as `Sprite.tsx:32 CHAR_TO_HEX`. All pixel art is drawn procedurally — no external image files needed.

---

## Desk Props

Each agent has 1–2 desk props rendered on the cubicle surface. Props are defined in `src/lib/agent-props.ts` and rendered by `src/components/DeskProps.tsx`.

### How It Works

1. `DeskProps` receives `agentId` + `isWorking`
2. Calls `getAgentProps(agentId)` → returns `{ items: PropDef[] }`
3. Each prop is an `<img>` positioned absolutely (`left`, `top`) inside the cubicle body
4. When `isWorking`, props animate with `animate-prop-float` (2px bob, staggered 300ms)

### Adding a New Agent Prop

1. Create or reuse a PNG in `public/sprites/props/` (max ~24px recommended)
2. Add entry to `AGENT_PROPS` in `src/lib/agent-props.ts`:

```typescript
"my-agent": {
  items: [
    { src: "/sprites/props/my-prop.png", x: "10%", y: "25%", w: 16, h: 16, alt: "description" },
  ],
},
```

3. Run `npm run build` — no other changes needed; `DeskProps` picks it up automatically via `getAgentProps(agentId)`

### PropDef Shape

```typescript
type PropDef = {
  src: string;   // PNG path from public/
  x: string;     // CSS left (% or px)
  y: string;     // CSS top (% or px)
  w: number;     // render width in px
  h: number;     // render height in px
  alt: string;   // accessible alt text
};
```

Unknown agents fall back to `INTERN_PROPS` (coffee mug).

---

## Verification

Commands verified `2026-09-08` on `pixel-office-monitor@0.1.0` (win32):

| Command | Result | Notes |
|---|---|---|
| `npm test` | **140 pass / 9 files** | schema, ingest/store, SSE replay/metrics, grouping, system actors, presentation, and pose behavior |
| `npx tsc --noEmit` | **pass** | no diagnostics |
| `npm run build` | **pass** | Next.js 16.3.4 production build; `/`, `/demo`, `/character-demo`, `/settings`, and API routes generated |
| `npm run lint` | **0 errors, 24 warnings** | unused legacy code, raw pixel `<img>` elements, and one hook dependency warning |
| Runtime on `3001` | **pass** | `/`, `/demo`, and `/character-demo` return `200`; root HTML contains empty-state text |

**Security posture: local-only.** Ingest and SSE reject bad tokens; zod validates ingress; SSE limits connections per IP and redacts prompt previews. `NEXT_PUBLIC_PIXEL_MONITOR_TOKEN` is intentionally visible in the browser and is not a production secret. `/api/state` and health data remain local diagnostics, Supabase policies permit anonymous reads when enabled, and ingest has no server-side rate limiter. Add separate user auth, private read authorization, origin controls, and ingest rate limiting before internet exposure.

Re-run verification:

```powershell
npm test
npm run build
npm run lint
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `401 { error:"unauthorized" }` on `POST /api/ingest` | token mismatch | Ensure `.env.local` `MONITOR_TOKEN=<YOUR_TOKEN>` matches plugin env `PIXEL_MONITOR_TOKEN=<YOUR_TOKEN>`. Restart `next dev` after editing env. Check header name — `x-monitor-token`, `x-token`, or `Authorization: Bearer <YOUR_TOKEN>` all valid (case-insensitive for Bearer). Try `curl` with each. |
| `◧ no active floor` forever | no ingest or SSE auth mismatch | Confirm port 3001, trigger an OpenCode task, and ensure `MONITOR_TOKEN`, `NEXT_PUBLIC_PIXEL_MONITOR_TOKEN`, and plugin `PIXEL_MONITOR_TOKEN` match. Restart Next dev after env changes. Check `curl http://localhost:3001/api/state`. |
| `port 3001 in use` / `EADDRINUSE` | another process on 3001 | `netstat -ano | findstr :3001` → `taskkill /PID <pid> /F`, or use `-p 3002` and update `PIXEL_MONITOR_URL=http://localhost:3002/api/ingest` in both env files + restart both. |
| `npm run build` TypeScript errors | stale `.next` or TS drift | `rm -rf .next` (or `rmdir /s /q .next`), `npm run build` again. If `tsconfig` path alias `@/*` broken, check `tsconfig.json:21` maps `@/* → ./src/*`. |
| `supabase` flag flip to cloud not showing data | `NEXT_PUBLIC_USE_SUPABASE=1` but env missing / RLS | MVP Map-first — `isSupabaseEnabled()` also checks `USE_SUPABASE` fallback. When `1`, ensure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are set (see migration `supabase/migrations/20260905000000_pixel_monitor.sql` — tables `floors` + `cubicles` with RLS `Service role full access` + `Anon can read`). Run migration via `supabase db push` or SQL editor. Toggle back to `0` to test local Map before cloud. |
| `Zzz` not floating / no working tick | `prefers-reduced-motion: reduce` active | Intentional freeze — `globals.css:118` disables `animate-floatZ`/`animate-working`. Disable OS reduce-motion or check media query in DevTools → Rendering. |
| `CRT` toggle not visible | flag off or CSS hidden | Toggle `/settings` → `CRT scanline overlay` writes `pixel:crt`. Inspect `main.crt::after` `repeating-linear-gradient` (`globals.css:53`). Clear `localStorage` key `pixel:crt` if stuck. |
| `5 fakes POST → 400 { issues:[...] }` | payload missing required `project`/`kind` | Schema requires `project` (new since `monitor-store` expects it). Always send `project` and all 8-kind enums exactly (`subtask.start` not `Subtask.Start`). |
| Plugin not sending | `.opencode/plugins` not loaded | Restart `opencode` (plugin loads on start). Verify with `opencode` log line. Check copies in **both** `Rai\.opencode\plugins\` and `~\.config\opencode\plugins\` are same version. |

**Runbook triage (Sprint 1→5 path):**

1. `curl http://localhost:3001/api/health` → check `uptime` > 0 / `floorsCount` grows after ingest.
2. `curl -v POST /api/ingest` with good token — expect `200 {ok:true}`. Bad token → confirm 401 codepath works.
3. `npm test` → `116` green proves store logic; failing store test means `monitor-store.ts` drift.

---

## File map

```
pixel-office-monitor/
├── PLAN.md                               # sprint plan & checklist (single source of truth — see §4)
├── README.md                              # this file (E3.1)
├── AGENTS.md                              # auto-generated Next.js agent rules — keep committed (next dev)
├── package.json                           # 0.1.0 — scripts: dev/build/start/lint/test (vitest)
├── vitest.config.mjs                      # node env, include src/**/*.{test,spec}
├── next.config.ts                         # NextConfig (minimal)
├── tsconfig.json                          # ES2017, jsx react-jsx, paths @/* → ./src/*
├── .env.example                           # token + Supabase placeholder vars
├── .env.local                             # local (gitignored) — MONITOR_TOKEN / PIXEL_MONITOR_URL / flag
├── scripts/
│   └── generate-assets.py                 # Python Pillow — generates all 43 PNGs
├── supabase/
│   └── migrations/20260905000000_pixel_monitor.sql   # floors + cubicles, RLS, indexes, prune comments
├── public/
│   └── sprites/
│       ├── floor-tile.png                 # 32×32 floor carpet tile
│       ├── wall-tile.png                  # 32×32 wall segment
│       ├── door-tile.png                  # 32×32 door
│       ├── cubicle-idle.png               # 64×64 cubicle frame (idle)
│       ├── cubicle-working.png            # 64×64 cubicle frame (working glow)
│       ├── props/                         # 23 desk prop PNGs (4–24px)
│       │   ├── binoculars.png
│       │   ├── blueprint-scroll.png
│       │   ├── book-stack.png
│       │   ├── cable-coil.png
│       │   ├── camera.png
│       │   ├── clipboard.png
│       │   ├── coffee-mug.png
│       │   ├── compass.png
│       │   ├── globe.png
│       │   ├── hard-hat.png
│       │   ├── headset.png
│       │   ├── laptop.png
│       │   ├── magnifier.png
│       │   ├── map.png
│       │   ├── neural-orb.png
│       │   ├── padlock.png
│       │   ├── paper-stack.png
│       │   ├── pen.png
│       │   ├── server-rack.png
│       │   ├── stamp.png
│       │   ├── t-square.png
│       │   ├── toolbox.png
│       │   └── wrench.png
│       └── monitors/                      # 15 monitor screen PNGs (16×8 each)
│           ├── ai-systems.png
│           ├── architect.png
│           ├── automation-engineer.png
│           ├── build.png
│           ├── devops.png
│           ├── documentation.png
│           ├── explore.png
│           ├── general.png
│           ├── plan.png
│           ├── project-manager.png
│           ├── qa-engineer.png
│           ├── researcher.png
│           ├── scout.png
│           ├── security-reviewer.png
│           └── senior-engineer.png
├── docs/
│   ├── office-revamp.md                   # R1–R5 revamp decisions & verification
│   └── pixel-art-assets.md                # R6–R10 asset inventory & palette reference
└── src/
    ├── app/
    │   ├── layout.tsx                     # Press_Start_2P + VT323 + Inter, metadata
    │   ├── globals.css                    # OLED tokens, pixelated, crt, floatZ/blink/pulse-live, monitor-glow, prop-float, reduced-motion
    │   ├── page.tsx                       # SSE state, floor selection, fitted OfficeScene, settings
    │   ├── demo/page.tsx                  # static office asset demo
    │   ├── character-demo/page.tsx        # sprite pose/direction demo
    │   ├── api/
    │   │   ├── ingest/route.ts            # POST zod + 401/400/200/405 — extractToken three-header
    │   │   ├── state/route.ts             # GET → getState() no-store
    │   │   ├── events/route.ts            # authenticated replayable SSE + heartbeat
    │   │   └── health/route.ts            # GET → { ok, floorsCount, uptime, timestamp }
    │   └── settings/page.tsx              # toggles (localStorage) + reduced-motion read-only
    ├── components/
    │   ├── Header.tsx                     # game HUD + stream freshness status
    │   ├── FloorSwitcher.tsx              # root-session floors, pin/rename/close/follow controls
    │   ├── scene/OfficeScene.tsx          # current 384×256 room, actors, handoffs, monitors
    │   ├── scene/SceneViewport.tsx        # responsive static whole-room fit
    │   ├── scene/CharacterSprite.tsx      # 8 poses × 4 directions with per-frame timing
    │   ├── AgentInspector.tsx             # selected actor/task detail modal
    │   ├── FloorTabs.tsx                  # legacy tab UI
    │   ├── OfficeGrid.tsx                 # legacy card grid
    │   ├── CubicleCard.tsx                # legacy cubicle renderer
    │   ├── CubicleFrame.tsx              # cubicle-idle/working.png background wrapper
    │   ├── AgentTooltip.tsx              # hover tooltip: name, role, status, prompt/tool
    │   ├── SpeechBubble.tsx              # prompt text bubble above sprite
    │   ├── DeskProps.tsx                 # per-agent prop PNGs, float animation
    │   ├── MonitorScreen.tsx             # per-agent monitor screen PNG, glow animation
    │   ├── Sprite.tsx                    # 16×16 CSS grid, 15 agents, 200ms/1800ms, reduced-motion
    │   ├── OfficeFloor.tsx               # floor texture wrapper (door, aisle, label)
    │   ├── VacantCubicle.tsx             # 6 dashed vacant desks
    │   ├── OfficeBackground.tsx          # fixed floor-tile.png repeating pattern (z-0)
    │   └── ErrorBoundary.tsx             # class boundary, ◩ glitch fallback, Try again reset
    └── lib/
        ├── schema.ts                      # zod ingestPayloadSchema (v/ts/sessionID/project/agent/kind/status/detail)
        ├── monitor-store.ts               # runtime maps, v1/v2 upsert, dedupe, event ring, SSE metrics
        ├── monitor-types.ts               # floor/session/actor/invocation snapshot contracts
        ├── scene/                         # layout, assets, pose derivation, routes, handoff controller
        ├── agents.ts                      # AGENT_MAP 15 entries + INTERN fallback, getAgentMeta()
        ├── agent-props.ts                 # AGENT_PROPS 15 agents + INTERN fallback, getAgentProps()
        ├── format.ts                      # formatSince (s/m/h/d), formatProject, formatTitle
        ├── supabase.ts                   # isSupabaseEnabled() flag helper + getSupabaseEnv()
        ├── supabase/{server,client,admin}.ts    # Supabase SSR clients
        └── __tests__/                     # 9 suites, 140 tests
```

Plugin (outside app, but part of system):

```
C:\Users\DELL\Desktop\Rai\.opencode\plugins\pixel-monitor.js   # event + tool.execute.before/after, debounce 300ms, 2s keepalive
C:\Users\DELL\.config\opencode\plugins\pixel-monitor.js        # identical copy (user global)
```

---

## Env var reference (all placeholders)

Never paste a real token from `API KEYS.txt`. Use `<YOUR_TOKEN>` locally and set via `.env.local` / shell. Verified vars:

```
MONITOR_TOKEN               # server-only, checked by /api/ingest
NEXT_PUBLIC_PIXEL_MONITOR_TOKEN # browser SSE token; local-only, must match MONITOR_TOKEN
PIXEL_MONITOR_TOKEN         # plugin, sent to server
PIXEL_MONITOR_URL           # plugin → http://localhost:3001/api/ingest
NEXT_PUBLIC_USE_SUPABASE    # 0/1 (or true) — Map vs Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY   # server-only
```

---

## What was verified for these docs

* **Read before documenting:** current page, SSE hook/route, monitor store/types/schema, scene layout/assets/renderers, all 9 test suites, env example, package scripts, and both current Pillow generators.
* **Ran:** 140 tests, TypeScript clean, production build clean, lint 0 errors/24 warnings, and HTTP `200` checks for `/`, `/demo`, and `/character-demo` on port 3001.
* **Not verified:** Supabase cloud path remains flag-off and was not tested against a live project. OpenCode plugin restart/live delegation was not repeated during this visual/doc pass.

---

*OLED #0F172A · VT323 · Press Start 2P · Pixelated crisp · authenticated SSE · static whole-room fit · 2026-09-08*
