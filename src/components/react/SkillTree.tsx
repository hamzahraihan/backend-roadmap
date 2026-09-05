import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  useReactFlow,
  useNodesState,
  useEdgesState,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Graph, layout } from '@dagrejs/dagre';
import { ResetIcon } from '@radix-ui/react-icons';
import { ProgressProvider, useProgressContext } from './ProgressProvider';
import type { SkillSummary } from '../../lib/skills';
import type { ProgressStatus } from '../../lib/progress';
import { useTheme } from '../../lib/theme';
import { CATEGORY_COLORS, buildNeighborhood, categoryColor } from '../../lib/skillGraph';

const NODE_WIDTH = 200;
const NODE_HEIGHT = 64;

type SkillNodeData = {
  skill: SkillSummary;
  status: ProgressStatus;
};

const STATUS_STYLES: Record<ProgressStatus, { ring: string; badge: string; label: string }> = {
  'not-started': { ring: 'border-sky-500/60', badge: 'bg-sky-500/15 text-sky-300', label: 'Available' },
  'in-progress': { ring: 'border-amber-500/60', badge: 'bg-amber-500/15 text-amber-300', label: 'In progress' },
  completed: { ring: 'border-emerald-500/60', badge: 'bg-emerald-500/15 text-emerald-300', label: 'Completed' },
};

