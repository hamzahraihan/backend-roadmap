# DAG Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the homepage skill graph readable and navigable: combed layout, category colors, click-to-select focus, filters, search, progress chip.

**Architecture:** Extract pure graph helpers (`categoryColor`, `buildNeighborhood`) into `src/lib/skillGraph.ts` for isolation and node-testability; convert `SkillTree.tsx` edge/node rendering to controlled ReactFlow state (`useNodesState`/`useEdgesState`) so selection, filters, and search drive opacity and highlight through effects. No dependency changes, no new packages.

**Tech Stack:** React, `@xyflow/react` (v12: `useNodesState`, `useEdgesState`, `setCenter`, `flowToScreenPosition`), `@dagrejs/dagre`, Tailwind v4, existing `ProgressProvider`/`useTheme`.

## Global Constraints

- No `dependsOn` edits, no content-file edits, no new npm dependencies, no changes to sims/theme/progress store.
- `npm run check` must report 0 errors after each task; `npm run build` must pass from Task 2 onward.
- Status keeps the node `border-2` ring channel; category uses only the dot channel (spec §2).
- Non-matching / non-neighborhood nodes dim to opacity `0.15` — never `hidden`, so layout never jumps.
- One commit per task; push only when the user asks.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/skillGraph.ts` (create) | Pure helpers: `CATEGORY_COLORS`, `categoryColor()`, `buildNeighborhood()` |
| `src/lib/skillGraph.check.ts` (create, temporary) | Red-green behavioral assertions, deleted after green |
| `src/components/react/SkillTree.tsx` (modify) | All UI: layout config, edges, dots, legend, select/focus/popover, chips, search, progress |

**Interfaces (locked):**
- `categoryColor(category: string): string` — exact palette hex, or deterministic hash fallback into the palette.
- `buildNeighborhood(skills: SkillSummary[], id: string): Set<string>` — `id` plus all transitive ancestors (via `dependsOn`) plus all transitive descendants.
- `SkillSummary` shape (from `src/lib/skills.ts`): `{ id, title, category, order, dependsOn: string[], position? }`.

---

### Task 1: Graph helpers library (`src/lib/skillGraph.ts`)

**Files:**
- Create: `src/lib/skillGraph.ts`
- Create then delete: `src/lib/skillGraph.check.ts`
- Modify: none
- Test: esbuild-bundled node assertions (red-green below) + `npm run check`

**Interfaces:**
- Consumes: `SkillSummary` type from `src/lib/skills.ts`.
- Produces: `CATEGORY_COLORS`, `categoryColor`, `buildNeighborhood` for Tasks 2–4.

- [ ] **Step 1: Write the failing check `src/lib/skillGraph.check.ts`**

```ts
import { buildNeighborhood, categoryColor } from './skillGraph';
import type { SkillSummary } from './skills';

const fail = (msg: string): never => {
  throw new Error(`CHECK FAIL: ${msg}`);
};

