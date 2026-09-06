# Home Layout Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist home-page skill-tree node positions to `localStorage` on drag end, with a Reset layout button restoring the dagre auto-layout plus refit view.

**Architecture:** New `src/lib/skillLayout.ts` helper mirroring `src/lib/progress.ts` (guarded JSON `localStorage` access). `SkillTree.tsx` merges saved positions over its existing dagre memo on every recompute, saves on React Flow `onNodeDragStop`, and resets via a `layoutEpoch` state bump plus `fitView()`.

**Tech Stack:** Astro + React islands, `@xyflow/react` (React Flow), `@dagrejs/dagre`, Tailwind v4. No new dependencies.

## Global Constraints

- Per-browser `localStorage` only; no accounts, no server, no backend database.
- Never throw from storage helpers; corrupt/missing data falls back to dagre.
- Preserve the committed visual world in `DESIGN.md` (Reference Terminal: graphite base, signal colors for status only, flat surfaces, system sans + mono).
- New UI copies the existing Reset progress button styling exactly (same classes, same `ResetIcon`).
- `npm run check` must report 0 errors and 0 warnings after every task.
- This repo has no unit-test runner (scripts are `dev`/`build`/`check`); each task's test cycle is `npm run check` plus the specified runtime behavior check.

---

### Task 1: Storage helper `src/lib/skillLayout.ts`

**Files:**
- Create: `src/lib/skillLayout.ts`
- Test: `npm run check` (typecheck must pass)

**Interfaces:**
- Consumes: nothing (only `window.localStorage`).
- Produces (used by Task 2 and Task 3 — exact names and signatures):
  - `export interface SavedPosition { x: number; y: number }`
  - `export type SavedLayout = Record<string, SavedPosition>`
  - `export function loadLayout(): SavedLayout`
  - `export function saveLayout(map: SavedLayout): void`
  - `export function clearLayout(): void`

- [ ] **Step 1: Create `src/lib/skillLayout.ts` with the full implementation**

```ts
export interface SavedPosition {
  x: number;
  y: number;
}

export type SavedLayout = Record<string, SavedPosition>;

const STORAGE_KEY = 'backend-roadmap:skill-layout';

function isPosition(v: unknown): v is SavedPosition {
  if (!v || typeof v !== 'object') return false;
  const { x, y } = v as { x?: unknown; y?: unknown };
  return (
    typeof x === 'number' &&
    Number.isFinite(x) &&
    typeof y === 'number' &&
    Number.isFinite(y)
  );
}

/** Saved node positions by skill id. Returns {} when missing, corrupt, or server-side. Never throws. */
export function loadLayout(): SavedLayout {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: SavedLayout = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (isPosition(v)) out[k] = { x: v.x, y: v.y };
    }
    return out;
  } catch {
    return {};
  }
}

/** Persist node positions by skill id. No-op server-side; ignores quota errors. */
export function saveLayout(map: SavedLayout): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Private mode / quota: layout simply doesn't persist this session.
  }
}

/** Remove saved positions. No-op server-side; ignores errors. */
export function clearLayout(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do: absence of stored data already means dagre base.
  }
}
```

- [ ] **Step 2: Run the typecheck**

Run: `npm run check`
Expected: `Result (45 files): 0 errors, 0 warnings` (hint count may vary; errors and warnings must be 0).

- [ ] **Step 3: Commit**

```bash
git add src/lib/skillLayout.ts
git commit -m "feat(home): add skill layout storage helper"
```

---

### Task 2: Merge saved positions and auto-save on drag in `SkillTree.tsx`

**Files:**
- Modify: `src/components/react/SkillTree.tsx:26` (add import), `:173-222` (epoch state + dagre memo merge), `:356-374` (add `onNodeDragStop` prop)
- Test: `npm run check` + runtime drag/persist check below

**Interfaces:**
- Consumes (from Task 1): `loadLayout(): SavedLayout`, `saveLayout(map: SavedLayout): void`.
- Produces (for Task 3): merged `initialNodes` (saved positions win over dagre), `layoutEpoch` state with `setLayoutEpoch` setter.

- [ ] **Step 1: Add the import after line 26**

```tsx
import { loadLayout, saveLayout } from '../../lib/skillLayout';
```

so lines 22–27 read:

```tsx
import { ProgressProvider, useProgressContext } from './ProgressProvider';
import type { SkillSummary } from '../../lib/skills';
import type { ProgressStatus } from '../../lib/progress';
import { useTheme } from '../../lib/theme';
import { loadLayout, saveLayout } from '../../lib/skillLayout';
import { CATEGORY_COLORS, buildNeighborhood, categoryColor } from '../../lib/skillGraph';
```

- [ ] **Step 2: Add `layoutEpoch` state and merge saved positions inside the dagre memo**

Add directly above the `useMemo` that builds `initialNodes` (currently starting `const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {`):

```tsx
const [layoutEpoch, setLayoutEpoch] = useState(0);
```

Inside that same `useMemo`, after the `nodeList` array is built and before `edgeList` is built, insert the merge (replacing `return { nodes: nodeList, edges: edgeList };`):

```tsx
const saved = loadLayout();
const mergedNodes: Node[] = nodeList.map((n) => {
  const p = saved[n.id];
  return p ? { ...n, position: { x: p.x, y: p.y } } : n;
});
```

Change the memo's return to:

