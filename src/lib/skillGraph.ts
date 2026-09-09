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
  if (!byId.has(id)) return new Set<string>();
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

export interface TreePoint {
  x: number;
  y: number;
}

/**
 * Core skill = the entry point that unlocks the most downstream skills
 * (ties fall back to lowest `order`). For this roadmap that's the most
 * basic thing a learner starts with (Internet Fundamentals).
 */
export function findCoreId(skills: SkillSummary[]): string {
  const byId = new Map(skills.map((s) => [s.id, s]));
  const children = new Map<string, string[]>();
  for (const s of skills) {
    for (const dep of s.dependsOn) {
      if (!byId.has(dep)) continue;
      const list = children.get(dep) ?? [];
      list.push(s.id);
      children.set(dep, list);
    }
  }
  let best = '';
  let bestReach = -1;
  let bestOrder = Number.POSITIVE_INFINITY;
  for (const s of skills) {
    const seen = new Set<string>([s.id]);
    const stack = [s.id];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const child of children.get(cur) ?? []) {
        if (!seen.has(child)) {
          seen.add(child);
          stack.push(child);
        }
      }
    }
    const reach = seen.size - 1;
    if (reach > bestReach || (reach === bestReach && s.order < bestOrder)) {
      best = s.id;
      bestReach = reach;
      bestOrder = s.order;
    }
  }
  return best;
}

export const TREE_X_GAP = 140;
export const TREE_Y_GAP = 48;

/**
 * Learning stage of each skill = longest dependency chain from any entry
 * point (entry skills sit at stage 0). Shared by the graph layout and the
 * step-by-step guide so both order skills identically.
 */
export function assignDepths(skills: SkillSummary[]): Map<string, number> {
  const byId = new Map(skills.map((s) => [s.id, s]));
  const ordered = [...skills].sort((a, b) => a.order - b.order);
  const depth = new Map<string, number>();
  const unresolved = new Set(ordered.map((s) => s.id));
  let guard = 0;
  while (unresolved.size > 0 && guard++ < skills.length + 1) {
    let progressed = false;
    for (const s of ordered) {
      if (!unresolved.has(s.id)) continue;
      const known = s.dependsOn.filter((d) => byId.has(d));
      if (known.every((d) => depth.has(d))) {
        depth.set(s.id, known.length === 0 ? 0 : 1 + Math.max(...known.map((d) => depth.get(d)!)));
        unresolved.delete(s.id);
        progressed = true;
      }
    }
    if (!progressed) {
      for (const id of unresolved) depth.set(id, 0);
      unresolved.clear();
    }
  }
  return depth;
}

/**
 * Skills grouped into learning stages (ascending), each stage sorted by
 * `order`. Backs the step-by-step guide page.
 */
export function groupSkillsByStage(skills: SkillSummary[]): { depth: number; skills: SkillSummary[] }[] {
  const depth = assignDepths(skills);
  const lanes = new Map<number, SkillSummary[]>();
  for (const s of skills) {
    const d = depth.get(s.id) ?? 0;
    const lane = lanes.get(d) ?? [];
    lane.push(s);
    lanes.set(d, lane);
  }
  return [...lanes.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([d, lane]) => ({ depth: d, skills: lane.sort((a, b) => a.order - b.order) }));
}

/**
 * Layered skill-tree layout, rooted at the core skill.
 * - x column = longest dependency chain from any entry point (core at 0).
 * - y spread = siblings grouped in trunk bands (ancestor at depth ≤ 1) so
 *   each branch reads as one horizontal limbs instead of a stacked pile.
 */
export function layoutSkillTree(
  skills: SkillSummary[],
  nodeWidth: number,
  nodeHeight: number,
): Map<string, TreePoint> {
  const byId = new Map(skills.map((s) => [s.id, s]));
  const ordered = [...skills].sort((a, b) => a.order - b.order);
  const depth = assignDepths(skills);

  const primaryParent = new Map<string, string | null>();
  for (const s of ordered) {
    const known = s.dependsOn.filter((d) => byId.has(d));
    if (known.length === 0) {
      primaryParent.set(s.id, null);
      continue;
    }
    known.sort((a, b) => depth.get(b)! - depth.get(a)! || byId.get(a)!.order - byId.get(b)!.order);
    primaryParent.set(s.id, known[0]);
  }
  const trunkOf = (id: string): string => {
    let cur = id;
    for (let i = 0; i <= skills.length; i++) {
      if ((depth.get(cur) ?? 0) <= 1) return cur;
      const p = primaryParent.get(cur);
      if (!p) return cur;
      cur = p;
    }
    return cur;
  };
  const trunkRank = new Map<string, number>();
  [...new Set(ordered.map((s) => trunkOf(s.id)))]
    .sort((a, b) => byId.get(a)!.order - byId.get(b)!.order)
    .forEach((t, i) => trunkRank.set(t, i));

  const lanes = new Map<number, SkillSummary[]>();
  for (const s of ordered) {
    const d = depth.get(s.id) ?? 0;
    const lane = lanes.get(d) ?? [];
    lane.push(s);
    lanes.set(d, lane);
  }
  const out = new Map<string, TreePoint>();
  for (const [d, lane] of lanes) {
    lane.sort(
      (a, b) => trunkRank.get(trunkOf(a.id))! - trunkRank.get(trunkOf(b.id))! || a.order - b.order,
    );
    lane.forEach((s, i) => {
      out.set(s.id, {
        x: d * (nodeWidth + TREE_X_GAP),
        y: (i - (lane.length - 1) / 2) * (nodeHeight + TREE_Y_GAP),
      });
    });
  }
  return out;
}
