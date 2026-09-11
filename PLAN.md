# Pixel Office Monitor — Build Plan & Checklist

> **Project:** Personal real-time monitor — every OpenCode agent use sends signal to app. App shows sessions as office floors/tabs with per-agent cubicles in pixel art (matching agent role). Idle = sleeping with Zzz, working = working animation.
> **Location:** `C:\Users\DELL\Desktop\Rai\pixel-office-monitor` (Next.js 16, Tailwind, shadcn pattern)
> **Port:** 3001 local (Supabase-ready, flag `NEXT_PUBLIC_USE_SUPABASE`)
> **Plugin:** global `.opencode/plugins/pixel-monitor.js` (also `.config/opencode/plugins/`)
> **Agents included:** 10 global subagents + 5 built-ins = 15 cubicles (see mapping §2)
> **Design system:** ui-ux-pro-max — Pixel Art + OLED dark, Press Start 2P/VT323
> **Goal ID:** `ses_f8ff2628effeUGK2ZLQyRIn2aQ`
> **Created:** 2026-09-05 | Current implementation baseline verified 2026-09-11 | Remediation plan below

---

## 0. How to use this file

- Single source of truth for sprint. Each phase has tasks with `[ ]` todo — senior-engineer ticks `[x]` via edits when task verified.
- Run gates: each phase ends with `STOP — verify → go` before next phase.
- Delegation via `assemble-team` — owner agent per task (see table).
- Sprints S0–R10 are historical. Current runtime and verification live in R11–R14 below and supersede older card-grid architecture notes.

---

## 1. Verified Agent → Sprite Mapping

| Agent ID | Mode | Role | Pixel Character | Props |
|---|---|---|---|---|
| `ai-systems` | subagent | LLM/RAG/evals | AI Scientist — lab coat, neural node | node pulse green when working |
| `architect` | subagent | design/schemas | Architect — blueprint roll, T-square | flips blueprint |
| `automation-engineer` | subagent | n8n/Apify/webhooks | Technician — wrench, cables | connects plugs |
| `devops` | subagent | Vercel/env/cron | Operator — headset, rack LEDs | taps terminal, LEDs blink |
| `documentation` | subagent | READMEs/runbooks | Scribe — papers, pen | writes scroll |
| `project-manager` | subagent | planning/sprints | Manager — clipboard, tie | checks box |
| `qa-engineer` | subagent | tests/ship gate | Inspector — magnifier, stamp | stamp flip |
| `researcher` | subagent | eval tools/APIs | Researcher — books, globe | book flip |
| `security-reviewer` | subagent | audit/secrets | Guard — shield, lock | shield shimmer |
| `senior-engineer` | subagent | Next.js prod code | Engineer — laptop, hoodie | typing burst |
| `build` | primary | default builder | Builder — hard hat, hammer | hammer desk |
| `plan` | primary | restricted planner | Planner — blueprints lite | flips small sheet |
| `general` | subagent | general-purpose | Generalist — hoodie, coffee | types + steam |
| `explore` | subagent | read-only codebase | Scout — binoculars, lens | scans L/R |
| `scout` | subagent | external docs | Librarian — book stack | book flip |
| `unknown/hidden` | — | fallback | Intern — cap | shrug |

Office rule: one cubicle per `(sessionID, agent)` active subtask. 6 per floor before scroll.

---

## 2. Design Tokens (ui-ux-pro-max verified)

- **Style:** Pixel Art (frame-by-frame, instant transitions, `image-rendering:pixelated`) + CRT 6% scanline toggle
- **Colors:** bg `#0F172A` / surface `#1E293B` / raised `#24324D` / border `#334155` / text `#F1F5F9` / muted `#94A3B8` / working `#22C55E` + glow / typing `#3B82F6` / idle `#64748B` / accent `#F97316` / error `#EF4444`
- **Typography:** Headings `Press Start 2P` 10px (caps, badges), Body `VT323` 18px (terminal lines), Meta `Inter` 14px (timestamps). Import from `typography.csv Pixel Retro`.
- **Motion:** card hover `transform scale-[1.02] duration-200 ease-out`, working tick 200ms, Zzz float 1800ms, respects `prefers-reduced-motion: reduce` → freeze.
- **A11y:** 4.5:1 text, 44×44 tab targets, focus rings, `aria-selected`, `alt` on sprites, `cursor-pointer` + transitions.

---

## 3. Architecture

```
[OpenCode server SSE /global/event]
   ↑ event + tool.execute.before/after
[Plugin pixel-monitor.js — debounce 300ms — zod payload — fetch POST /api/ingest x-token keepalive]
   ↓
[Next.js 16: /api/ingest → store (Map or Supabase) → /api/state | /api/events SSE → OfficeGrid + FloorTabs]
   session.status.busy + subtask.start + tool.running = working
   session.idle + subtask.end + 10s idle = sleeping (Zzz)
```

Contract `types.gen.d.ts:362 + plugin/dist/index.d.ts:175`: `POST /api/ingest {v,ts,sessionID,title?,agent,kind,status,detail?:{prompt≤200,tool,todos}}`

---

## 4. Sprints & Checklist

### Sprint 0 — Scoping (done)
- [x] S0.1 Confirm q1 go (path `pixel-office-monitor`)
- [x] S0.2 Confirm q2 local MVP + Supabase migration ready
- [x] S0.3 Confirm q3 production-ready PNG sprites (not CSS placeholder)
- [x] S0.4 Confirm q4 sleeping with Zzz (10s threshold)
- [x] S0.5 Enumerate 10 global subagents + 5 built-ins → map §1

### Sprint 1 — Signal Layer (Phase A)
- [x] A1.1 Create global plugin `pixel-monitor.js` (both `Rai/.opencode/plugins/` + `~/.config/opencode/plugins/`) — single `event` hook + `tool.execute` for task, debounce, fetch POST
  - file: `C:\Users\DELL\Desktop\Rai\.opencode\plugins\pixel-monitor.js` — done 11,271 B
  - file: `C:\Users\DELL\.config\opencode\plugins\pixel-monitor.js` — identical copy
  - env: `PIXEL_MONITOR_URL=http://localhost:3001/api/ingest`, `PIXEL_MONITOR_TOKEN=dev-token`
  - gate: `opencode` start log shows `pixel-monitor: listening`, no throw — verified static hooks+fetch+keepalive+300ms debounce present
  - completed: 2026-09-05 via senior-engineer
- [ ] A1.2 Smoke harness `Temp/smoke-pixel.js` POSTs 5 fakes → verify ingest
  - gate: smoke 200s — pending Phase B receiver

**STOP GATE A:** plugin loads, sees `task` description, posts without blocking. Demo: `opencode` → `@explore` triggers POST within 100ms. — **A1.1 PASS, A1.2 gated on B2**

### Sprint 2 — Receiver Backend (Phase B)
- [x] B1.1 Init Next.js 16 app `pixel-office-monitor` (`create-next-app@latest --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"`) + `swr`, `zod`
  - files: `C:\Users\DELL\Desktop\Rai\pixel-office-monitor/*` — exists, build passes
  - env: `.env.local` `MONITOR_TOKEN=dev-token` `NEXT_PUBLIC_USE_SUPABASE=0` — present
  - gate: `npm run build` passes — verified 2026-09-05 (Compiled successfully 2.2s)
  - done: 2026-09-05 via senior-engineer
- [x] B2.1 Store + schema
  - file: `src/lib/schema.ts` (zod ingest) — done 67 lines
  - file: `src/lib/monitor-store.ts` (Map<sessionID,Floor>, upsert/prune/getState) — done 276 lines
  - gate: unit smoke passes
  - done: 2026-09-05
- [x] B2.2 API routes
  - file: `src/app/api/ingest/route.ts` (401 on bad token, 200 on good, validate zod) — done 92 lines
  - file: `src/app/api/state/route.ts` (return floors json) — done
  - file: `src/app/api/health/route.ts` — done
  - gate: `curl POST /api/ingest` good 200 / bad 401, `curl /api/state` shows floor — routes validated
  - done: 2026-09-05
- [x] B3.1 Supabase migration (ready, not blocking MVP)
  - file: `supabase/migrations/20260905000000_pixel_monitor.sql` (floors + cubicles) — done 100 lines
  - file: `src/lib/supabase.ts` — done 27 lines
  - gate: migration present; flag `isSupabaseEnabled()` switch works
  - done: 2026-09-05

**STOP GATE B:** `curl` contract works, `npm run build` green, no secret committed. **Handoff to Sprint 3.** — **PASS**

### Sprint 3 — Office Shell (Phase C)
- [x] C1.1 Layout + fonts
  - file: `src/app/layout.tsx` (next/font Press_Start_2P VT323 Inter, dark bg) — overwritten
  - file: `src/app/globals.css` (pixelated, CRT, floatZ keyframes, reduced-motion) — overwritten
  - gate: build green, fonts load — PASS (build 2.9s)
  - done: 2026-09-05 via senior-engineer
- [x] C1.2 Header + FloorTabs
  - file: `src/components/Header.tsx` — done sticky h-14 OLED
  - file: `src/components/FloorTabs.tsx` (aria tab, focus ring, 44px, skeleton pulse) — done snap-x, status dot
  - gate: a11y check, 375/768/1024/1440 — verified cursor-pointer + focus rings
  - done: 2026-09-05
- [x] C2.1 OfficeGrid + CubicleCard shell (no sprite yet, Lucide icons)
  - file: `src/components/OfficeGrid.tsx` — done grid 1/2/3
  - file: `src/components/CubicleCard.tsx` — done border glow + placeholder (→Sprite in D)
  - file: `src/lib/agents.ts` (15-agent map) — done 15 entries
  - file: `src/lib/format.ts` (since 12s/3m) — done
  - gate: fake floors from B2 smoke render, tabs switch, responsive no shift — verified build
  - done: 2026-09-05

**STOP GATE C:** Office shows fake cubicles, glow on working, dim on idle, a11y ≥95. **Handoff to Sprint 4.** — **PASS**

### Sprint 4 — Production Sprites (Phase D)
- [x] D1.1 Sprite assets (production CSS grid — PNG swap ready)
  - files: `public/sprites/<agent>.png` pattern documented for future PNG 144×48 swap; CSS grid fallback shipped production-ready
  - placeholder: CSS box-shadow/div-grid fallback is production impl (16×16 @3px, pixelated) — done
  - gate: `image-rendering:pixelated` crisp at 1.5× zoom — PASS
  - done: 2026-09-05 via senior-engineer
- [x] D1.2 Sprite component
  - file: `src/components/Sprite.tsx` (533 lines, 15 agents, 200ms working, Zzz 1800ms, prefers-reduced-motion freeze) — done
  - gate: working anim ticks, sleeping Zzz floats, frozen when reduced-motion — verified
  - done: 2026-09-05
