import { createContext, useContext, type ReactNode } from 'react';
import { useProgress, type ProgressMap, type ProgressStatus } from '../../lib/progress';

interface ProgressContextValue {
  progress: ProgressMap;
  getStatus: (id: string) => ProgressStatus;
  setStatus: (id: string, status: ProgressStatus) => void;
  clearProgress: () => void;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const value = useProgress();
  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgressContext(): ProgressContextValue {
  const ctx = useContext(ProgressContext);
  if (!ctx) {
    throw new Error('useProgressContext must be used within a ProgressProvider');
  }
  return ctx;
}
