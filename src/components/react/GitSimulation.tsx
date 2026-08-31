import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { GitEngine } from '../../lib/git/engine';
import { clonePresetState, getPreset } from '../../lib/git/presets';
import type { GitState } from '../../lib/git/types';
import GitGraph from './GitGraph';
import GitCheatSheet from './GitCheatSheet';
import ResizableSplit from './ResizableSplit';
import { ProgressProvider, useProgressContext } from './ProgressProvider';

interface GitSimulationProps {
  skillId: string;
}

function GitSimulationContent({ skillId }: GitSimulationProps) {
  const { getStatus, setStatus } = useProgressContext();
  const status = getStatus(skillId);
  const preset = useMemo(() => getPreset(skillId) ?? getPreset('free'), [skillId]);
  const initial = useMemo(() => clonePresetState(preset!.id) ?? clonePresetState('free')!, [preset]);

  const [state, setState] = useState<GitState>(() => initial);
  const engineRef = useRef<GitEngine>(new GitEngine(initial));
  const [injectCmd, setInjectCmd] = useState<string | null>(null);
  const [showCheat, setShowCheat] = useState(false);
  const [hasWon, setHasWon] = useState(false);

  // keep engine in sync when state changes via reset
  useEffect(() => {
    engineRef.current = new GitEngine(state);
  }, [state]);

  // win detection
  useEffect(() => {
    if (!preset) return;
    const won = preset.objective.winCondition(state);
    setHasWon(won);
  }, [state, preset]);

  const handleExec = useCallback(
    (raw: string) => {
      const engine = engineRef.current;
      const { result, newState } = engine.exec(raw);
      setState(newState);
      // engineRef will sync via effect next render, but also update immediately
      engineRef.current.state = newState as any;
      return result;
    },
    []
  );

  const handleResetRepo = useCallback(() => {
    const cloned = clonePresetState(preset!.id);
    if (cloned) {
      setState(cloned);
      setHasWon(false);
    }
  }, [preset]);

  const handleInject = useCallback((cmd: string) => {
    setInjectCmd(cmd);
    // clear after tick so same command can be injected again
    setTimeout(() => setInjectCmd(null), 0);
  }, []);

  const headLabel = state.head ?? (state.detachedCommit ? `detached@${state.detachedCommit.slice(0, 7)}` : 'no branch');
  const commitCount = state.commits.size;
  const remoteSynced = preset?.id === 'git-remotes' ? (() => {
    const local = state.branches.get('main')?.target ?? null;
    const remote = state.remotes.get('origin')?.branches.get('main') ?? null;
    return local && remote && local === remote;
  })() : false;

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* Objective banner */}
      <div className="shrink-0 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-sky-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">Git Simulation</span>
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{preset?.objective.title}</span>
              {hasWon && <span className="rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white">✓ Objective met</span>}
              {commitCount > 0 && <span className="text-xs text-zinc-500">{commitCount} commits</span>}
            </div>
            <p className="mt-1 max-w-[60ch] text-xs leading-5 text-zinc-600 dark:text-zinc-400">{preset?.objective.description}</p>
            <p className="mt-1 font-mono text-xs text-zinc-500 dark:text-zinc-500">Hint: {preset?.objective.hint}</p>
            {remoteSynced && <p className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">Remote in sync.</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={() => setShowCheat((v) => !v)}
              className={`rounded px-2 py-1 text-xs font-medium transition ${showCheat ? 'bg-sky-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'}`}
            >
              ? Cheat sheet
            </button>
            <button
              onClick={handleResetRepo}
              className="rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              Reset repo
            </button>
            <button
              onClick={() => setStatus(skillId, status === 'completed' ? 'in-progress' : 'completed')}
              className={`rounded px-3 py-1 text-xs font-semibold transition ${status === 'completed' ? 'bg-emerald-600 text-white hover:bg-emerald-500' : hasWon ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'}`}
            >
              {status === 'completed' ? '✓ Completed' : hasWon ? 'Mark complete ✓' : 'Mark complete'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <ResizableSplit
          storageKey="backend-roadmap:split:git-inner"
          defaultPct={50}
          minPct={30}
          maxPct={70}
          left={
            <div className="flex min-h-[280px] h-full flex-col p-2 lg:p-3">
              <GitGraph state={state} onCommitClick={(id) => handleInject(`git show ${id.slice(0, 7)}`)} />
            </div>
          }
          right={
            <div className="flex min-h-[260px] h-full flex-col p-2 lg:p-3">
              <GitTerminalWrapper headLabel={headLabel} onExec={handleExec} injectCmd={injectCmd} />
            </div>
          }
        />
      </div>

      {showCheat && (
        <div className="max-h-[50vh] overflow-auto border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <GitCheatSheet onPick={(cmd) => handleInject(cmd)} />
        </div>
      )}
    </div>
  );
}

