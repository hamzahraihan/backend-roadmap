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
