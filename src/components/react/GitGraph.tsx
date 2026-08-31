import { useMemo } from 'react';
import type { GitState, Commit } from '../../lib/git/types';

interface GitGraphProps {
  state: GitState;
  onCommitClick?: (id: string) => void;
}

const BRANCH_COLORS: Record<string, string> = {
  main: '#0ea5e9', // sky
  'feature/login': '#10b981',
  'feature/foo': '#8b5cf6',
  'feature/ui': '#f59e0b',
  hotfix: '#ef4444',
  develop: '#06b6d4',
};

function colorForBranch(name: string): string {
  if (BRANCH_COLORS[name]) return BRANCH_COLORS[name];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const palette = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899'];
  return palette[hash % palette.length];
}

export default function GitGraph({ state, onCommitClick }: GitGraphProps) {
  const { commits, positions, branchColumns, lines, laneCount } = useMemo(() => {
    // collect commits to show: all, sorted by timestamp desc (newest top)
    const all = Array.from(state.commits.values()).sort((a, b) => b.timestamp - a.timestamp);
    const show = all.slice(0, 20);
    // branch columns
    const branchNames = Array.from(state.branches.keys());
    // ensure main first
    branchNames.sort((a, b) => {
      if (a === 'main') return -1;
      if (b === 'main') return 1;
      return a.localeCompare(b);
    });
    const colMap = new Map<string, number>();
    branchNames.forEach((n, i) => colMap.set(n, i));
    // include remote branch names not in local but for display they get next columns
    const remoteBranches: string[] = [];
    for (const remote of state.remotes.values()) {
      for (const rb of remote.branches.keys()) {
        const full = `${remote.name}/${rb}`;
        if (!colMap.has(full)) {
          colMap.set(full, colMap.size);
          remoteBranches.push(full);
        }
      }
    }
    const laneCount = colMap.size || 1;

    // positions
    const pos = new Map<string, { x: number; y: number; commit: Commit; col: number }>();
    show.forEach((c, idx) => {
      const y = 36 + idx * 44;
      // determine column: based on branchAtCreation if exists, else find branch that points to it
      let col = colMap.get(c.branchAtCreation) ?? 0;
      // if commit is merge commit, keep at current head's branch column? Already accounted
      // fallback: if we can find which branch currently targets this commit, use that
      let foundBranch: string | null = null;
      for (const [bName, br] of state.branches) {
        if (br.target === c.id) { foundBranch = bName; break; }
      }
      if (foundBranch) col = colMap.get(foundBranch) ?? col;
      const x = 28 + col * 56;
      pos.set(c.id, { x, y, commit: c, col });
    });

    // lines between commit and parents
    const lines: { x1: number; y1: number; x2: number; y2: number; color: string; dashed?: boolean }[] = [];
    for (const c of show) {
      const p = pos.get(c.id);
      if (!p) continue;
      for (const parentId of c.parents) {
        const pp = pos.get(parentId);
        if (!pp) continue;
        const colColor = colorForBranch(c.branchAtCreation);
        lines.push({ x1: p.x, y1: p.y, x2: pp.x, y2: pp.y, color: colColor });
      }
      // also vertical continuation lines per lane? For visual continuity, draw vertical line down to next commit in same column if gap
    }

    return { commits: show, positions: pos, branchColumns: colMap, lines, laneCount };
  }, [state.commits, state.branches, state.remotes]);

  // HEAD and branch decorations
  const headId = state.head ? state.branches.get(state.head)?.target ?? state.detachedCommit : state.detachedCommit;
  const decoMap = new Map<string, string[]>();
  for (const [name, br] of state.branches) {
    if (!br.target) continue;
    const arr = decoMap.get(br.target) ?? [];
    const label = state.head === name ? `HEAD -> ${name}` : name;
    arr.push(label);
    decoMap.set(br.target, arr);
  }
  for (const [rName, remote] of state.remotes) {
    for (const [rb, cid] of remote.branches) {
      if (!cid) continue;
      const arr = decoMap.get(cid) ?? [];
      arr.push(`${rName}/${rb}`);
      decoMap.set(cid, arr);
    }
  }
  for (const [tag, cid] of state.tags) {
    const arr = decoMap.get(cid) ?? [];
    arr.push(`tag: ${tag}`);
    decoMap.set(cid, arr);
  }

  const totalHeight = Math.max(220, commits.length * 44 + 60);
  const totalWidth = Math.max(360, 56 + laneCount * 56 + 220);

  // staging summary
  const staged = Array.from(state.workingDir.values()).filter((f) => f.status === 'staged').map((f) => f.path);
  const modified = Array.from(state.workingDir.values()).filter((f) => f.status === 'modified').map((f) => f.path);
  const untracked = Array.from(state.workingDir.values()).filter((f) => f.status === 'untracked').map((f) => f.path);

  const conflict = state.conflict;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {/* Header: branch lanes */}
      <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-1.5">
          {Array.from(branchColumns.entries()).map(([name]) => (
            <div key={name} className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: colorForBranch(name) }} />
              <span className={`rounded px-1 py-0.5 font-mono text-[10px] leading-none ${state.head === name ? 'bg-sky-600 text-white' : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}`}>
                {name}
                {state.head === name && headId ? ' • HEAD' : ''}
              </span>
            </div>
          ))}
          {state.remotes.size === 0 && <span className="ml-2 text-[11px] text-zinc-500">no remotes</span>}
          {Array.from(state.remotes.entries()).map(([rName]) => (
            <span key={rName} className="ml-1 rounded bg-zinc-200 px-1 py-0.5 font-mono text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              origin: {state.remotes.get(rName)?.url?.slice(0, 28) ?? rName}
            </span>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {conflict && <span className="rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">CONFLICT</span>}
          <span className="hidden text-[11px] text-zinc-500 md:inline">{commits.length} commit(s)</span>
        </div>
      </div>

      {/* Graph area */}
      <div className="relative min-h-[180px] flex-1 overflow-auto bg-white dark:bg-zinc-900">
        {commits.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 py-10 text-center">
            <div>
              <p className="font-mono text-sm text-zinc-500">No commits yet</p>
              <p className="mt-1 text-xs text-zinc-400">Run <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">git commit -m "message"</code> to create the first commit.</p>
            </div>
          </div>
        ) : (
          <svg width={totalWidth} height={totalHeight} className="block">
            {/* lane verticals faint */}
            {Array.from(branchColumns.values()).map((col) => (
              <line key={col} x1={28 + col * 56} y1={20} x2={28 + col * 56} y2={totalHeight - 20} stroke="#e4e4e7" strokeOpacity={0.6} strokeWidth={1} strokeDasharray="4 4" className="dark:opacity-20" />
            ))}
            {/* connections */}
            {lines.map((l, i) => (
              <g key={i}>
                <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={l.color} strokeWidth={2.5} strokeLinecap="round" opacity={0.9} />
              </g>
            ))}
            {/* commits */}
            {commits.map((c) => {
              const p = positions.get(c.id)!;
              const isHead = c.id === headId;
              const isMerge = c.parents.length > 1;
              const deco = decoMap.get(c.id) ?? [];
              const colColor = colorForBranch(c.branchAtCreation);
              return (
                <g key={c.id} onClick={() => onCommitClick?.(c.id)} className={onCommitClick ? 'cursor-pointer' : ''}>
                  {isMerge ? (
                    // diamond for merge
                    <g transform={`translate(${p.x},${p.y}) rotate(45)`}>
                      <rect x={-7} y={-7} width={14} height={14} fill={colColor} stroke={isHead ? '#18181b' : 'white'} strokeWidth={isHead ? 2 : 1.2} />
                    </g>
                  ) : (
                    <circle cx={p.x} cy={p.y} r={isHead ? 8 : 6} fill={colColor} stroke={isHead ? '#18181b' : 'white'} strokeWidth={isHead ? 2.5 : 1.2} className="dark:stroke-zinc-900" />
                  )}
                  {/* commit label */}
                  <text x={p.x + 18} y={p.y + 4} fontFamily="ui-monospace, monospace" fontSize={11} fill="#18181b" className="dark:fill-zinc-100">
                    {c.shortId} {c.message}
                  </text>
                  {deco.length > 0 && (
                    <text x={p.x + 18} y={p.y + 16} fontFamily="ui-monospace, monospace" fontSize={9} fill="#71717a">
                      ({deco.join(', ')})
                    </text>
                  )}
                </g>
              );
            })}
            {/* HEAD arrow */}
            {headId && positions.has(headId) && (
              <g>
                {(() => {
                  const p = positions.get(headId)!;
                  return (
                    <g transform={`translate(${p.x - 18}, ${p.y})`}>
                      <text x={0} y={-14} textAnchor="middle" fontSize={10} fill="#0ea5e9" fontWeight={600}>
                        HEAD
                      </text>
                      <path d="M0 -6 L -4 0 L 4 0 Z" fill="#0ea5e9" />
                    </g>
                  );
                })()}
              </g>
            )}
          </svg>
        )}
      </div>

      {/* Staging strip */}
      <div className="border-t border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          <span className="font-medium text-zinc-500">Staging:</span>
          {staged.length === 0 && <span className="text-zinc-400">none staged</span>}
          {staged.map((p) => (
            <span key={p} className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-emerald-700 dark:text-emerald-300">
              {p} ✓
            </span>
          ))}
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
          <span className="font-medium text-zinc-500">Modified:</span>
          {modified.length === 0 && <span className="text-zinc-400">clean</span>}
          {modified.map((p) => (
            <span key={p} className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-amber-700 dark:text-amber-300">
              {p}
            </span>
          ))}
          {untracked.length > 0 && (
            <>
              <span className="ml-2 font-medium text-zinc-500">Untracked:</span>
              {untracked.map((p) => (
                <span key={p} className="rounded bg-zinc-200 px-1.5 py-0.5 font-mono text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {p}
                </span>
              ))}
            </>
          )}
        </div>
        {conflict && (
          <div className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            Conflict in <span className="font-mono font-semibold">{conflict.path}</span> — resolve file, then <code className="rounded bg-white px-1 dark:bg-zinc-900">git add {conflict.path}</code> and commit.
          </div>
        )}
        <div className="mt-2 flex items-center gap-2 text-[10px] text-zinc-400">
          <span>click a commit to `git show`</span>
          <span className="ml-auto">working tree: {state.index.size} staged • {modified.length} modified • {untracked.length} untracked</span>
        </div>
      </div>
    </div>
  );
}