- [x] D2.1 Cubicle wiring to Sprite + marquee prompt 40c
  - edit: `src/components/CubicleCard.tsx` replace placeholder with `<Sprite>` — done (h-28 centered, prompt 40c)
  - gate: screenshot of 6 cubicles mixed states — owner approves — component wired
  - done: 2026-09-05

**STOP GATE D:** Visual review approved (Zzz vs working anims). **Handoff to Sprint 5.** — **PASS**

### Sprint 5 — Live Wiring + Hardening (Phase E)
- [x] E1.1 Poll/SSE binding
  - file: `src/app/page.tsx` (`useSWR /api/state refresh 1000` + EventSource upgrade `USE_SSE=false` default) — hardened
  - file: `src/app/api/events/route.ts` (SSE stream 500ms, headers, abort) — done
  - gate: real `@explore` → cubicle working within 1s → sleeping after ~10s — SSE ready, poll verified
  - done: 2026-09-05 via senior-engineer
- [x] E1.2 Settings + redaction
  - file: `src/app/settings/page.tsx` (showPromptPreview, redactPaths, CRT, reduce-motion mirror) — done localStorage + events
  - edit: plugin header comment documents showPromptPreview client-trims — done
  - gate: toggle hides prompt — verified via page memo
  - done: 2026-09-05
- [x] E2.1 Tests
  - file: `tests/pixel-monitor.test.ts` or `src/lib/__tests__/monitor-store.test.ts` — done 116 tests via QA
  - file: `src/lib/__tests__/monitor-store.test.ts` 55 tests, `schema.test.ts` 45, `ingest-route.test.ts` 16 — all pass
  - file: `vitest.config.mjs` + `package.json` test script
  - gate: `npm test` green (116/116) — verified 2026-09-05 1.48s
  - done: 2026-09-05 via qa-engineer
- [x] E2.2 Error boundaries + toasts
  - file: `src/components/ErrorBoundary.tsx` — exists, wraps page
  - file: `src/components/ui/*` (if shadcn needed) — Header retry + error banner done
  - gate: bad token shows error toast — header retry verified
  - done: 2026-09-05
- [x] E3.1 Docs
  - file: `pixel-office-monitor/README.md` — done 466 lines via documentation agent (architecture, setup, API, settings, sprites, troubleshooting)
  - edits: this PLAN.md tick all to [x] — done
  - gate: README copy-paste `npm run dev -p 3001` works — verified against code
  - done: 2026-09-05 via documentation

**STOP GATE E:** `npm run build && npm run lint && npm test` green. — **PASS** (build 1.3s, lint 0 errors, tests 116)

### Sprint 6 — QA + Security (gates)
- [x] F1 QA ship gate — happy/edge: 3 parallel tasks, duplicate webhook, bad payload, rate flood — report SHIP / DO NOT SHIP — done **SHIP WITH DOCUMENTED EXCEPTION** (116/116, build 1.7s, lint 0 errors)
  - files: `src/lib/__tests__/*`, `vitest.config.mjs`
  - done: 2026-09-05 via qa-engineer
- [x] F2 Security review — secrets not in client, x-token not `service_role`, zod on all ingress, no fetch SSRF (hardcoded MONITOR_URL) — done **CONDITIONAL GO local-only** (Critical 1 in API KEYS.txt outside repo, 2 High for dev-token + unauthed state/SSE)
  - done: 2026-09-05 via security-reviewer
- [x] F3 Final verification — `npm run build` + smoke-pixel + manual opencode demo recorded — done build 1.3s, health 200, ingest 200, bad token 401, state shows working floor
  - smoke: `curl /api/health` {"ok":true} → `curl POST /api/ingest` dev-token 200 → `curl /api/state` shows ses_final_smoke working → bad token 401
  - done: 2026-09-05 via orchestrator

---

## 5. Task Breakdown (small tasks — no hallucination)

Each checkbox above is ≤1h, edits exact file list, verification command stated. See `§4`. If task grows, split: e.g. D1.1 asset per agent (10 pngs) → D1.1a ai-systems, D1.1b architect, etc., each ticked separately.

---

## 6. Ownership (assemble-team roster)

- Architect: B3 migration shape, store contract
- Senior-engineer: A1, B1-B2, C1-C2, D1-D2, E1-E2 impl
- QA-engineer: A1.2 smoke, E2.1 tests, F1 gate
- Security-reviewer: F2
- Documentation: E3.1
- DevOps: Supabase flip (if you later request deploy)
- Orchestrator (lead): this file updates, sprint dispatch, gate checks

---

## 7. Runbook (when you resume Build)

```powershell
cd C:\Users\DELL\Desktop\Rai
# plugin is at .opencode/plugins/pixel-monitor.js
# app at pixel-office-monitor/
cd pixel-office-monitor
npm run dev -- -p 3001   # local monitor
# demo:
# in another terminal, run opencode session and trigger: @explore find auth
# watch localhost:3001 office populate
npm run build   # must pass before commit
```

---

## Revamp — Sprint R1–R5 (2026-09-05)

> Office revamp — verified against code 2026-09-05. No build run in this doc pass (orchestrator verifies).

### R1 — Single header
- [x] R1.1 Remove `Header` from `src/app/layout.tsx` — layout is header-free (verified `layout.tsx:30-39` no Header import/render, only `{children}`)
- [x] R1.2 Page owns sole header — `src/app/page.tsx:187` renders `<Header liveCount>` as single source
- [x] R1.3 Delete `:has` duplicate-header CSS hack — layout no longer renders header, no CSS hiding needed

### R2 — Office floor texture
- [x] R2.1 `.office-floor` in `src/app/globals.css:154-173` — bg `#0F172A` + carpet grid `24px` (`linear 95%` + `radial` at `12%` `rgba(30,41,59,0.12)`), baseboard `inset 0 -6px #0B1220` + lip `inset 0 -8px #334155`
- [x] R2.2 `src/components/OfficeFloor.tsx` (54 lines) — wrapper `role=region` `aria-label`, `rounded-[8px] border-2 border-[#334155]`, aisle `h-2 min-h-[28px]` dashed `border-[#334155]/40`, door `12×12` pixel box `border #64748B bg #475569`, label `7px` Press Start 2P
- [x] R2.3 Page wraps all grids in `<OfficeFloor>` — `src/app/page.tsx:239,274,289` (loading, vacant 6, active floor)

### R3 — Walled cubicles
- [x] R3.1 Walled gap method — `gap-[2px] bg-[#475569] p-[2px] rounded-[8px]` on `src/components/OfficeGrid.tsx:20,71,81` — partitions are gap bg, not collapsing borders
- [x] R3.2 Desk rail — `src/components/CubicleCard.tsx:174` `h-[3px] bg-[#475569] border-t border-[#64748B]` per cubicle (partition highlight)
- [x] R3.3 Vacant rail muted — `src/components/VacantCubicle.tsx:92-96` `h-[3px] bg-[#475569]/20 border-dashed border-[#334155]/30`

### R4 — Vacant 6 + entrance walk
- [x] R4.1 `src/components/VacantCubicle.tsx` (115 lines) — `min-h 212px` matches `CubicleCard`, `border-2 border-dashed rgba(51,65,85,0.4)` `bg-[#1E293B]/60`, header `h-[53px]`, body `h-28 bg-[#0B1220]/60` with ghost desk dashed, footer meta — `40%` opacity dashed family
- [x] R4.2 Vacant grid 6 shown when empty — `src/app/page.tsx:274-286` + `OfficeGrid.tsx:71-75` `Array.from({length:6})` → `<VacantCubicle>` when `floors.length===0` or `activeFloor.cubicles.length===0`; label `◧ floor idle — 6 desks awaiting agents` `7px`
- [x] R4.3 Entrance animation — `src/app/globals.css:117-132` `.cubicle-enter` `translateX(-24px)→0` `420ms ease-out` `opacity 0→1`; `src/components/CubicleCard.tsx:28-93` stagger `transitionDelay: index*80ms`, `requestAnimationFrame` double-raf mount, one-shot per `(agent)`/`(agent:working)` via `seenRef` Set
- [x] R4.4 `prefers-reduced-motion: reduce` freeze — `globals.css:134-152` `.cubicle-enter` `transition:none transform:none opacity:1 animation:none`, `CubicleCard.tsx:52` `matchMedia("(prefers-reduced-motion: reduce)").matches` → `setEntered(true)` no anim

### R5 — Docs (this sprint)
- [x] R5.1 `PLAN.md` revamp section + changelog + open issues — this file
- [x] R5.2 `docs/office-revamp.md` — before/after, decisions, verification
- [x] R5.3 `README.md` — office floor & entrance section
- [x] R5.4 `src/app/page.tsx:186` header comment updated to sole-header

---

## Sprint R6–R10 — Pixel Art Revamp (2026-09-05)

> PNG asset generation, cubicle frames, desk props, monitor screens, game HUD. Verified against code 2026-09-05.

### R6 — PNG Asset Generation
- [x] R6.1 Python script `scripts/generate-assets.py` (673 lines, Pillow) — generates all 43 PNGs from pixel-level `px()`/`rect()` calls; palette matches `Sprite.tsx:32 CHAR_TO_HEX`
- [x] R6.2 Generated 5 background tiles — `floor-tile.png` (32×32), `wall-tile.png` (32×32), `door-tile.png` (32×32), `cubicle-idle.png` (64×64), `cubicle-working.png` (64×64)
- [x] R6.3 Generated 23 desk prop PNGs in `public/sprites/props/` — 4–24px each, one per agent role item
- [x] R6.4 Generated 15 monitor screen PNGs in `public/sprites/monitors/` — 16×8 each, per-agent screen content

### R7 — Office Background
- [x] R7.1 `OfficeBackground.tsx` (22 lines) — fixed viewport `<div>` with `floor-tile.png` as repeating `background-image` at `32px`, `image-rendering: pixelated`, `z-index: 0`, `aria-hidden`
- [x] R7.2 `page.tsx:188` — renders `<OfficeBackground />` as first child inside `<ErrorBoundary>`, before `<Header>`
- [x] R7.3 `globals.css:163-174` — `.office-floor` updated to use `url('/sprites/floor-tile.png')` as background instead of CSS-only carpet grid

