# Infrastructure Components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add DNS, WAF, Rate Limiter, Auth Service, and Search Index as full-citizen node kinds in the design simulator, and relabel Queue/Storage.

**Architecture:** Extend the kind union in `types.ts`, then follow the existing kind-generic machinery outward: latency/notes in `engine.ts`, sink routing in `player.ts`, availability in `presets.ts` + one failure button in `SimulationStage.tsx`. No new dependencies, no new presets, no engine semantics changes.

**Tech Stack:** TypeScript, Astro, React, `@xyflow/react`; verification via `npm run check`, `npm run build`, and headless esbuild-bundle smoke scripts (the repo has no test runner — follow that precedent).

## Global Constraints

- No new dependencies.
- Guided presets, SLOs, and win conditions stay untouched.
- No 429 load-shedding simulation for the rate limiter — over-limit note only.
- No changes to git/pipeline simulations or homepage graph.
- This repo has no test framework: "failing test" steps below are headless node smoke scripts bundled with esbuild into `G:/Temp/opencode/` (approved temp dir) and deleted after each task.

---

## File Structure

- Modify: `src/lib/design/types.ts` — kind union, labels, sink list. Single source of truth every other file keys off.
- Modify: `src/lib/design/engine.ts` — base latencies, load sensitivity, explainer notes. Pure functions only.
- Modify: `src/lib/design/player.ts` — sink routing via shared `SINK_KINDS`, load sensitivity mirror. Live-run behavior only.
- Modify: `src/lib/design/presets.ts` — `FULL` palette only. Availability.
- Modify: `src/components/react/SimulationStage.tsx` — one `Kill auth` button. Availability.

Each file has one responsibility; tasks run in order because engine/player/presets consume the kind union from Task 1.

---

### Task 1: New kinds, labels, sinks in `types.ts`

**Files:**
- Modify: `src/lib/design/types.ts:1-29`
- Test: `G:/Temp/opencode/check-kinds.cjs` (temp, deleted after)

**Interfaces:**
- Consumes: nothing (foundation task).
- Produces: `DesignKind` including `'dns' | 'waf' | 'ratelimit' | 'auth' | 'search'`; `DESIGN_KIND_LABELS` entries DNS / WAF / Rate Limiter / Auth Service / Search Index / Message Queue / Object Storage; `SINK_KINDS` = `['sql', 'nosql', 'storage', 'search']`. Tasks 2–4 consume these exact names.

- [ ] **Step 1: Write the failing smoke script**

```js
// G:/Temp/opencode/check-kinds.cjs
const { DESIGN_KINDS, DESIGN_KIND_LABELS, SINK_KINDS } = require('G:/Temp/opencode/types.cjs');
const assert = require('node:assert');
for (const k of ['dns', 'waf', 'ratelimit', 'auth', 'search']) assert(DESIGN_KINDS.includes(k), 'missing kind ' + k);
assert.equal(DESIGN_KIND_LABELS.dns, 'DNS');
assert.equal(DESIGN_KIND_LABELS.waf, 'WAF');
assert.equal(DESIGN_KIND_LABELS.ratelimit, 'Rate Limiter');
assert.equal(DESIGN_KIND_LABELS.auth, 'Auth Service');
assert.equal(DESIGN_KIND_LABELS.search, 'Search Index');
assert.equal(DESIGN_KIND_LABELS.queue, 'Message Queue');
assert.equal(DESIGN_KIND_LABELS.storage, 'Object Storage');
assert(SINK_KINDS.includes('search'), 'search must be a sink');
console.log('kinds OK');
```

- [ ] **Step 2: Bundle and run to verify it fails**

```bash
npx esbuild src/lib/design/types.ts --bundle --platform=node --format=cjs --outfile="G:/Temp/opencode/types.cjs" --log-level=error && node "G:/Temp/opencode/check-kinds.cjs"
```

Expected: FAIL with "missing kind dns".

- [ ] **Step 3: Write minimal implementation**