```tsx
return { nodes: mergedNodes, edges: edgeList };
```

And change the memo dependency array from `[skills, deriveStatus]` to `[skills, deriveStatus, layoutEpoch]` (`layoutEpoch` only busts the cache so Task 3's reset recomputes; `loadLayout()` re-reads storage on every recompute, which is what picks up drags saved after mount).

- [ ] **Step 3: Add the drag-stop persist handler and wire it to React Flow**

Add near the other callbacks (e.g. after `onPaneClick`):

```tsx
// NOTE: bare `MouseEvent` here is React's synthetic type (imported at the
// top of SkillTree.tsx) and does NOT satisfy React Flow's `OnNodeDrag`,
// which expects native DOM events — use the `globalThis` qualification.
const onNodeDragStop = useCallback((_: globalThis.MouseEvent | globalThis.TouchEvent, _node: Node, all: Node[]) => {
  const map: Record<string, { x: number; y: number }> = {};
  for (const n of all) map[n.id] = { x: n.position.x, y: n.position.y };
  saveLayout(map);
}, []);
```

Add the prop to the `<ReactFlow>` element (alongside `onNodesChange`/`onEdgesChange`):

```tsx
onNodeDragStop={onNodeDragStop}
```

`MouseEvent` and `Node` types are already imported at the top of the file; no new type imports needed.

- [ ] **Step 4: Run the typecheck**

Run: `npm run check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 5: Runtime check (dev server)**

Run: `npm run dev`, open the home page, drag any node, reload the page.
Expected: the dragged node keeps its dragged position; unmoved nodes stay on the dagre layout. (Do not commit a broken intermediate state — fix first if positions reset.)

- [ ] **Step 6: Commit**

```bash
git add src/components/react/SkillTree.tsx src/lib/skillLayout.ts
git commit -m "feat(home): auto-save skill tree layout on drag"
```

---

### Task 3: Reset layout button plus reset handler

**Files:**
- Modify: `src/components/react/SkillTree.tsx:176` (`useReactFlow` destructure), callbacks area (add `onResetLayout`), `:470-476` (add button beside Reset progress)
- Test: `npm run check` + runtime reset check below

**Interfaces:**
- Consumes: `clearLayout()` from Task 1; `layoutEpoch`/`setLayoutEpoch` and merged `initialNodes` from Task 2; `fitView` from React Flow's `useReactFlow`.
- Produces: nothing (final UI task).

- [ ] **Step 1: Expose `fitView` from `useReactFlow`**

Change line 176 from:

```tsx
const { setCenter, flowToScreenPosition, getNode } = useReactFlow();
```

to:

```tsx
const { setCenter, flowToScreenPosition, getNode, fitView } = useReactFlow();
```

- [ ] **Step 2: Add the reset handler near the other callbacks**

```tsx
const onResetLayout = useCallback(() => {
  clearLayout();
  setLayoutEpoch((e) => e + 1);
  requestAnimationFrame(() => fitView({ padding: 0.2 }));
}, [fitView]);
```

How it works: clearing storage plus the epoch bump forces the Task 2 memo to recompute to pure dagre positions; the existing re-sync effect (which rebuilds display nodes from `initialNodes`) then restores them, and `fitView({ padding: 0.2 })` refits the canvas (same padding as the initial `fitViewOptions`).

- [ ] **Step 3: Add the button directly above the Reset progress button**

Insert before the existing Reset progress `<button onClick={clearProgress} ...>`:

```tsx
<button
  onClick={onResetLayout}
  className="inline-flex items-center gap-1.5 rounded bg-zinc-100 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
>
  <ResetIcon width={13} height={13} className="shrink-0" aria-hidden />
  Reset layout
</button>
```

(`ResetIcon` is already imported; classes intentionally duplicate the sibling button.)

- [ ] **Step 4: Run the typecheck**

Run: `npm run check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 5: Runtime check (dev server)**

With the dev server running: drag a node, reload (position holds), press **Reset layout**.
Expected: all nodes return to the dagre auto-layout, the canvas refits to view, and a further reload keeps the dagre positions (storage was cleared). Pressing Reset layout with nothing saved is a safe no-op.

- [ ] **Step 6: Commit**

```bash
git add src/components/react/SkillTree.tsx
git commit -m "feat(home): add reset layout button"
```

---

### Task 4: Final verification pass

**Files:** none (verification only — if it surfaces a defect, fix it in the owning task's files and commit there, not here).

- [ ] **Step 1: Fresh typecheck**

Run: `npm run check`
Expected: 0 errors, 0 warnings. If not, stop: fix in Task 1–3 files, re-verify, and commit the fix before continuing.

- [ ] **Step 2: Full manual cycle at desktop width**

Drag two nodes → reload (both hold) → toggle a category filter off and on (custom positions survive) → mark a skill complete/in-progress (positions survive) → press Reset layout (dagre returns, view refits) → reload (dagre holds).
Expected: every step behaves as described.

- [ ] **Step 3: Mobile-width spot check**

Repeat drag → reload → reset at ~390px width.
Expected: same behavior; Reset layout and Reset progress buttons both reachable and visually distinct.

- [ ] **Step 4: Confirm clean diff**

Run: `git status --short && git diff --stat`
Expected: only `src/lib/skillLayout.ts` (new) and `src/components/react/SkillTree.tsx` modified; no other files touched.
