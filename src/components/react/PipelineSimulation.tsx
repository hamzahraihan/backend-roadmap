import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckIcon, QuestionMarkCircledIcon, ResetIcon } from '@radix-ui/react-icons';
import { PipelineEngine } from '../../lib/pipeline/engine';
import { clonePresetState, getPreset } from '../../lib/pipeline/presets';
import { PIPELINE_CHEAT_SHEET, PIPELINE_GROUP_ORDER } from '../../lib/pipeline/helpText';
import type { PipelineState } from '../../lib/pipeline/types';
import PipelineGraph from './PipelineGraph';
import ResizableSplit from './ResizableSplit';
import { ProgressProvider, useProgressContext } from './ProgressProvider';

interface PipelineSimulationProps {
  skillId: string;
}

function PipelineSimulationContent({ skillId }: PipelineSimulationProps) {
  const { getStatus, setStatus } = useProgressContext();
  const status = getStatus(skillId);
  const preset = useMemo(() => getPreset(skillId) ?? getPreset('free'), [skillId]);
  const initial = useMemo(() => clonePresetState(preset!.id) ?? clonePresetState('free')!, [preset]);

  const [state, setState] = useState<PipelineState>(() => initial);
  const engineRef = useRef<PipelineEngine>(new PipelineEngine(initial));
  const [injectCmd, setInjectCmd] = useState<string | null>(null);
  const [showCheat, setShowCheat] = useState(false);
  const [hasWon, setHasWon] = useState(false);
  const [direction, setDirection] = useState<'vertical' | 'horizontal'>('vertical');

  useEffect(() => {
    engineRef.current = new PipelineEngine(state);
  }, [state]);

  useEffect(() => {
    if (!preset) return;
    setHasWon(preset.objective.winCondition(state));
  }, [state, preset]);

  const handleExec = useCallback((raw: string) => {
    const engine = engineRef.current;
    const { result, newState } = engine.exec(raw);
    setState(newState);
    engineRef.current.state = newState;
    return result;
  }, []);

  const handleReset = useCallback(() => {
    const cloned = clonePresetState(preset!.id);
    if (cloned) {
      setState(cloned);
      setHasWon(false);
    }
  }, [preset]);

  const handleInject = useCallback((cmd: string) => {
    setInjectCmd(cmd);
    setTimeout(() => setInjectCmd(null), 0);
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-50 dark:bg-zinc-950">
      <div className="shrink-0 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">Pipeline Simulation</span>
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{preset?.objective.title}</span>
              {hasWon && <span className="inline-flex items-center gap-1 rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white"><CheckIcon width={11} height={11} aria-hidden />Objective met</span>}
            </div>
            <p className="mt-1 max-w-[60ch] text-xs leading-5 text-zinc-600 dark:text-zinc-400">{preset?.objective.description}</p>
            <p className="mt-1 font-mono text-xs text-zinc-500 dark:text-zinc-500">Hint: {preset?.objective.hint}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <div className="flex overflow-hidden rounded border border-zinc-200 dark:border-zinc-700" role="tablist" aria-label="Graph direction">
              {(['vertical', 'horizontal'] as const).map((d) => (
                <button
                  key={d}
                  role="tab"
                  aria-selected={direction === d}
                  title={d === 'vertical' ? 'Top-down view' : 'Left-to-right view'}
                  onClick={() => setDirection(d)}
                  className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium capitalize transition ${direction === d ? 'bg-sky-600 text-white' : 'bg-white text-zinc-500 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'}`}
                >
                  {d === 'vertical' ? '↕ Top-down' : '↔ Horizontal'}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowCheat((v) => !v)}
              className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition ${showCheat ? 'bg-sky-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'}`}
            >
              <QuestionMarkCircledIcon width={13} height={13} className="shrink-0" aria-hidden />
              Cheat sheet
            </button>
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1 rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              <ResetIcon width={13} height={13} className="shrink-0" aria-hidden />
              Reset run
            </button>
            <button
              onClick={() => setStatus(skillId, status === 'completed' ? 'in-progress' : 'completed')}
              className={`inline-flex items-center gap-1 rounded px-3 py-1 text-xs font-semibold transition ${status === 'completed' || hasWon ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'}`}
            >
              {(status === 'completed' || hasWon) && <CheckIcon width={13} height={13} className="shrink-0" aria-hidden />}
              {status === 'completed' ? 'Completed' : 'Mark complete'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <ResizableSplit
          storageKey="backend-roadmap:split:pipe-inner"
          defaultPct={50}
          minPct={30}
          maxPct={70}
          left={
            <div className="flex min-h-[280px] h-full flex-col p-2 lg:p-3">
              <PipelineGraph state={state} direction={direction} />
            </div>
          }
          right={
            <div className="flex min-h-[260px] h-full flex-col p-2 lg:p-3">
              <PipelineTerminal onExec={handleExec} injectCmd={injectCmd} runId={state.runId} />
            </div>
          }
        />
      </div>

      {showCheat && (
        <div className="max-h-[50vh] overflow-auto border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="grid gap-4 p-4 md:grid-cols-3">
            {PIPELINE_GROUP_ORDER.map((group) => (
              <div key={group}>
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{group}</div>
                <div className="mt-2 flex flex-col gap-1.5">
                  {PIPELINE_CHEAT_SHEET.filter((it) => it.group === group).map((it) => (
                    <button
                      key={it.command}
                      onClick={() => handleInject(it.example)}
                      className="rounded border border-zinc-200 px-2 py-1.5 text-left hover:border-sky-500/60 hover:bg-sky-500/10 dark:border-zinc-700"
                    >
                      <div className="font-mono text-[11px] font-semibold text-zinc-800 dark:text-zinc-100">{it.command}</div>
                      <div className="text-[11px] text-zinc-500">{it.explanation}</div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Terminal: same injectable pattern as GitSimulation's InjectableGitTerminal,
// retitled for pipelines. Commands: pipe run [stage], pipe retry <stage>,
// pipe status, pipe logs <stage>, pipe reset, clear.
function PipelineTerminal({ onExec, injectCmd, runId }: {
  onExec: (c: string) => { stdout: string; stderr: string; exitCode: number };
  injectCmd: string | null;
  runId: number;
}) {
  const [lines, setLines] = useState<{ type: 'input' | 'stdout' | 'stderr' | 'hint'; text: string }[]>([
    { type: 'hint', text: 'Pipeline terminal — type `pipe status` to start. ↑/↓ history, Tab autocomplete, `clear` to reset.' },
  ]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const append = useCallback((newLines: { type: 'input' | 'stdout' | 'stderr' | 'hint'; text: string }[]) => {
    setLines((prev) => [...prev, ...newLines]);
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [lines]);

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

  const lastInjectRef = useRef<string | null>(null);
  useEffect(() => {
    if (injectCmd && injectCmd !== lastInjectRef.current) {
      lastInjectRef.current = injectCmd;
      execAndAppend(injectCmd);
    }
    if (!injectCmd) lastInjectRef.current = null;
  }, [injectCmd, execAndAppend]);

  const ALL_COMMANDS = [
    'pipe run', 'pipe run build', 'pipe run test', 'pipe run scan', 'pipe run deploy',
    'pipe retry test', 'pipe retry build', 'pipe retry scan', 'pipe retry deploy',
    'pipe status', 'pipe logs build', 'pipe logs test', 'pipe logs scan', 'pipe logs deploy',
    'pipe reset', 'clear',
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
          <span className="ml-2 font-mono text-[11px] uppercase tracking-wide text-zinc-400">Pipeline Terminal</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">run #{runId}</span>
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
            placeholder="pipe status"
            spellCheck={false}
            autoComplete="off"
            className="flex-1 bg-transparent font-mono text-xs text-zinc-100 placeholder-zinc-600 outline-none"
          />
        </div>
      </div>
      <div className="border-t border-zinc-800 bg-zinc-900/50 px-3 py-1 text-[10px] text-zinc-500">↑/↓ history • Tab autocomplete • pipe help</div>
    </div>
  );
}

export default function PipelineSimulation(props: PipelineSimulationProps) {
  return (
    <ProgressProvider>
      <PipelineSimulationContent {...props} />
    </ProgressProvider>
  );
}
