import { CHEAT_SHEET, GROUP_ORDER } from '../../lib/git/helpText';

interface Props {
  onPick?: (cmd: string) => void;
}

export default function GitCheatSheet({ onPick }: Props) {
  const grouped = GROUP_ORDER.map((g) => ({ group: g, items: CHEAT_SHEET.filter((c) => c.group === g) }));

  return (
    <div className="bg-white p-4 dark:bg-zinc-950">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Git Cheat Sheet</h3>
        <span className="text-xs text-zinc-500">Click a command to insert into terminal</span>
      </div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {grouped.map(({ group, items }) => (
          <div key={group} className="rounded border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-300">{group}</h4>
            <div className="space-y-3">
              {items.map((it) => (
                <button
                  key={it.command}
                  onClick={() => onPick?.(it.command.split(' ')[0] === 'git' ? it.command : `git ${it.command}`)}
                  className="block w-full text-left"
                >
                  <div className="font-mono text-xs font-semibold text-sky-700 dark:text-sky-400">{it.command}</div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{it.explanation}</div>
                  <div className="mt-0.5 font-mono text-[11px] text-zinc-400">
                    <span className="text-zinc-500">usage:</span> {it.usage}
                  </div>
                  <div className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">→ {it.example}</div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
