# Simulator Smoothstep Edges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render system-design simulator edges as rounded smoothstep curves matching the home canvas.

**Architecture:** Swap the single path function inside the existing custom `FlowEdge` (`SimulationStage.tsx`); the base wire, dash overlay, and SMIL pulses all share that `path` variable, so one edit bends everything consistently.

**Tech Stack:** Astro + React islands, `@xyflow/react` (`getSmoothStepPath`, `EdgeProps`), Tailwind v4. No new dependencies.

## Global Constraints

- Scope is the simulator `FlowEdge` only; home skill-tree edges already use smoothstep and git/pipeline edges are untouched.
- Arrow marker, stroke colors/widths, dash overlay, and SMIL pulses stay exactly as they are.
- `npm run check` must report 0 errors and 0 warnings.
- `npm run build` must succeed.
- This repo has no unit-test runner and no screenshot harness; verification is typecheck + build + a manual dev-server glance in both canvas directions.

---

### Task 1: Swap FlowEdge to smoothstep path

**Files:**
- Modify: `src/components/react/SimulationStage.tsx:11` (import), `:132-143` (props + path call)
- Test: `npm run check`, `npm run build`, manual glance (steps below)

**Interfaces:**
- Consumes: `EdgeProps` (`sourceX/Y`, `targetX/Y`, `sourcePosition`, `targetPosition` — all supplied by React Flow; no new props).
- Produces: `path` string consumed unchanged by `BaseEdge`, the dash overlay `<path>`, and `<animateMotion path={...}>`.

- [ ] **Step 1: Swap the import (line 11)**

```tsx
// before
  getStraightPath,
// after
  getSmoothStepPath,
```

Full import block is `from '@xyflow/react'`; change only that one identifier.

- [ ] **Step 2: Thread handle positions through FlowEdge and swap the call**

```tsx
// before
function FlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  data,
}: EdgeProps) {
  const d = (data ?? {}) as FlowEdgeData;
  const flow = Math.min(1, Math.max(0, d.flow ?? 0));
  const [path] = getStraightPath({ sourceX, sourceY, targetX, targetY });
```

```tsx
// after
function FlowEdge({
  id,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  markerEnd,
  data,
}: EdgeProps) {
  const d = (data ?? {}) as FlowEdgeData;
  const flow = Math.min(1, Math.max(0, d.flow ?? 0));
  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
```

Default corner radius applies; nothing downstream changes (`BaseEdge`, dash overlay, and pulses keep reading `path`).

- [ ] **Step 3: Run the typecheck**

Run: `npm run check`
Expected: `0 errors, 0 warnings` (hint count may vary; errors and warnings must be 0).

- [ ] **Step 4: Run the build**

Run: `npm run build`
Expected: `Complete!` with all pages built and no errors.

- [ ] **Step 5: Manual glance (dev server, needs a browser)**

Run: `npm run dev`, open any connected design topology, toggle the canvas direction control between top-down and horizontal.
Expected: edges render as rounded smoothstep bends oriented with the flow direction in both modes; arrowheads sit on the wire ends; traffic dashes/pulses ride the curves.

- [ ] **Step 6: Commit**

```bash
git add src/components/react/SimulationStage.tsx
git commit -m "feat(sim): render flow edges as smoothstep curves"
```
