# Simulation Studio + Playback Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the system-design canvas a live simulation feel (play/pause/step, animated packets, streaming log, scripted timelines) and expose it as a dedicated `/design` studio page.

**Architecture:** A pure deterministic tick engine (`player.ts` + `timelines.ts`) extends the existing `src/lib/design/` modules; one new `SimulationStage.tsx` island (React Flow renderer + playback overlay) serves both the compact skill-page panel and the full-width studio page; presets gain timelines/SLOs with a backward-compatible win adapter.

**Tech Stack:** Astro 7, React 19 islands, `@xyflow/react` 12 (no new deps), Tailwind v4, TypeScript, `requestAnimationFrame` playback loop.

## Global Constraints

- No new npm dependencies; React Flow stays the renderer.
- DESIGN.md: graphite neutrals; blue = selected/playing; emerald = objective met; amber = bottleneck/strain; red = errors/failures only; machine output mono; flat surfaces, `rounded-sm` buttons.
- `prefers-reduced-motion` disables packet animation (state changes still render).
- Engine is pure (no DOM/network), deterministic per seed, never throws on user input.
- Existing `winCondition(state, result)` signature keeps working via adapter.
- Verification is `npm run check`, `npm run build`, plus node CJS smoke scripts (repo has no test runner — do not add one).

---

### Task 1: Tick engine core (`player.ts`)

**Files:**
- Create: `src/lib/design/player.ts`

**Interfaces:**
- Consumes: `BASE_LATENCY_MS`, `findRequestPath`, `hasPath`, `validateTopology`, `countKind` from `./engine`; types from `./types`.
- Produces: `mulberry32(seed)`, `createRun(topology, opts) → RunHandle`, `RunEvent`, `RunSummary`, `RequestTrace`, `runToCompletion(handle, maxSec)` (headless helper for smoke tests) — consumed by Tasks 2–4.

- [ ] **Step 1: Create `src/lib/design/player.ts`** with exactly this surface:

```ts
import { BASE_LATENCY_MS, findRequestPath, hasPath, validateTopology } from './engine';
import { SINK_KINDS, type DesignKind } from './types';

export interface PlayerTopology { nodes: { id: string; kind: DesignKind }[]; edges: { from: string; to: string }[]; }
export interface PlayerOpts { qps: number; readRatio: number; seed?: number; }
export type SimTrigger = { type: 'spike'; factor: number; secs: number } | { type: 'fail'; kind: DesignKind } | { type: 'heal'; kind: DesignKind } | { type: 'note'; text: string };
export interface Hop { nodeId: string; arrived: number; departed: number; }
export interface RequestTrace { id: number; path: string[]; hops: Hop[]; latencyMs: number; hit?: boolean; error?: string; }
export interface RunEvent { t: number; kind: 'spawned'|'hop'|'completed'|'dropped'|'trigger'|'note'; text: string; requestId?: number; nodeId?: string; }
export interface NodeLoad { inFlight: number; queue: number; served: number; errors: number; }
export interface RunSummary { simSec: number; completed: number; errors: number; p99Ms: number; errPct: number; rps: number; bottleneck: string; loadByKind: Record<string, NodeLoad>; }
export interface RunHandle {
  tick(dtSec: number): RunEvent[];
  trigger(ev: SimTrigger): RunEvent[];
  snapshot(): { simSec: number; loads: Record<string, NodeLoad>; inFlight: { requestId: number; edgeKey: string; progress: number }[] };
  summarize(): RunSummary;
  traces(): RequestTrace[];
}
export function mulberry32(seed: number): () => number { /* standard */ }
export function createRun(topo: PlayerTopology, opts: PlayerOpts): RunHandle { /* ... */ }
export function runToCompletion(topo: PlayerTopology, opts: PlayerOpts, maxSec: number, triggers?: { at: number; ev: SimTrigger }[]): { summary: RunSummary; events: RunEvent[] } { /* tick 0.1s steps, fire triggers at marks */ }
```