if (categoryColor('Tooling') !== '#64748b') fail('Tooling color mismatch');
if (categoryColor('System Design') !== '#6366f1') fail('System Design color mismatch');
const fb = categoryColor('Some Future Category');
if (!/^#[0-9a-f]{6}$/.test(fb)) fail('fallback must be a hex color, got ' + fb);

const mini = [
  { id: 'a', dependsOn: [] },
  { id: 'b', dependsOn: ['a'] },
  { id: 'c', dependsOn: ['a'] },
  { id: 'd', dependsOn: ['b', 'c'] },
  { id: 'zzz', dependsOn: [] },
] as SkillSummary[];
const hood = buildNeighborhood(mini, 'b');
for (const id of ['a', 'b', 'd']) if (!hood.has(id)) fail(`neighborhood of b missing ${id}`);
if (hood.has('c')) fail('sibling c must not be in b neighborhood');
if (hood.has('zzz')) fail('unrelated zzz must not be in b neighborhood');

console.log('SKILLGRAPH PASS: colors, fallback, neighborhood all green');
```

- [ ] **Step 2: Run check to verify it fails**

```bash
node_modules/.bin/esbuild src/lib/skillGraph.check.ts --bundle --platform=node --format=esm --outfile=node_modules/.cache/skillgraph-check.mjs --log-level=error && node node_modules/.cache/skillgraph-check.mjs
```

Expected: FAIL with `Could not resolve "./skillGraph"` (module does not exist yet).

- [ ] **Step 3: Write minimal `src/lib/skillGraph.ts`**

```ts
import type { SkillSummary } from './skills';

export const CATEGORY_COLORS: Record<string, string> = {
  Foundations: '#8b5cf6',
  'Web Basics': '#06b6d4',
  Languages: '#eab308',
  APIs: '#3b82f6',
  Databases: '#f97316',
  Security: '#ef4444',
  Infrastructure: '#14b8a8',
  Architecture: '#d946ef',
  Scaling: '#84cc16',
  Quality: '#ec4899',
  Tooling: '#64748b',
  'System Design': '#6366f1',
};

const FALLBACKS = Object.values(CATEGORY_COLORS);

export function categoryColor(category: string): string {
  const exact = CATEGORY_COLORS[category];
  if (exact) return exact;
  let h = 0;
  for (let i = 0; i < category.length; i++) h = (h * 31 + category.charCodeAt(i)) >>> 0;
  return FALLBACKS[h % FALLBACKS.length];
}

export function buildNeighborhood(skills: SkillSummary[], id: string): Set<string> {
  const byId = new Map(skills.map((s) => [s.id, s]));
  const children = new Map<string, string[]>();
  for (const s of skills) {
    for (const dep of s.dependsOn) {
      const list = children.get(dep) ?? [];
      list.push(s.id);
      children.set(dep, list);
    }
  }
  const seen = new Set<string>([id]);
  const up = [id];
  while (up.length) {
    const cur = up.pop()!;
    for (const dep of byId.get(cur)?.dependsOn ?? []) {
      if (!seen.has(dep)) {
        seen.add(dep);
        up.push(dep);
      }
    }
  }
  const down = [id];
  while (down.length) {
    const cur = down.pop()!;
    for (const child of children.get(cur) ?? []) {
      if (!seen.has(child)) {
        seen.add(child);
        down.push(child);
      }
    }
  }
  return seen;
}
```

- [ ] **Step 4: Run check to verify it passes**

```bash
node_modules/.bin/esbuild src/lib/skillGraph.check.ts --bundle --platform=node --format=esm --outfile=node_modules/.cache/skillgraph-check.mjs --log-level=error && node node_modules/.cache/skillgraph-check.mjs && npm run check 2>&1 | tail -n 5
```

Expected: `SKILLGRAPH PASS: colors, fallback, neighborhood all green` and `0 errors`.

- [ ] **Step 5: Delete check files and commit**

```bash
rm src/lib/skillGraph.check.ts node_modules/.cache/skillgraph-check.mjs
git add src/lib/skillGraph.ts
git commit -m "feat(graph): add category colors and neighborhood helpers"
```

---

### Task 2: Layout tuning + color system in `SkillTree.tsx`

**Files:**
- Modify: `src/components/react/SkillTree.tsx`
- Test: `npm run check` + `npm run build` + curl markers below

**Interfaces:**
- Consumes: `categoryColor`, `CATEGORY_COLORS` from Task 1.
- Produces: combed layout + dots + category legend consumed visually by Tasks 3–4 (no code interface).

- [ ] **Step 1: Tune dagre config (`SkillTree.tsx:87`)**

Old:

```tsx
g.setGraph({ rankdir: 'TB', nodesep: 80, ranksep: 120 });
```

New:

```tsx
g.setGraph({ rankdir: 'TB', nodesep: 110, ranksep: 150, edgesep: 30, marginx: 40, marginy: 40 });
```

- [ ] **Step 2: Slim smoothstep edges (`SkillTree.tsx:107-116`)**

Old `edgeList.push` body:

```tsx
edgeList.push({
  id: `${dep}-${s.id}`,
  source: dep,
  target: s.id,
  markerEnd: { type: MarkerType.ArrowClosed },
  style: { stroke: '#71717a', strokeWidth: 3 },
});
```

New:

```tsx
edgeList.push({
  id: `${dep}-${s.id}`,
  source: dep,
  target: s.id,
  type: 'smoothstep',
  markerEnd: { type: MarkerType.ArrowClosed, color: '#a1a1aa' },
  style: { stroke: '#a1a1aa', strokeWidth: 1.5 },
});
```

- [ ] **Step 3: Category dot on nodes (`SkillTree.tsx:39-67`)**

Add import at top:

```tsx
import { categoryColor } from '../../lib/skillGraph';
```

Inside `SkillNode`, after the opening `<div>` and before the target `Handle`, insert:

```tsx
<span
  className="absolute left-2 top-2 h-2.5 w-2.5 rounded-full"
  style={{ backgroundColor: categoryColor(skill.category) }}
  title={skill.category}
/>
```

And give the title room — change the title div to:

```tsx
<div className="truncate pl-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{skill.title}</div>
```

- [ ] **Step 4: Category section in legend (`SkillTree.tsx:178-190`)**

After the status-swatches `<div className="flex flex-wrap ...">...</div>` and before the Reset button, insert:

```tsx
<details className="rounded bg-white/80 p-2 dark:bg-zinc-900/80">
  <summary className="cursor-pointer text-[11px] text-zinc-500 dark:text-zinc-400">Categories</summary>
  <div className="mt-1.5 grid max-h-48 grid-cols-2 gap-1 overflow-y-auto">
    {Object.entries(CATEGORY_COLORS).map(([cat, hex]) => (
      <span key={cat} className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: hex }} />
        {cat}
      </span>
    ))}
  </div>
