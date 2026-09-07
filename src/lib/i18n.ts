import { useSyncExternalStore } from 'react';

export type UILocale = 'en' | 'id';

export interface UILocaleMeta {
  id: UILocale;
  label: string;
}

export const UI_LOCALES: UILocaleMeta[] = [
  { id: 'en', label: 'EN' },
  { id: 'id', label: 'ID' },
];

export const DEFAULT_UI_LOCALE: UILocale = 'en';

const STORAGE_KEY = 'backend-roadmap:ui-locale';

/** Window event fired whenever the UI locale changes (works across bundles). */
export const UI_LOCALE_EVENT = 'ui-locale-change';

const en = {
  activities: 'Activities',
  openActivities: 'Open activities',
  closeActivities: 'Close activities',
  roadmap: 'Roadmap',
  hideDocs: 'Hide docs',
  showDocs: 'Show docs',
  hideDocumentation: 'Hide documentation',
  showDocumentation: 'Show documentation',
  skillsUnit: 'skills',
  roadmapOrder: 'Roadmap order',
  total: 'total',
  searchPlaceholder: 'Search — e.g. branching',
  clearSearch: 'Clear search',
  noMatches: 'No matches',
  tryExamples: 'Try “git”, “api”, or “scale”.',
  clear: 'Clear',
  current: 'Current',
  viewGraph: 'View graph',
  completedCount: 'completed',
  available: 'Available',
  inProgress: 'In progress',
  completed: 'Completed',
  all: 'All',
  categories: 'Categories',
  openLink: 'Open →',
  close: 'Close',
  searchSkills: 'Search skills',
  searchSkillsPlaceholder: 'Search skills…',
  resetLayout: 'Reset layout',
  resetProgress: 'Reset progress',
  reset: 'Reset',
  run: 'Run',
  running: 'Running…',
  output: 'Output',
  markComplete: 'Mark complete',
  pressRunHint: 'Press Run to execute your code via the Wandbox sandbox.',
  resetRepo: 'Reset repo',
  resetRun: 'Reset run',
  cheatSheet: 'Cheat sheet',
  graphDirection: 'Graph direction',
  canvasDirection: 'Canvas direction',
  topDown: '↕ Top-down',
  horizontal: '↔ Horizontal',
  topDownView: 'Top-down view',
  leftRightView: 'Left-to-right view',
  objectiveMet: 'Objective met',
  scenarios: 'Scenarios:',
  patterns: 'Patterns',
  play: 'Play',
  pause: 'Pause',
  step: 'Step',
  loadingSimulation: 'Loading simulation…',
  pressPlayHint: 'Press Play — requests will flow through your architecture live',
  resizeHandle: 'Drag to resize • Double-click to reset • Arrow keys to nudge',
  deleteConnection: 'Delete connection',
  scenarioLibrary: 'Scenario library',
  playbackControls: 'Playback controls',
  addComponents: 'Add components',
  eventLog: 'Simulation event log',
  selectRequest: 'Select request to inspect',
  simulationMode: 'Simulation mode',
  switchToEnglish: 'Switch to English',
  switchToIndonesian: 'Switch to Indonesian',
  language: 'Language',
} as const;

export type UIStringKey = keyof typeof en;

const id: Record<UIStringKey, string> = {
  activities: 'Aktivitas',
  openActivities: 'Buka aktivitas',
  closeActivities: 'Tutup aktivitas',
  roadmap: 'Peta Jalan',
  hideDocs: 'Sembunyikan docs',
  showDocs: 'Tampilkan docs',
  hideDocumentation: 'Sembunyikan dokumentasi',
  showDocumentation: 'Tampilkan dokumentasi',
  skillsUnit: 'skill',
  roadmapOrder: 'Urutan peta jalan',
  total: 'total',
  searchPlaceholder: 'Cari — mis. branching',
  clearSearch: 'Bersihkan pencarian',
  noMatches: 'Tidak ada hasil',
  tryExamples: 'Coba “git”, “api”, atau “scale”.',
  clear: 'Bersihkan',
  current: 'Saat ini',
  viewGraph: 'Lihat graf',
  completedCount: 'selesai',
  available: 'Tersedia',
  inProgress: 'Berlangsung',
  completed: 'Selesai',
  all: 'Semua',
  categories: 'Kategori',
  openLink: 'Buka →',
  close: 'Tutup',
  searchSkills: 'Cari skill',
  searchSkillsPlaceholder: 'Cari skill…',
  resetLayout: 'Atur ulang tata letak',
  resetProgress: 'Atur ulang progres',
  reset: 'Atur ulang',
  run: 'Jalankan',
  running: 'Menjalankan…',
  output: 'Keluaran',
  markComplete: 'Tandai selesai',
  pressRunHint: 'Tekan Jalankan untuk mengeksekusi kode melalui sandbox Wandbox.',
  resetRepo: 'Atur ulang repo',
  resetRun: 'Atur ulang run',
  cheatSheet: 'Cheat sheet',
  graphDirection: 'Arah graf',
  canvasDirection: 'Arah kanvas',
  topDown: '↕ Atas-bawah',
  horizontal: '↔ Horizontal',
  topDownView: 'Tampilan atas-bawah',
  leftRightView: 'Tampilan kiri-ke-kanan',
  objectiveMet: 'Tujuan tercapai',
  scenarios: 'Skenario:',
  patterns: 'Pola',
  play: 'Putar',
  pause: 'Jeda',
  step: 'Langkah',
  loadingSimulation: 'Memuat simulasi…',
  pressPlayHint: 'Tekan Putar — request akan mengalir melalui arsitektur Anda secara langsung',
  resizeHandle: 'Seret untuk mengubah ukuran • Klik ganda untuk mengatur ulang • Gunakan tombol panah untuk menggeser',
  deleteConnection: 'Hapus koneksi',
  scenarioLibrary: 'Pustaka skenario',
  playbackControls: 'Kontrol putar',
  addComponents: 'Tambah komponen',
  eventLog: 'Log peristiwa simulasi',
  selectRequest: 'Pilih request untuk diperiksa',
  simulationMode: 'Mode simulasi',
  switchToEnglish: 'Ganti ke bahasa Inggris',
  switchToIndonesian: 'Ganti ke bahasa Indonesia',
  language: 'Bahasa',
};

const STRINGS: Record<UILocale, Record<UIStringKey, string>> = { en: { ...en }, id };

/** Translate a UI chrome key. Falls back to English, then the key itself. */
export function t(locale: UILocale, key: UIStringKey): string {
  return STRINGS[locale][key] ?? STRINGS.en[key] ?? key;
}

/**
 * Read the active locale straight from localStorage on every call so that
 * separate bundles (Astro `<script>` islands and React `client:*` islands do
 * not share module state) always agree. Cheap enough for render paths.
 */
export function getUILocale(): UILocale {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return DEFAULT_UI_LOCALE;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'id' || raw === 'en') return raw;
  } catch {}
  return DEFAULT_UI_LOCALE;
}

export function setUILocale(locale: UILocale): void {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {}
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(UI_LOCALE_EVENT, { detail: { locale } }));
  }
}

export function subscribeUILocale(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(UI_LOCALE_EVENT, listener);
  return () => {
    window.removeEventListener(UI_LOCALE_EVENT, listener);
  };
}

export function useUILocale(): UILocale {
  return useSyncExternalStore(subscribeUILocale, getUILocale, () => DEFAULT_UI_LOCALE);
}