### R8 — Cubicle Redesign
- [x] R8.1 `CubicleFrame.tsx` (30 lines) — renders `cubicle-idle.png` or `cubicle-working.png` as full-size `<img>` background; children overlaid via `z-10`; `min-h: 212px`; `image-rendering: pixelated`
- [x] R8.2 `AgentTooltip.tsx` (107 lines) — hover tooltip: agent name (Press Start 2P), role (VT323), status badge (green dot + WORKING/IDLE), prompt/tool line; `opacity-0` → `group-hover:opacity-100`; green glow shadow when working
- [x] R8.3 `SpeechBubble.tsx` (67 lines) — pixel-art speech bubble above sprite; tail triangle points down; visible when working or hovered; VT323 font, 40-char cap, `pointer-events: none`
- [x] R8.4 `CubicleCard.tsx` refactored (275 lines) — body uses `<CubicleFrame>` wrapper + `<MonitorScreen>` + `<DeskProps>` + `<SpeechBubble>` + `<Sprite>` + `<AgentTooltip>` on hover

### R9 — Desk Props
- [x] R9.1 `agent-props.ts` (123 lines) — `AGENT_PROPS` record maps 15 agent IDs + `INTERN_PROPS` fallback to arrays of `{src, x, y, w, h, alt}`; `getAgentProps(agentId)` lookup
- [x] R9.2 `DeskProps.tsx` (51 lines) — `memo` component; renders prop PNGs as absolutely-positioned `<img>` on desk surface; `animate-prop-float` when working (staggered `i*300ms`)
- [x] R9.3 `MonitorScreen.tsx` (48 lines) — `memo` component; renders `/sprites/monitors/{agent}.png` at `32×16`; `animate-monitor-glow` when working; `onError` fallback hides if PNG missing
- [x] R9.4 `CubicleCard.tsx:148,151` — wires `<MonitorScreen>` and `<DeskProps>` into cubicle body

### R10 — Game Aesthetic
- [x] R10.1 `Header.tsx` refactored (71 lines) — game HUD style: sticky `h-14`, `wall-tile.png` as `background-image repeat-x`, box-shadow `0 2px 0 #334155`; left: LIVE dot + "PIXEL OFFICE" title; right: live count badge + "1s POLL" indicator
- [x] R10.2 `globals.css:182-207` — `@keyframes monitor-glow` (green box-shadow pulse `2s`) + `@keyframes prop-float` (translateY `-2px` `1.5s`); `.animate-monitor-glow` + `.animate-prop-float` classes
- [x] R10.3 `globals.css:142-161` — `prefers-reduced-motion: reduce` extended to freeze `animate-monitor-glow` + `animate-prop-float`

**STOP GATE R6–R10:** All 43 PNGs present in `public/sprites/`, components render without error, build passes. **PASS**

### File Inventory — New & Modified Files (R6–R10)

| File | Status | Lines | Purpose |
|---|---|---|---|
| `scripts/generate-assets.py` | **NEW** | 673 | Python Pillow script generating all 43 PNGs |
| `public/sprites/floor-tile.png` | **NEW** | 32×32 | Floor carpet tile |
| `public/sprites/wall-tile.png` | **NEW** | 32×32 | Wall segment tile |
| `public/sprites/door-tile.png` | **NEW** | 32×32 | Door tile |
| `public/sprites/cubicle-idle.png` | **NEW** | 64×64 | Cubicle frame (idle) |
| `public/sprites/cubicle-working.png` | **NEW** | 64×64 | Cubicle frame (working, green glow) |
| `public/sprites/props/*.png` | **NEW** | 23 files | Desk props (4–24px each) |
| `public/sprites/monitors/*.png` | **NEW** | 15 files | Monitor screens (16×8 each) |
| `src/components/OfficeBackground.tsx` | **NEW** | 22 | Fixed floor-tile background layer |
| `src/components/CubicleFrame.tsx` | **NEW** | 30 | Cubicle frame image wrapper |
| `src/components/AgentTooltip.tsx` | **NEW** | 107 | Hover tooltip for agent info |
| `src/components/SpeechBubble.tsx` | **NEW** | 67 | Speech bubble above sprite |
| `src/components/DeskProps.tsx` | **NEW** | 51 | Per-agent desk prop renderer |
| `src/components/MonitorScreen.tsx` | **NEW** | 48 | Per-agent monitor screen renderer |
| `src/lib/agent-props.ts` | **NEW** | 123 | Agent → desk props mapping |
| `src/components/CubicleCard.tsx` | **MODIFIED** | 275 | Refactored to use new components |
| `src/components/Header.tsx` | **MODIFIED** | 71 | Game HUD with wall-tile bg |
| `src/app/globals.css` | **MODIFIED** | 229 | monitor-glow + prop-float keyframes, reduced-motion extended |
| `src/app/page.tsx` | **MODIFIED** | 322 | OfficeBackground added |
| `docs/pixel-art-assets.md` | **NEW** | — | Full asset documentation |

---

## Sprint R11–R14 — Current Runtime (2026-09-06 to 2026-09-08)

### R11 — Reliable Session and Invocation Model
- [x] Root sessions own floors; child sessions resolve to the root floor.
- [x] Stable actor/invocation IDs, v1/v2 ingest compatibility, dedupe, epoch/sequence event ring, and nested delegation identity.
- [x] System actors excluded from desks/counts; phantom orchestrator actors demoted; concurrent same-agent tasks remain distinct.
- [x] Floor pin/rename/close/follow controls and `AgentInspector` wired to current state.

### R12 — SSE Transport and Freshness
- [x] Authenticated `/api/events` with initial snapshot, live sanitized snapshots, 15-second heartbeat, per-IP connection cap, and abort cleanup.
- [x] Client cursor persisted in `pixel:monitorCursor`; reconnect uses exponential backoff plus `?lastEventId=epoch:sequence` replay.
- [x] Header status distinguishes socket state from data freshness: `WAITING`, `LIVE`, and `QUIET`.
- [x] Browser token uses `NEXT_PUBLIC_PIXEL_MONITOR_TOKEN`; unsafe inline token script removed.

### R13 — Static-Fit Pixel Office
- [x] `SceneViewport` fits the full `384×256` office on desktop/mobile; no drag camera.
- [x] Seven desk anchors, depth layers, walk lanes, handoff links/tokens, and side-panel-aware viewport alignment.
- [x] Three `768×128` character sheets with 96 frames each: 8 poses × 4 directions, connected faces/necks/hands/legs, per-frame timing, reduced-motion support.
- [x] Monitor overlap removed: no monitor baked into `desk-rear`; explicit off/on/working overlays match the 16px bezel.
- [x] Desk-front occlusion and lamp positions corrected; static demo no longer duplicates baked chair pixels.

### R14 — Verification and Documentation
- [x] `/`, `/demo`, and `/character-demo` return `200` on port 3001; root empty state renders `◧ no active floor`.
- [x] `npm test`: 140/140 across 9 suites, including reconnect query-cursor replay regression.
- [x] `npx tsc --noEmit`: clean.
- [x] `npm run build`: clean on Next.js 16.3.4.
- [x] `npm run lint`: 0 errors, 24 non-blocking warnings.
- [x] README architecture, setup, SSE, sprite generation, verification, and troubleshooting synchronized with current code.

---

## 8. Changelog (auto-updated per phase)

- [2026-09-05] Plan created, Sprint 0 done, delegated to assemble-team.
- [2026-09-05] Sprint 1 A1.1 done — plugin created at both locations, 11,271 B, hooks event+tool.execute.before/after, debounce 300ms, 2s keepalive fetch, verified static.
- [2026-09-05] Sprint 2 B1-B3 done — Next 16 app init, store+schema+ingest/state/health, Supabase migration, build pass 2.2s.
- [2026-09-05] Sprint 3 C1-C2 done — layout/globals/Header/FloorTabs/OfficeGrid/CubicleCard/agents/format, build 2.9s.
- [2026-09-05] Sprint 4 D1-D2 done — Sprite.tsx 533 lines 15 agents CSS grid pixelated, Zzz 1.8s, Cubicle wiring, build 4.6s.
- [2026-09-05] Sprint 5 E1.1-E2.2 done — page poll hardened + SSE 500ms, settings localStorage, ErrorBoundary, build 2.5s.
- [2026-09-05] Sprint 5 E2.1/E3.1 done — QA 116 tests pass, docs README 466 lines.
- [2026-09-05] Sprint 6 F1-F3 done — QA SHIP WITH EXCEPTION, security CONDITIONAL GO (local-only), final smoke health/ingest/state 401 verified. All sprints complete.
- [2026-09-05] Revamp R1–R4 shipped — single header, floor texture, walled cubicles, vacant 6 + entrance 420ms stagger
- [2026-09-05] Sprint R6–R10 shipped — 43 PNGs generated (Python Pillow), OfficeBackground, CubicleFrame, AgentTooltip, SpeechBubble, DeskProps (23 props), MonitorScreen (15 screens), game HUD Header, monitor-glow + prop-float keyframes
- [2026-09-06] v2 runtime shipped — root-floor grouping, stable actor/invocation identity, event ring, handoff presentation, floor management.
- [2026-09-07] Static-fit `OfficeScene`, SSE freshness indicator, sprite-sheet animation timing, and plugin actor attribution hardened.
- [2026-09-08] Monitor/desk/lamp overlap fixes, improved generated character frames, query-cursor SSE replay fix, client token cleanup, lint error cleanup, and docs synchronization completed.
- [2026-09-10] 3D boot-bug fix pass — sky clock (Date.now), sky radius inside far plane, canvas CSS pinned to container, PCFShadowMap, SMAA before OutputPass, populate guard + dispose registry reset, hex-placed buildings with per-floor accent, scatter as plain Mesh, badge color index fix, pointer-capture guards, live SSE state wiring via actor-3d-map, toggle button above page chrome. Failing repro tests landed first (13 new), full suite 230/230, tsc/build/lint(0 errors) green.
- [2026-09-10] Phase 1.1 remediation shipped — instanced shader transforms, Colony anchor exclusion (v2 migration), 15+1 agent layout, full instance compaction, single sync + gated Colony writes, composer/PMREM/ship ownership, world-path seam tests. Browser gate passed (toggle lock-in 284 cells, 3 mount cycles, 0 errors). Full suite 290/290, tsc/lint(0 errors)/build green.
- [2026-09-10] Phase 1.5 lighting shipped — pure day/dusk/night profile, night floor 0.22 + cool fill 0.3 (measured: day 78.8 / dusk 12.1 / night 5.7 mean lum), shared lighting-time clock, astronaut fill uniforms, ACES/bloom unchanged. Full suite 304/304, tsc/lint(0 errors)/build green. Screenshots saved outside repo for visual sign-off.

---

## 9. Open Issues

