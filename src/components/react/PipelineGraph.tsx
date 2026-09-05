import { CheckIcon, CrossCircledIcon } from '@radix-ui/react-icons';
import type { PipelineState } from '../../lib/pipeline/types';

const ORDER = ['build', 'test', 'scan', 'deploy'] as const;

const STATUS_STYLE: Record<string, string> = {
  idle: 'border-zinc-300 bg-white text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400',
  running: 'border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  pass: 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  fail: 'border-red-500 bg-red-500/10 text-red-600 dark:text-red-400',
};

export default function PipelineGraph({ state }: { state: PipelineState }) {
  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-zinc-500">run #{state.runId} → {state.environment}</span>
        {state.deployed && (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
            <CheckIcon width={11} height={11} aria-hidden />Deployed
          </span>
        )}
      </div>
      {ORDER.map((id, i) => {
        const st = state.stages[id];
        return (
          <div key={id}>
            <div className={`rounded border px-3 py-2 ${STATUS_STYLE[st.status]}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold capitalize">{i + 1}. {id}</span>
                <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                  {st.status === 'pass' && <CheckIcon width={11} height={11} aria-hidden />}
                  {st.status === 'fail' && <CrossCircledIcon width={11} height={11} aria-hidden />}
                  {st.status} · {st.attempts} attempt{st.attempts === 1 ? '' : 's'}
                </span>
              </div>
              {st.logs.length > 0 && (
                <div className="mt-1 font-mono text-[11px] opacity-80">{st.logs[st.logs.length - 1]}</div>
              )}
            </div>
            {i < ORDER.length - 1 && <div className="mx-auto h-3 w-px bg-zinc-300 dark:bg-zinc-700" aria-hidden />}
          </div>
        );
      })}
    </div>
  );
}