Semantics to implement: spawn `qps*dtSec` requests per tick (fractional carry); each request walks the BFS client→sink path; per-node service time = `BASE_LATENCY_MS[kind]` × (1+qps/2000 for app/sql/nosql/storage) with ±20% seeded jitter; FIFO queue per node id, cap = 50 × replica count (replica count = node count of that kind); over cap → `dropped` + error; cache on path with readRatio ≥ 0.5 → reads complete at cache with hit trace (no downstream hops); queue kind = zero blocking, trace continues; failed kinds (via `fail` trigger or initial set) stall 150ms then reroute note or error when no path; `progress` for packets = elapsed/edgeTime along current hop; invalid topology → `createRun` returns a handle whose `summarize()` is `{simSec:0,completed:0,errors:0,p99Ms:0,errPct:0,rps:0,bottleneck:'—',loadByKind:{}}` and whose first `tick` emits the `validateTopology` guidance as `note` events (never throw).

- [ ] **Step 2: Typecheck**

Run: `npm run check`
Expected: PASS, 0 errors.

### Task 2: Timelines, SLOs, preset extension

**Files:**
- Create: `src/lib/design/timelines.ts`
- Modify: `src/lib/design/presets.ts` (append timeline/slo fields + `checkRunObjective`)
- Modify: `src/lib/design/types.ts` (append `TimelineEvent`, `RunSLO` types)

**Interfaces:**
- Consumes: `RunSummary` from Task 1; existing `DesignPreset`, `DesignState`, `DesignResult`.
- Produces: `TimelineEvent`, `SCENARIO_TIMELINES: Record<string, TimelineEvent[]>`, `checkRunObjective(preset, topologyOk: boolean, summary)`, `resultFromSummary(summary, structuralNotes)` adapter — consumed by Task 3.

- [ ] **Step 1: Append to `src/lib/design/types.ts`**

```ts
export interface TimelineEvent { atSec: number; trigger: import('./player').SimTrigger; }
export interface RunSLO { p99LtMs?: number; errLtPct?: number; minCompleted?: number; }
```

(Avoid the `import()` type by instead importing type `SimTrigger` at top: `import type { SimTrigger } from './player';` and using `trigger: SimTrigger;`.)

- [ ] **Step 2: Create `src/lib/design/timelines.ts`**

```ts
import type { TimelineEvent } from './types';
export const SCENARIO_TIMELINES: Record<string, TimelineEvent[]> = {
  'scalability-performance': [
    { atSec: 10, trigger: { type: 'spike', factor: 4, secs: 15 } },
    { atSec: 30, trigger: { type: 'note', text: 'Spike over — watch queues drain.' } },
  ],
  'distributed-failures': [
    { atSec: 8, trigger: { type: 'fail', kind: 'app' } },
    { atSec: 25, trigger: { type: 'heal', kind: 'app' } },
  ],
  'interview-framework': [
    { atSec: 10, trigger: { type: 'spike', factor: 3, secs: 12 } },
    { atSec: 24, trigger: { type: 'fail', kind: 'app' } },
    { atSec: 38, trigger: { type: 'heal', kind: 'app' } },
  ],
  'rate-limiting-url-shortener': [
    { atSec: 8, trigger: { type: 'spike', factor: 5, secs: 12 } },
  ],
  free: [],
};
export function timelineFor(presetId: string): TimelineEvent[] { return SCENARIO_TIMELINES[presetId] ?? []; }
```

- [ ] **Step 3: Extend `src/lib/design/presets.ts`** — add to each guided preset an `slo` and keep existing `winCondition` untouched; append:

