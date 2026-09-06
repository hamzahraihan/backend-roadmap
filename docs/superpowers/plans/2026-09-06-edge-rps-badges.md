# Edge RPS Badges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a live per-edge RPS badge on every simulator edge, derived from measured traversals.

**Architecture:** The existing 4Hz flush counts windowed edge crossings from request traces; it divides by elapsed sim-seconds for RPS, stores it in edge data, and the custom `FlowEdge` renders it via `EdgeLabelRenderer` at the smoothstep label anchor. No engine changes.

**Tech Stack:** Astro + React islands, `@xyflow/react` (`EdgeLabelRenderer`, `getSmoothStepPath` label anchor), Tailwind v4. No new dependencies.

## Global Constraints

- Scope is simulator edges only; no `player.ts`/`engine.ts` changes; home, git, and pipeline canvases untouched.
- Badges always mounted, reading `0` when idle or not playing; mono type, zinc panel, sky tint while carrying traffic, theme-aware light/dark.
- Values are compact (`850`, `1.2k`, `0`); rates use simulated seconds so pause/step/speeds stay truthful.
- `npm run check` must report 0 errors and 0 warnings.
- `npm run build` must succeed.
- This repo has no unit-test runner and no screenshot harness; verification is typecheck + build + a manual dev-server glance.

---

### Task 1: Per-edge RPS badges on simulator edges

**Files:**
- Modify: `src/components/react/SimulationStage.tsx` (import ~line 2-21, `FlowEdgeData` ~line 118-124, `FlowEdge` ~line 132-180, flush `setEdges` ~line 420-428, reset paths ~lines 343, 529, `onConnect` ~line 586)
- Test: `npm run check`, `npm run build`, manual glance (steps below)

**Interfaces:**
- Consumes: existing flush `counts` inputs (`snap.inFlight` ignored for RPS — see below), `snap.simSec`, `getSmoothStepPath` `[path, labelX, labelY]` triple, `EdgeLabelRenderer` from `@xyflow/react`.
- Produces: `FlowEdgeData.rps?: number` read by `FlowEdge`; nothing else consumes it.

**Key correctness point (do not skip):** RPS must count only *windowed completions* (trace-derived crossings since the previous flush), never the instantaneous `inFlight` snapshot (occupancy, not a rate). At very high QPS the engine retains only the newest 300 traces, so readings above ~1200 RPS understate absolute values while preserving relative split — acceptable for a learning instrument, documented here, no engine change.

- [ ] **Step 1: Extend `FlowEdgeData`, import the label renderer, add helpers**

```tsx
// import block from '@xyflow/react': add EdgeLabelRenderer alongside BaseEdge
import {
  // ...existing imports...
  BaseEdge,
  EdgeLabelRenderer,
  // ...existing imports...
} from '@xyflow/react';
```

```tsx
export type FlowEdgeData = {
  /** 0..1 traffic intensity from live sim snapshot — drives dash speed + pulse count */
  flow?: number;
  /** downstream endpoint is failed/degraded */
  failed?: boolean;
  /** measured edge crossings per simulated second over the last flush window */
  rps?: number;
  [key: string]: unknown;
};
```

Module scope (near `FlowEdge`, above it):

```tsx
function formatRps(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return '0';
  if (v < 1000) return `${Math.round(v)}`;
  return `${(v / 1000).toFixed(1)}k`;
}
```

Add next to the other refs inside `SimulationStageContent`:

```tsx
const lastRpsSimRef = useRef(0);
```

- [ ] **Step 2: Render the badge in `FlowEdge`**

Change the path call to also take the label anchor:

```tsx
// before
const [path] = getSmoothStepPath({
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
});
```

```tsx
// after
const [path, labelX, labelY] = getSmoothStepPath({
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
});
const rps = d.rps ?? 0;
```

Append inside the returned fragment, after the pulses block:

```tsx
<EdgeLabelRenderer>
  <div
    style={{
      transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
      pointerEvents: 'none',
    }}
    className={`rounded border px-1.5 py-0.5 font-mono text-[10px] leading-none ${
      rps > 0
        ? 'border-sky-500/40 bg-white/90 text-sky-600 dark:bg-zinc-900/90 dark:text-sky-300'
        : 'border-zinc-200 bg-white/90 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-400'
    }`}
  >
    {formatRps(rps)}
  </div>
</EdgeLabelRenderer>
```

- [ ] **Step 3: Compute RPS in the 4Hz flush and zero it on reset paths**

In the flush block (where `counts` is built), track windowed completions separately from the intensity counts:

```tsx
// after the existing traces loop that fills `counts`:
const simElapsed = snap.simSec - lastRpsSimRef.current;
lastRpsSimRef.current = snap.simSec;
```

Count trace-derived crossings per edge in their own map inside the same traces loop (do not reuse `counts`, which mixes in instantaneous `inFlight` occupancy):

```tsx
// inside `for (const t of handle.traces())`, alongside the existing counts.set:
trips.set(key, (trips.get(key) ?? 0) + 1);
```

with `const trips = new Map<string, number>();` declared next to `const counts = ...`. Then in `setEdges`:

```tsx
setEdges((eds) =>
  eds.map((e) => {
    const flow = Math.min(1, (counts.get(`${e.source}→${e.target}`) ?? 0) / 8);
    const failed = failedRef.current.has(kindById.get(e.target) as DesignKind);
    const rps = simElapsed > 1e-6 ? (trips.get(`${e.source}→${e.target}`) ?? 0) / simElapsed : 0;
    const prev = (e.data ?? {}) as FlowEdgeData;
    if (prev.flow === flow && prev.failed === failed && prev.rps === rps) return e;
    return { ...e, data: { ...prev, flow, failed, rps } };
  }),
);
```

A rewound clock (fresh run restarts `simSec` at 0, so `simElapsed <= 0`) yields `rps: 0` for that flush and re-baselines the ref — no extra reset edits needed for correctness of the rate itself. Still zero the stored value wherever edge data is reset so stale numbers never linger before the next flush:

- `restartRun` reset map: `{ ...((e.data ?? {}) as FlowEdgeData), flow: 0, failed: false }` → add `rps: 0`.
- `touchTopology` reset map: same addition.
- `onConnect` `addEdge` data `{ flow: 0, failed: false }` → add `rps: 0`.

- [ ] **Step 4: Run the typecheck**

Run: `npm run check`
Expected: `0 errors, 0 warnings` (hint count may vary; errors and warnings must be 0).

- [ ] **Step 5: Run the build**

Run: `npm run build`
Expected: `Complete!` with all pages built and no errors.

- [ ] **Step 6: Manual glance (dev server, needs a browser)**

Run: `npm run dev`, open a connected design topology, press Play.
Expected: every edge carries a small badge; numbers rise with the QPS slider; pausing freezes them; a detached edge reads `0`; both canvas directions and both themes show legible badges that track their wires under pan/zoom.

- [ ] **Step 7: Commit**

```bash
git add src/components/react/SimulationStage.tsx
git commit -m "feat(sim): show live per-edge RPS badges"
```
