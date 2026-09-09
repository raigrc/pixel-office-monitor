# Office Revamp — Sprint R1–R5 (2026-09-05)

> 1-pager for the R1–R4 office floor revamp. Verified against code 2026-09-05 — no build run in this doc pass (orchestrator verifies).

## Before / After (what changed)

| Area | Before | After (R1–R4) |
|---|---|---|
| **Header** | Double render — `layout.tsx` + `page.tsx` both rendered `<Header>`; `:has` CSS hid duplicate | **Single header** — `layout.tsx:30-39` is header-free (only `{children}`); `page.tsx:187` owns sole `<Header liveCount>` |
| **Floor** | Flat `bg-[#0F172A]` | **Textured carpet** — `.office-floor` (`globals.css:154-173`) `24px` grid (`linear 95%` + `radial 1px` at `12%` `rgba(30,41,59,0.12)`) + baseboard `inset 0 -6px #0B1220` + lip `inset 0 -8px #334155`; wrapped by `OfficeFloor.tsx` (`role=region`, door `12×12` `bg #475569` `border #64748B`, aisle `h-2 min-h-[28px]` dashed `border-[#334155]/40`, label `7px` Press Start 2P) |
| **Cubicles** | Floating cards with independent borders | **Walled partitions** — `gap-[2px] bg-[#475569] p-[2px] rounded-[8px]` on `OfficeGrid.tsx:20,71,81`; walls are the gap bg (not collapsing borders); desk rail `h-[3px] bg-[#475569] border-t border-[#64748B]` per `CubicleCard.tsx:174` |
| **Empty state** | Skeleton pulse 6 placeholders or single `◧ floor idle` | **6 vacant dashed desks + walk-in** — `VacantCubicle.tsx` (115 lines, `min-h 212px` matches card, `border-2 border-dashed rgba(51,65,85,0.4)` `bg-[#1E293B]/60`, header `h-[53px]` + body `h-28` ghost desk, `40%` opacity family) shown via `Array.from({length:6})` in `page.tsx:274-286` (no floors) and `OfficeGrid.tsx:71-75` (empty floor); new cubicles animate in from door |

**Screenshot description (no PNG captured in this pass — describe verified DOM):**

- *Before:* two sticky headers stacked, uniform dark floor, cards float with `gap-4` on transparent bg, empty shows gray pulse skeletons only.
- *After:* one sticky header (LIVE dot + live count badge), floor shows subtle `24px` carpet dots/lines + dark baseboard + top aisle with tiny door square and `OFFICE FLOOR` label, cubicles touch with `2px` slate walls between them and a `3px` horizontal rail at each desk edge, empty shows 6 identically-sized dashed `VACANT` cards (`— empty —` in the desk well) that lift/slide in staggered on arrival.

## Decisions

| Decision | Choice | Why / trade-off |
|---|---|---|
| **Single header** | Remove from `layout.tsx`, keep in `page.tsx` — not `:has` CSS hack | Layout owned the duplicate; `:has` hid it but left DOM/a11y dupe and flaked on `:has` support. Removal is `1-line` and verifiable via `grep -c Header` = 1. |
| **Floor texture** | `12%` opacity `rgba(30,41,59,0.12)` `24px` + radial dots + baseboard `inset` shadows | Stays within OLED `#0F172A` contrast (`#F1F5F9` >4.5:1 preserved); `12%` is legible at `1×` without banding, `24px` matches pixel grid; baseboard gives enclosure without extra DOM. |
| **Walled partitions** | `gap-[2px] bg-[#475569]` + `p-[2px]` on grid container, cards no outer margin | Walls are the container bg showing through the gap — no collapsing-border math, no double borders, rounded outer corners preserved `rounded-[8px]`; `2px` mimics partition thickness at `48px` sprite scale. |
| **Entrance** | **CSS only** `.cubicle-enter` `translateX(-24px)→0` `420ms ease-out` `opacity 0→1`, stagger `index*80ms` (`transitionDelay`), `requestAnimationFrame` double-raf + `seenRef` Set one-shot | No JS animation library, no layout shift (`transform` is compositor-only), `420ms` = door→desk walk at pixel scale, `80ms` stagger avoids wave-clash for 6; `will-change: transform,opacity` for jank avoidance. |
| **Reduced motion** | Freeze: `prefers-reduced-motion: reduce` → `transition:none transform:none opacity:1 animation:none` (`globals.css:134-152`) + `matchMedia` early-return in `CubicleCard.tsx:52` | Honors OS setting, no vestibular motion, still shows desk instantly. |
| **Vacant 6** | Dashed `40%` opacity family `rgba(51,65,85,0.4)` `bg-[#1E293B]/60` `min-h 212px` (header `53px` + body `h-28` + footer) | Same footprint as live card so grid doesn't reflow on arrival; dashed signals "unoccupied" vs skeleton's "loading"; `40%` keeps text `>4.5:1` on overlay label. |

