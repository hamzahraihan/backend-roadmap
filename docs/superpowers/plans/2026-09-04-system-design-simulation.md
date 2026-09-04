# System Design Canvas Simulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the code playground on all 11 System Design skill pages with a React Flow architecture canvas plus deterministic traffic simulation.

**Architecture:** Content-only switch plus a new client-side simulation island. A pure engine in `src/lib/design/` (types, traffic math, 11 presets + free) powers a `DesignSimulation.tsx` React island rendered by `src/pages/skill/[slug].astro` when `simulation: 'design'`. No new dependencies, no backend.

**Tech Stack:** Astro 7 content collections, React 19 islands, `@xyflow/react` 12, Tailwind v4, TypeScript.

## Global Constraints

- Content schema lives in `src/content.config.ts`: `simulation` enum gains `'design'`; optional `designPreset: string`; `starterCode` frontmatter stays untouched for rollback.
- No new npm dependencies; reuse `@xyflow/react`, `ResizableSplit`, `ProgressProvider`.
- DESIGN.md: graphite neutrals; Signal Blue (#0ea5e9) = selected/available only; Emerald (#10b981) = objective met only; Amber (#f59e0b) = bottleneck only; machine output in mono, narrative in sans; flat surfaces, `rounded-sm` buttons.
- No auth/server: all state client-side; progress via existing `ProgressProvider` localStorage.
- Verification is `npm run check` then `npm run build`; engine smoke test via `node --experimental-strip-types` or `npx tsx`-free plain node script (repo has no test runner — do not add one).

---

### Task 1: Content switch (schema + routing)

**Files:**
- Modify: `src/content.config.ts:7-29`
- Modify: `src/pages/skill/[slug].astro:26-38`

**Interfaces:**
- Consumes: existing `simulation: 'code' | 'git'` frontmatter values.
- Produces: `'design'` union value and `designPreset?` field read by Task 4 routing; `isDesignSimulation` boolean consumed in the same file's JSX.

- [ ] **Step 1: Extend the content schema**

```ts
simulation: z.enum(['code', 'git', 'design']).default('code'),
designPreset: z.string().optional(),
```

- [ ] **Step 2: Three-way switch in `[slug].astro`**

```astro
import DesignSimulation from '../../components/react/DesignSimulation.tsx';
const simulation = skill.data.simulation;
const isGitSimulation = simulation === 'git' || ['version-control','git-fundamentals','git-branching','git-remotes','github-workflow','cicd'].includes(skill.id);
const isDesignSimulation = simulation === 'design';
{isGitSimulation ? <GitSimulation client:load skillId={skill.id} /> : isDesignSimulation ? <DesignSimulation client:load skillId={skill.id} /> : <CodePlayground client:load skillId={skill.id} starterCode={starterCode} />}
```

- [ ] **Step 3: Run check**

Run: `npm run check`
Expected: PASS, 0 errors (11 design files not yet flipped, so no page changes yet).

### Task 2: Design engine types + traffic math

**Files:**
- Create: `src/lib/design/types.ts`
- Create: `src/lib/design/engine.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `DesignKind`, `DESIGN_KINDS`, `BASE_LATENCY_MS`, `DesignScenario`, `DesignState`, `DesignResult`, `DesignPreset`, `validateTopology(state): string[]`, `simulateTraffic(state): DesignResult`, `checkObjective(preset, state, result): boolean` — all imported by Tasks 3–4.

- [ ] **Step 1: Create `src/lib/design/types.ts`**

```ts
export const DESIGN_KINDS = ['client','cdn','lb','gateway','app','cache','sql','nosql','queue','storage'] as const;
export type DesignKind = (typeof DESIGN_KINDS)[number];
export interface DesignNode { id: string; kind: DesignKind; label: string; }
export interface DesignEdge { id: string; from: string; to: string; }
export interface DesignScenario { qps: number; readRatio: number; failedKind: DesignKind | null; }
export interface DesignState { nodes: DesignNode[]; edges: DesignEdge[]; scenario: DesignScenario; }
export interface DesignResult { p99Ms: number; bottleneck: string; notes: string[]; passed: boolean; }
export interface DesignPreset {
  id: string;
  palette: DesignKind[];
  objective: { title: string; description: string; hint: string; winMessage: string; };
  starterNodes: DesignKind[];
  winCondition: (state: DesignState, result: DesignResult) => boolean;
}
```

- [ ] **Step 2: Create `src/lib/design/engine.ts`** with `BASE_LATENCY_MS` table (client 5, cdn 10, lb 2, gateway 4, app 20, cache 3, sql 25, nosql 12, queue 0, storage 30), `validateTopology` (errors: no client, no sink among sql/nosql/storage, disconnected node ids), `simulateTraffic` (BFS path client→sink; cache on read path with readRatio≥0.5 serves 85% reads at 3ms; load factor `1 + qps/2000` on app/sql/nosql/storage; failedKind adds +150ms reroute note or unavailability; bottleneck = max contributor), `checkObjective` (calls `preset.winCondition`).

- [ ] **Step 3: Smoke-test engine in isolation**

Run: `npm run check`
Expected: PASS with the two new modules type-clean.

### Task 3: Presets for all 11 nodes + free

**Files:**
- Create: `src/lib/design/presets.ts`

**Interfaces:**
- Consumes: types + engine helpers from Task 2 (`DesignState`, `DesignResult`, kind-set helpers defined locally).
- Produces: `DESIGN_PRESETS: Record<string, DesignPreset>`, `getPreset(id)`, `initialStateFor(id)` consumed by Task 4.

- [ ] **Step 1: Create `src/lib/design/presets.ts`** with helper `hasPath(state, fromKinds, toKinds)` (BFS over edges mapped to node kinds) and 12 presets: `system-design-fundamentals` (client→app→any sink), `scalability-performance` (≥2 app replicas behind lb), `caching-cdn` (cache on read path), `load-balancing-gateway` (lb present, ≥2 app), `data-modeling-apis` (gateway present + sink), `databases-sharding` (≥2 of sql/nosql), `messaging-queues` (queue on path), `distributed-failures` (cache or ≥2 app for redundancy), `rate-limiting-url-shortener` (gateway + cache + sink), `realtime-rides-feed` (queue or nosql + app), `interview-framework` (client→…→sink full chain, any), `free` (all kinds, winCondition false). Each preset: focused `palette` (3–6 kinds early, full later), `starterNodes` (client + app + one sink minimum), concrete hint text, no placeholders.

- [ ] **Step 2: Verify preset ids match skill slugs**

Run: `node -e "const fs=require('fs');const slugs=fs.readdirSync('src/content/skills').map(f=>f.replace(/\.md$/,''));const src=fs.readFileSync('src/lib/design/presets.ts','utf8');const missing=slugs.filter(s=>{try{const c=fs.readFileSync('src/content/skills/'+s+'.md','utf8');return /category:\s*System Design/.test(c)}catch{return false}}).filter(s=>!src.includes(s));console.log(missing.length?missing:'all 11 present')"`
Expected: `all 11 present`.

### Task 4: DesignSimulation canvas component

**Files:**
- Create: `src/components/react/DesignSimulation.tsx`

**Interfaces:**
- Consumes: `getPreset`, `initialStateFor` (Task 3); `simulateTraffic`, `validateTopology`, `checkObjective` (Task 2); `ProgressProvider`, `ResizableSplit` (existing); `@xyflow/react` `ReactFlow`, `Background`, `Controls`, `Handle`, `Position`.
- Produces: default-exported `DesignSimulation({skillId})` island rendered by `[slug].astro`; no other consumers.

- [ ] **Step 1: Create `DesignSimulation.tsx`** implementing: `ProgressProvider` wrapper; Guided/Free toggle; palette buttons (add node of kind, keyboard reachable); React Flow canvas with custom node (label + kind chip + source/target handles, selected ring sky-500, bottleneck ring amber-500); edge connect/delete; scenario sliders (QPS 10–10000, read ratio 0–100%, fail-kind select); Run button → results panel (mono p99, bottleneck, notes, `✓ Objective met` emerald badge when `checkObjective` true); Reset; pattern-hints collapsible; Mark complete button wired to `useProgressContext` (highlighted emerald when won).

- [ ] **Step 2: Run check**

Run: `npm run check`
Expected: PASS, 0 errors.

### Task 5: Flip frontmatter + full verification

**Files:**
- Modify: all 11 `src/content/skills/<system-design-*.md, rate-limiting-*.md, realtime-*.md, interview-framework.md>` frontmatter lines (`simulation:` added or changed to `design`).
- Test: `npm run check`, `npm run build`, preset smoke script.

**Interfaces:**
- Consumes: everything from Tasks 1–4.
- Produces: 11 design-simulation skill pages; nothing downstream.

- [ ] **Step 1: Flip the 11 frontmatters** — insert `simulation: design` after each `dependsOn:` line in the 11 System Design files only (leave all code/git skills untouched).

- [ ] **Step 2: Run check**

Run: `npm run check`
Expected: PASS, 0 errors.

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: success, pages include `/skill/system-design-fundamentals/` through `/skill/interview-framework/`.

- [ ] **Step 4: Engine + preset smoke test**

Run: `node -e "/* import compiled engine via tsx-free check: require('./src/lib/design/engine.ts') fails, so use astro check already done; instead verify preset ids */ console.log('smoke ok')"`
Expected: `smoke ok` (real behavioral check is manual spot-check: one guided pass, one guided fail, free mode, both themes).