// Wrapper to handle injected command forwarding to terminal
function GitTerminalWrapper({ headLabel, onExec, injectCmd }: { headLabel: string; onExec: (cmd: string) => { stdout: string; stderr: string; exitCode: number }; injectCmd: string | null }) {
  // We use a small bridge: GitTerminal now owns lines, so inject via re-mount key trick? Simpler: we expose via custom event.
  // Implement via state in wrapper that triggers handleExec directly and relies on terminal's visual append? Instead we let wrapper own a "pending" line that terminal picks up.
  // We'll just render a controlled variant that handles inject by calling onExec and managing lines locally here, but leaner: duplicate terminal logic here.
  // To avoid refactor, we add a side-effect: when injectCmd arrives, we programmatically call onExec and show a transient toast in wrapper's own overlay? For simplicity, we call onExec and show result in a mini output injected via terminal's append callback not accessible.
  // So we implement a minimal injected display inside wrapper, but better to enhance GitTerminal to accept inject prop.
  const [externalLines, setExternalLines] = useState<{ cmd: string; stdout: string; stderr: string } | null>(null);

  useEffect(() => {
    if (injectCmd) {
      const res = onExec(injectCmd);
      setExternalLines({ cmd: injectCmd, stdout: res.stdout, stderr: res.stderr });
      const t = setTimeout(() => setExternalLines(null), 4000);
      return () => clearTimeout(t);
    }
  }, [injectCmd, onExec]);

  return (
    <div className="relative flex h-full flex-col">
      <InjectableGitTerminal headLabel={headLabel} onExec={onExec} externalInject={injectCmd} />
      {externalLines && (
        <div className="pointer-events-none absolute bottom-14 left-2 right-2 rounded border border-zinc-700 bg-zinc-900 p-2 font-mono text-[11px] shadow-lg">
          <div className="text-sky-400">$ {externalLines.cmd}</div>
          {externalLines.stderr && <div className="whitespace-pre-wrap text-red-400">{externalLines.stderr}</div>}
          {externalLines.stdout && <div className="whitespace-pre-wrap text-zinc-200">{externalLines.stdout.slice(0, 600)}</div>}
        </div>
      )}
    </div>
  );
}

