import { useState } from 'react';

export type SupportedLanguage = 'go' | 'java' | 'typescript' | 'python';

export interface LanguageMeta {
  id: SupportedLanguage;
  label: string;
  monacoLanguage: string;
  extension: string;
}

export const LANGUAGES: LanguageMeta[] = [
  { id: 'go', label: 'Go', monacoLanguage: 'go', extension: 'go' },
  { id: 'java', label: 'Java', monacoLanguage: 'java', extension: 'java' },
  { id: 'typescript', label: 'TypeScript', monacoLanguage: 'typescript', extension: 'ts' },
  { id: 'python', label: 'Python', monacoLanguage: 'python', extension: 'py' },
];

export const DEFAULT_LANGUAGE: SupportedLanguage = 'python';

const LANGUAGE_KEY = 'backend-roadmap:language';

export function loadLanguage(): SupportedLanguage {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
  const raw = window.localStorage.getItem(LANGUAGE_KEY);
  if (raw && LANGUAGES.some((l) => l.id === raw)) return raw as SupportedLanguage;
  return DEFAULT_LANGUAGE;
}

export function usePersistedLanguage(): [SupportedLanguage, (lang: SupportedLanguage) => void] {
  const [language, setLanguage] = useState<SupportedLanguage>(() => loadLanguage());
  const set = (lang: SupportedLanguage) => {
    setLanguage(lang);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LANGUAGE_KEY, lang);
    }
  };
  return [language, set];
}