```ts
import type { RunSLO } from './types';
import type { RunSummary } from './player';
const SLOS: Record<string, RunSLO> = {
  'system-design-fundamentals': { minCompleted: 20 },
  'scalability-performance': { p99LtMs: 400, minCompleted: 100 },
  'caching-cdn': { p99LtMs: 200, minCompleted: 100 },
  'load-balancing-gateway': { errLtPct: 5, minCompleted: 100 },
  'data-modeling-apis': { minCompleted: 50 },
  'databases-sharding': { p99LtMs: 400, minCompleted: 100 },
  'messaging-queues': { errLtPct: 5, minCompleted: 100 },
  'distributed-failures': { errLtPct: 25, minCompleted: 100 },
  'rate-limiting-url-shortener': { p99LtMs: 250, minCompleted: 100 },
  'realtime-rides-feed': { errLtPct: 5, minCompleted: 100 },
  'interview-framework': { p99LtMs: 400, errLtPct: 10, minCompleted: 150 },
  free: {},
};
export function sloFor(presetId: string): RunSLO { return SLOS[presetId] ?? {}; }
export function checkRunObjective(presetId: string, topologyOk: boolean, summary: RunSummary): boolean {
  if (!topologyOk || summary.completed === 0) return false;
  const slo = sloFor(presetId);
  if (slo.minCompleted !== undefined && summary.completed < slo.minCompleted) return false;
  if (slo.p99LtMs !== undefined && summary.p99Ms >= slo.p99LtMs) return false;
  if (slo.errLtPct !== undefined && summary.errPct >= slo.errLtPct) return false;
  return true;
}
```

- [ ] **Step 4: Engine smoke test for Tasks 1–2** — compile and run:

Run: `npx tsc src/lib/design/types.ts src/lib/design/engine.ts src/lib/design/player.ts src/lib/design/timelines.ts src/lib/design/presets.ts --ignoreConfig --outDir "G:\Temp\opencode\design-out2" --module commonjs --target es2020 --skipLibCheck && node -e "const {createRun,runToCompletion}=require('G:/Temp/opencode/design-out2/player.js');const {initialStateFor}=require('G:/Temp/opencode/design-out2/presets.js');const {timelineFor}=require('G:/Temp/opencode/design-out2/timelines.js');const topo=(()=>{const s=initialStateFor('caching-cdn');return{nodes:s.nodes,edges:s.edges}})();const a=runToCompletion(topo,{qps:500,readRatio:0.8,seed:7},30);const b=runToCompletion(topo,{qps:500,readRatio:0.8,seed:7},30);console.log(a.summary.completed>0&&JSON.stringify(a.summary)===JSON.stringify(b.summary)?'PASS determinism':'FAIL determinism');const c=runToCompletion(topo,{qps:500,readRatio:0.8,seed:7},45,timelineFor('distributed-failures').map(t=>({at:t.atSec,ev:t.trigger})));console.log(c.events.some(e=>e.kind==='trigger')?'PASS timeline fires':'FAIL timeline');console.log(JSON.stringify(a.summary.completed) + ' completed, p99 ' + a.summary.p99Ms)"
Expected: PASS determinism, PASS timeline fires, plus counts line.

### Task 3: `SimulationStage.tsx` (playback UI)

**Files:**
- Create: `src/components/react/SimulationStage.tsx`

**Interfaces:**
- Consumes: `createRun`, `RunHandle`, `RunEvent`, `RunSummary`, `RequestTrace` (Task 1); `getPreset`, `initialStateFor`, `starterNode`, `sloFor`, `checkRunObjective` (Task 2 + existing); `timelineFor` (Task 2); `simulateTraffic`, `validateTopology` (existing engine); `ProgressProvider`, `ResizableSplit`, `useTheme` (existing).
- Produces: default export `SimulationStage({skillId, scenarioId?, layout}: {skillId: string; scenarioId?: string; layout: 'panel'|'studio'})` — consumed by Task 4. Packet overlay reads live node positions via `useStore`/`useReactFlow` `getInternalNode` inside a `ReactFlowProvider` child.

- [ ] **Step 1: Create `src/components/react/SimulationStage.tsx`** implementing all of the following (no placeholders — every control wired):
  - Props resolve preset by `scenarioId ?? skillId` with `getPreset` fallback; guided/free toggle (free preset id forces free).
  - Palette add, drag/connect/delete canvas (same node/edge model as current `DesignSimulation.tsx`), transport bar: Play/Pause/Step/Reset, speed 1×/2×/4×, sim clock `t+Xs`, scenario sliders (QPS, reads %, failure select pre-run), manual trigger buttons (Spike ×4 15s, Kill menu by kind, Heal) enabled mid-run.
  - rAF loop: `clockRef += dt*speed`, `handle.tick()` in 0.1s sim quanta, timeline events fired at marks, `snapshot()` per frame → packet overlay (dots positioned by interpolating edge endpoints from `getInternalNode` coords; cap 120 rendered, counters exact), node badges (in-flight/queue), bottleneck amber ring, failed grey-out, streaming log capped at 200 lines with auto-scroll + pause-on-hover, metrics header (p99, err %, rps + 40-sample sparkline divs), step mode (pause + select latest request → trace list + Next-step advances one hop), SLO evaluation over the run (guided: `checkRunObjective` with topology pre-check via old `winCondition` on current topology + instant `simulateTraffic` for the preview line), Reset restores starter topology + clock + log.
  - `prefers-reduced-motion`: skip packet dots, still update badges/log/metrics.
  - rAF cleanup on unmount, preset/scenario change, Reset. Panel layout keeps objective banner + `ResizableSplit`; studio layout adds scenario picker row (buttons for TinyURL/Chat/Rides/Feed/Free mapping to preset ids, switching resets the run).

- [ ] **Step 2: Run check**

Run: `npm run check`
Expected: PASS, 0 errors.

### Task 4: Studio route + TopBar + skill-page wiring + old panel removal

**Files:**
- Create: `src/pages/design.astro`
- Modify: `src/components/TopBar.astro` (Props variant union, breadcrumb, home CTA)
- Modify: `src/pages/skill/[slug].astro` (render `SimulationStage layout="panel"`)
- Delete: `src/components/react/DesignSimulation.tsx`

**Interfaces:**
- Consumes: `SimulationStage` (Task 3).
- Produces: `/design` route; `variant='design'` TopBar; skill pages on the new stage; no references to `DesignSimulation` remain.

- [ ] **Step 1: Create `src/pages/design.astro`** mirroring `src/pages/playground.astro`:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import SimulationStage from '../components/react/SimulationStage.tsx';
import TopBar from '../components/TopBar.astro';
---
<BaseLayout title="Design Studio — Backend Roadmap">
  <main class="flex h-screen flex-col">
    <TopBar variant="design" />
    <div class="min-h-0 flex-1">
      <SimulationStage client:load skillId="free" scenarioId="rate-limiting-url-shortener" layout="studio" />
    </div>
  </main>
</BaseLayout>
```

- [ ] **Step 2: Edit `src/components/TopBar.astro`** — variant union `'home' | 'skill' | 'playground' | 'design'`; add `isDesign` const; breadcrumb block for design ("Design Studio"); home CTA "Design Studio" link `/design` next to "Git Playground" (visible on `isHome`); ← Roadmap link on `isDesign` (same classes as playground one).

- [ ] **Step 3: Edit `src/pages/skill/[slug].astro`** — replace the `DesignSimulation` import with `SimulationStage` and the `isDesignSimulation` branch with `<SimulationStage client:load skillId={skill.id} layout="panel" />`.

- [ ] **Step 4: Delete `src/components/react/DesignSimulation.tsx`** and grep for leftovers:

Run: `rg -l "DesignSimulation" src/`
Expected: no output.

- [ ] **Step 5: Run check + build**

Run: `npm run check && npm run build`
Expected: 0 errors; build lists `/design/index.html` plus all skill pages.