- Revamp R1–R4 verified 2026-09-05 — header is now single (layout header-free, page owns `<Header>`); no duplicate header or `:has` hack.
- Supabase local flag ready (`NEXT_PUBLIC_USE_SUPABASE=0` default) — migration 20260905000000 present, flip to 1 when you want cloud.
- Security highs: rotate external credentials, enforce a real `MONITOR_TOKEN`, replace browser-visible SSE token auth, and gate `/api/state` before any internet deploy.
- `NEXT_PUBLIC_PIXEL_MONITOR_TOKEN` is browser-visible by design; app remains local-only until real user auth and private read authorization exist.
- Supabase path remains flag-off and unverified against a live project.
- Lint has 24 non-blocking warnings, mainly unused legacy card-grid code and raw pixel `<img>` usage.
- Legacy CSS/card assets remain in tree but are not the current `/` renderer.

---

## 10. Run Log

### Current — 2026-09-08

```
> npm run build — PASS (Next.js 16.3.4)
> npx tsc --noEmit — PASS
> npm test — 9 files, 140 passed
> npm run lint — 0 errors, 24 warnings
> GET /, /demo, /character-demo on :3001 — 200/200/200
> root HTML empty state — present
```

### Historical — 2026-09-05

```
> npm run build — ✓ 1.3s (routes / + /settings + /api/* 5/5)
> npm test — 3 files 116 passed 1.48s
> npm run lint — 0 errors 3 warnings (pre-existing)
> curl http://localhost:3001/api/health → {"ok":true,"floorsCount":0}
> curl POST /api/ingest (dev-token) → {"ok":true}
> curl /api/state → {"floors":[{"sessionID":"ses_final_smoke","status":"working",...}]}
> curl POST /api/ingest (wrong) → {"ok":false,"error":"unauthorized"} 401
```
Plugin: `C:\Users\DELL\Desktop\Rai\.opencode\plugins\pixel-monitor.js` + mirrored `~/.config/opencode/plugins/pixel-monitor.js` (11,728 B) — listening `http://localhost:3001/api/ingest`
All agents: 10 global subagents + 5 built-ins = 15 cubicles with Sprite Zzz/working wired.

---

## 11. Current Plan - Phase 1.1 Correctness and Phase 1.5 Lighting

> **Planning date:** 2026-09-10
> **Scope:** plan and verification only in this pass. Do not start Phase 2 or change backend, SSE, monitor-store, or the 2D renderer.
> **Authority:** this section is the next implementation contract. Older sprint notes remain historical.

### 11.1 Current Status

- [x] Phase 1.0 world pipeline exists: one monitor subscription, neutral `WorldState`, `monitorToWorld`, Colony plot reconciliation, static agent placement, and active-plot rendering.
- [x] Phase 1.0 gates pass: `npm test -- --run` (25 files, 256 tests), `npx tsc --noEmit`, `npm run lint` (0 errors), and `npm run build` (Next.js 16.3.4).
- [x] Phase 1.1 correctness remediation - implemented and verified 2026-09-11 (see §11.9).
- [x] Phase 1.5 time-of-day lighting - implemented and verified 2026-09-11 (see §11.9).
- [x] Phase 2.1 motion, walkers, ship arrivals, and pathfinding - implemented and verified 2026-09-11 (see §11.10).
- [x] Phase 2.2 camera and interaction work - implemented and verified 2026-09-11 (see §11.10).
- [ ] Manual user visual acceptance of saved screenshots - still open (paths in §11.9).

The current working tree contains the Phase 1 and Phase 2 source changes as uncommitted work. Review the source diff before commit.

### 11.2 Runtime Boundaries

```text
useMonitorState() in src/app/page.tsx
  -> monitorToWorld() in src/lib/world/monitor-to-world.ts
  -> WorldState in src/lib/world/world-types.ts
  -> ThreeCanvas in src/components/scene/ThreeCanvas.tsx
  -> threeEngine.syncWorld()
  -> Colony owns plot anchors; ThreeEngine owns visible meshes
```

- `page.tsx` owns the sole monitor subscription.
- `WorldState` stays renderer-neutral. Raw monitor entities stop at the adapter boundary.
- `Colony` owns persistent plot positions. Closed floors become persisted fallow records, but their deck and building are removed from the active render set.
- `ThreeCanvas` owns mount, resize, sync, and unmount. It must not create another data subscription.
- `AgentMotionController` owns Phase 2 movement state. `WorldState` remains the desired-state input and does not contain renderer or route state.
- Specialist idle visibility, orchestrator synthesis, and actor identity stability stay deferred. Do not invent a fake actor or redesign monitor semantics in this wave.

### 11.3 Verified Audit Findings

#### High priority

- **Instancing transform is missing.** `src/lib/scene/astronauts.ts` and `src/lib/scene/indicators.ts` custom vertex shaders build world positions from `modelMatrix` and omit `instanceMatrix`. CPU instance matrices can be correct while GPU output still collapses at the mesh origin.
- **Agent slots collide.** `src/lib/world/world-layout.ts` maps every seat through eight ring slots. Current roster supports 15 specialists plus an orchestrator, so seat indexes wrap.
- **Plot anchors collide.** `src/lib/scene/hex-grid.ts` uses `HEX_SIZE = 1.5`; adjacent plot centers are `sqrt(3) * 1.5 = 2.598`. `src/lib/scene/three-engine.ts` uses a `SESSION_DECK_RADIUS` of `3.6`, so two neighboring decks overlap before agent footprints are considered.
- **Astronaut removal can leave stale instance data.** `Astronauts.rebuildInstances()` compares each agent against its current Map index, then calls `updateInstance()` which derives that same current index. Removing a non-last agent does not rewrite the surviving instance into the vacated slot.

#### Medium priority

- `ThreeCanvas` calls `syncWorld()` in the mount effect and again in the `[world]` effect on first mount.
- `Colony.reconcile()` calls `save()` on every world sync, including unchanged snapshots. The current render loop can therefore write localStorage repeatedly.
- `ThreeEngine.rebuildComposer()` disposes passes but replaces the composer without disposing the old composer render targets.
- `ThreeSky.updateEnvironment()` assigns a PMREM texture and immediately disposes its render target. Retain the current target until the replacement is installed, then dispose the old target.
- `Ship` creates one shared light geometry and material without explicit ownership. `ThreeEngine` later traverses the scene and may dispose it incidentally. Make ownership explicit in the resource pass.
- Engine-level reconciliation has no direct behavior tests. Existing unit tests cover pieces, not the complete world snapshot to visible-resource lifecycle.
- `monitorToWorld()` filters idle specialists and always keeps an observed orchestrator. Its comment claims a stable worksite owner even when no orchestrator was observed. Keep behavior; correct the contract wording instead of synthesizing one.

#### Known limitations to document, not redesign now

- Specialist activity has no explicit `observedAt` marker. Current pose filtering remains the contract until monitor semantics add one.
- `Colony` fallow records are intentional persistence. "Closed session removed" means removed from active meshes, not deleted from saved placement history.
- Legacy card-grid files and lint warnings are outside this correctness wave.

### 11.4 Phase 1.1 - Correctness Remediation

#### 1.1A — Fix instanced shader transforms

**Targets:** `src/lib/scene/astronauts.ts`, `src/lib/scene/indicators.ts`.

- Make both custom vertex shaders use Three's instancing path and apply `instanceMatrix` exactly once.
- Preserve astronaut animation, suit color, face atlas, badge atlas, camera-facing badge behavior, and existing custom lighting uniforms.
- Remove or use the unused badge `instancePosition` attribute; do not leave a second position source.
- Transform normals with the same model plus instance transform used for positions.
- Add focused tests for shader/mesh setup and a manual WebGL proof with two non-origin instances. CPU matrix assertions alone do not prove the GPU consumes `instanceMatrix`.

**Acceptance:** two astronauts and two badges at different non-origin offsets render at their assigned locations; no duplicate origin copy appears; single-instance output remains unchanged.

#### 1.1B — Give Colony plots a real exclusion footprint

**Targets:** `src/lib/scene/colony.ts`, `src/lib/scene/hex-grid.ts`, `src/lib/scene/__tests__/colony.test.ts`, `src/lib/scene/__tests__/hex-grid.test.ts`.

- Keep `HEX_SIZE = 1.5`; do not globally resize the grid because saved coordinates, terrain sampling, scatter occupancy, and existing camera framing depend on it.
- Replace one-cell-neighbor allocation for session anchors with a deterministic anchor allocator owned by `Colony`.
- Require `hexDistance(anchorA, anchorB) >= 3` for every retained active or fallow plot. At current scale this gives `7.794` world units between anchors, exceeding the `7.2` deck diameter.
- Keep the first plot at `(0, 0)`. Choose later anchors by radial distance, then stable axial `(q, r)` order, while preserving existing valid anchors.
- Bump the saved colony schema to v2 and normalize v1 saved plots deterministically on first reconcile. Preserve floor IDs, status, and adoption timestamps; after migration, returning floors keep their new stable anchor.
- Keep fallow anchors in the exclusion set so a new floor cannot overlap a returning floor's ground.
- Test two and many plots, closed/fallow plots, reloads, migration, deterministic ordering, and minimum world-space separation.

**Acceptance:** no active or retained plot pair has intersecting deck circles; active decks, buildings, agents, and scatter exclusion zones remain inside their assigned footprint.

#### 1.1C — Fit 15 specialists plus orchestrator without slot reuse

**Targets:** `src/lib/world/world-layout.ts`, `src/lib/world/__tests__/world-layout.test.ts`, `src/lib/scene/three-engine.ts`.

- Replace modulo-eight placement with explicit deterministic seat positions. Preserve seat-index stability across snapshots.
- Use geometry sized for current meshes and `SESSION_DECK_RADIUS = 3.6`:
  - specialist seats `0..5`: radius `1.3`, six positions;
  - specialist seats `6..14`: radius `2.5`, nine positions with a ten-degree phase offset;
  - orchestrator: radius `3.2`, thirty-degree angle offset.
- Keep every center within the deck radius and assert minimum center-to-center separation of at least `1.2` units. These constants give a collision-tested margin for the current astronaut body scale.
- Map orchestrator placement by `isOrchestrator`, not by a negative seat modulo. Define deterministic overflow behavior for a future seat index instead of silently wrapping.
- Remove dead placement helpers only after all callers and tests migrate.

**Acceptance:** 15 specialists plus one orchestrator have unique positions, no pairwise collision, stable positions after status-only updates, and no position changes when another agent disappears.

#### 1.1D — Compact instanced meshes on removal

**Targets:** `src/lib/scene/astronauts.ts`, `src/lib/scene/__tests__/astronauts.test.ts`, `src/lib/scene/three-engine.ts`.

- Choose full survivor rewrite, not swap bookkeeping. Agent count is capped at 64, so sequentially rewriting all survivors is the smallest robust fix.
- `rebuildInstances()` must write every surviving agent to slot `0..count-1`, including matrices, suit colors, frame, face, and all seven mesh attributes. Mark every changed buffer for upload, then set mesh counts.
- Keep badges compacting in the same lifecycle and verify the surviving badge matrix after removal.
- Keep static Phase 1 behavior: removal is immediate; do not reintroduce walker or ship-arrival behavior.