```ts
export const DESIGN_KINDS = [
  'client',
  'dns',
  'cdn',
  'waf',
  'lb',
  'gateway',
  'ratelimit',
  'auth',
  'app',
  'cache',
  'search',
  'sql',
  'nosql',
  'queue',
  'storage',
] as const;
```

```ts
export const DESIGN_KIND_LABELS: Record<DesignKind, string> = {
  client: 'Client',
  dns: 'DNS',
  cdn: 'CDN',
  waf: 'WAF',
  lb: 'Load Balancer',
  gateway: 'API Gateway',
  ratelimit: 'Rate Limiter',
  auth: 'Auth Service',
  app: 'App Server',
  cache: 'Cache',
  search: 'Search Index',
  sql: 'SQL DB',
  nosql: 'NoSQL DB',
  queue: 'Message Queue',
  storage: 'Object Storage',
};
```

```ts
export const SINK_KINDS: DesignKind[] = ['sql', 'nosql', 'storage', 'search'];
```

- [ ] **Step 4: Re-run to verify it passes**

```bash
npx esbuild src/lib/design/types.ts --bundle --platform=node --format=cjs --outfile="G:/Temp/opencode/types.cjs" --log-level=error && node "G:/Temp/opencode/check-kinds.cjs"
```

Expected: prints "kinds OK".

- [ ] **Step 5: Clean up and commit**

```bash
rm "G:/Temp/opencode/types.cjs" "G:/Temp/opencode/check-kinds.cjs"
git add src/lib/design/types.ts
git commit -m "feat(design): add dns/waf/ratelimit/auth/search kinds"
```

---

### Task 2: Latency, load sensitivity, notes in `engine.ts`

**Files:**
- Modify: `src/lib/design/engine.ts:11-22` (`BASE_LATENCY_MS`), `src/lib/design/engine.ts:25` (`LOAD_SENSITIVE`), `src/lib/design/engine.ts` `simulateTraffic` notes block (after the `hasCache && readRatio < 0.5` note).
- Test: `G:/Temp/opencode/check-engine.cjs` (temp, deleted after)

**Interfaces:**
- Consumes: `DesignKind`, `BASE_LATENCY_MS` shape from Task 1.
- Produces: finite p99 + explainer notes for topologies containing the new kinds. Task 3 consumes the latency table indirectly via `serviceTime`.

- [ ] **Step 1: Write the failing smoke script**

```js
// G:/Temp/opencode/check-engine.cjs
const { simulateTraffic } = require('G:/Temp/opencode/engine.cjs');
const assert = require('node:assert');
const ids = ['c', 'dns', 'waf', 'rl', 'gw', 'au', 'app', 'ca', 'se'];
const kinds = ['client', 'dns', 'waf', 'ratelimit', 'gateway', 'auth', 'app', 'cache', 'search'];
const nodes = ids.map((id, i) => ({ id, kind: kinds[i], label: kinds[i] }));
const edges = ids.slice(1).map((id, i) => ({ id: 'e' + i, from: ids[i], to: id }));
const base = { nodes, edges, scenario: { qps: 300, readRatio: 0.8, failedKind: null } };
const r = simulateTraffic(base);
assert(r.passed, 'topology should validate: ' + JSON.stringify(r.notes));
assert(Number.isFinite(r.p99Ms) && r.p99Ms > 0, 'p99 must be finite, got ' + r.p99Ms);
for (const w of ['WAF', 'Auth', 'Search', 'DNS']) assert(r.notes.some((n) => n.includes(w)), 'missing note for ' + w);
const hot = simulateTraffic({ ...base, scenario: { qps: 6000, readRatio: 0.8, failedKind: null } });
assert(hot.notes.some((n) => n.includes('429')), 'missing over-limit note at qps 6000');
console.log('engine OK, p99=' + r.p99Ms);
```

- [ ] **Step 2: Bundle and run to verify it fails**

```bash
npx esbuild src/lib/design/engine.ts --bundle --platform=node --format=cjs --outfile="G:/Temp/opencode/engine.cjs" --log-level=error && node "G:/Temp/opencode/check-engine.cjs"
```

