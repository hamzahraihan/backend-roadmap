# Edge RPS badges — design

Date: 2026-09-06
Status: approved (sections 1–2), pending spec review
Scope: system design simulator canvas (`SimulationStage.tsx` edges) only

## Problem

Edges show animated flow intensity but no numbers, so a learner cannot see
how many requests per second travel from one node to the next (e.g. how
load splits across two app servers, or that a detached edge carries
nothing).

## Decisions (from brainstorming)

- Metric: live per-edge RPS (measured traversals, 0 when idle).
- Visibility: badges always mounted on every edge, reading 0 when idle or
  not playing — nothing pops in or out.
- Approach A: derive RPS from the existing flush traversal counts; no
  engine changes.

## Data flow and rendering

- The existing 4Hz flush already builds `counts` (edge key → traversals
  since the previous flush). It additionally computes
  `rps = count / elapsedSimSeconds` per edge and writes it into that
  edge's data alongside the existing `flow`/`failed` fields.
- `FlowEdge` reads `d.rps` and renders it through React Flow's
  `EdgeLabelRenderer` at the `labelX/labelY` anchor its `getSmoothStepPath`
  call already returns, so badges stay glued under pan/zoom/fitView.
- Styling follows the terminal system: mono type, zinc panel consistent
  with node labels, sky tint while the edge carries traffic, theme-aware
  for light and dark modes.

## Formatting, states, verification

- Compact values: raw integers below 1000 (`850`), one-decimal `k` above
  (`1.2k`), `0` when idle or not playing.
- Rates derive from simulated seconds, not wall clock, so readings stay
  truthful under pause, single-step, and 1×/2×/4× playback speeds.
- Topology edits and run resets return edge data (including RPS) to 0 via
  the existing reset paths.
- Verification: `npm run check` reports 0 errors and 0 warnings,
  `npm run build` succeeds, plus a dev-server glance (numbers rise with
  QPS, freeze on pause, detached edges read 0).

## Out of scope

- Cumulative per-edge totals and per-node RPS rollups.
- Any `player.ts`/`engine.ts` changes.
- Other canvases (home skill tree, git/pipeline simulators).