function SkillNode({ data }: NodeProps) {
  const { skill, status } = data as unknown as SkillNodeData;
  const style = STATUS_STYLES[status];
  return (
    <div
      className={`relative w-[200px] cursor-pointer rounded-lg border-2 bg-white p-3 shadow-lg transition hover:border-zinc-500 dark:bg-zinc-900/90 ${style.ring}`}
    >
      <span
        className="absolute left-2 top-2 h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: categoryColor(skill.category) }}
        title={skill.category}
      />
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !border-0 !bg-zinc-500"
      />
       <div className="truncate pl-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{skill.title}</div>
      <div className="mt-1 flex items-center justify-between">
        <span className="text-xs text-zinc-500">{skill.category}</span>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${style.badge}`}
        >
          {style.label}
        </span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !border-0 !bg-zinc-500"
      />
    </div>
  );
}

const nodeTypes = { skill: SkillNode };

interface SkillTreeProps {
  skills: SkillSummary[];
}

function SkillSearch({ skills, onPick }: { skills: SkillSummary[]; onPick: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const matches =
    query.trim().length === 0
      ? []
      : skills.filter((s) => s.title.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6);
  return (
    <div className="relative">
      <input
        value={query}
        aria-label="Search skills"
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && matches.length > 0) {
            onPick(matches[0].id);
            setQuery('');
          } else if (e.key === 'Escape') {
            setQuery('');
          }
        }}
        placeholder="Search skills…"
        spellCheck={false}
        autoComplete="off"
        className="w-44 rounded border border-zinc-300 bg-white/90 px-2.5 py-1 text-xs text-zinc-800 placeholder-zinc-400 outline-none focus:border-sky-500 dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-100"
      />
      {query.trim().length > 0 && (
        <div className="absolute left-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
          {matches.length === 0 ? (
            <button
              disabled
              className="block w-full cursor-default px-3 py-1.5 text-left text-xs text-zinc-400 dark:text-zinc-500"
            >
              No matches
            </button>
          ) : (
            matches.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                onPick(m.id);
                setQuery('');
              }}
              className="block w-full px-3 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {m.title}
            </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function applyDim(
  nodes: Node[],
  edges: Edge[],
  neighborhood: Set<string> | null,
  disabledCats: Set<string>,
  colorById: Map<string, string>,
  categoryById: Map<string, string>,
): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: nodes.map((n) => ({
      ...n,
      style: {
        ...n.style,
        opacity:
          (!neighborhood || neighborhood.has(n.id)) &&
          !disabledCats.has((n.data as unknown as SkillNodeData).skill.category)
            ? 1
            : 0.15,
      },
    })),
    edges: edges.map((e) => {
      const lit =
        (!neighborhood || (neighborhood.has(e.source) && neighborhood.has(e.target))) &&
        !disabledCats.has(categoryById.get(e.source) ?? '') &&
        !disabledCats.has(categoryById.get(e.target) ?? '');
      const col = colorById.get(e.target) ?? '#a1a1aa';
      return {
        ...e,
        style: { stroke: lit ? col : '#3f3f46', strokeWidth: lit ? 2.5 : 1, opacity: lit ? 1 : 0.25 },
        markerEnd: { type: MarkerType.ArrowClosed, color: lit ? col : '#3f3f46' },
        className: lit ? e.className : undefined,
      };
    }),
  };
}

function SkillTreeContent({ skills }: SkillTreeProps) {
  const { getStatus, clearProgress } = useProgressContext();
  const theme = useTheme();
  const { setCenter, flowToScreenPosition, getNode } = useReactFlow();

  const deriveStatus = useCallback(
    (skill: SkillSummary): ProgressStatus => getStatus(skill.id),
    [getStatus],
  );

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const g = new Graph();
    g.setGraph({ rankdir: 'TB', nodesep: 110, ranksep: 150, edgesep: 30, marginx: 40, marginy: 40 });
    g.setDefaultEdgeLabel(() => ({}));
    skills.forEach((s) => g.setNode(s.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
    skills.forEach((s) => s.dependsOn.forEach((dep) => g.setEdge(dep, s.id)));
    layout(g);

    const nodeList: Node[] = skills.map((s) => {
      const pos = g.node(s.id);
      return {
        id: s.id,
        type: 'skill',
        position: {
          x: (pos?.x ?? 0) - NODE_WIDTH / 2,
          y: (pos?.y ?? 0) - NODE_HEIGHT / 2,
        },
        data: { skill: s, status: deriveStatus(s) } satisfies SkillNodeData,
      };
    });

    const edgeList: Edge[] = [];
    skills.forEach((s) =>
      s.dependsOn.forEach((dep) => {
        edgeList.push({
          id: `${dep}-${s.id}`,
          source: dep,
          target: s.id,
          type: 'smoothstep',
          markerEnd: { type: MarkerType.ArrowClosed, color: '#a1a1aa' },
          style: { stroke: '#a1a1aa', strokeWidth: 1.5 },
        });
      }),
    );

    return { nodes: nodeList, edges: edgeList };
  }, [skills, deriveStatus]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const effectiveSelectedId = skills.some((s) => s.id === selectedId) ? selectedId : null;

  const colorById = useMemo(
    () => new Map(skills.map((s) => [s.id, categoryColor(s.category)])),
    [skills],
  );

  const categoryById = useMemo(() => new Map(skills.map((s) => [s.id, s.category])), [skills]);

  const neighborhood = useMemo(
    () => (effectiveSelectedId ? buildNeighborhood(skills, effectiveSelectedId) : null),
    [skills, effectiveSelectedId],
  );

  const allCategories = useMemo(() => [...new Set(skills.map((s) => s.category))], [skills]);
  const [disabledCats, setDisabledCats] = useState<Set<string>>(new Set());

  // Re-sync when underlying skill data or progress changes.
  useEffect(() => {
    const dimmed = applyDim(initialNodes, initialEdges, neighborhood, disabledCats, colorById, categoryById);
    setNodes(dimmed.nodes);
    setEdges(dimmed.edges);
  }, [initialNodes, initialEdges, neighborhood, disabledCats, colorById, categoryById, setNodes, setEdges]);

  const toggleCat = useCallback((cat: string) => {
    setDisabledCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  // Dim everything outside the selected neighborhood; light the neighborhood.
  useEffect(() => {
    setNodes((ns) => applyDim(ns, [], neighborhood, disabledCats, colorById, categoryById).nodes);
    setEdges((es) => applyDim([], es, neighborhood, disabledCats, colorById, categoryById).edges);
  }, [neighborhood, colorById, categoryById, setNodes, setEdges, disabledCats]);

  const [, setViewportTick] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const completedCount = useMemo(
    () => skills.filter((s) => getStatus(s.id) === 'completed').length,
    [skills, getStatus],
  );

  const onNodeClick = useCallback((_: MouseEvent, node: Node) => {
    setSelectedId(node.id);
  }, []);

  const onNodeDoubleClick = useCallback((_: MouseEvent, node: Node) => {
    window.location.href = `/skill/${node.id}`;
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedId(null);
  }, []);

  const onNodeMouseEnter = useCallback(
    (_: MouseEvent, node: Node) => {
      setEdges((eds) =>
        eds.map((e) => ({
          ...e,
          className:
            (e.source === node.id || e.target === node.id) && e.style?.opacity === 1
              ? 'skill-edge-dots'
              : undefined,
        })),
      );
    },
    [setEdges],
  );

  const onNodeMouseLeave = useCallback(() => {
    setEdges((eds) => eds.map((e) => ({ ...e, className: undefined })));
  }, [setEdges]);

  return (
    <div ref={wrapperRef} className="relative h-full w-full">
      <div className="pointer-events-none absolute left-4 top-4 z-10 flex max-w-[60%] flex-col gap-2">
        <div className="pointer-events-auto flex flex-wrap gap-1.5 rounded bg-white/80 p-2 dark:bg-zinc-900/80">
          <button
            onClick={() => setDisabledCats(new Set())}
            className="rounded-full border border-zinc-300 px-2.5 py-0.5 text-[11px] text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            All
          </button>
          {allCategories.map((cat) => {
            const off = disabledCats.has(cat);
            return (
              <button
                key={cat}
                onClick={() => toggleCat(cat)}
                aria-pressed={!off}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] transition ${
                  off
                    ? 'border-zinc-300 text-zinc-400 opacity-60 dark:border-zinc-700 dark:text-zinc-500'
                    : 'border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: categoryColor(cat) }} />
                {cat}
              </button>
            );
          })}
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <SkillSearch
            skills={skills}
            onPick={(id) => {
              const node = getNode(id);
              if (node) setCenter(node.position.x + NODE_WIDTH / 2, node.position.y + NODE_HEIGHT / 2, { zoom: 1, duration: 400 });
              setSelectedId(id);
              const picked = skills.find((s) => s.id === id);
              if (picked) {
                setDisabledCats((prev) => {
                  if (!prev.has(picked.category)) return prev;
                  const next = new Set(prev);
                  next.delete(picked.category);
                  return next;
                });
              }
            }}
          />
          <span className="rounded bg-white/80 px-2 py-1 font-mono text-[11px] text-zinc-500 dark:bg-zinc-900/80 dark:text-zinc-400">
            {completedCount} / {skills.length} completed
          </span>
        </div>
      </div>
       <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onPaneClick={onPaneClick}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onMove={() => selectedId && setViewportTick((t) => t + 1)}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={1.5}
        colorMode={theme === 'dark' ? 'dark' : 'light'}
        proOptions={{ hideAttribution: false }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color={theme === 'dark' ? '#27272a' : '#e4e4e7'}
        />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            const d = node.data as SkillNodeData;
            if (!d) return '#3f3f46';
            return d.status === 'completed'
              ? '#10b981'
              : d.status === 'in-progress'
                ? '#f59e0b'
                : '#0ea5e9';
          }}
          maskColor={theme === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)'}
        />
      </ReactFlow>
      {effectiveSelectedId &&
        (() => {
          const node = getNode(effectiveSelectedId);
          const skill = skills.find((s) => s.id === effectiveSelectedId);
          if (!node || !skill) return null;
          const screen = flowToScreenPosition({
            x: node.position.x + NODE_WIDTH / 2,
            y: node.position.y,
          });
          const rect = wrapperRef.current?.getBoundingClientRect();
          const anchorX = rect ? screen.x - rect.left : screen.x;
          const anchorY = rect ? screen.y - rect.top : screen.y;
          const width = rect?.width ?? anchorX + 132;
          const left = Math.min(Math.max(anchorX, 132), Math.max(132, width - 132));
          const below = anchorY < 160;
          const status = getStatus(skill.id);
          const statusStyle = STATUS_STYLES[status];
          return (
            <div
              className={`absolute z-20 w-64 -translate-x-1/2 rounded-lg border border-zinc-200 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 ${below ? '' : '-translate-y-full'}`}
              style={{ left, top: below ? anchorY + 12 : anchorY - 12 }}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{skill.title}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
                    <span>{skill.category}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${statusStyle.badge}`}
                    >
                      {statusStyle.label}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedId(null)}
                  aria-label="Close"
                  className="rounded px-1.5 py-0.5 text-xs text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
                >
                  ✕
                </button>
              </div>
              <a
                href={`/skill/${skill.id}`}
                className="mt-2 inline-flex items-center gap-1 rounded bg-sky-600 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-500"
              >
                Open →
              </a>
            </div>
          );
        })()}
      <div className="absolute right-4 top-4 z-10 flex flex-col items-end gap-2">
        <div className="flex flex-wrap justify-end gap-2 rounded bg-white/80 p-2 dark:bg-zinc-900/80">
          {[
            { label: 'Available', cls: 'border-sky-500/60' },
            { label: 'In progress', cls: 'border-amber-500/60' },
            { label: 'Completed', cls: 'border-emerald-500/60' },
          ].map((i) => (
            <span key={i.label} className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
              <span className={`h-2.5 w-2.5 rounded-sm border-2 ${i.cls} bg-white dark:bg-zinc-900`} />
              {i.label}
            </span>
          ))}
        </div>
        <details className="rounded bg-white/80 p-2 dark:bg-zinc-900/80">
          <summary className="cursor-pointer text-[11px] text-zinc-500 dark:text-zinc-400">Categories</summary>
          <div className="mt-1.5 grid max-h-48 grid-cols-2 gap-1 overflow-y-auto">
            {Object.entries(CATEGORY_COLORS).map(([cat, hex]) => (
              <span key={cat} className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: hex }} />
                {cat}
              </span>
            ))}
          </div>
        </details>
        <button
          onClick={clearProgress}
          className="inline-flex items-center gap-1.5 rounded bg-zinc-100 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          <ResetIcon width={13} height={13} className="shrink-0" aria-hidden />
          Reset progress
        </button>
      </div>
    </div>
  );
}

export default function SkillTree({ skills }: SkillTreeProps) {
  return (
    <ProgressProvider>
      <ReactFlowProvider>
        <SkillTreeContent skills={skills} />
      </ReactFlowProvider>
    </ProgressProvider>
  );
}