## Verification

```powershell
# Build — must pass before commit (orchestrator runs)
npm run build

# Header is single — layout has 0, page has 1
grep -rn "Header" src/app/layout.tsx src/app/page.tsx
# expect: layout.tsx no match, page.tsx 1 import + 1 <Header

# Floor texture tokens present
grep -n "office-floor" src/app/globals.css src/components/OfficeFloor.tsx

# Walled partitions present
grep -n "bg-\[#475569\]" src/components/OfficeGrid.tsx src/components/CubicleCard.tsx

# Vacant + entrance tokens present
grep -n "VacantCubicle" src/app/page.tsx src/components/OfficeGrid.tsx
grep -n "cubicle-enter" src/app/globals.css src/components/CubicleCard.tsx
grep -n "prefers-reduced-motion" src/app/globals.css src/components/CubicleCard.tsx

# Smoke (when dev is up on 3001)
curl http://localhost:3001/api/health
curl -X POST http://localhost:3001/api/ingest -H "x-monitor-token: <YOUR_TOKEN>" -H "Content-Type: application/json" -d "{\"v\":1,\"ts\":1700000000000,\"sessionID\":\"ses_recheck\",\"project\":\"pixel-office-monitor\",\"agent\":\"explore\",\"kind\":\"subtask.start\",\"status\":\"working\"}"
curl http://localhost:3001/api/state
```

## Run log excerpt (verified 2026-09-05, revamp code — build not re-run in doc pass)

```
PLAN.md — Revamp R1–R5 section added (this file) — ticks verified via Read
src/app/layout.tsx — header-free (no Header import/render) — Read 2026-09-05
src/app/page.tsx:187 — sole <Header liveCount> + comment updated — Edited
src/app/globals.css:117-173 — .cubicle-enter 420ms + .office-floor 24px 12% + baseboard — Read
src/components/OfficeFloor.tsx — aisle door 12×12 + OfficeFloor wrapper — Read 54 lines
src/components/OfficeGrid.tsx — gap-[2px] bg[#475569] p-[2px] — Read
src/components/CubicleCard.tsx:174 — desk rail h-[3px] bg[#475569] — Read
src/components/VacantCubicle.tsx — 6 dashed 40% opacity min-h 212px — Read 115 lines
docs/office-revamp.md — created (this file)
README.md — Office floor & entrance paragraph appended — Edited
```

## Files

- `src/app/layout.tsx` — R1 single header (header-free)
- `src/app/page.tsx` — sole Header + OfficeFloor wraps + vacant 6
- `src/app/globals.css` — `.office-floor` + `.cubicle-enter` + `prefers-reduced-motion`
- `src/components/OfficeFloor.tsx` — floor texture wrapper
- `src/components/OfficeGrid.tsx` — walled grid + vacant 6 fallback
- `src/components/CubicleCard.tsx` — desk rail + entrance stagger 80ms
- `src/components/VacantCubicle.tsx` — 6 vacant dashed

## Assumptions / not verified in this pass

- No `npm run build` executed (per task: orchestrator verifies).
- No pixel PNG sprites — CSS grid (`Sprite.tsx` 16×16 @48px) is production impl, PNG swap remains optional.
- Supabase cloud path not live-tested (flag `0` default).
