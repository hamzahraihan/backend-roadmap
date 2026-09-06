# Inline Edge Label + Click-to-Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seat the RPS text on the wire with a legibility halo and let a wire click reveal a midpoint × delete button.

**Architecture:** Both pieces live in the existing `FlowEdge` label layer (`SimulationStage.tsx`): a theme-aware text shadow for the halo, and a selection-gated × button that deletes through `useReactFlow().deleteElements()` into the existing `onEdgesChange` remove pipeline. No engine changes, no new files.

**Tech Stack:** Astro + React islands, `@xyflow/react` (`EdgeLabelRenderer`, `useReactFlow`, `EdgeProps.selected`), `@radix-ui/react-icons` (`Cross1Icon`, already imported), Tailwind v4. No new dependencies.

## Global Constraints

- Scope is the simulator `FlowEdge` label only; wires, markers, strokes, dash overlay, SMIL pulses, and the RPS value pipeline stay exactly as they are.
- Bare text stays bare: no backgrounds, borders, or padding return.
- Keyboard deletion (Backspace/Delete) keeps working; single edge deleted per × click.
- `npm run check` must report 0 errors and 0 warnings.
- `npm run build` must succeed.
- This repo has no unit-test runner and no screenshot harness; verification is typecheck + build + a manual dev-server glance.

---

### Task 1: Halo on the RPS text

**Files:**
- Modify: `src/components/react/SimulationStage.tsx` (RPS `<span>` inside `EdgeLabelRenderer`, ~line 188-200)
- Test: `npm run check`, manual glance (steps below)

**Interfaces:**
- Consumes: existing `rps` value and label `div` positioning (unchanged).
- Produces: halo-styled text; Task 2 adds the × button beside it.

- [ ] **Step 1: Restructure the label into halo text**

Replace the badge content (keep the outer positioned `div` with its `transform` and `pointerEvents: 'none'` exactly as-is):

```tsx
// before
<div
  style={{
    transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
    pointerEvents: 'none',
  }}
  className={`font-mono text-[10px] leading-none ${
    rps > 0 ? 'text-sky-600 dark:text-sky-300' : 'text-zinc-500 dark:text-zinc-400'
  }`}
>
  {formatRps(rps)}
</div>
```

```tsx
// after
<div
  style={{
    transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
    pointerEvents: 'none',
  }}
  className="flex items-center gap-1"
>
  <span
    className={`font-mono text-[10px] leading-none [text-shadow:0_0_5px_white] dark:[text-shadow:0_0_5px_#09090b] ${
      rps > 0 ? 'text-sky-600 dark:text-sky-300' : 'text-zinc-500 dark:text-zinc-400'
    }`}
  >
    {formatRps(rps)}
  </span>
</div>
```

(`#09090b` is the DESIGN.md ink value; the `×` button lands inside this flex row in Task 2.)

- [ ] **Step 2: Run the typecheck**

Run: `npm run check`
Expected: `0 errors, 0 warnings` (hint count may vary; errors and warnings must be 0).

- [ ] **Step 3: Commit**

```bash
git add src/components/react/SimulationStage.tsx
git commit -m "feat(sim): seat edge RPS text on the wire with halo"
```

---

### Task 2: Selected-edge × delete button

**Files:**
- Modify: `src/components/react/SimulationStage.tsx` (import ~line 2-21, `FlowEdge` signature + hook + label row)
- Test: `npm run check`, `npm run build`, manual glance (steps below)

**Interfaces:**
- Consumes: `EdgeProps.selected` and `EdgeProps.id` (both supplied by React Flow; `id` is already destructured), Task 1's flex label row.
- Produces: nothing (final UI task).

- [ ] **Step 1: Add the `useReactFlow` import**

```tsx
// before (in the '@xyflow/react' import block, alphabetical neighbors permitting)
  useEdgesState,
  useNodesState,
```

```tsx
// after
  useEdgesState,
  useNodesState,
  useReactFlow,
```

(`Cross1Icon` is already imported from `@radix-ui/react-icons`; do not re-import it.)

- [ ] **Step 2: Read `selected` and `deleteElements` in `FlowEdge`**

```tsx
// before
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
  selected,
  data,
}: EdgeProps) {
  const { deleteElements } = useReactFlow();
```

- [ ] **Step 3: Render the × button beside the RPS text when selected**

Inside Task 1's flex row, after the RPS `<span>`:

```tsx
{selected && (
  <button
    onClick={(e) => {
      e.stopPropagation();
      deleteElements({ edges: [{ id }] });
    }}
    aria-label="Delete connection"
    title="Delete connection"
    style={{ pointerEvents: 'auto' }}
    className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-zinc-600 text-white hover:bg-red-500 dark:bg-zinc-300 dark:text-zinc-900 dark:hover:bg-red-400"
  >
    <Cross1Icon width={9} height={9} aria-hidden />
  </button>
)}
```

`deleteElements` flows into the existing `onEdgesChange` remove path (`handleEdgesChange` → topology reset), so no other wiring is needed. Only the button re-enables pointer events; the text stays click-transparent.

- [ ] **Step 4: Run the typecheck**

Run: `npm run check`
Expected: `0 errors, 0 warnings`.

- [ ] **Step 5: Run the build**

Run: `npm run build`
Expected: `Complete!` with all pages built and no errors.

- [ ] **Step 6: Manual glance (dev server, needs a browser)**

Run: `npm run dev`, open a connected design topology.
Expected: clicking a wire selects it (sky highlight) and reveals the × button beside its RPS text; clicking × deletes exactly that connection and resets the run; clicking empty canvas deselects; Backspace/Delete-key deletion still works; halo keeps digits legible over default, amber, and failed-red wires in both themes.

- [ ] **Step 7: Commit**

```bash
git add src/components/react/SimulationStage.tsx
git commit -m "feat(sim): delete connection via selected-edge button"
```