</details>
```

With import:

```tsx
import { CATEGORY_COLORS, categoryColor } from '../../lib/skillGraph';
```

(single import line covers Step 3 — write `import { CATEGORY_COLORS, categoryColor } from '../../lib/skillGraph';` once.)

- [ ] **Step 5: Run verifications**

```bash
npm run check 2>&1 | tail -n 5
```

Expected: `0 errors`.

```bash
npm run build 2>&1 | tail -n 3
```

Expected: `Complete!`.

```bash
npx astro dev --background --port 4323 2>&1 | tail -n 2; sleep 10; curl -s http://localhost:4323/ | grep -c '#8b5cf6'; curl -s http://localhost:4323/ | grep -c 'Categories'; npx astro dev stop 2>&1 | tail -n 1
```

Expected: two counts ≥ 1 (dot color + legend present in SSR HTML), server stopped. Note: if port 4323 is taken, substitute a free port.

- [ ] **Step 6: Commit**

```bash
git add src/components/react/SkillTree.tsx
git commit -m "feat(graph): comb layout, slim edges, category dots and legend"
```

---

### Task 3: Click-to-select focus + popover

**Files:**
- Modify: `src/components/react/SkillTree.tsx`
- Test: `npm run check` + `npm run build` + dev-server interaction pass (Task 5 does the full pass; here: build green + spot-check no console errors on `/`)

**Interfaces:**
- Consumes: `buildNeighborhood` from Task 1; `colorById` map built in this task, reused by Task 4's filter effect (same file, so no cross-task signature — both effects live in `SkillTreeContent`).
- Produces: `selectedId` state + neighborhood dimming pattern that Task 4 extends with filter dimming.

- [ ] **Step 1: Controlled flow state (replace `defaultNodes`/`defaultEdges`)**

Add to the `@xyflow/react` import: `useNodesState, useEdgesState`.

In `SkillTreeContent`, after the `useMemo` that returns `{ nodes: nodeList, edges: edgeList }`, rename its outputs by changing:

```tsx
const { nodes, edges } = useMemo(() => {
```

to:

```tsx
const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
```

then insert after the memo:

```tsx
const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

// Re-sync when underlying skill data or progress changes.
useEffect(() => {
  setNodes(initialNodes);
  setEdges(initialEdges);
}, [initialNodes, initialEdges, setNodes, setEdges]);
```

Add `useEffect` to the React import by extending line 1 to `import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';` (`useState` is used in Step 2).

Replace the `<ReactFlow>` props `defaultNodes={nodes}` → `nodes={nodes} onNodesChange={onNodesChange}` and `defaultEdges={edges}` → `edges={edges} onEdgesChange={onEdgesChange}`.

Replace `const { setEdges } = useReactFlow();` (line 78) with:

```tsx
const { setCenter, flowToScreenPosition, getNode } = useReactFlow();
```

(`setCenter` is used in Task 4; destructure it here to avoid a second edit. The hover handlers keep working: change their `setEdges` source — they already call `setEdges` from scope, which now resolves to the `useEdgesState` setter. No body changes needed.)

- [ ] **Step 2: Selection state + neighborhood dimming effect** (`useState` already imported in Step 1)

Insert after the re-sync effect:

```tsx
const [selectedId, setSelectedId] = useState<string | null>(null);

const colorById = useMemo(
  () => new Map(skills.map((s) => [s.id, categoryColor(s.category)])),
  [skills],
);

const neighborhood = useMemo(
  () => (selectedId ? buildNeighborhood(skills, selectedId) : null),
  [skills, selectedId],
);

// Dim everything outside the selected neighborhood; light the neighborhood.
useEffect(() => {
  setNodes((ns) =>
    ns.map((n) => ({
      ...n,
      style: { opacity: !neighborhood || neighborhood.has(n.id) ? 1 : 0.15 },
    })),
  );
  setEdges((es) =>
    es.map((e) => {
      const lit = !neighborhood || (neighborhood.has(e.source) && neighborhood.has(e.target));
      const col = colorById.get(e.target) ?? '#a1a1aa';
      return {
        ...e,
        style: { stroke: lit ? col : '#3f3f46', strokeWidth: lit ? 2.5 : 1, opacity: lit ? 1 : 0.25 },
        markerEnd: { type: MarkerType.ArrowClosed, color: lit ? col : '#3f3f46' },
      };
    }),
  );
}, [neighborhood, colorById, setNodes, setEdges]);
```

Add `useState` to the React import if missing (line 1 currently imports `useCallback, useMemo, type MouseEvent` — extend to `useCallback, useEffect, useMemo, useState, type MouseEvent`; `useEffect` added in Step 1).

- [ ] **Step 3: Click / double-click / pane-click behavior**

Replace `onNodeClick` (lines 122-124):

```tsx
const onNodeClick = useCallback((_: MouseEvent, node: Node) => {
  setSelectedId(node.id);
}, []);

const onNodeDoubleClick = useCallback((_: MouseEvent, node: Node) => {
  window.location.href = `/skill/${node.id}`;
}, []);

const onPaneClick = useCallback(() => {
  setSelectedId(null);
}, []);
```

Wire into `<ReactFlow>`: add `onNodeDoubleClick={onNodeDoubleClick}` and `onPaneClick={onPaneClick}` props.

- [ ] **Step 4: Selection popover anchored near the node**

Insert before the closing of the outer `<div className="h-full w-full">` (after `</ReactFlow>`, before the legend overlay div):

```tsx
{selectedId &&
  (() => {
    const node = getNode(selectedId);
    const skill = skills.find((s) => s.id === selectedId);
    if (!node || !skill) return null;
    const anchor = flowToScreenPosition({
      x: node.position.x + NODE_WIDTH / 2,
      y: node.position.y,
    });
    return (
      <div
        className="absolute z-20 w-64 -translate-x-1/2 -translate-y-full rounded-lg border border-zinc-200 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        style={{ left: anchor.x, top: anchor.y - 12 }}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{skill.title}</div>
            <div className="mt-0.5 text-xs text-zinc-500">{skill.category}</div>
          </div>
          <button
            onClick={() => setSelectedId(null)}
            aria-label="Close"
            className="rounded px-1.5 py-0.5 text-xs text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>
        <a
          href={`/skill/${skill.id}`}
          className="mt-2 inline-flex items-center gap-1 rounded bg-sky-600 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-500"
        >
          Open →
        </a>
      </div>
    );
  })()}
```

Reposition on pan/zoom — add to `<ReactFlow>` props:

```tsx
onMoveStart={() => setSelectedId((id) => id)}
```

No — that does nothing. Correct: force re-render on viewport change. Add a tick state:

```tsx
const [, setViewportTick] = useState(0);
```

and prop `onMove={() => setViewportTick((t) => t + 1)}`. (Re-render recomputes `flowToScreenPosition`; 40 nodes re-render cheaply and popover tracks the node.)

- [ ] **Step 5: Run verifications**

```bash
npm run check 2>&1 | tail -n 5
```

Expected: `0 errors`.

```bash
npm run build 2>&1 | tail -n 3
```

Expected: `Complete!`. (Interaction itself is verified in the Task 5 browser pass.)

- [ ] **Step 6: Commit**

```bash
git add src/components/react/SkillTree.tsx
git commit -m "feat(graph): click-to-select neighborhood focus with popover"
```

---

### Task 4: Filter chips + search + progress chip

**Files:**
- Modify: `src/components/react/SkillTree.tsx`
- Test: `npm run check` + `npm run build` + curl markers below

**Interfaces:**
- Consumes: `neighborhood`/`selectedId` state and the dimming effect from Task 3 (extended, not replaced).
- Produces: nothing downstream (last feature task).

- [ ] **Step 1: Category filter state + combined dimming**

Insert after the `neighborhood` memo:

```tsx
const allCategories = useMemo(() => [...new Set(skills.map((s) => s.category))], [skills]);
const [disabledCats, setDisabledCats] = useState<Set<string>>(new Set());

const toggleCat = useCallback((cat: string) => {
  setDisabledCats((prev) => {
    const next = new Set(prev);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    return next;
  });
}, []);
```

Extend the Task 3 dimming effect: change its node-mapping line to also respect filters. Replace:

```tsx
style: { opacity: !neighborhood || neighborhood.has(n.id) ? 1 : 0.15 },
```

with:

```tsx
style: {
  opacity:
    (!neighborhood || neighborhood.has(n.id)) &&
    !disabledCats.has((n.data as unknown as SkillNodeData).skill.category)
      ? 1
      : 0.15,
},
```

and add `disabledCats` to that effect's dependency array.

- [ ] **Step 2: Filter chips + search + progress overlay UI**

Insert as the first child of the outer `<div className="h-full w-full">` (before `<ReactFlow>`):

```tsx
<div className="pointer-events-none absolute left-4 top-4 z-10 flex max-w-[60%] flex-col gap-2">
  <div className="pointer-events-auto flex flex-wrap gap-1.5 rounded bg-white/80 p-2 dark:bg-zinc-900/80">
    <button
      onClick={() => setDisabledCats(new Set())}
      className="rounded-full border border-zinc-300 px-2.5 py-0.5 text-[11px] text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      All
    </button>
    {allCategories.map((cat) => {
      const off = disabledCats.has(cat);
      return (
        <button
          key={cat}
          onClick={() => toggleCat(cat)}
          aria-pressed={!off}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] transition ${
            off
              ? 'border-zinc-300 text-zinc-400 opacity-60 dark:border-zinc-700 dark:text-zinc-500'
              : 'border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
          }`}
        >
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: categoryColor(cat) }} />
          {cat}
        </button>
      );
    })}
  </div>
  <div className="pointer-events-auto flex items-center gap-2">
    <SkillSearch
      skills={skills}
      onPick={(id) => {
        const node = getNode(id);
        if (node) setCenter(node.position.x + NODE_WIDTH / 2, node.position.y + NODE_HEIGHT / 2, { zoom: 1, duration: 400 });
        setSelectedId(id);
      }}
    />
    <span className="rounded bg-white/80 px-2 py-1 font-mono text-[11px] text-zinc-500 dark:bg-zinc-900/80 dark:text-zinc-400">
      {skills.filter((s) => getStatus(s.id) === 'completed').length} / {skills.length} completed
    </span>
  </div>
