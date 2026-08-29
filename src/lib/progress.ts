import { useCallback, useEffect, useState } from 'react';

export type ProgressStatus = 'not-started' | 'in-progress' | 'completed';
export type ProgressMap = Record<string, ProgressStatus>;

const STORAGE_KEY = 'backend-roadmap:progress';

export function loadProgress(): ProgressMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ProgressMap) : {};
  } catch {
    return {};
  }
}

export function saveProgress(map: ProgressMap): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function useProgress(): {
  progress: ProgressMap;
  getStatus: (id: string) => ProgressStatus;
  setStatus: (id: string, status: ProgressStatus) => void;
  clearProgress: () => void;
} {
  const [progress, setProgress] = useState<ProgressMap>(() => loadProgress());

  useEffect(() => {
    const onStorage = () => setProgress(loadProgress());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setStatus = useCallback((id: string, status: ProgressStatus) => {
    setProgress((prev) => {
      const next = { ...prev, [id]: status };
      saveProgress(next);
      return next;
    });
  }, []);

  const clearProgress = useCallback(() => {
    setProgress({});
    saveProgress({});
  }, []);

  return { progress, getStatus: (id) => progress[id] ?? 'not-started', setStatus, clearProgress };
}
