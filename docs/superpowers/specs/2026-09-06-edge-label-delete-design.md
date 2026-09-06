# Inline edge label + click-to-delete — design

Date: 2026-09-06
Status: approved (sections 1–2), pending spec review
Scope: system design simulator edges (`SimulationStage.tsx` `FlowEdge`) only

## Problem

The RPS text floats without a legibility treatment where it crosses the
wire, and the only way to delete a connection is selecting it and pressing
Backspace/Delete — undiscoverable for mouse users.

## Decisions (from brainstorming)

- Delete: click the wire to select, revealing a midpoint × button;
  clicking × deletes. Keyboard deletion unchanged.
- Indicator: bare `N/s` text on the wire midpoint with a subtle halo.
- Approach A: × button in the label layer, CSS halo, existing delete
  pipeline (no parallel delete path, no SVG text duplicate).

## Midpoint cluster behavior

- The `EdgeLabelRenderer` label at the smoothstep anchor always shows the
  bare `N/s` text (click-transparent, as today).
- When its edge is selected — via wire click, using React Flow's built-in
  interaction width so the 2.5px wire is easy to hit — a small × button
  appears beside the text. Only the button takes pointer events.
- Clicking empty canvas deselects through the existing pane-click handler;
  the selected wire keeps its current sky highlight.

## Halo, pipeline, verification

- Halo is a tight theme-aware text shadow (white glow in light mode, ink
  glow in dark mode). No backgrounds, borders, or padding return.
- Deletion calls `useReactFlow().deleteElements()` from inside the custom
  edge, flowing into the existing `onEdgesChange` remove path and its
  topology reset (fresh run on next Play). Single edge only per click.
- Verification: `npm run check` reports 0 errors and 0 warnings,
  `npm run build` succeeds, plus a dev-server glance (× visible only while
  selected; halo legible over default, amber, and failed-red wires in both
  themes; keyboard delete still works).

## Out of scope

- Undo/redo, multi-edge bulk delete, node changes.
- Other canvases (home skill tree, git/pipeline simulators).
