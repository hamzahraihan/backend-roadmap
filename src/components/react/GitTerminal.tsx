import { useEffect, useRef, useState, useCallback, useMemo } from 'react';

type Line = { type: 'input' | 'stdout' | 'stderr' | 'hint'; text: string };

interface GitTerminalProps {
  skillId: string;
  headLabel: string;
  onExec: (cmd: string) => { stdout: string; stderr: string; exitCode: number };
  initialLines?: string[];
}

const ALL_COMMANDS = [
  'git init',
  'git status',
  'git add',
  'git add .',
  'git commit -m ""',
  'git log',
  'git log --oneline',
  'git log --oneline --graph --all',
  'git branch',
  'git branch -d',
  'git checkout',
  'git checkout -b',
  'git switch',
  'git switch -c',
  'git merge',
  'git merge --abort',
  'git rebase',
  'git diff',
  'git diff --staged',
  'git show',
  'git remote -v',
  'git remote add origin',
  'git fetch',
  'git push',
  'git push -u origin',
  'git pull',
  'git clone',
  'git reset --hard HEAD~1',
  'git restore --staged',
  'git stash',
  'git stash pop',
  'git tag',
  'git cherry-pick',
  'git revert',
  'clear',
  'help',
];

export default function GitTerminal({ headLabel, onExec }: GitTerminalProps) {
  const [lines, setLines] = useState<Line[]>([
    { type: 'hint', text: 'Git terminal — type `git status` to start. ↑/↓ for history, Tab to autocomplete, `clear` to reset.' },
  ]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [lines, scrollToBottom]);

  const append = useCallback((newLines: Line[]) => {
    setLines((prev) => [...prev, ...newLines]);
  }, []);

  const handleExec = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;
      setHistory((h) => [...h, raw]);
      setHistIdx(null);
      append([{ type: 'input', text: `$ ${raw}` }]);
      const res = onExec(raw);
      if (res.stdout === '__CLEAR__') {
        setLines([{ type: 'hint', text: 'Cleared.' }]);
        return;
      }
      if (res.stderr) append([{ type: 'stderr', text: res.stderr }]);
      if (res.stdout) append([{ type: 'stdout', text: res.stdout }]);
      if (!res.stdout && !res.stderr) append([{ type: 'stdout', text: '' }]);
    },
    [onExec, append],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleExec(input);
      setInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const nextIdx = histIdx === null ? history.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(nextIdx);
      setInput(history[nextIdx]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (histIdx === null) return;
      const nextIdx = histIdx + 1;
      if (nextIdx >= history.length) {
        setHistIdx(null);
        setInput('');
      } else {
        setHistIdx(nextIdx);
        setInput(history[nextIdx]);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const candidates = ALL_COMMANDS.filter((c) => c.startsWith(input) && c !== input);
      if (candidates.length === 1) {
        setInput(candidates[0]);
      } else if (candidates.length > 1) {
        append([{ type: 'hint', text: candidates.slice(0, 8).join('  ') }]);
      }
    } else if (e.key === 'l' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setLines([{ type: 'hint', text: 'Cleared.' }]);
    }
  };

  const suggestions = useMemo(() => {
    if (!input || input.length < 2) return [];
    return ALL_COMMANDS.filter((c) => c.startsWith(input) && c !== input).slice(0, 6);
  }, [input]);

  return (
    <div className="flex h-full min-h-[240px] flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
          <span className="ml-2 font-mono text-[11px] uppercase tracking-wide text-zinc-400">Git Terminal</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">{headLabel || 'no branch'}</span>
          <button
            onClick={() => setLines([{ type: 'hint', text: 'Cleared.' }])}
            className="rounded px-2 py-0.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            clear
          </button>
        </div>
      </div>

      {/* Output */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-2 font-mono text-xs leading-5">
        {lines.map((l, i) => {
          if (l.type === 'input') return <div key={i} className="whitespace-pre-wrap text-sky-400">{l.text}</div>;
          if (l.type === 'stderr') return <div key={i} className="whitespace-pre-wrap text-red-400">{l.text}</div>;
          if (l.type === 'hint') return <div key={i} className="whitespace-pre-wrap text-zinc-500">{l.text}</div>;
          return <div key={i} className="whitespace-pre-wrap text-zinc-200">{l.text}</div>;
        })}
        {/* Prompt */}
        <div className="mt-1 flex items-center gap-2">
          <span className="shrink-0 text-emerald-400">$</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder='git status'
            spellCheck={false}
            autoComplete="off"
            className="flex-1 bg-transparent font-mono text-xs text-zinc-100 placeholder-zinc-600 outline-none"
          />
        </div>
        {suggestions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {suggestions.map((s) => (
              <button key={s} onClick={() => setInput(s)} className="rounded bg-zinc-800 px-1.5 py-0.5 text-[11px] text-zinc-400 hover:bg-zinc-700">
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer hints */}
      <div className="border-t border-zinc-800 bg-zinc-900/50 px-3 py-1 text-[10px] text-zinc-500">
        ↑/↓ history • Tab autocomplete • <span className="text-zinc-400">git help &lt;command&gt;</span>
      </div>
    </div>
  );
}