Expected: FAIL — `BASE_LATENCY_MS` has no entries for the new kinds, so contributions are `NaN` and p99 is `NaN`.

- [ ] **Step 3: Write minimal implementation**

In `BASE_LATENCY_MS`, add after the matching entries:

```ts
export const BASE_LATENCY_MS: Record<DesignKind, number> = {
  client: 5,
  dns: 2,
  cdn: 10,
  waf: 3,
  lb: 2,
  gateway: 4,
  ratelimit: 2,
  auth: 10,
  app: 20,
  cache: 3,
  search: 12,
  sql: 25,
  nosql: 12,
  queue: 0,
  storage: 30,
};
```

```ts
const LOAD_SENSITIVE: DesignKind[] = ['app', 'auth', 'search', 'sql', 'nosql', 'storage'];
```

In `simulateTraffic`, after the `if (hasCache && readRatio < 0.5) { ... }` block:

```ts
if (kinds.includes('dns')) {
  notes.push('DNS resolves the edge address first (~2ms, usually cached).');
}
if (kinds.includes('waf')) {
  notes.push('WAF filters malicious traffic at the edge (~3ms).');
}
if (kinds.includes('auth')) {
  notes.push('Auth service validates tokens on the request path (~10ms).');
}
if (kinds.includes('search')) {
  notes.push('Search index serves full-text reads (~12ms).');
}
if (kinds.includes('ratelimit') && qps >= 5000) {
  notes.push('Traffic exceeds typical quota — expect 429s without more capacity.');
}
```

- [ ] **Step 4: Re-run to verify it passes**

```bash
npx esbuild src/lib/design/engine.ts --bundle --platform=node --format=cjs --outfile="G:/Temp/opencode/engine.cjs" --log-level=error && node "G:/Temp/opencode/check-engine.cjs"
```

Expected: prints "engine OK" with a finite p99.

- [ ] **Step 5: Clean up and commit**

```bash
rm "G:/Temp/opencode/engine.cjs" "G:/Temp/opencode/check-engine.cjs"
git add src/lib/design/engine.ts
git commit -m "feat(design): model latency and notes for new infra kinds"
```

---

### Task 3: Sink routing and load mirror in `player.ts`

**Files:**
- Modify: `src/lib/design/player.ts:2` (import), `src/lib/design/player.ts:94` (`LOAD_SENSITIVE`), `src/lib/design/player.ts:183` (`sinkIds`), `src/lib/design/player.ts:206` (`pickPath` sink check).
- Test: `G:/Temp/opencode/check-player.cjs` (temp, deleted after)

**Interfaces:**
- Consumes: `SINK_KINDS` (Task 1), latency table (Task 2, via `serviceTime` — no signature change).
- Produces: live runs that complete through a `search` sink and degrade on `auth` failure. Task 4 consumes nothing from this task.

- [ ] **Step 1: Write the failing smoke script**

```js
// G:/Temp/opencode/check-player.cjs
const { createRun } = require('G:/Temp/opencode/player.cjs');
const assert = require('node:assert');
const topo = {
  nodes: [
    { id: 'c', kind: 'client' },
    { id: 'dns', kind: 'dns' },
    { id: 'app', kind: 'app' },
    { id: 'se', kind: 'search' },
  ],
  edges: [
    { from: 'c', to: 'dns' },
    { from: 'dns', to: 'app' },
    { from: 'app', to: 'se' },
  ],
};
const h = createRun(topo, { qps: 300, readRatio: 0.2, seed: 7 });
for (let i = 0; i < 100; i++) h.tick(0.05);
const s = h.summarize();
assert(s.completed > 0, 'requests must complete through search sink, completed=' + s.completed);
const seen = new Set();
for (let i = 0; i < 100; i++) {
  h.tick(0.05);
  for (const p of h.snapshot().inFlight) seen.add(p.edgeKey);
}
// NOTE: assert on app→se, not c→dns — 2ms dns hops drain within one substep
// and never appear in instantaneous snapshots (verified behavior).
assert(seen.has('app→se'), 'app→search edge must carry traffic, saw ' + JSON.stringify([...seen]));
const topoAuth = {
  nodes: [{ id: 'c', kind: 'client' }, { id: 'au', kind: 'auth' }, { id: 'db', kind: 'sql' }],
  edges: [{ from: 'c', to: 'au' }, { from: 'au', to: 'db' }],
};
const h3 = createRun(topoAuth, { qps: 300, readRatio: 0.2, seed: 7, failedKinds: ['auth'] });
const evs = h3.tick(0.5);
assert(evs.some((e) => e.text.includes('degraded')), 'auth failure must degrade, got ' + JSON.stringify(evs.map((e) => e.text)));
console.log('player OK');
```

