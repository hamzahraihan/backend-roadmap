# Design: System Design Simulation Studio + Playback Experience

**Date:** 2026-09-04
**Status:** Approved
**Parent:** `2026-09-04-system-design-simulation-design.md` (static canvas panel)

## Overview

The static canvas (sliders + Run button + instant numbers) reads as a diagram
tool, not a simulation. This spec adds time, motion, and reaction while keeping
React Flow as the renderer: a deterministic tick engine drives animated request
packets along edges, nodes show live load badges, failures reroute mid-run, and
an event log streams. The same stage ships twice: compact in the 11 System
Design skill pages (replacing `DesignSimulation`) and full-width on a new
`/design` studio route with a scenario library, mirroring the `/playground`
precedent for Git.

## Nodes / routes

- No skill-graph changes. All 11 System Design skills keep
  `simulation: design`; their presets gain timelines + run-based SLOs.
- New route `src/pages/design.astro`: studio with scenario picker
  (TinyURL, Chat, Rides, Feed, Free canvas — mapped to existing preset ids
  `rate-limiting-url-shortener`, `realtime-rides-feed` ×2 views, `free`).
- `TopBar` gains `variant: 'design'` (breadcrumb "Design Studio", ← Roadmap
  link) and a home CTA "Design Studio" next to "Git Playground".

## Components

- **`src/lib/design/player.ts`** (new, pure, no DOM) — deterministic
  discrete-event core. Seeded RNG (mulberry32). `createRun(topology,
  scenario, seed)` → `RunHandle { tick(dtSimSeconds), trigger(event),
  snapshot() }`. Per-tick: spawn requests from QPS, route along BFS request
  path, per-node FIFO queues with service times from `BASE_LATENCY_MS` × load
  factor, cache hit-rate shortcut, failure reroute penalty, per-request trace
  recording (node id, arrival, departure). Emits `RunEvent`s (spawned,
  hop, completed, dropped, timeline-fired). `summarize()` → p99, error %,
  throughput, per-kind load, bottleneck. Engine never throws on user input;
  invalid topology yields a failed empty summary with guidance notes.
- **`src/lib/design/timelines.ts`** (new) — `TimelineEvent { atSec, type:
  'spike'|'fail'|'heal'|'note', payload }` per guided preset + `SLO { p99LtMs?,
  errLtPct? }`. Manual triggers reuse the same event type.
- **`src/lib/design/engine.ts`** — keep `simulateTraffic` (instant estimate,
  still used for pre-run preview + old smoke tests); add `summarizeToResult`
  adapter so run summaries render through the existing notes UI.
- **`src/lib/design/presets.ts`** — presets gain optional `timeline` and
  `slo`; `winCondition` extends to run-based check via new
  `checkRunObjective(preset, topology, summary)` while keeping the old
  `(state, result)` signature working (adapter wraps it).
- **`src/components/react/SimulationStage.tsx`** (new, replaces
  `DesignSimulation.tsx` usage) — transport bar (Play/Pause/Step/Reset,
  1×/2×/4×, sim clock), React Flow canvas with animated packet dots
  (custom edge overlay positioned via edge path measurement,
  `requestAnimationFrame`, disabled under `prefers-reduced-motion`),
  node live badges (in-flight, queue depth, hit %), step inspector
  (selected request trace, Next-step), streaming event log (mono, capped
  200 lines), ticking metrics header (p99, err %, rps sparkline via divs).
  Compact vs studio layout via `layout: 'panel' | 'studio'` prop; scenario
  picker only in studio. Reuses `ProgressProvider`, `ResizableSplit`.
- **`src/pages/skill/[slug].astro`** — render `SimulationStage
  layout="panel"` for `simulation: 'design'`.

## Data flow

Edit topology → Play → `createRun` snapshot → rAF loop advances sim clock
(speed-scaled) → `snapshot()` per frame updates packets/badges/metrics/log
→ timeline events fire at clock marks + manual triggers inject → Pause/Step
freezes and exposes per-request traces → SLO evaluated over run window →
objective badge → Mark complete persists via `ProgressProvider`.

## Playback model

Sim second = tick batch (spawn count = qps × dt, capped for perf: visual
packets sampled max ~120 in flight, counters exact). Queueing: service time
per kind, FIFO, drop + error when queue > cap (cap scales with replicas =
node count of kind). Cache: reads hit at 85% × readRatio, served fast, miss
falls through. Failure: failed kind queues stall → after timeout requests
reroute note + penalty or error if no path. Deterministic: same
topology+scenario+seed → identical trace (guided checks reproducible).

## Error handling

Invalid topology → transport disabled with guidance message (same copy as
`validateTopology`). Unknown scenario id → free canvas. Player methods are
total (no throws); component guards rAF cleanup on unmount/reset/preset
change.

## Testing

`npm run check`, `npm run build`. Engine smoke (node, compiled CJS like
before): determinism (same seed → identical summary), timeline fires spike +
failure + heal at marks, manual trigger parity, all 11 presets' starters
produce passing summaries, invalid topology fails gracefully. Manual:
play/pause/step, 4× speed, kill mid-run, guided win, free canvas, both
themes, mobile stack, keyboard (transport buttons + palette), reduced-motion.

## Decisions

- React Flow stays as renderer; feel comes from the playback layer (time +
  motion + reaction), not a new graph library — no new deps.
- `DesignSimulation.tsx` is superseded by `SimulationStage.tsx` (deleted at
  the end to avoid two owners of the right pane).
- Timelines + manual triggers share one event type; guided scenarios play
  timelines by default, free canvas is manual-only.
- DESIGN.md honored: graphite neutrals, blue = selected/playing, emerald =
  objective met, amber = bottleneck/strain, red reserved for errors/failures;
  machine output mono; flat surfaces.

## Out of scope

- Sound, multi-user/collaboration, saving/sharing/exporting diagrams.
- Real backend metrics or Wandbox execution in this feature.
- New learning tracks, company-specific scenarios, AI grading.
