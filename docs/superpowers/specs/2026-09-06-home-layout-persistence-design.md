# Home layout persistence — design

Date: 2026-09-06
Status: approved (sections 1–2), pending spec review
Scope: home page skill-tree (`SkillTree.tsx`) only

## Problem

Home-page nodes are draggable via React Flow, but positions reset on every
reload: layout is recomputed by dagre on each mount. Users who arrange the
graph to their liking lose the arrangement.

## Decisions (from brainstorming)

- Persistence is automatic on drag end; there is no Save button.
- One new control only: a **Reset layout** button.
- Reset restores dagre positions and refits the canvas view.
- Approach A: `localStorage` position map merged over the dagre base.
- Storage is per-browser, consistent with progress, theme, and split sizes
  (the product has no accounts, so no roaming).

## Architecture

- New helper `src/lib/skillLayout.ts`, mirroring `src/lib/progress.ts`:
  - `loadLayout(): Record<string, { x: number; y: number }>` — parses key
    `backend-roadmap:skill-layout`, returns `{}` on missing/corrupt data.
  - `saveLayout(map)` — writes the key; no-ops server-side.
  - `clearLayout()` — removes the key; no-ops server-side.
  - All functions SSR-guard with `typeof window === 'undefined'` and never
    throw (try/catch around JSON parse, matching `loadProgress`).
- No changes to content schema, collections, or the `position` frontmatter
  field (it stays unused).

## Components and data flow

- `SkillTree.tsx` keeps the existing dagre memo as the base layout.
- At init, saved positions for known skill ids are merged over the dagre
  positions to produce `initialNodes`. The merge lives inside the existing
  dagre `useMemo` (which already recomputes when skill data or progress
  changes), so each recompute re-reads storage via `loadLayout()` and picks
  up drags saved after mount. Entries for unknown ids are dropped;
  skills without saved entries keep dagre positions.
- Dragging continues through the existing `onNodesChange`. Persistence
  happens on React Flow `onNodeDragStop`: current node positions for known
  skill ids are written via `saveLayout`.
- The existing re-sync effect rebuilds display nodes from `initialNodes`,
  so seeding saved positions into `initialNodes` keeps custom layouts intact
  across progress and category-filter changes.
- Reset handler: `clearLayout()`, recompute the dagre base, `setNodes` with
  the base positions, and refit via the flow instance `fitView()`.
- Reset button lives in the existing bottom-right control stack beside
  **Reset progress**: same `ResetIcon` visual language, label
  **Reset layout** so the two destructive actions are visually grouped but
  textually distinct.

## States and error handling

- No saved/dirty indicator; auto-save is silent.
- Reset is always rendered and is a safe no-op when nothing is stored.
- Corrupt JSON, missing key, or server-side render: fall back to dagre.
- Removed-skill entries are pruned on load and on save.

## Verification

- `npm run check` must report 0 errors and 0 warnings.
- Manual cycle: drag one or more nodes, reload (positions hold), press
  Reset layout (dagre positions return, view refits), reload again (dagre
  positions hold). Repeat at a desktop width and a mobile width.
- Positions are theme-independent; verify primarily in the current theme
  with a spot-check in the other.

## Out of scope

- Viewport (pan/zoom) persistence.
- Honoring the `position` frontmatter field.
- Cross-device sync.
- Dagre parameter tuning or node-size changes.
