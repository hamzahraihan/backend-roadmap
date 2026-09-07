import { UI_LOCALES, getUILocale, setUILocale, t, useUILocale } from '../../lib/i18n';

export default function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const locale = useUILocale();

  return (
    <div
      role="group"
      aria-label={t(locale, 'language')}
      title={t(locale, 'language')}
      className={`flex items-center overflow-hidden rounded-md border transition ${
        compact
          ? 'h-7 border-transparent text-xs'
          : 'h-9 border-zinc-200 text-xs dark:border-zinc-700'
      }`}
    >
      {UI_LOCALES.map((l) => {
        const active = l.id === locale;
        const label = t(locale, l.id === 'en' ? 'switchToEnglish' : 'switchToIndonesian');
        return (
          <button
            key={l.id}
            type="button"
            onClick={() => {
              if (getUILocale() !== l.id) setUILocale(l.id);
            }}
            aria-pressed={active}
            aria-label={label}
            title={label}
            className={`px-2 font-semibold tracking-wide transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
              compact ? 'h-7' : 'h-9'
            } ${
              active
                ? 'bg-sky-600 text-white'
                : 'bg-transparent text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
            }`}
          >
            {l.label}
          </button>
        );
      })}
    </div>
  );
}
