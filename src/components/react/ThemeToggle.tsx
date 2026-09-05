import { MoonIcon, SunIcon } from '@radix-ui/react-icons';
import { useTheme, toggleTheme } from '../../lib/theme';

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const theme = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className={`flex items-center justify-center rounded-md border transition ${compact ? 'h-7 w-7 border-transparent bg-transparent text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800' : 'h-9 w-9 border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'}`}
    >
      {isDark ? (
        <SunIcon width={16} height={16} className="h-4 w-4" aria-hidden />
      ) : (
        <MoonIcon width={16} height={16} className="h-4 w-4" aria-hidden />
      )}
    </button>
  );
}