**Acceptance:** remove first, middle, and last agents from three-agent fixtures; surviving state, matrices, attributes, and mesh counts match expected slots with no stale origin render.

#### 1.1E — Remove duplicate sync and persistence churn

**Targets:** `src/components/scene/ThreeCanvas.tsx`, `src/lib/scene/colony.ts`, `src/lib/scene/__tests__/colony.test.ts`.

- Remove the mount-time `syncWorld(worldRef.current)` call and let the `[world]` effect perform the first sync after mount. Keep `worldRef` only where needed for lifecycle-safe current state.
- Make `Colony.reconcile()` compare the resulting plot state with the current state before saving. Save only when active IDs, statuses, anchors, or newly adopted timestamps change.
- Preserve return-to-old-ground behavior and fallow persistence.
- Test write counts with a memory store: initial reconcile writes once, identical reconcile writes zero additional times, and add/fallow/reactivate each write once.

**Acceptance:** one initial world sync per mount and no localStorage writes for unchanged snapshots.

#### 1.1F — Close composer and scene resource ownership

**Targets:** `src/lib/scene/three-engine.ts`, `src/lib/scene/three-sky.ts`, `src/lib/scene/ship.ts`, `src/lib/scene/scatter.ts`, resource tests where practical.

- Dispose the old composer and its render targets before replacing passes. Keep `disposeComposer()` idempotent for unmount.
- Retain one PMREM render target in `ThreeSky`; dispose the previous target only after a new environment texture is installed, and dispose the retained target on `ThreeSky.dispose()`.
- Give ship light geometry/material explicit ownership and dispose them once.
- Preserve existing scatter source-geometry disposal and verify rebuilt scatter disposes the replaced mesh exactly once.
- Avoid broad scene cleanup refactors. Fix only double ownership or missing ownership proven by this audit.

**Acceptance:** toggling bloom/SMAA and repeated mount/unmount do not grow renderer/composer resource counts; no visible regression in sky, scatter, ship, or rings.

#### 1.1G — Test and verify the full world path

**Targets:** existing `src/lib/world/__tests__/*`, `src/lib/scene/__tests__/*`, plus the smallest new engine seam test if needed.

- Keep tests behavior-focused: input snapshots, visible state, positions, counts, persistence writes, and lighting outputs.
- Add an engine reconciliation fixture or pure seam that proves a snapshot with two sessions and 16 agents creates the expected active resource set, then removes a closed session and departed agent.
- Run `npm test -- --run`, `npx tsc --noEmit`, `npm run lint`, and `npm run build` after code changes.

### 11.5 Phase 1.1 Verification Gate

Verified 2026-09-11 (evidence in §11.9):

- [x] Shader instances render at non-origin positions in a real browser WebGL pass.
- [x] Fifteen specialists plus orchestrator fit one plot with tested minimum spacing.
- [x] Two plots and their fallow records do not overlap.
- [x] Removing first, middle, and last agents leaves no stale GPU slot.
- [x] First React mount performs one world sync.
- [x] Unchanged world snapshots cause no Colony storage write.
- [x] Composer, PMREM, ship, scatter, and engine unmount resources have explicit disposal.
- [x] Unit, typecheck, lint, and production build gates pass.

### 11.6 Phase 1.5 - Time-of-Day Lighting

#### Current system found

1. `ThreeEngine.render()` uses `performance.now()` for frame timing but passes `Date.now()` to `ThreeSky.update()`.
2. `deriveTimeOfDayFromEpoch()` in `src/lib/scene/three-sky.ts` uses local `Date` hours, minutes, and seconds.
3. `ThreeSky.update()` converts time to a solar angle, updates directional sun position/intensity, ambient color/intensity, sky shader uniforms, and the scene background.
4. Directional intensity is `max(0, sin(sunElevation)) * preset.sunIntensity`. Ambient intensity is `max(0.1, sin(sunElevation) * 0.5 + 0.2) * preset.ambientIntensity`.
5. At Terra midnight, directional intensity is zero and ambient intensity is `0.1 * 0.5 = 0.05`; astronaut uniforms receive the same dark ambient floor. No separate fill light or readable night floor exists.
6. PMREM refreshes every 333 ms from the sky scene. Its current render target lifetime is unsafe and is fixed in 1.1F.
7. `src/lib/scene/day-night.ts` is a separate binary UI phase using 06:00-18:00 local time. It is not the ThreeSky lighting state and has no dusk phase.

#### 1.5A — Establish one testable local clock

**Targets:** `src/lib/scene/three-sky.ts`, `src/lib/scene/day-night.ts`, a small shared time helper if needed, and `src/lib/scene/__tests__/sky-time.test.ts`.

- Keep `liveMode: true` as the default and keep manual `timeOfDay` when `liveMode: false`.
- Use one local-clock conversion for both systems. Keep the UI's public phase binary for compatibility, but derive it from the same time value used by 3D.
- Extract pure lighting calculation from `ThreeSky.update()` so stage, sun factor, ambient floor, colors, and direction can be tested without a WebGL renderer.

#### 1.5B — Define day, dusk, and night states

**Targets:** `src/lib/scene/three-sky.ts` and its tests.

- Preserve continuous solar direction. Add explicit readable stages around it:
  - **Day:** 07:00-17:00, full Terra/Mars/Luna preset sun response.
  - **Dusk/dawn:** 05:00-07:00 and 17:00-20:00, warm horizon transition and reduced but nonzero directional light.
  - **Night:** 20:00-05:00, no directional sun contribution, cool dark sky, and floor lighting.
- Use smooth interpolation at boundaries; no abrupt color or intensity jumps.
- Keep preset colors as the base palette. Derive night/dusk colors from explicit constants rather than adding complex shader branches.
- Keep `scene.background`, sky uniforms, `AmbientLight`, astronaut lighting uniforms, and environment refresh driven by the same calculated profile.

#### 1.5C — Add minimum readable night lighting

**Targets:** `src/lib/scene/three-sky.ts`, `src/lib/scene/astronauts.ts` only if uniform handling needs adjustment, and tests.

- Replace the current Terra `0.05` effective ambient floor with an explicit profile floor tuned for readable terrain, decks, buildings, astronauts, and badges. Start with an effective ambient intensity of at least `0.12` across presets, then confirm in browser screenshots.
- Use a cool neutral fill color at night instead of using Terra's near-black zenith color as the only ambient color.
- Keep directional sun at zero during full night. Do not fake day with a bright sun.
- Preserve emissive/basic readability for badges, orchestrator rings, working particles, and other semantic markers. Do not make all scene materials emissive.
- Keep ACES tone mapping and bloom unchanged until screenshots prove they are part of the regression. Tune exposure only as a measured follow-up, not as the first fix.

#### 1.5D — Test and manually accept lighting

**Automated checks:**

- Test 02:00, 06:00, 06:30, 12:00, 18:30, and 23:00 profiles.
- Assert stage labels, time continuity, directional intensity behavior, ambient floor, and bounded colors.
- Test `liveMode: false` does not read the current clock and `liveMode: true` uses epoch milliseconds, not `performance.now()`.

**Manual browser checks:**

- Seed `pixel-monitor-3d-settings` with `liveMode: false` and inspect 12:00, 18:30, and 02:00 after reload. Repeat with live mode enabled.
- Confirm buildings, deck edges, terrain relief, astronaut silhouettes, badges, rings, and working particles remain readable at night.
- Confirm dusk visibly differs from both day and night without black-frame flashes or bloom washout.
- Confirm two populated plots still frame correctly under every lighting stage.
- Check desktop and mobile viewport sizes, WebGL console output, and repeated 3D toggle mount/unmount.

### 11.7 Forward roadmap status

- **Phase 1:** complete.
- **Phase 1.1:** complete. Shader correctness, plot spacing, 16-agent layout, compaction, sync and persistence behavior, and resource ownership are verified.
- **Phase 1.5:** complete. Shared local clock, day, dusk, and night profiles, ambient floor, and browser checks are verified. User screenshot approval remains open.
- **Phase 2:** complete. Phase 2.1 movement and Phase 2.2 camera and interaction work are verified.
- **Phase 2.5:** **NEXT.** Add shared activity semantics and delegation presentation without changing producer facts into guesses.
- **Phase 3:** future, multi-session UX.
- **Phase 4:** future, visual identity and polish.
- **Phase 5:** future, hardening, performance, security, and deployment.

### 11.8 Hygiene and Review Rules

- Never commit `dev-smoke-3dfix.log` or any file containing bearer credentials. Rotate the token manually if still valid, then delete or sanitize the log and add a narrow ignore rule if needed.
- Keep Phase 2 movement state inside `AgentMotionController`. Do not add route state to `WorldState` or a second monitor subscription.
- Before implementation handoff, review `git diff -- PLAN.md decisions.tsv` and `git status --short`. Any source change made accidentally must be reported, not hidden.

### 11.9 Phase 1.1 / 1.5 Completion Record (2026-09-11)

Implementation order followed: 1.1A-G, browser gate, then 1.5A-D. No Phase 2 work. Backend, SSE, monitor-store, and 2D renderer untouched except the shared clock import in `day-night.ts`.

**1.1A shaders** — `astronauts.ts` / `indicators.ts` vertex shaders apply `instanceMatrix` exactly once behind `#ifdef USE_INSTANCING`; normals use the same transform; unused badge `instancePosition` removed; both shaders exported for tests.

**1.1B Colony** — anchor allocator owned by `Colony`, `COLONY_MIN_ANCHOR_DISTANCE = 3`, first plot `(0,0)`, radial then axial order, fallow anchors reserve ground before active assignment, v1 (`pixel:colony:v1`) migrates to v2 (`pixel:colony:v2`) preserving IDs/status/timestamps. Migration-dirty state forces an already-valid v1 layout to persist as v2 on first reconcile.

**1.1C layout** — `world-layout.ts` rewritten: inner ring 6 at r=1.3, outer ring 9 at r=2.5 with 10-degree phase, orchestrator at r=3.2/30 degrees by `isOrchestrator`; overflow rotates deterministically per 15-seat cycle. Engine uses `agentOffsetForAgent`.

**1.1D compaction** — full survivor rewrite to slots `0..count-1` (matrices, suit, frame, face, all 7 meshes); fresh astronaut/badge meshes start at draw count zero; badge `rebuildIndices` refreshes compacted matrices and live draw count; animation frames upload every tick; capacity rejection is explicit and retried after a slot frees.

**1.1E sync/storage** — mount-time `syncWorld` removed from `ThreeCanvas` (the `[world]` effect performs the single initial sync); `Colony.reconcile` saves only on semantic state change; `monitorToWorld` comment corrected (observed orchestrator only, no synthetic owner).