- [ ] **Step 2: Bundle and run to verify it fails**

```bash
npx esbuild src/lib/design/player.ts --bundle --platform=node --format=cjs --outfile="G:/Temp/opencode/player.cjs" --log-level=error && node "G:/Temp/opencode/check-player.cjs"
```

Expected: FAIL with `completed=0` — `pickPath`/`canReachSink` don't recognize `search` as a sink, so requests dead-end before it.

- [ ] **Step 3: Write minimal implementation**

Import (line 2):

```ts
import { DESIGN_KIND_LABELS, SINK_KINDS, type DesignKind } from './types';
```

Line 94:

```ts
const LOAD_SENSITIVE: DesignKind[] = ['app', 'auth', 'search', 'sql', 'nosql', 'storage'];
```

Line 183:

```ts
const sinkIds = topo.nodes.filter((n) => SINK_KINDS.includes(n.kind)).map((n) => n.id);
```

Line 206:

```ts
if (SINK_KINDS.includes(kindOf.get(cur)!)) return path;
```

- [ ] **Step 4: Re-run to verify it passes**

```bash
npx esbuild src/lib/design/player.ts --bundle --platform=node --format=cjs --outfile="G:/Temp/opencode/player.cjs" --log-level=error && node "G:/Temp/opencode/check-player.cjs"
```

Expected: prints "player OK".

- [ ] **Step 5: Clean up and commit**

```bash
rm "G:/Temp/opencode/player.cjs" "G:/Temp/opencode/check-player.cjs"
git add src/lib/design/player.ts
git commit -m "feat(design): route and degrade new infra kinds in player"
```

---

### Task 4: Palette availability and Kill-auth button

**Files:**
- Modify: `src/lib/design/presets.ts:19` (`FULL` palette)
- Modify: `src/components/react/SimulationStage.tsx:698` (after the Kill SQL button)
- Test: `G:/Temp/opencode/check-presets.cjs` (temp, deleted after) + `npm run check`

**Interfaces:**
- Consumes: kind names from Task 1 (`DESIGN_KIND_LABELS` renders palette buttons automatically; `fireManual('fail', kind)` accepts any `DesignKind`).
- Produces: new kinds placeable in Free canvas + Interview-framework; auth failure injectable from the toolbar. Nothing downstream.

- [ ] **Step 1: Write the failing smoke script**

```js
// G:/Temp/opencode/check-presets.cjs
const { DESIGN_PRESETS } = require('G:/Temp/opencode/presets.cjs');
const assert = require('node:assert');
for (const id of ['free', 'interview-framework']) {
  const p = DESIGN_PRESETS[id].palette;
  for (const k of ['dns', 'waf', 'ratelimit', 'auth', 'search']) assert(p.includes(k), id + ' palette missing ' + k);
}
const fund = DESIGN_PRESETS['system-design-fundamentals'].palette;
assert.deepStrictEqual(fund, ['client', 'lb', 'app', 'sql', 'nosql'], 'guided palettes must stay untouched');
console.log('presets OK');
```

- [ ] **Step 2: Bundle and run to verify it fails**

