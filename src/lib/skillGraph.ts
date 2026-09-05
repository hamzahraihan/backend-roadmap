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
