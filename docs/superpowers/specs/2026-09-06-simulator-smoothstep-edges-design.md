# Simulator smoothstep edges — design

Date: 2026-09-06
Status: approved, pending spec review
Scope: system design simulator canvas (`SimulationStage.tsx` `FlowEdge`) only

## Problem

Simulator edges render with `getStraightPath`, so every connection is a
rigid straight segment. The home skill-tree canvas already uses rounded
`smoothstep` edges, making the simulator feel inconsistent and less
friendly, especially on diagonal node pairs.

## Decisions (from brainstorming)

- Curve style: `smoothstep`, matching the home canvas.
- Approach A: swap the path function inside the existing custom `FlowEdge`;
  keep the base wire, animated dash overlay, SMIL flow pulses, arrow
  marker, strokes, and colors exactly as they are.

## Change

In `src/components/react/SimulationStage.tsx`:

- Import `getSmoothStepPath` from `@xyflow/react` instead of
  `getStraightPath`.
- In `FlowEdge`, compute the shared `path` via `getSmoothStepPath` with
  `{ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition }`
  taken from the edge props plus the default corner radius. Passing the
  handle positions keeps bends oriented correctly in both the top-down and
  horizontal canvas directions.
- No other edits: `BaseEdge`, the dash overlay `<path>`, and the
  `<animateMotion>` pulses all render from the same `path` variable, so the
  traffic animation stays glued to the new curve automatically.

## Verification

- `npm run check` reports 0 errors and 0 warnings.
- `npm run build` succeeds (Astro prerender unaffected; change is SVG
  geometry only).
- Manual glance in the dev server at one connected topology in each canvas
  direction (no screenshot harness exists in this repo).

## Out of scope

- Home skill-tree edges (already `smoothstep`).
- Git/pipeline simulator edges (default styling, not reported).
- Tunable curvature, per-direction path variants, or replacing the custom
  `FlowEdge` with a built-in edge type (rejected: would delete the
  live-traffic animation).