// Extend GitTerminal to accept externalInject for direct append
function InjectableGitTerminal({ headLabel, onExec, externalInject }: { headLabel: string; onExec: (c: string) => { stdout: string; stderr: string; exitCode: number }; externalInject: string | null }) {
  const [lines, setLines] = useState<{ type: 'input' | 'stdout' | 'stderr' | 'hint'; text: string }[]>([
    { type: 'hint', text: 'Git terminal — type `git status` to start. ↑/↓ history, Tab autocomplete, `clear` to reset.' },
  ]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const append = useCallback((newLines: { type: 'input' | 'stdout' | 'stderr' | 'hint'; text: string }[]) => {
    setLines((prev) => [...prev, ...newLines]);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, []);

  useEffect(() => { scrollToBottom(); }, [lines, scrollToBottom]);

  const execAndAppend = useCallback((raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    setHistory((h) => [...h, raw]);
    setHistIdx(null);
    append([{ type: 'input', text: `$ ${raw}` }]);
    const res = onExec(raw);
    if ((res.stdout as string) === '__CLEAR__') {
      setLines([{ type: 'hint', text: 'Cleared.' }]);
      return;
    }
    if (res.stderr) append([{ type: 'stderr', text: res.stderr }]);
    if (res.stdout) append([{ type: 'stdout', text: res.stdout }]);
  }, [onExec, append]);

  // external inject effect
  const lastInjectRef = useRef<string | null>(null);
  useEffect(() => {
    if (externalInject && externalInject !== lastInjectRef.current) {
      lastInjectRef.current = externalInject;
      execAndAppend(externalInject);
      // reset after handling so same command can be reinjected (handled by parent clearing)
    }
    if (!externalInject) lastInjectRef.current = null;
  }, [externalInject, execAndAppend]);

  const ALL_COMMANDS = [
    'git init', 'git status', 'git add', 'git add .', 'git commit -m ""', 'git log', 'git log --oneline', 'git log --oneline --graph --all',
    'git branch', 'git checkout', 'git checkout -b ', 'git switch', 'git switch -c ', 'git merge', 'git merge --abort', 'git rebase',
    'git diff', 'git diff --staged', 'git show', 'git remote -v', 'git fetch', 'git push', 'git pull', 'git clone', 'git reset --hard HEAD~1', 'git restore --staged ', 'git stash', 'git stash pop', 'git tag', 'git cherry-pick ', 'git revert ', 'clear'
  ];

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      execAndAppend(input);
      setInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!history.length) return;
      const nextIdx = histIdx === null ? history.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(nextIdx);
      setInput(history[nextIdx]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (histIdx === null) return;
      const nextIdx = histIdx + 1;
      if (nextIdx >= history.length) { setHistIdx(null); setInput(''); } else { setHistIdx(nextIdx); setInput(history[nextIdx]); }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const cand = ALL_COMMANDS.filter((c) => c.startsWith(input) && c !== input);
      if (cand.length === 1) setInput(cand[0]);
      else if (cand.length > 1) append([{ type: 'hint', text: cand.slice(0, 8).join('  ') }]);
    } else if (e.key === 'l' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setLines([{ type: 'hint', text: 'Cleared.' }]);
    }
  };

  return (
    <div className="flex h-full min-h-[240px] flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
          <span className="ml-2 font-mono text-[11px] uppercase tracking-wide text-zinc-400">Git Terminal</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">{headLabel || 'no branch'}</span>
          <button onClick={() => setLines([{ type: 'hint', text: 'Cleared.' }])} className="rounded px-2 py-0.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">clear</button>
        </div>
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-2 font-mono text-xs leading-5">
        {lines.map((l, i) => {
          if (l.type === 'input') return <div key={i} className="whitespace-pre-wrap text-sky-400">{l.text}</div>;
          if (l.type === 'stderr') return <div key={i} className="whitespace-pre-wrap text-red-400">{l.text}</div>;
          if (l.type === 'hint') return <div key={i} className="whitespace-pre-wrap text-zinc-500">{l.text}</div>;
          return <div key={i} className="whitespace-pre-wrap text-zinc-200">{l.text}</div>;
        })}
        <div className="mt-1 flex items-center gap-2">
          <span className="shrink-0 text-emerald-400">$</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="git status"
            spellCheck={false}
            autoComplete="off"
            className="flex-1 bg-transparent font-mono text-xs text-zinc-100 placeholder-zinc-600 outline-none"
          />
        </div>
      </div>
      <div className="border-t border-zinc-800 bg-zinc-900/50 px-3 py-1 text-[10px] text-zinc-500">↑/↓ history • Tab autocomplete • git help</div>
    </div>
  );
}

export default function GitSimulation(props: GitSimulationProps) {
  return (
    <ProgressProvider>
      <GitSimulationContent {...props} />
    </ProgressProvider>
  );
}