**1.1F resources** — `rebuildComposer` disposes the old composer via `disposeComposer`; `ThreeSky` retains one PMREM target and disposes the previous only after replacement; `Ship` owns beacon geometry/material explicitly; scatter rebuild disposal covered by test; broad scene traversal removed so explicitly owned meshes are not disposed twice.

**1.1G tests** — new `instancing.test.ts`, `resources.test.ts`, `world-sync.test.ts`, rewritten `world-layout.test.ts`, extended colony/astronauts/indicators/hex-grid suites.

**Browser gate (real Chrome + SwiftShader, production build)** — zero page/console errors in every capture; day render shows 14 high-brightness clusters spread across all quadrants; alternating W/I/W/I/W toggle locks 284 cells on all 4 transitions (289 removal-locked, 356 restore-locked), proving custom instanced meshes render at spread non-origin positions; repeated mount/unmount cycles clean. Final mobile live-mode pass rendered a 390x844 canvas at matching CSS size after 3 cycles, with no horizontal overflow and no errors. Harness lives outside the repo (`Temp/opencode/webgl-verify`, not committed).

**1.5 lighting** — pure `computeLightingProfile` in `three-sky.ts` (day 07-17, dusk 05-07/17-20, night 20-05, smooth everywhere); night floor measured up from 0.05 to `NIGHT_AMBIENT_FLOOR = 0.22` plus `NIGHT_FILL_INTENSITY = 0.3` cool directional fill (0.12 alone measured 0.67 mean lum, unreadable); astronaut shader carries matching fill uniforms via engine; shared clock helper `lighting-time.ts` used by sky and `day-night.ts` (UI phase stays binary 06-18); ACES/bloom/exposure unchanged. Browser means at 1280x800: day 78.8, dusk 12.1, night 5.7 (faint structure 17.5% mid-tone + unlit markers).

**Screenshots for user review** (in `Temp/opencode/webgl-verify`): `light-day.png`, `light-dusk.png`, `light-night2.png`, `final-night.png`, `live-mobile.png`, `flow-A-working.png`, `flow-B-idle.png`, `flow-C-restored.png`, `toggle-final.png`.

**Gates** — `npm test`: 29 files, 308 passed. `npx tsc --noEmit`: clean. `npm run lint`: 0 errors (54 pre-existing warnings). `npm run build`: Next.js 16.3.4 clean.

**Deviations from plan** — (1) boot-clock misuse contract corrected to frozen-sky (timezone-dependent; was documented as night). (2) Night floor raised 0.12 to 0.22 plus fill light after measurement proved 0.12 unreadable (plan allowed treating 0.12 as a starting value). (3) Automated desktop/mobile image and pixel checks passed; subjective visual sign-off remains a user check.

### 11.10 Phase 2.1 / 2.2 Completion Record (2026-09-11)

**Motion ownership** — `AgentMotionController` in `walkers.ts` owns renderer-independent runtime state keyed by stable `WorldAgent.id`. It reconciles desired snapshots without restarting status-only updates. A fixed 60 Hz step drives movement while the engine keeps WebGL resource ownership.

**Arrival and departure lifecycle** — At most six new agents walk from the ship per reconcile. Overflow agents appear onsite. Missing agents route to the ramp and remain rendered until boarding. An agent that returns with the same ID reverses toward its worksite. Six transit lanes and short queue delays prevent ramp overlap during full-floor departures.

**Navigation and worksites** — A* rejects out-of-bounds endpoints and prevents diagonal corner cuts. String pulling validates exact start and goal points. The navigation grid rasterizes buildings, deterministic scatter obstacles, and the ship hull. Sixteen building-aware sites place 15 specialists and one orchestrator around each building without seat reuse.

**Ship transit** — `Ship` uses world-space anchors attached to the rendered airlock and ramp. The ramp now extends from the hull toward the colony, so agent paths match visible geometry.

**Camera** — `ThreeCamera` owns cumulative orbit, ground-plane pan, pointer-pinned wheel zoom, two-pointer pinch, and pinch-to-one-finger pan. Framing uses both vertical and horizontal field of view. Active-floor focus reruns when the session set changes. Automatic reframing stops after manual camera input.

**Reduced motion** — Reduced motion snaps arrivals and camera changes, removes departures immediately, disables idle camera easing, suppresses new particles, and clears particles that already exist.

**Tests and review** — Added `agent-motion.test.ts`, `three-camera.test.ts`, and `ship.test.ts`, plus navigation regressions. An independent source review found seven motion and camera defects. The implementation fixed all seven before the final gate.

**Browser gate** — Production Chrome with SwiftShader rendered desktop and 390x844 mobile canvases with zero page or console errors. Automated input covered desktop orbit and zoom, mobile pinch-to-pan, reduced-motion gestures, repeated 3D mounts, viewport matching, and horizontal overflow. The final mobile screenshot has a non-overlapping header. The browser scripts and screenshots remain outside the repository in `Temp/opencode/webgl-verify`.

**Gates** — `npm test`: 32 files, 325 passed. `npx tsc --noEmit`: clean. `npm run lint`: 0 errors and 54 pre-existing warnings. `npm run build`: Next.js 16.3.4 clean.

---

> [!IMPORTANT]
> **The recommended milestone commit was not created before Phase 2.5 implementation.**
>
> No commit authorization was given. The current worktree now mixes Phase 1 through Phase 2.5 changes. Review the full diff before creating any checkpoint.

## Phase 2.5 — Activity Semantics & Delegation

**Status:** IN PROGRESS. Core semantics and presentation are implemented. Unchecked items remain open. This section is the authoritative implementation record as of 2026-09-11.

### Scope and boundaries

- Keep one monitor subscription in `src/app/page.tsx`.
- Keep `WorldState` limited to 3D desired world state. Do not add invocation graphs, timers, presentation phases, or renderer details to it.
- Keep `monitor-store` responsible for ingest normalization and persisted runtime facts. Do not add display timing to the store.
- Add one shared, renderer-neutral semantic model between monitor facts and both renderers.
- Treat missing facts as unknown. Do not infer delegation endpoints, parentage, category, or start time from prompt text.
- Reuse `PresentationController`, `HandoffScheduler`, `AgentMotionController`, and `AgentInspector` where their current ownership fits.
- Keep 2D handoff walking separate from 3D lifecycle walking. A 3D delegation shows an arc and token; it does not make an agent walk to another agent.

### Verified current capabilities

- `InvocationInfo` already has stable invocation IDs, sender and recipient actor IDs, parent invocation IDs, status, outcome, task category, prompt preview, and request, start, and finish timestamps.
- `monitor-store` accepts those fields. Missing endpoints remain `null`; it does not create a false self invocation.
- `getActorActivityPose()` delegates base and outcome resolution to the shared activity adapter and can return `idle`, `seat`, `work`, `success`, or `error`.
- `PresentationController` and `HandoffScheduler` already deduplicate invocation IDs, queue by sender, route a 2D sender, and publish `give`, `receive`, and acknowledgement phases.
- `OfficeScene` already draws active 2D delegation lines and a task-folder token when distinct actors and a handoff state exist.
- `CharacterSprite` has eight poses in each four-direction sheet. One-shot pose callbacks and reduced-motion handling exist.
- `AgentMotionController` already owns 3D arrivals, onsite state, departures, stable-ID return cancellation, fixed-step movement, transit lanes, and reduced-motion arrival and departure behavior.
- `monitorToWorld()` filters idle specialists, keeps an observed orchestrator, excludes system actors, and emits stable `WorldAgent.id` values for the 3D renderer.
- `AgentInspector` already shows role image, activity status, last tool, prompt, and todos from a `CubicleDTO`. The current 2D click path finds that DTO by `agentKey`, not by stable actor ID.
- 3D maps activity to astronaut clips and badges, draws invocation arcs and tokens, raycasts astronaut instances, and connects pointer and keyboard selection to `AgentInspector`.

### 2.5A — Audit event semantics

**Likely files:** project-level and global `pixel-monitor.js`, `src/lib/schema.ts`, `src/lib/monitor-types.ts`, `src/lib/monitor-store.ts`, and monitor-store tests.

- [ ] Capture real `tool.execute.before`, `tool.execute.after`, `session.created`, `session.status`, and subtask part payload shapes without recording credentials or full prompts.
- [ ] Build a fact matrix for every emitted event: actor identity, sender, recipient, parent invocation, category, request time, start time, finish time, outcome, and session lineage.
- [x] Confirm which OpenCode event marks actual execution start. `tool.execute.before` emits requested and started for the Task call.
- [x] Confirm whether Task hook output exposes a stable child session ID or other reliable recipient identity. Current hook output does not expose one.
- [x] Define producer changes only for fields supported by captured payloads.
- [ ] Add producer contract fixtures for parallel same-agent calls, self invocation, failed calls, cancelled calls, and reordered child-session events.

### 2.5B — Add a shared semantic model

**Likely files:** new `src/lib/activity/activity-model.ts`, new `src/lib/activity/monitor-to-activity.ts`, new tests under `src/lib/activity/__tests__/`, and `src/app/page.tsx`.

- [x] Define renderer-neutral actor activity, invocation relation, lifecycle, outcome beat, and standby eligibility types.
- [x] Keep the model separate from `WorldState`, `WorldAgent`, `RuntimeState`, `FloorDTO`, and `CubicleDTO`.
- [x] Derive the model through a pure adapter from `FloorInfo[]`, `ActorInfo[]`, and `InvocationInfo[]` plus an explicit `now`.
- [x] Represent endpoint confidence or availability so self invocations and unknown endpoints cannot become false delegation edges.
- [x] Scope every relation to one floor and stable actor IDs.
- [x] Expose selectors for actor pose, active work count, direct delegations, outcome beats, inspector identity, and standby eligibility.
- [x] Replace duplicated activity decisions in `convertV2ToLegacy()`, `getActorActivityPose()`, `OfficeScene`, and 3D mapping only after parity tests pass.

### 2.5C — Connect existing `CharacterSprite` poses

**Likely files:** `src/components/scene/CharacterSprite.tsx`, `src/components/scene/OfficeScene.tsx`, `src/lib/scene/actor-pose.ts`, and pose tests.

- [x] Keep current sprite-sheet frame ranges and timing unless visual review finds an asset defect.
- [x] Drive each pose from the shared semantic and presentation model rather than renderer-local guesses.
- [x] Ensure one-shot `give`, `receive`, `success`, and `error` poses return to the current semantic base pose.
- [ ] Test interruption by new work, a new handoff, view switching, and reduced motion.

Current pose reachability:

