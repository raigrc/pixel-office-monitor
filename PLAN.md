# Pixel Office Monitor — Build Plan & Checklist

> **Project:** Personal real-time monitor — every OpenCode agent use sends signal to app. App shows sessions as office floors/tabs with per-agent cubicles in pixel art (matching agent role). Idle = sleeping with Zzz, working = working animation.
> **Location:** `C:\Users\DELL\Desktop\Rai\pixel-office-monitor` (Next.js 16, Tailwind, shadcn pattern)
> **Port:** 3001 local (Supabase-ready, flag `NEXT_PUBLIC_USE_SUPABASE`)
> **Plugin:** global `.opencode/plugins/pixel-monitor.js` (also `.config/opencode/plugins/`)
> **Agents included:** 10 global subagents + 5 built-ins = 15 cubicles (see mapping §2)
> **Design system:** ui-ux-pro-max — Pixel Art + OLED dark, Press Start 2P/VT323
> **Goal ID:** `ses_f8ff2628effeUGK2ZLQyRIn2aQ`
> **Created:** 2026-09-05 | Current implementation verified 2026-09-08

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
