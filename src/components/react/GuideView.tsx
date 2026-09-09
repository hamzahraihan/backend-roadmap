import { useMemo, useState } from 'react';
import { ProgressProvider, useProgressContext } from './ProgressProvider';
import type { SkillSummary } from '../../lib/skills';
import type { ProgressStatus } from '../../lib/progress';
import { categoryColor, findCoreId, groupSkillsByStage } from '../../lib/skillGraph';
import { t, useUILocale } from '../../lib/i18n';

const STATUSES: ProgressStatus[] = ['not-started', 'in-progress', 'completed'];

function GuideViewContent({ skills }: { skills: SkillSummary[] }) {
  const locale = useUILocale();
  const { getStatus, setStatus } = useProgressContext();
  const [query, setQuery] = useState('');

  const byId = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);
  const coreId = useMemo(() => findCoreId(skills), [skills]);
  const stages = useMemo(() => groupSkillsByStage(skills), [skills]);

  const q = query.trim().toLowerCase();
  const visibleStages = useMemo(
    () =>
      stages
        .map((st) => ({
          ...st,
          skills: q
            ? st.skills.filter(
                (s) =>
                  s.title.toLowerCase().includes(q) || s.category.toLowerCase().includes(q),
              )
            : st.skills,
        }))
        .filter((st) => st.skills.length > 0),
    [stages, q],
  );

  const completedCount = skills.filter((s) => getStatus(s.id) === 'completed').length;
  let step = 0;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-28 pt-8 sm:px-6">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{t(locale, 'guideIntro')}</p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t(locale, 'searchSkills')}
          placeholder={t(locale, 'searchSkillsPlaceholder')}
          spellCheck={false}
          autoComplete="off"
          className="w-64 max-w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 placeholder-zinc-400 outline-none focus:border-sky-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <progress
            value={completedCount}
            max={skills.length}
            aria-label={`${completedCount} / ${skills.length} ${t(locale, 'completedCount')}`}
            className="h-2 w-32"
          />
          <span>
            {completedCount} / {skills.length} {t(locale, 'completedCount')}
          </span>
        </div>
      </div>

      {visibleStages.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">
          {t(locale, 'noMatches')} {t(locale, 'tryExamples')}
        </p>
      ) : (
        visibleStages.map((st) => (
          <section key={st.depth} aria-labelledby={`stage-${st.depth}`} className="mt-8">
            <h2
              id={`stage-${st.depth}`}
              className="text-lg font-bold text-zinc-900 dark:text-zinc-100"
            >
              {t(locale, 'stage')} {st.depth + 1}
            </h2>
            <ol role="list" className="mt-3 flex flex-col gap-3">
              {st.skills.map((s) => {
                step += 1;
                const status = getStatus(s.id);
                const isCore = s.id === coreId;
                const deps = s.dependsOn.filter((d) => byId.has(d));
                return (
                  <li
                    role="listitem"
                    key={s.id}
                    value={step}
                    className={`rounded-xl border bg-white p-4 shadow-sm dark:bg-zinc-900 ${
                      isCore
                        ? 'border-amber-400 dark:border-amber-400'
                        : 'border-zinc-200 dark:border-zinc-800'
                    }`}
                  >
                    <article aria-labelledby={`guide-title-${s.id}`}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3
                            className="text-base font-semibold text-zinc-900 dark:text-zinc-100"
                          >
                            <a
                              href={`/skill/${s.id}`}
                              className="rounded underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                            >
                              {isCore ? `★ ${s.title}` : s.title}
                            </a>
                          </h3>
                          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: categoryColor(s.category) }}
                              aria-hidden="true"
                            />
                            {s.category}
                            {isCore && (
                              <span className="rounded-full bg-amber-400 px-2 py-px text-[10px] font-bold uppercase tracking-wider text-zinc-950">
                                {t(locale, 'startHere')}
                              </span>
                            )}
                          </p>
                        </div>
                        <label className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                          {t(locale, 'statusLabel')}
                          <select
                            value={status}
                            onChange={(e) =>
                              setStatus(s.id, e.target.value as ProgressStatus)
                            }
                            aria-label={`${s.title} — ${t(locale, 'statusLabel')}`}
                            className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 outline-none focus:border-sky-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                          >
                            {STATUSES.map((st2) => (
                              <option key={st2} value={st2}>
                                {t(
                                  locale,
                                  st2 === 'not-started'
                                    ? 'available'
                                    : st2 === 'in-progress'
                                      ? 'inProgress'
                                      : 'completed',
                                )}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      {deps.length > 0 && (
                        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                          {t(locale, 'requires')}:{' '}
                          {deps.map((d, i) => (
                            <span key={d}>
                              {i > 0 && ', '}
                              <a
                                href={`/skill/${d}`}
                                className="rounded underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                              >
                                {byId.get(d)?.title ?? d}
                              </a>
                            </span>
                          ))}
                        </p>
                      )}
                    </article>
                  </li>
                );
              })}
            </ol>
          </section>
        ))
      )}
    </div>
  );
}

export default function GuideView({ skills }: { skills: SkillSummary[] }) {
  return (
    <ProgressProvider>
      <GuideViewContent skills={skills} />
    </ProgressProvider>
  );
}