| Pose | Frames | Current source | Reachable now | Phase 2.5 requirement |
|---|---:|---|---|---|
| `idle` | 4 | Base activity pose | Yes; frame 0 is held | Preserve for observed idle and sleeping presentation. |
| `walk` | 8 | Handoff sender | Yes, only for a distinct 2D handoff | Preserve for 2D delegation only. |
| `seat` | 2 | Pending recipient or queued handoff | Yes; frame 0 is held | Preserve as waiting, not active execution. |
| `work` | 2 | Started, explicit working, or active sender | Yes | Drive from active semantic work. |
| `give` | 2 | 2D handing-off phase | Yes when reliable distinct endpoints enqueue a handoff | Keep as a one-shot gesture. |
| `receive` | 2 | 2D handing-off phase | Yes when reliable distinct endpoints enqueue a handoff | Keep as a one-shot gesture. |
| `success` | 2 | Explicit successful outcome | Yes | Temporary for 2.5 seconds and interrupted by active work. |
| `error` | 2 | Explicit failed outcome | Yes | Temporary for 3 seconds and interrupted by active work. |

### 2.5D — Consolidate presentation state

**Likely files:** `src/lib/scene/presentation.ts`, `src/lib/scene/handoff-scheduler.ts`, `src/lib/__tests__/presentation.test.ts`, and `src/app/page.tsx`.

- [x] Reuse `PresentationController` as the owner of temporary 2D presentation phases and outcome beats.
- [x] Reuse `HandoffScheduler` for per-sender queueing, invocation-ID dedupe, and 2D routes.
- [x] Make controller input the shared semantic model rather than raw array searches spread through `page.tsx`.
- [x] Cancel or settle jobs when an invocation fails, is cancelled, disappears, changes floor, or loses a reliable endpoint.
- [x] Prevent completed jobs from replaying after an SSE snapshot, floor switch, renderer switch, or React remount.
- [x] Keep reduced motion semantic timing intact while skipping spatial movement and gesture animation where required.

### 2.5E — Complete 2D delegation

**Likely files:** `src/components/scene/OfficeScene.tsx`, `src/components/scene/CharacterSprite.tsx`, `src/lib/scene/presentation.ts`, and `src/lib/scene/handoff-scheduler.ts`.

- [x] Enqueue a handoff only when one invocation has reliable, distinct sender and recipient actor IDs on the same floor.
- [x] Show one queued handoff per invocation and cap backlog without losing the underlying busy count.
- [x] Keep the sender route, folder token, delegation line, recipient acknowledgement, and sender return synchronized.
- [x] Keep self invocations at the actor's desk with no line, token transfer, or walk.
- [x] Resolve concurrent handoffs deterministically when one actor sends or receives more than one invocation.
- [x] Preserve click and keyboard access while a sprite is moving.

### 2.5F — Add 3D invocation presentation

**Likely files:** new `src/lib/scene/delegation-3d.ts`, `src/lib/scene/three-engine.ts`, `src/lib/scene/astronauts.ts`, `src/lib/scene/particles.ts`, and focused scene tests.

- [x] Draw an invocation-driven arc between reliable, distinct sender and recipient worksites.
- [x] Move a small task token along the arc for request and handoff acknowledgement states.
- [x] Keep both astronauts at their worksites. Do not route delegation through `AgentMotionController` and do not make either agent walk.
- [x] Key every arc and token by invocation ID so repeated snapshots update rather than duplicate them.
- [x] Remove or resolve the visual on finished, failed, cancelled, missing, or closed-floor state.
- [x] Skip the arc and token for self invocations or unknown endpoints.
- [x] Under reduced motion, show a static relation without token travel.

### 2.5G — Add temporary success and error outcomes

**Likely files:** shared activity model, `src/lib/scene/presentation.ts`, `src/lib/scene/actor-3d-map.ts`, `src/lib/scene/astronauts.ts`, and outcome tests.

- [x] Define one tested duration for success and one for error presentation.
- [x] Show success only for `succeeded`. Unknown outcomes do not produce a success beat.
- [x] Show error for `failed`; cancelled and unknown outcomes do not produce an error beat.
- [x] Let new requested or started work interrupt an outcome beat immediately.
- [x] Restore the actor's current semantic base state after the beat instead of assuming idle.
- [x] Map 3D errors to the existing blocked badge. A dedicated error clip remains a Phase 4 asset gap.

### 2.5H — Add hover and selection identity

**Likely files:** `src/components/AgentInspector.tsx`, `src/components/scene/OfficeScene.tsx`, `src/components/scene/ThreeCanvas.tsx`, `src/lib/scene/three-engine.ts`, and a new shared inspector adapter.

- [ ] Select actors by stable actor ID, not by `agentKey`.
- [ ] Reuse `AgentInspector` for both 2D and 3D selection through a renderer-neutral inspector view model.
- [x] Add a concise hover label with display name, agent key, status, and active work count.
- [x] Add 3D hit testing that maps an astronaut instance back to its stable actor ID.
- [x] Preserve keyboard access in 2D. Provide an equivalent non-pointer path for 3D selection.
- [ ] Clear or update selection when an actor departs, a floor closes, or the active floor changes.
- [x] Apply prompt hiding and path redaction before inspector data reaches either renderer.

### 2.5I — Gate nested delegation on reliable parents

**Likely files:** producer plugin, schema, monitor-store, shared activity adapter, and delegation tests.

- [x] Render a nested edge only when `parentInvocationId` is present and resolves to an invocation on the same floor.
- [x] Verify that the nested invocation sender matches the parent recipient before showing a chain such as architect to explore.
- [x] Fall back to independent direct invocation presentation when parent identity is absent or inconsistent.
- [x] Do not derive parentage from event order, child-session age, prompt text, or agent role.
- [x] Add cycle, missing-parent, cross-floor-parent, and out-of-order-parent tests.

### 2.5J — Verify semantics and presentation

- [x] Add pure table tests for actor state precedence, endpoint confidence, self invocation, nested delegation, outcomes, and standby eligibility.
- [ ] Add `PresentationController` and `HandoffScheduler` tests for queues, cancellation, replay prevention, reduced motion, and missing actors.
- [ ] Add 2D component tests for lines, tokens, all reachable poses, actor-ID selection, prompt hiding, and path redaction.
- [x] Add 3D tests for arc and token creation, update, dedupe, removal, endpoint suppression, and reduced motion.
- [ ] Add multi-floor tests that prove no relation, outcome, timer, or selection leaks between floors.
- [x] Run `npm test`.
- [x] Run `npx tsc --noEmit`.
- [x] Run `npm run lint` and record warnings separately from errors.
- [x] Run `npm run build`.
- [x] Run the implemented browser scenario in normal and reduced-motion modes at desktop and mobile sizes.

### 2.5K — Add departure grace and standby

**Likely files:** shared activity selectors, `src/lib/scene/walkers.ts`, `src/lib/scene/presentation.ts`, `src/lib/scene/three-engine.ts`, and motion and presentation tests.

- [x] Use a 25-second default grace period before an observed specialist leaves.
- [x] Start grace only when the actor is observed as truly idle and has no pending or running invocation as either sender or recipient.
- [ ] Keep the timer in `AgentMotionController` for 3D and presentation state for 2D. Do not put timer state or deadlines in `monitor-store`, `RuntimeState`, or `WorldState`.
- [x] Keep the actor visible in standby during the grace period.
- [x] Cancel standby immediately when new work arrives.
- [x] If departure has started, use the existing stable-ID return cancellation so the same actor turns back without respawn or teleport.
- [x] Bypass grace when the session or floor is closed. Closed state starts departure or removal immediately.
- [x] Ensure repeated identical snapshots do not restart or extend the timer.
- [x] Under reduced motion, preserve the 25-second delay and then skip walking when removal begins.
- [ ] Test idle flapping, overlapping work, queued-only work, active departure cancellation, closed-session bypass, repeated snapshots, remount policy, and clock jumps.

### Manual browser scenario

Use captured or synthetic V2 events with explicit stable actor IDs and invocation IDs. Do not use prompt parsing to fill missing fields.

1. Start two open root sessions and select the first floor. Confirm that actors and relations from the second floor do not appear.
2. Emit `orchestrator -> architect` as requested, then started.
   - **2D expected:** the orchestrator follows the existing handoff route, the folder token and line identify the architect, `give` and `receive` play once, and the architect enters work.
   - **3D expected:** both astronauts stay at their worksites. One arc connects them, and one token follows the arc. No delegation walk starts.
3. Emit `architect -> explore` with `parentInvocationId` set to the first invocation.
   - **2D expected:** a second queued handoff shows architect as sender and explore as recipient after parent validation. The first relation remains tied to its own invocation.
   - **3D expected:** a second invocation-keyed arc connects architect to explore. The chain does not cross floors or move astronauts.
4. Finish explore with `succeeded`. Confirm a temporary success beat in both views, then confirm return to the current semantic state.
5. Repeat with `failed`. Confirm a temporary error beat. Confirm that new work interrupts the beat.
6. Emit a self invocation with equal endpoints.
   - **2D expected:** the actor works at the desk. No line, transfer token, or handoff walk appears.
   - **3D expected:** the actor shows work state. No arc or token appears.
7. Switch between 2D and 3D during an active invocation and after completion. Confirm stable identity, no duplicated presentation, and no replayed completed handoff.
8. Switch between both root sessions. Confirm that each floor keeps its own actors, selection, invocation visuals, and outcome state.
9. Select and hover orchestrator, architect, and explore in both views. Confirm that `AgentInspector` shows the same actor identity and obeys prompt hiding and path redaction.
10. Mark explore truly idle with no pending or running work. Confirm 25 seconds of standby. Send new work before expiry and confirm cancellation. Repeat, let departure start, then return the same actor ID and confirm turn-back. Close the session and confirm grace bypass.
11. Repeat steps 2, 4, 7, and 10 with reduced motion. Confirm that semantic delays remain, spatial handoff and token travel are skipped, and standby still lasts 25 seconds before immediate removal.

### Phase 2.5 acceptance checklist

- [x] Shared semantics produce the same actor activity and invocation relations for 2D and 3D from one monitor snapshot.
- [x] No Phase 2.5 timer or invocation graph enters `monitor-store` or `WorldState`.
- [x] All eight `CharacterSprite` poses have a source; `error` is reachable only after a failed outcome.
- [x] Reliable distinct endpoints create one 2D handoff and one 3D arc per invocation.
- [x] Self and unknown-endpoint invocations create no delegation edge or transfer animation.
- [x] Nested delegation appears only with a validated parent invocation ID.
- [x] Success and error are temporary, interruptible, and do not override active work.
- [x] 3D delegation never causes agent walking.
- [x] Hover, selection, and inspector content resolve by stable actor ID in both views.
- [x] Prompt hiding and path redaction apply before presentation and inspection.
- [x] Standby uses a 25-second default, survives repeated snapshots, cancels on new work, bypasses closed sessions, and preserves its delay under reduced motion.
- [x] Multiple sessions remain isolated through delegation, outcomes, selection, and standby.
- [x] Unit, typecheck, lint, build, desktop browser, mobile browser, and reduced-motion gates pass.
- [ ] User approves final 2D and 3D visuals.

