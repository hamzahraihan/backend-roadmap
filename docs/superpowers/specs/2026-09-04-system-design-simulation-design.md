# Design: System Design Canvas Simulation

**Date:** 2026-09-04
**Status:** Approved

## Overview

Replace the code playground on all 11 System Design skill pages with an
interactive architecture canvas. Learners drag components (client, LB,
gateway, app, cache, CDN, SQL, NoSQL, queue, storage) onto a React Flow
canvas, connect them into a request path, then run a deterministic traffic
simulation (QPS + read/write sliders, failure injection) to see estimated
p99, bottleneck, and availability impact. Each node ships a guided objective
with a win condition (git-preset pattern) plus a free-mode toggle.

## Nodes

All 11 existing System Design skills flip `simulation: 'git'|'code'` to
`simulation: 'design'` (orders 140–235 unchanged, `dependsOn` unchanged):
system-design-fundamentals, scalability-performance, caching-cdn,
load-balancing-gateway, data-modeling-apis, databases-sharding,
messaging-queues, distributed-failures, rate-limiting-url-shortener,
realtime-rides-feed, interview-framework. Each gets a preset in
`src/lib/design/presets.ts` (palette subset + objective + winCondition) plus
a `free` preset.

## Components

- **`src/lib/design/types.ts`** — `DesignKind`, `DesignNode`, `DesignEdge`,
  `DesignScenario {qps, readRatio, failedKind?}`, `DesignState`,
  `DesignResult {p99Ms, bottleneck, notes[], passed}`, `DesignPreset`.
- **`src/lib/design/engine.ts`** — pure functions: `validateTopology`,
  `simulateTraffic`, `checkObjective`. No DOM, no network.
- **`src/lib/design/presets.ts`** — 11 guided presets + `free`; `getPreset`,
  `initialStateFor`.
- **`src/components/react/DesignSimulation.tsx`** — right-pane island:
  objective banner, Guided/Free toggle, palette buttons, React Flow canvas,
  scenario sliders, Run-traffic results (mono), pattern hints, Reset,
  Mark complete via existing `ProgressProvider`.
- **`src/content.config.ts`** — `simulation` enum gains `'design'`,
  optional `designPreset`.
- **`src/pages/skill/[slug].astro`** — three-way switch on
  `skill.data.simulation` instead of the git boolean + hardcoded id list.

## Data flow

Palette click → append node → user drags/connects edges → scenario sliders
→ Run → `simulateTraffic(state)` → results panel + `winCondition(state,
result)` → objective badge → Mark complete persists to `localStorage`
via `ProgressProvider`. Free mode skips win evaluation.

## Traffic model

Per-kind base latencies (ms): client 5, cdn 10 (3 on hit), lb 2, gateway 4,
app 20, cache 3, sql 25, nosql 12, queue 0 blocking (+15 async note),
storage 30. Load factor `1 + qps/2000` on app/db kinds. Cache on read path
with readRatio ≥ 0.5 cuts storage/db hops to 15% traffic. Failed kind adds
reroute penalty or unavailability note. Output labeled "simulated estimate".

## Error handling

Invalid graphs (no client, no storage/db sink, disconnected nodes) return
`passed: false` with plain-language notes instead of numbers. Unknown preset
id falls back to `free`. Engine never throws on user input.

## Testing

`npm run check` (schema + types), `npm run build` (36 pages), node smoke
script exercising `simulateTraffic` + every preset `winCondition` on a
passing and failing state. Manual spot-check: guided pass/fail, free mode,
theme toggle, stacked mobile layout, keyboard-reachable palette.

## Decisions

- Reuse `@xyflow/react`, `ResizableSplit`, `ProgressProvider` — no new deps.
- Mirror `src/lib/git/` preset/objective pattern for consistency.
- Keep `starterCode` frontmatter untouched for one-line rollback.
- DESIGN.md honored: graphite neutrals, blue = selected, emerald = met,
  amber = bottleneck; machine output mono.

## Out of scope

- No AI grading, share/export, real latency measurement, or new tracks.
- No changes to code/git simulations or homepage graph.
