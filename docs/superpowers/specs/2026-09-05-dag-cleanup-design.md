# DAG Cleanup Design (Skill Tree Readability + UX)

**Status:** approved by user (2026-09-05) — all 4 sections.
**Scope:** Full UX upgrade of the homepage skill graph. **Dependencies (`dependsOn`) are frozen** — visual fix only.
**Approach:** A (tidy top-down). Alternatives rejected: B (left-to-right, bad on mobile, fan-outs stack badly), C (staged columns, new semantics to maintain).

## Problem

42 nodes / ~45 edges in one top-down dagre layout (`SkillTree.tsx:87`: `rankdir TB, nodesep 80, ranksep 120`). Tangle sources confirmed from data:

- Long backward edges: `cicd (35) ← testing-cicd (120)`, `data-modeling-apis (180) ← rest-api (70), relational-databases (40)`.
- Wide fan-outs: `internet-basics → 4`, `pick-language → 4`, `rest-api → 5`.
- All edges identical (3px zinc bezier); nodes identical except status ring; no category channel.

## Changes (all in `src/components/react/SkillTree.tsx` unless noted)

### 1. Layout tuning

- dagre config: `rankdir: 'TB'`, `nodesep: 110`, `ranksep: 150`, add `edgesep: 30`, `marginx: 40`, `marginy: 40`. Ranker stays `network-simplex` (dagre default); no other algorithm changes.
- Edges: `type: 'smoothstep'`, `style: { stroke: '#a1a1aa', strokeWidth: 1.5 }`, keep `ArrowClosed` marker (recolor to match stroke). Path finding / edge list construction unchanged.
- Node size stays 200×64 (`NODE_WIDTH`/`NODE_HEIGHT` unchanged) so dagre coordinates stay comparable.

### 2. Color system

- Status keeps the strong channel: node `border-2` ring (`STATUS_STYLES`, unchanged).
- Category gets a quiet channel: 10px color dot at the node's top-left + matching entry in the legend. No other node restyle.
- Category palette (hex, works in both themes):
  - Foundations `#8b5cf6` · Web Basics `#06b6d4` · Languages `#eab308` · APIs `#3b82f6`
  - Databases `#f97316` · Security `#ef4444` · Infrastructure `#14b8a8` · Architecture `#d946ef`
  - Scaling `#84cc16` · Quality `#ec4899` · Tooling `#64748b` · System Design `#6366f1`
- New-category fallback: hash category string to one of the palette hues so a future 13th category never renders uncolored.
- Edges default to neutral zinc; connected-edge highlight on hover/selection uses the *target node's* category color at full opacity with the existing `skill-edge-dots` animation class.

### 3. Click-to-select (replaces click-to-navigate)

- Single click selects: compute neighborhood = node + all transitive ancestors + all transitive descendants (from `skills[].dependsOn`, memoized adjacency). Selected neighborhood renders full opacity with category-colored edges; everything else `opacity: 0.15`. A small popover anchored near the node shows title, category, status, and an **Open →** button (`/skill/{id}`).
- Double-click (and the Open button) navigates to `/skill/{id}`. Clicking empty canvas clears selection.
- Hover edge-shimmer (`onNodeMouseEnter/Leave`) unchanged.
- Rationale: previously a single click navigated away instantly, which made any focus feature impossible.

### 4. Navigation aids

- Category filter chips (overlay row, top-left): multi-toggle across the 12 categories. Non-matching nodes dim to 15% opacity — never `hidden`, so layout never jumps and path context is preserved. "All" reset chip.
- Search box (overlay, top-left under chips): filters by title substring; Enter or click zooms to the match (`setCenter`) and selects it (same neighborhood highlight as click).
- Progress chip: `x / 42 completed` (count from `getStatus`), top-left overlay. Denominator derived from `skills.length`, never hardcoded.
- Legend (existing top-right panel): keep status swatches; add collapsible category section with the 12 dots. Reset-progress button unchanged.
- MiniMap, Controls, Background, theming (`useTheme`, `colorMode`) unchanged.

## Non-goals / frozen

- No `dependsOn` edits, no content-file edits, no new npm dependencies, no changes to sims/theme/progress store.
- No sub-100px responsive redesign beyond what ReactFlow already provides; chips/search overlay must wrap on small screens (`flex-wrap`, max-width).

## Verification

- `npm run check` (0 errors), `npm run build` (exit 0).
- Dev-server visual pass: full graph fits with breathing room; no edge overlaps node cards at default zoom; filter dim (not hide); select → neighborhood lights, popover opens; double-click/Open navigates; search zooms; progress count matches manual count; both themes.