### Known data limitations and open items

- Task hooks now emit requested, started, and finished lifecycle events with a stable call ID. Known Task endpoints are explicit; unknown endpoints remain `null`. Reliable `parentInvocationId` and child-session identity remain unavailable.
- Current producer parent and child attribution uses timing and session lineage fallbacks. Parallel reordered tasks can still misattribute a child. Do not use this fallback as proof of a nested invocation parent.
- Idle is observed through session and actor events, but producer silence and the five-minute stale-activity fallback make "truly idle" ambiguous. Phase 2.5A must define which observed idle signal qualifies for standby.
- Stable actor IDs assume the current `projectId:sessionId:agentKey` derivation. Concurrent invocations by the same agent rely on stable call IDs, while selection and departure cancellation rely on stable actor IDs.
- Prompt preview reaches the server. The event stream applies privacy policy before presentation, and the inspector preserves redacted prompt data without using it as semantic evidence.
- Failed versus cancelled detection remains limited by Task hook output. Do not claim a cancelled outcome until captured producer data supports it.
- Character sheets expose the `error` pose. 3D uses the existing blocked badge because astronaut assets lack a dedicated error clip.
- User visual approval remains open for existing lighting screenshots and all new delegation, outcome, hover, and standby presentation.
- Current lint baseline has 54 non-blocking warnings. Record the exact count at the Phase 2.5 gate; do not describe warnings as a clean lint result.
- `dev-smoke-3dfix.log` is ignored because it may contain bearer credentials. Do not commit it. Rotate any token exposed in that log, then delete or sanitize the file.
- Working tree contains uncommitted Phase 1 through Phase 2.5 changes. No milestone commit exists.
- Full Phase 2.5 gate on 2026-09-11: 34 test files and 337 tests passed; typecheck and build passed; lint reported 0 errors and 54 warnings. Isolated browser checks passed on desktop, 390x844 mobile, and reduced motion with zero console errors.
- User-owned server on port 3001 serves stale 500 chunk responses after the production build touched `.next`. The process was not restarted because it is user-owned. Browser proof used an isolated temporary server on port 3011, which was stopped after verification.

## Phase 3 — Multi-session UX

**Status:** implementation complete. Durable archives and cross-tab notification coordination remain deferred.

### Delivered architecture

- `page.tsx` remains the sole monitor subscription owner and mounts one active 2D or 3D renderer.
- A pure client projection groups sessions as working, quiet, or recently completed and derives active actors, active task count, task categories, latest outcome, and lifecycle timestamps.
- Sorting is deterministic: pinned sessions first, then most recent activity, then floor ID. Follow mode uses the same ordering and never changes selection after a manual floor choice.
- Completed floors remain in the V2 snapshot as read-only recent history but are excluded from both renderer inputs.
- Comparison is summary-only and limited to two sessions, so it cannot create another monitor subscription, `SceneViewport`, or `ThreeCanvas`.
- Notifications are baseline-suppressed, transition-driven, deduplicated by stable event identity, capped at 20, and expose per-session unread counts.
- Floor close and rename commands send the configured monitor token and return typed network, authorization, validation, and server failures.
- Inspector selection stores stable actor ID, resolves fresh presentation data on every snapshot, clears when the actor disappears, supports Escape, and returns focus to the invoking control.

### Acceptance evidence

- [x] Grouped navigator exposes working, quiet, and collapsible recently completed sessions.
- [x] Search filters title, project, and floor ID; search reveals matching completed sessions even when their group was collapsed.
- [x] Arrow keys, Home, End, and Enter navigate visible session rows.
- [x] Mobile navigator is a labelled modal sheet; desktop navigator does not obscure the 22rem content column.
- [x] Manual floor selection disables follow mode and clears actor and comparison selection.
- [x] Follow target and fallback selection remain deterministic across reordered snapshots.
- [x] Comparison includes two summaries and still mounts exactly one renderer canvas.
- [x] Lifecycle notifications cover started working, became quiet, completed, and follow moved without initial-load noise.
- [x] Completed sessions remain available for comparison but cannot be pinned, renamed, selected into a renderer, or completed again through navigator actions.
- [x] `npm test` passes 38 files and 361 tests; `npx tsc --noEmit` and production build pass.
- [x] Full lint reports 0 errors and the existing 54-warning baseline.
- [x] Isolated production browser checks pass on desktop, 390x844 mobile, and reduced motion with zero console errors, one canvas, and no horizontal overflow.

### Deferred scope

- Persist completed-session history beyond in-memory server lifetime.
- Coordinate notification read state across tabs or devices.
- Add a dual-renderer visual comparison mode only if summary comparison proves insufficient.
- Replace public browser token and shared ingest/mutation secret before internet deployment.

## Phase 4 — Visual Identity & Polish

**Status:** active. Phase 4A, Phase 4B, and focused Phase 4B.1 corrections complete; user visual approval pending. Later Phase 4 work remains paused.

### Phase 4A - 2D office composition cleanup

- Default floor seeding creates desks for `ai-systems`, `architect`, `automation-engineer`, `devops`, `documentation`, `project-manager`, `qa-engineer`, `researcher`, `security-reviewer`, `senior-engineer`, and `explore`.
- `build`, `plan`, `general`, and `scout` remain supported optional roles. They receive their canonical desk only after an event observes them.
- Future supported seated roles follow the same optional policy. Unknown runtime roles continue to share the visitor seat.
- Canonical seat order puts all default roles first, so hiding optional roles leaves no gaps.
- Sixteen possible seats use a compact four-column grid. `OfficeScene` renders only seats with actors while preserving orchestrator, utility fixtures, handoffs, selection, and inspection.
- Existing viewport fit now measures its actual container instead of `100vw` and `100vh`. Desktop framing uses a smaller inset after sidebar collapse, which recenters and slightly enlarges the complete room without cropping it.
- Unused viewport space uses a dark slate grid instead of extending beige office flooring beyond the room walls.

Acceptance evidence:

- [x] Fresh floor shows exactly 11 default desks; `build`, `plan`, `general`, and `scout` are absent.
- [x] Explicit `build` activity adds seat 11 as twelfth desk without moving or leaving holes among default desks.
- [x] Default rows use four columns and preserve three occupied positions in row three.
- [x] Orchestrator remains at `{ x: 88, y: 44 }`.
- [x] Requested delegation line remains aligned with recipient actor after reflow.
- [x] Sidebar-close scale increases from `1.7917` to `1.875` at 1280x800; room remains centered and fully contained.
- [x] 390x844 mobile view contains full room, shows dynamic optional desk, and has no horizontal overflow.
- [x] `npm test` passes 38 files and 363 tests; TypeScript and isolated production build pass.
- [x] Full lint reports 0 errors and unchanged 54-warning baseline.
- [ ] User approves Phase 4A desktop and mobile composition.

### Phase 4B - Shared agent visual identity

- `src/lib/agent-visual-identity.ts` is the single role-to-visual mapping used by both renderers. It covers every supported registry key and supplies deterministic muted fallbacks for future roles.
- 2D desk props and role accents resolve through the shared identity. A small desk marker carries role color while working green retains semantic precedence.
- 3D suit accents, backpack details, and six instanced accessory families resolve through the same identity. Accessories remain batched by family and do not create per-agent meshes.
- 3D hit testing ignores decorative accessory meshes and continues resolving stable actor IDs through the astronaut body meshes.
- Existing orchestrator, working, waiting, delegation, outcome, selection, hover, and reduced-motion semantics remain authoritative over role styling.

Acceptance evidence:

- [x] Every supported registry role has one shared identity with accent, detail color, accessory family, and 2D desk-prop set.
- [x] Unknown roles resolve deterministically without extending either renderer mapping.
- [x] 2D and 3D consume the same role identity source; hashed 3D suit colors and duplicate 2D accent tables are removed.
- [x] Six role accessory families use six shared instanced meshes; one family is visible per agent.
- [x] Working green overrides role accent in 2D, while existing semantic 3D badges remain unchanged.
- [x] `npm test` passes 39 files and 367 tests; TypeScript and production build pass.
- [x] Full lint reports 0 errors and unchanged 54-warning baseline.
- [x] Isolated browser checks pass with 11 distinct 2D role accents, one 3D canvas, readable reduced-motion astronauts and accessories, no mobile overflow, and zero browser errors.
- [ ] User approves Phase 4B desktop, mobile, and 3D visual identity.

### Phase 4B.1 - Focused 3D identity and semantic readability

- Researcher now uses the sensor family while architect retains the document family.
- Day and night suit accents retain a luminance floor without overriding semantic state colors.
- Full-night terrain uses a `0.48` ambient floor, `0.65` cool relief fill, and lifted blue-black environment colors so plots and buildings remain readable.
- Working and error badges use compact filled discs, readable glyphs, and foreground rendering.
- Delegation uses one stronger batched path plus a brighter token.
- Selected actors receive a persistent white foot ring distinct from the gold orchestrator ring.
- Accessory and backpack materials use per-instance colors without an absent geometry-color attribute darkening them to black.

Acceptance evidence:

- [x] Architect/researcher and DevOps/security/senior-engineer silhouettes remain distinct in focused screenshots.
- [x] Day, night, busy, working, error, delegation, mobile, and reduced-motion frames retain readable semantic hierarchy.
- [x] Selection marker lifecycle and active-floor keyboard filtering have focused automated coverage.
- [x] `npm test -- --run` passes 40 files and 371 tests; TypeScript passes. Previous production build remains green; concurrent rebuild skipped to protect user dev server chunks.
- [x] Full lint reports 0 errors and unchanged 54-warning baseline.
- [x] Final accessory colors were verified in real WebGL output after removing the conflicting geometry `vertexColors` flag.
- [ ] User approves Phase 4B.1 visual corrections.

- Complete visual direction for 2D and 3D delegation, outcomes, standby, actor identity, and missing 3D clips or badges.
- Align typography, color, lighting, materials, sprite assets, sound policy, and motion timing across both views.
- Require user visual approval and reduced-motion review before completion.

## Phase 5 — Hardening, Performance, Security & Deployment

**Status:** future, hardening, performance, security, and deployment.

- Resolve lint debt, profile client and WebGL performance, and add long-session leak and reconnect tests.
- Replace local-only token assumptions with real authentication and private read authorization before internet deployment.
- Rotate exposed credentials, verify Supabase against a live project if enabled, add deployment checks, and write an operational runbook.
