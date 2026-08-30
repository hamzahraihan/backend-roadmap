import { useCallback, useMemo, type MouseEvent } from 'react';
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
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Graph, layout } from '@dagrejs/dagre';
import { ProgressProvider, useProgressContext } from './ProgressProvider';
import type { SkillSummary } from '../../lib/skills';
import type { ProgressStatus } from '../../lib/progress';
import { useTheme } from '../../lib/theme';

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
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !border-0 !bg-zinc-500"
      />
       <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{skill.title}</div>
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

function SkillTreeContent({ skills }: SkillTreeProps) {
  const { getStatus, clearProgress } = useProgressContext();
  const theme = useTheme();
  const { setEdges } = useReactFlow();

  const deriveStatus = useCallback(
    (skill: SkillSummary): ProgressStatus => getStatus(skill.id),
    [getStatus],
  );

  const { nodes, edges } = useMemo(() => {
    const g = new Graph();
    g.setGraph({ rankdir: 'TB', nodesep: 80, ranksep: 120 });
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
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: '#71717a', strokeWidth: 3 },
        });
      }),
    );

    return { nodes: nodeList, edges: edgeList };
  }, [skills, deriveStatus]);

  const onNodeClick = useCallback((_: MouseEvent, node: Node) => {
    window.location.href = `/skill/${node.id}`;
  }, []);

  const onNodeMouseEnter = useCallback(
    (_: MouseEvent, node: Node) => {
      setEdges((eds) =>
        eds.map((e) => ({
          ...e,
          className: e.source === node.id || e.target === node.id ? 'skill-edge-dots' : undefined,
        })),
      );
    },
    [setEdges],
  );

  const onNodeMouseLeave = useCallback(() => {
    setEdges((eds) => eds.map((e) => ({ ...e, className: undefined })));
  }, [setEdges]);

  return (
    <div className="h-full w-full">
       <ReactFlow
        defaultNodes={nodes}
        defaultEdges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
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
        <button
          onClick={clearProgress}
          className="rounded bg-zinc-100 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
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