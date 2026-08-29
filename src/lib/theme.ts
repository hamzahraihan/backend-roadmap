import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

function getInitial(): Theme {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  }
  if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

let current: Theme = getInitial();
const listeners = new Set<(t: Theme) => void>();

export function getTheme(): Theme {
  return current;
}

export function setTheme(t: Theme): void {
  current = t;
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', t === 'dark');
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, t);
  }
  listeners.forEach((l) => l(t));
}

export function toggleTheme(): void {
  setTheme(current === 'dark' ? 'light' : 'dark');
}

export function subscribe(listener: (t: Theme) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

if (typeof document !== 'undefined') {
  document.documentElement.classList.toggle('dark', current === 'dark');
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getTheme, () => 'light' as Theme);
}
