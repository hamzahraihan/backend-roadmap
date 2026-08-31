import { useEffect, useMemo, useRef, useState } from 'react';
import { ProgressProvider, useProgressContext } from './ProgressProvider';
import type { SkillSummary } from '../../lib/skills';

type Props = {
  skills: SkillSummary[];
};

const STATUS_STYLES: Record<string, { dot: string; label: string }> = {
  'not-started': { dot: 'bg-sky-500/60', label: 'Available' },
  'in-progress': { dot: 'bg-amber-500/60', label: 'In progress' },
  completed: { dot: 'bg-emerald-500/60', label: 'Completed' },
};

function ActivitiesSidebarInner({ skills }: Props) {
  const { getStatus } = useProgressContext();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // Listen for toggle from TopBar
  useEffect(() => {
    const onToggle = (e: Event) => {
      const detail = (e as CustomEvent).detail as { open?: boolean } | undefined;
      if (detail && typeof detail.open === 'boolean') {
        setOpen(detail.open);
      } else {
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    const onClose = () => setOpen(false);
    window.addEventListener('activities:toggle', onToggle as EventListener);
    window.addEventListener('activities:open', onOpen);
    window.addEventListener('activities:close', onClose);
    return () => {
      window.removeEventListener('activities:toggle', onToggle as EventListener);
      window.removeEventListener('activities:open', onOpen);
      window.removeEventListener('activities:close', onClose);
    };
  }, []);

  // Sync aria-expanded on trigger
  useEffect(() => {
    const triggers = document.querySelectorAll('[data-activities-trigger]');
    triggers.forEach((el) => el.setAttribute('aria-expanded', String(open)));
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement;
      // focus search after transition
      setTimeout(() => searchRef.current?.focus(), 100);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      // return focus to trigger
      if (triggerRef.current) {
        triggerRef.current.focus();
      }
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Escape + focus trap
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        window.dispatchEvent(new CustomEvent('activities:close'));
      }
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...skills].sort((a, b) => a.order - b.order);
    if (!q) return sorted;
    return sorted.filter(
      (s) => s.title.toLowerCase().includes(q) || s.category.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
    );
  }, [skills, query]);

  // Group by category but keep roadmap order inside group? Since overall order already is roadmap, we just flat list
  // For visual, we can show category as small label per item, no grouping needed for flat order

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden={!open}
        onClick={() => {
          setOpen(false);
          window.dispatchEvent(new CustomEvent('activities:close'));
        }}
        className={`fixed inset-0 z-40 bg-zinc-950/20 backdrop-blur-sm transition-opacity dark:bg-black/40 ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        data-activities-backdrop
      />

      {/* Panel */}
      <div
        ref={panelRef}
        id="activities-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="activities-title"
        aria-hidden={!open}
        className={`fixed left-2 top-2 z-50 flex h-[calc(100vh-16px)] w-[340px] max-w-[88vw] flex-col rounded-2xl border border-zinc-200 bg-white/95 shadow-2xl backdrop-blur-xl transition-transform duration-200 ease-out dark:border-zinc-800 dark:bg-zinc-900/95 dark:shadow-black/30 sm:left-3 sm:top-3 ${
          open ? 'translate-x-0' : '-translate-x-[calc(100%+16px)]'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <span className="grid h-5 w-5 grid-cols-3 gap-0.5" aria-hidden="true">
              <span className="h-1.5 w-1.5 rounded-[2px] bg-zinc-700 dark:bg-zinc-300" />
              <span className="h-1.5 w-1.5 rounded-[2px] bg-zinc-700 dark:bg-zinc-300" />
              <span className="h-1.5 w-1.5 rounded-[2px] bg-zinc-700 dark:bg-zinc-300" />
              <span className="h-1.5 w-1.5 rounded-[2px] bg-zinc-700 dark:bg-zinc-300" />
              <span className="h-1.5 w-1.5 rounded-[2px] bg-zinc-700 dark:bg-zinc-300" />
              <span className="h-1.5 w-1.5 rounded-[2px] bg-zinc-700 dark:bg-zinc-300" />
              <span className="h-1.5 w-1.5 rounded-[2px] bg-zinc-700 dark:bg-zinc-300" />
              <span className="h-1.5 w-1.5 rounded-[2px] bg-zinc-700 dark:bg-zinc-300" />
              <span className="h-1.5 w-1.5 rounded-[2px] bg-zinc-700 dark:bg-zinc-300" />
            </span>
            <h2 id="activities-title" className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Activities
            </h2>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              {filtered.length} skills
            </span>
          </div>
          <button
            onClick={() => {
              setOpen(false);
              window.dispatchEvent(new CustomEvent('activities:close'));
            }}
            aria-label="Close activities"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M4 4l8 8M12 4L4 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-zinc-200 px-3 py-2.5 dark:border-zinc-800">
          <div className="relative">
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400"
              aria-hidden="true"
            >
              <circle cx="7" cy="7" r="4.5" />
              <path d="M10.5 10.5L13 13" />
            </svg>
            <input
              ref={searchRef}
              type="search"
              placeholder="Search — e.g. branching"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-full border border-zinc-200 bg-zinc-50 py-1.5 pl-8 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-700"
              >
                <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 4l8 8M12 4L4 12" />
                </svg>
              </button>
            )}
          </div>
          <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            Roadmap order • {skills.length} total • <span className="font-mono text-[11px]">order {filtered[0]?.order ?? '-'} → {filtered[filtered.length - 1]?.order ?? '-'}</span>
          </p>
        </div>

        {/* List */}
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">No matches</p>
              <p className="mt-1 text-xs text-zinc-500">Try “git”, “api”, or “scale”.</p>
              <button
                onClick={() => setQuery('')}
                className="mt-3 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              >
                Clear
              </button>
            </div>
          ) : (
            <ul role="list" className="space-y-1">
              {filtered.map((skill) => {
                const status = getStatus(skill.id);
                const style = STATUS_STYLES[status] ?? STATUS_STYLES['not-started'];
                const isCurrent = typeof window !== 'undefined' && window.location.pathname === `/skill/${skill.id}`;
                return (
                  <li key={skill.id}>
                    <a
                      href={`/skill/${skill.id}`}
                      onClick={() => {
                        setOpen(false);
                        window.dispatchEvent(new CustomEvent('activities:close'));
                      }}
                      className={`group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
                        isCurrent
                          ? 'border-sky-500/30 bg-zinc-100 dark:border-sky-500/30 dark:bg-zinc-800'
                          : 'border-transparent hover:border-zinc-200 hover:bg-zinc-50 dark:hover:border-zinc-800 dark:hover:bg-zinc-800/80'
                      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500`}
                    >
                      <span className={`h-8 w-1 shrink-0 self-stretch rounded-full ${status === 'completed' ? 'bg-emerald-500' : status === 'in-progress' ? 'bg-amber-500' : 'bg-sky-500'} opacity-60 group-hover:opacity-100`} aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{skill.title}</span>
                          {isCurrent && (
                            <span className="rounded-full bg-sky-500 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">Current</span>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">{skill.category}</span>
                          <span className="h-1 w-1 shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-600" aria-hidden="true" />
                          <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">#{skill.order}</span>
                        </div>
                      </div>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full border-2 ${style.dot} bg-white dark:bg-zinc-900`} aria-hidden="true" title={style.label} />
                        <svg
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.4"
                          className="h-3 w-3 shrink-0 text-zinc-400 group-hover:text-zinc-600 dark:text-zinc-500 dark:group-hover:text-zinc-300"
                          aria-hidden="true"
                        >
                          <path d="M6 3l5 5-5 5" />
                        </svg>
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-200 px-3 py-2.5 dark:border-zinc-800">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>
              {skills.filter((s) => getStatus(s.id) === 'completed').length} / {skills.length} completed
            </span>
            <a href="/" className="font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100">
              View graph →
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

export default function ActivitiesSidebar(props: Props) {
  return (
    <ProgressProvider>
      <ActivitiesSidebarInner {...props} />
    </ProgressProvider>
  );
}