```bash
npx esbuild src/lib/design/presets.ts --bundle --platform=node --format=cjs --outfile="G:/Temp/opencode/presets.cjs" --log-level=error && node "G:/Temp/opencode/check-presets.cjs"
```

Expected: FAIL with "palette missing dns".

- [ ] **Step 3: Write minimal implementation**

In `presets.ts` line 19:

```ts
const FULL: DesignKind[] = ['client', 'dns', 'cdn', 'waf', 'lb', 'gateway', 'ratelimit', 'auth', 'app', 'cache', 'search', 'sql', 'nosql', 'queue', 'storage'];
```

In `SimulationStage.tsx` line 698, insert after the Kill SQL button (mirror it exactly, swapping kind and label):

```tsx
<button onClick={() => fireManual('fail', 'auth')} className="inline-flex items-center gap-1 rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:border-red-500/60 hover:text-red-500 dark:border-zinc-700 dark:text-zinc-300"><CrossCircledIcon width={13} height={13} className="shrink-0" aria-hidden />Kill auth</button>
```

- [ ] **Step 4: Run checks to verify**

```bash
npx esbuild src/lib/design/presets.ts --bundle --platform=node --format=cjs --outfile="G:/Temp/opencode/presets.cjs" --log-level=error && node "G:/Temp/opencode/check-presets.cjs"
```

Expected: prints "presets OK".

```bash
npm run check 2>&1 | tail -n 5
```

Expected: 0 errors. Also grep the button into place:

```bash
rg -n "Kill auth" src/components/react/SimulationStage.tsx
```

Expected: exactly one match.

- [ ] **Step 5: Clean up, full build, and commit**

```bash
rm "G:/Temp/opencode/presets.cjs" "G:/Temp/opencode/check-presets.cjs"
npm run build 2>&1 | tail -n 5
git add src/lib/design/presets.ts src/components/react/SimulationStage.tsx
git commit -m "feat(design): expose new infra kinds in palettes and failure buttons"
```

Expected: build succeeds with no errors.

---

## Self-Review

**1. Spec coverage:** New kinds + labels + search-as-sink → Task 1. Latencies (dns 2, waf 3, ratelimit 2, auth 10, search 12), load sensitivity (auth, search), explainer notes incl. 429 note at qps ≥ 5000 → Task 2. Shared `SINK_KINDS` in player, load mirror, Kill-auth button → Tasks 3–4. FULL palette only, guided presets untouched (asserted) → Task 4. Relabels queue/storage → Task 1. Tracing/mesh exclusion → no task needed (explicit non-goal, listed in plan Out of scope below). Verification (check + build + smoke + manual spot-check) → Task 4 steps + manual checklist below. No gaps.

**2. Placeholder scan:** All code blocks are exact (line numbers verified by grep/read this session: engine BASE map shape, LOAD_SENSITIVE lines, player lines 2/94/183/206, presets FULL line 19, Kill SQL button line 698). No TBD/TODO. Commands use the repo's real scripts (`npm run check`, `npm run build`) and the esbuild pattern already proven in this repo session.

**3. Type consistency:** `DesignKind` union → `Record<DesignKind, ...>` labels (all 15 keys present in Task 1 snippet) → `BASE_LATENCY_MS: Record<DesignKind, ...>` (all 15 keys present) → `SINK_KINDS: DesignKind[]` consumed by `SINK_KINDS.includes(n.kind)` / `includes(kindOf.get(cur)!)` (both `DesignKind`) → `fireManual('fail', 'auth')` matches `SimTrigger { type: 'fail'; kind: DesignKind }`. Consistent.

## Manual spot-check (after Task 4, before pushing)

- Free canvas: add DNS → WAF → Rate Limiter → Gateway → Auth → App → Search, connect, Play — all edges animate in both directions (toggle to verify).
- Kill auth — nodes grey out, log shows degraded reroutes.
- Dark mode + stacked mobile layout on the canvas.
- Push only after all green.

## Out of scope (from spec)

- Tracing/mesh nodes, new guided presets, SLO changes, 429 shedding semantics, git/pipeline/homepage changes, new dependencies.
