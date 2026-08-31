export const SPLIT_KEY_OUTER = 'backend-roadmap:split:skill';
export const SPLIT_KEY_INNER_GIT = 'backend-roadmap:split:git-inner';
export const SPLIT_KEY_INNER_CODE = 'backend-roadmap:split:code-inner';

export function loadSplit(key: string, fallback = 50): number {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const n = Number(JSON.parse(raw));
    if (Number.isFinite(n) && n >= 15 && n <= 85) return n;
    if (Number.isFinite(Number(raw)) && Number(raw) >= 15 && Number(raw) <= 85) return Number(raw);
  } catch {}
  return fallback;
}

export function saveSplit(key: string, value: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(Math.round(value)));
  } catch {}
}

export function clampSplit(value: number, min = 25, max = 75): number {
  return Math.min(max, Math.max(min, value));
}