</div>
```

(`setCenter` and `getNode` come from the Task 3 `useReactFlow()` destructure — both are part of its return value. `getStatus` is already in scope.)

- [ ] **Step 3: `SkillSearch` component (same file, above `SkillTreeContent`)**

```tsx
function SkillSearch({ skills, onPick }: { skills: SkillSummary[]; onPick: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const matches =
    query.trim().length === 0
      ? []
      : skills.filter((s) => s.title.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6);
  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && matches.length > 0) {
            onPick(matches[0].id);
            setQuery('');
          }
        }}
        placeholder="Search skills…"
        spellCheck={false}
        autoComplete="off"
        className="w-44 rounded border border-zinc-300 bg-white/90 px-2.5 py-1 text-xs text-zinc-800 placeholder-zinc-400 outline-none focus:border-sky-500 dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-100"
      />
      {matches.length > 0 && (
        <div className="absolute left-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
          {matches.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                onPick(m.id);
                setQuery('');
              }}
              className="block w-full px-3 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {m.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run verifications**

```bash
npm run check 2>&1 | tail -n 5
```

Expected: `0 errors`.

```bash
npm run build 2>&1 | tail -n 3
```

Expected: `Complete!`.

```bash
npx astro dev --background --port 4323 2>&1 | tail -n 2; sleep 10; curl -s http://localhost:4323/ | grep -c 'Search skills'; curl -s http://localhost:4323/ | grep -o '[0-9]*<!-- --> / <!-- -->[0-9]*<!-- --> completed'; npx astro dev stop 2>&1 | tail -n 1
```

Expected: search count ≥ 1 and the progress pattern prints (e.g. `0<!-- --> / <!-- -->40<!-- --> completed` — React SSR splits JSX expressions with comment nodes, so match the pattern, not a contiguous string), server stopped. If port 4323 is taken, substitute a free port.

- [ ] **Step 5: Commit**

```bash
git add src/components/react/SkillTree.tsx
git commit -m "feat(graph): category filters, search with zoom, progress chip"
```

---

### Task 5: Final verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full check**

```bash
npm run check 2>&1 | tail -n 5
```

Expected: `0 errors`.

- [ ] **Step 2: Full build**

```bash
npm run build 2>&1 | tail -n 3
```

Expected: `Complete!`.

- [ ] **Step 3: Browser click-through (dev server)**

```bash
npx astro dev --background --port 4323 2>&1 | tail -n 2; sleep 10
```

Then open `http://localhost:4323/` and confirm, in both themes:

1. Graph loads with breathing room; no edge overlaps a node card at default zoom.
2. Category dots + collapsible Categories legend render.
3. Toggle a filter chip → matching dims, layout does not jump; All resets.
4. Search `kuber` → `Kubernetes Basics` offered; Enter zooms and selects.
5. Click a node → neighborhood lights with category-colored edges, rest dims, popover appears; Open (and double-click) navigates to `/skill/{id}`; canvas click clears.
6. Progress chip count matches manual count; Reset progress still works; MiniMap/controls work.

```bash
npx astro dev stop 2>&1 | tail -n 1
```

- [ ] **Step 4: Report** — no commit. Summarize evidence per the verification-before-completion rule.
