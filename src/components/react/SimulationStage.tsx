import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  NodeResizer,
  Position,
  MarkerType,
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useUpdateNodeInternals,
  type Connection,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  ActivityLogIcon,
  BarChartIcon,
  ChatBubbleIcon,
  CheckCircledIcon,
  CheckIcon,
  ClockIcon,
  CopyIcon,
  Cross1Icon,
  CrossCircledIcon,
  CubeIcon,
  EnterFullScreenIcon,
  ExclamationTriangleIcon,
  FrameIcon,
  GroupIcon,
  LightningBoltIcon,
  Link2Icon,
  MagnifyingGlassIcon,
  MinusIcon,
  PauseIcon,
  Pencil2Icon,
  PlayIcon,
  PlusIcon,
  QuestionMarkCircledIcon,
  ReloadIcon,
  ResetIcon,
  TargetIcon,
  TimerIcon,
  TrackNextIcon,
  TrashIcon,
} from '@radix-ui/react-icons';
import { simulateTraffic, validateTopology } from '../../lib/design/engine';
import { createRun, type RequestTrace, type RunEvent, type RunHandle, type RunSummary } from '../../lib/design/player';
import { checkRunObjective, getPreset, initialStateFor, sloFor, starterNode } from '../../lib/design/presets';
import { timelineFor } from '../../lib/design/timelines';
import { DESIGN_KIND_LABELS, type DesignKind } from '../../lib/design/types';
import ResizableSplit from './ResizableSplit';
import { ProgressProvider, useProgressContext } from './ProgressProvider';
import { t, useUILocale } from '../../lib/i18n';
import { useTheme } from '../../lib/theme';

type CanvasNodeData = {
  kind: DesignKind;
  label: string;
  bottleneck?: boolean;
  failed?: boolean;
  queued?: number;
  direction?: FlowDirection;
  [key: string]: unknown;
};

type FlowDirection = 'vertical' | 'horizontal';

function layoutPos(i: number, direction: FlowDirection): { x: number; y: number } {
  return direction === 'horizontal'
    ? { x: i * 250, y: 60 + (i % 2) * 150 }
    : { x: 60 + (i % 2) * 220, y: i * 130 };
}
/** Figma-style annotation nodes. Notes/sections never enter the sim topology. */
export type SectionColor = 'blue' | 'green' | 'amber' | 'purple' | 'red';

export interface NoteNodeData {
  text: string;
  color: string;
  [key: string]: unknown;
}

export interface SectionNodeData {
  title: string;
  color: SectionColor;
  [key: string]: unknown;
}

export const SECTION_STYLES: Record<SectionColor, { border: string; bg: string; chip: string }> = {
  blue: { border: 'border-sky-500/70', bg: 'bg-sky-500/[0.07]', chip: 'bg-sky-500/90' },
  green: { border: 'border-emerald-500/70', bg: 'bg-emerald-500/[0.07]', chip: 'bg-emerald-500/90' },
  amber: { border: 'border-amber-500/70', bg: 'bg-amber-500/[0.07]', chip: 'bg-amber-500/90' },
  purple: { border: 'border-violet-500/70', bg: 'bg-violet-500/[0.07]', chip: 'bg-violet-500/90' },
  red: { border: 'border-red-500/70', bg: 'bg-red-500/[0.07]', chip: 'bg-red-500/90' },
};

export const NOTE_COLORS = ['#fcd34d', '#7dd3fc', '#6ee7b7', '#f9a8d4', '#c4b5fd'];

const PALETTE_GROUPS: { title: string; items: DesignKind[] }[] = [
  { title: 'Edge', items: ['client', 'dns', 'cdn', 'waf', 'lb', 'gateway'] },
  { title: 'Logic', items: ['app', 'auth', 'ratelimit', 'search'] },
  { title: 'Data', items: ['sql', 'nosql', 'cache', 'storage', 'queue'] },
];

const KIND_ACCENT: Record<DesignKind, string> = {
  client: '#38bdf8',
  dns: '#38bdf8',
  cdn: '#38bdf8',
  waf: '#38bdf8',
  lb: '#38bdf8',
  gateway: '#38bdf8',
  ratelimit: '#f59e0b',
  auth: '#a78bfa',
  app: '#a78bfa',
  cache: '#34d399',
  search: '#a78bfa',
  sql: '#34d399',
  nosql: '#34d399',
  queue: '#34d399',
  storage: '#34d399',
};


/** Bridge so inline note/section editors can bracket one undo step per edit session. */
export const studioEditBridge: { begin: (() => void) | null; end: (() => void) | null } = { begin: null, end: null };


function DesignCanvasNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as CanvasNodeData;
  const horizontal = d.direction === 'horizontal';
  const updateNodeInternals = useUpdateNodeInternals();
  const { deleteElements } = useReactFlow();
  const locale = useUILocale();
  // Handle sides flip with direction — React Flow caches handle geometry, so
  // it must be notified or edges stay glued to the stale side (detached lines).
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, horizontal, updateNodeInternals]);
  return (
    <div
      className={`relative w-[150px] rounded-lg border-2 bg-white p-2 shadow-lg transition dark:bg-zinc-900/90 ${
        d.failed
          ? 'border-red-500/70 opacity-80'
          : d.bottleneck
            ? 'border-amber-500/70'
            : selected
              ? 'border-sky-500/70'
              : 'border-zinc-300 dark:border-zinc-700'
      }`}
    >
      <Handle type="target" position={horizontal ? Position.Left : Position.Top} className="!h-2 !w-2 !border-0 !bg-zinc-500" />
      <div className="flex items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: KIND_ACCENT[d.kind] }} aria-hidden />
          <div className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100">{d.label}</div>
        </div>
        {d.failed && <Cross1Icon width={10} height={10} className="shrink-0 text-red-500" aria-hidden />}
      </div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-zinc-500">{DESIGN_KIND_LABELS[d.kind]}</div>
      {(d.queued ?? 0) > 0 && (
        <div className="mt-1.5" aria-label={`${d.queued} requests queued`}>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
            <div
              className={`h-full rounded-full transition-[width] duration-300 ${d.failed ? 'bg-red-500' : (d.queued ?? 0) > 20 ? 'bg-amber-500' : 'bg-sky-500'}`}
              style={{ width: `${Math.min(100, ((d.queued ?? 0) / 50) * 100)}%` }}
            />
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-zinc-500">Queued {d.queued}</div>
        </div>
      )}
      <Handle type="source" position={horizontal ? Position.Right : Position.Bottom} className="!h-2 !w-2 !border-0 !bg-zinc-500" />
      {selected && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            deleteElements({ nodes: [{ id }] });
          }}
          aria-label={t(locale, 'deleteComponent')}
          title={t(locale, 'deleteComponent')}
          className="nodrag nopan absolute -right-2 -top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-600 text-white shadow hover:bg-red-500 dark:bg-zinc-300 dark:text-zinc-900 dark:hover:bg-red-400"
        >
          <Cross1Icon width={10} height={10} aria-hidden />
        </button>
      )}
    </div>
  );
}
function NoteNode({ data, selected }: NodeProps) {
  const d = data as unknown as NoteNodeData;
  const { setNodes } = useReactFlow();
  return (
    <div
      className={`relative h-full w-full rounded-md p-2 shadow-lg transition ${selected ? 'ring-2 ring-sky-500' : 'ring-1 ring-black/20'}`}
      style={{ background: d.color, minWidth: 140, minHeight: 100 }}
    >
      <NodeResizer isVisible={selected} minWidth={140} minHeight={100} lineClassName="!border-sky-500" handleClassName="!h-2 !w-2 !border-0 !bg-sky-500" />
      <textarea
        value={d.text}
        rows={4}
        placeholder="Double-click canvas note…"
        aria-label="Canvas note"
        onFocus={() => studioEditBridge.begin?.()}
        onBlur={() => studioEditBridge.end?.()}
        onChange={(e) => {
          const text = e.target.value;
          setNodes((nds) => nds.map((n) => (n.data === data ? { ...n, data: { ...n.data, text } } : n)));
        }}
        className="nodrag h-full w-full resize-none bg-transparent text-xs leading-4 text-zinc-900 outline-none placeholder:text-zinc-900/40"
      />
    </div>
  );
}

function SectionNode({ data, selected }: NodeProps) {
  const d = data as unknown as SectionNodeData;
  const { setNodes } = useReactFlow();
  const style = SECTION_STYLES[d.color] ?? SECTION_STYLES.blue;
  return (
    <div className={`relative h-full w-full rounded-xl border-2 ${style.border} ${style.bg} transition ${selected ? 'ring-2 ring-sky-500/60' : ''}`}>
      <NodeResizer isVisible={selected} minWidth={280} minHeight={160} lineClassName="!border-sky-500" handleClassName="!h-2 !w-2 !border-0 !bg-sky-500" />
      <div className="absolute -top-3 left-3 flex items-center gap-1">
        <input
          value={d.title}
          aria-label="Section title"
          onFocus={() => studioEditBridge.begin?.()}
          onBlur={() => studioEditBridge.end?.()}
          onChange={(e) => {
            const title = e.target.value;
            setNodes((nds) => nds.map((n) => (n.data === data ? { ...n, data: { ...n.data, title } } : n)));
          }}
          className={`nodrag rounded px-2 py-0.5 text-[11px] font-semibold text-white outline-none ${style.chip}`}
          style={{ width: `${Math.max(80, d.title.length * 7 + 24)}px` }}
        />
      </div>
    </div>
  );
}

const nodeTypes = { design: DesignCanvasNode, note: NoteNode, section: SectionNode };

export type FlowEdgeData = {
  /** 0..1 traffic intensity from live sim snapshot — drives dash speed + pulse count */
  flow?: number;
  /** downstream endpoint is failed/degraded */
  failed?: boolean;
  /** measured edge crossings per simulated second over the last flush window */
  rps?: number;
  [key: string]: unknown;
};

function formatRps(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return '0/s';
  if (v < 1000) return `${Math.round(v)}/s`;
  return `${(v / 1000).toFixed(1)}k/s`;
}

/**
 * In-viewport flow edge. All geometry comes from React Flow's own edge props,
 * so dashes and pulses ride the wire exactly under any pan/zoom/fitView —
 * no manual coordinate projection. Motion is declarative (CSS dash flow +
 * SMIL pulses), so it stays smooth between sim updates.
 */
function FlowEdge({
  id,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  markerEnd,
  selected,
  data,
}: EdgeProps) {
  const { deleteElements } = useReactFlow();
  const locale = useUILocale();
  const d = (data ?? {}) as FlowEdgeData;
  const flow = Math.min(1, Math.max(0, d.flow ?? 0));
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  const rps = d.rps ?? 0;
  const reduceMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animated = !reduceMotion && flow > 0.02;
  const stroke = d.failed ? '#f87171' : flow > 0.66 ? '#f59e0b' : '#71717a';
  const pulses = !animated ? [] : flow > 0.66 ? [0, -0.3, -0.6] : flow > 0.33 ? [0, -0.7] : [0];
  const dur = flow > 0.66 ? 0.9 : flow > 0.33 ? 1.4 : 2.2;
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={{ stroke, strokeWidth: d.failed ? 3 : 2.5 }} />
      {animated && (
        <path
          d={path}
          fill="none"
          stroke={d.failed ? '#f87171' : '#0ea5e9'}
          strokeWidth={2.5}
          strokeLinecap="round"
          className="flow-edge-dash"
          style={{ animationDuration: `${Math.max(0.35, 1.6 - flow * 1.2)}s` }}
        />
      )}
      {pulses.map((begin) => (
        <circle key={begin} r={4} fill={d.failed ? '#f87171' : '#0ea5e9'} opacity={0.95} pointerEvents="none">
          <animateMotion dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite" path={path} />
        </circle>
      ))}
      <EdgeLabelRenderer>
        <div
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'none',
          }}
            className="absolute flex items-center gap-1"
        >
          <span
            className={`font-mono text-[10px] leading-none [text-shadow:0_0_5px_white] dark:[text-shadow:0_0_5px_#09090b] ${
              rps > 0 ? 'text-sky-600 dark:text-sky-300' : 'text-zinc-500 dark:text-zinc-400'
            }`}
          >
            {formatRps(rps)}
          </span>
          {selected && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteElements({ edges: [{ id }] });
              }}
              aria-label={t(locale, 'deleteConnection')}
              title={t(locale, 'deleteConnection')}
              style={{ pointerEvents: 'auto' }}
              className="nodrag nopan inline-flex h-4 w-4 items-center justify-center rounded-full bg-zinc-600 text-white hover:bg-red-500 dark:bg-zinc-300 dark:text-zinc-900 dark:hover:bg-red-400"
            >
              <Cross1Icon width={9} height={9} aria-hidden />
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const edgeTypes = { flow: FlowEdge };

interface SimulationStageProps {
  skillId: string;
  scenarioId?: string;
  layout: 'panel' | 'studio';
}

const STUDIO_SCENARIOS = [
  { id: 'rate-limiting-url-shortener', label: 'TinyURL', Icon: Link2Icon },
  { id: 'realtime-rides-feed', label: 'Chat & Rides', Icon: ChatBubbleIcon },
  { id: 'databases-sharding', label: 'Scaling', Icon: BarChartIcon },
  { id: 'distributed-failures', label: 'Failures', Icon: ExclamationTriangleIcon },
  { id: 'free', label: 'Free canvas', Icon: CubeIcon },
];

type Phase = 'idle' | 'playing' | 'paused' | 'step';

function toFlowNodes(state: ReturnType<typeof initialStateFor>, direction: FlowDirection = 'vertical'): Node[] {
  return state.nodes.map((n, i) => ({
    id: n.id,
    type: 'design',
    position: layoutPos(i, direction),
    data: { kind: n.kind, label: DESIGN_KIND_LABELS[n.kind], bottleneck: false, failed: false, queued: 0, direction } satisfies CanvasNodeData,
  }));
}

function toFlowEdges(state: ReturnType<typeof initialStateFor>): Edge[] {
  return state.edges.map((e) => ({
    id: e.id,
    source: e.from,
    target: e.to,
    type: 'flow',
    data: { flow: 0, failed: false } satisfies FlowEdgeData,
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: '#71717a', strokeWidth: 2.5 },
  }));
}
let studioSeq = 0;

function nextStudioId(prefix: string): string {
  studioSeq += 1;
  return `${prefix}-${Date.now().toString(36)}-${studioSeq}`;
}

function makeDesignNode(kind: DesignKind, position: { x: number; y: number }, direction: FlowDirection, parentId?: string): Node {
  const n = starterNode(kind, kind);
  return {
    id: n.id,
    type: 'design',
    position,
    parentId,
    selected: true,
    data: { kind, label: DESIGN_KIND_LABELS[kind], bottleneck: false, failed: false, queued: 0, direction } satisfies CanvasNodeData,
  };
}

function makeNoteNode(position: { x: number; y: number }, parentId?: string): Node {
  return {
    id: nextStudioId('note'),
    type: 'note',
    position,
    parentId,
    selected: true,
    style: { width: 180, height: 140 },
    data: { text: '', color: NOTE_COLORS[0] } satisfies NoteNodeData,
  };
}

function makeSectionNode(position: { x: number; y: number }, width = 520, height = 260): Node {
  return {
    id: nextStudioId('section'),
    type: 'section',
    position,
    selected: true,
    style: { width, height },
    zIndex: -10,
    data: { title: 'New section', color: 'blue' } satisfies SectionNodeData,
  };
}

function sectionAt(nodes: Node[], at: { x: number; y: number }): Node | undefined {
  return nodes.find((n) => {
    if (n.type !== 'section') return false;
    const w = Number(n.style?.width ?? n.width ?? 520);
    const h = Number(n.style?.height ?? n.height ?? 260);
    return at.x >= n.position.x && at.x <= n.position.x + w && at.y >= n.position.y && at.y <= n.position.y + h;
  });
}

function SimulationStageContent({ skillId, scenarioId, layout }: SimulationStageProps) {
  const locale = useUILocale();
  const { getStatus, setStatus } = useProgressContext();
  const theme = useTheme();
  const [activeScenario, setActiveScenario] = useState(scenarioId ?? skillId);
  const preset = useMemo(() => getPreset(activeScenario), [activeScenario]);
  const isFree = preset.id === 'free';

  const [mode, setMode] = useState<'guided' | 'free'>(isFree ? 'free' : 'guided');
  const [direction, setDirection] = useState<FlowDirection>('vertical');
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [ready, setReady] = useState(false);
  const [qps, setQps] = useState(300);
  const [readPct, setReadPct] = useState(80);
  const [phase, setPhase] = useState<Phase>('idle');
  const [speed, setSpeed] = useState(1);
  const [clock, setClock] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<RunSummary | null>(null);
  const [spark, setSpark] = useState<number[]>([]);
  const [hasWon, setHasWon] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [inspectId, setInspectId] = useState<number | ''>('');
  const [recentTraces, setRecentTraces] = useState<RequestTrace[]>([]);

  const handleRef = useRef<RunHandle | null>(null);
  const rafRef = useRef<number>(0);
  const lastFrameRef = useRef(0);
  const frameRef = useRef(0);
  const firedRef = useRef(0);
  const failedRef = useRef<Set<DesignKind>>(new Set());
  const failureSeenRef = useRef<DesignKind | null>(null);
  const pendingEventsRef = useRef<RunEvent[]>([]);
  const suppressedRef = useRef(0);
  const hopSampleRef = useRef(0);
  const lastTraceIdRef = useRef(0);
  const lastRpsSimRef = useRef(0);
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);
  const logRef = useRef<HTMLDivElement>(null);
  const flowWrapperRef = useRef<HTMLDivElement>(null);
  const reactFlowRef = useRef<ReactFlowInstance | null>(null);

  // ---- Figma-style studio state: undo/redo history, persistence, canvas chrome ----
  interface HistorySnap { nodes: Node[]; edges: Edge[]; }
  const pastRef = useRef<HistorySnap[]>([]);
  const futureRef = useRef<HistorySnap[]>([]);
  const editSnapshotRef = useRef<HistorySnap | null>(null);
  const dragSnapshotRef = useRef<HistorySnap | null>(null);
  const [, setHistTick] = useState(0);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [zoom, setZoom] = useState(1);
  const [showMap, setShowMap] = useState(true);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const studioKey = `backend-roadmap:studio:${preset.id}`;
  const canUndo = pastRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

  const pushHistory = useCallback((snap?: HistorySnap) => {
    pastRef.current.push(
      snap ?? { nodes: JSON.parse(JSON.stringify(nodesRef.current)), edges: JSON.parse(JSON.stringify(edgesRef.current)) },
    );
    if (pastRef.current.length > 60) pastRef.current.shift();
    futureRef.current = [];
    setHistTick((v) => v + 1);
  }, []);

  // Inline note/section editors bracket one undo step per edit session.
  useEffect(() => {
    studioEditBridge.begin = () => {
      if (!editSnapshotRef.current) {
        editSnapshotRef.current = {
          nodes: JSON.parse(JSON.stringify(nodesRef.current)),
          edges: JSON.parse(JSON.stringify(edgesRef.current)),
        };
      }
    };
    studioEditBridge.end = () => {
      const snap = editSnapshotRef.current;
      editSnapshotRef.current = null;
      if (snap) pushHistory(snap);
    };
    return () => {
      studioEditBridge.begin = null;
      studioEditBridge.end = null;
    };
  }, [pushHistory]);

  // (re)initialize canvas when scenario changes — restore autosaved canvas when present
  useEffect(() => {
    const fresh = initialStateFor(preset.id);
    let restored: { nodes: Node[]; edges: Edge[] } | null = null;
    try {
      const raw = localStorage.getItem(studioKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { nodes?: Node[]; edges?: Edge[] };
        if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges) && parsed.nodes.length > 0) {
          const nodeIds = new Set(parsed.nodes.filter((n) => n && typeof n.id === 'string').map((n) => n.id));
          restored = {
            nodes: parsed.nodes
              .filter((n) => n && typeof n.id === 'string')
              .map((n) => ({
                ...n,
                selected: false,
                data:
                  n.type === 'note'
                    ? { text: '', color: NOTE_COLORS[0], ...((n.data as object) ?? {}) }
                    : n.type === 'section'
                      ? { title: 'Section', color: 'blue' as SectionColor, ...((n.data as object) ?? {}) }
                      : { bottleneck: false, failed: false, queued: 0, direction, ...((n.data as object) ?? {}) },
              })) as Node[],
            edges: parsed.edges.filter((e) => e && nodeIds.has(e.source) && nodeIds.has(e.target)).map((e) => ({ ...e, selected: false })) as Edge[],
          };
        }
      }
    } catch {
      restored = null;
    }
    setNodes(restored?.nodes ?? toFlowNodes(fresh, direction));
    setEdges(restored?.edges ?? toFlowEdges(fresh));
    handleRef.current = null;
    setPhase('idle');
    setClock(0);
    setLog([]);
    setMetrics(null);
    setSpark([]);
    setHasWon(false);
    setRecentTraces([]);
    setInspectId('');
    firedRef.current = 0;
    failedRef.current = new Set();
    failureSeenRef.current = null;
    pastRef.current = [];
    futureRef.current = [];
    editSnapshotRef.current = null;
    setHistTick((v) => v + 1);
    setReady(true);
  }, [preset.id, setNodes, setEdges]);

  // Autosave canvas (components, connections, notes, sections) per scenario.
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(
          studioKey,
          JSON.stringify({
            nodes: nodesRef.current.map((n) => ({
              id: n.id,
              type: n.type,
              position: n.position,
              data: n.data,
              style: n.style,
              parentId: n.parentId,
              zIndex: n.zIndex,
            })),
            edges: edgesRef.current.map((e) => ({
              id: e.id,
              source: e.source,
              target: e.target,
              type: e.type,
              data: e.data,
              markerEnd: e.markerEnd,
              style: e.style,
            })),
          }),
        );
        setSavedAt(new Date());
      } catch {
        // Storage full or blocked — canvas keeps working in memory.
      }
    }, 600);
    return () => clearTimeout(t);
  }, [nodes, edges, ready, studioKey]);

  const fmtClock = useCallback((t: number) => `t+${t.toFixed(1)}s`, []);

  const pushLog = useCallback((lines: string[]) => {
    if (lines.length === 0) return;
    setLog((prev) => [...prev.slice(Math.max(0, prev.length + lines.length - 200)), ...lines]);
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [log]);

  const onQps = useCallback(
    (v: number) => {
      setQps(v);
      handleRef.current?.retune(v, readPct / 100);
    },
    [readPct],
  );

  const onReadPct = useCallback(
    (v: number) => {
      setReadPct(v);
      handleRef.current?.retune(qps, v / 100);
    },
    [qps],
  );

  const deriveTopology = useCallback(
    () => ({
      nodes: nodes
        .filter((n) => n.type === 'design')
        .map((n) => {
          const d = n.data as unknown as CanvasNodeData;
          return { id: n.id, kind: d.kind };
        }),
      edges: edges.map((e, i) => ({ from: e.source, to: e.target, id: e.id || `e-${i}` })),
    }),
    [nodes, edges],
  );

  const ensureHandle = useCallback(() => {
    if (!handleRef.current) {
      const topo = deriveTopology();
      handleRef.current = createRun(topo, { qps, readRatio: readPct / 100, seed: 7, failedKinds: [...failedRef.current] });
      lastTraceIdRef.current = 0;
    }
    return handleRef.current;
  }, [deriveTopology, qps, readPct]);

  const restartRun = useCallback(
    (reason: string) => {
      handleRef.current = null;
      firedRef.current = 0;
      setClock(0);
      setMetrics(null);
      setSpark([]);
      setHasWon(false);
      setRecentTraces([]);
      setInspectId('');
      pushLog([`${reason} — run restarted.`]);
      setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, bottleneck: false, failed: false, queued: 0 } })));
      setEdges((eds) => eds.map((e) => ({ ...e, data: { ...((e.data ?? {}) as FlowEdgeData), flow: 0, failed: false, rps: 0 } })));
    },
    [pushLog, setNodes, setEdges],
  );

  const evaluateWin = useCallback(
    (summary: RunSummary) => {
      if (mode === 'free' || hasWon) return;
      const canvasState = {
        nodes: nodes
          .filter((n) => n.type === 'design')
          .map((n) => {
            const d = n.data as unknown as CanvasNodeData;
            return { id: n.id, kind: d.kind, label: typeof d.label === 'string' ? d.label : d.kind };
          }),
        edges: edges.map((e, i) => ({ id: e.id || `e-${i}`, from: e.source, to: e.target })),
        scenario: { qps, readRatio: readPct / 100, failedKind: failureSeenRef.current },
      };
      const instant = simulateTraffic(canvasState);
      const topologyOk = preset.winCondition(canvasState, instant);
      if (checkRunObjective(preset.id, topologyOk, summary)) setHasWon(true);
    },
    [mode, hasWon, nodes, edges, qps, readPct, preset],
  );

  // main playback loop
  useEffect(() => {
    if (phase !== 'playing') return;
    lastFrameRef.current = performance.now();
    const frame = (now: number) => {
      const dtReal = Math.min((now - lastFrameRef.current) / 1000, 0.25);
      lastFrameRef.current = now;
      const handle = ensureHandle();
      const evs = handle.tick(dtReal * speed);
      // guided timelines
      if (mode === 'guided') {
        const tl = timelineFor(preset.id);
        const snap0 = handle.snapshot();
        while (firedRef.current < tl.length && tl[firedRef.current].atSec <= snap0.simSec) {
          const te = tl[firedRef.current];
          firedRef.current += 1;
          evs.push(...handle.trigger(te.trigger));
          if (te.trigger.type === 'fail') {
            failedRef.current.add(te.trigger.kind);
            failureSeenRef.current = te.trigger.kind;
          } else if (te.trigger.type === 'heal') {
            failedRef.current.delete(te.trigger.kind);
          }
        }
      }
      pendingEventsRef.current.push(...evs);
      frameRef.current += 1;
      // every frame: clock only (edge motion is declarative CSS/SMIL in-viewport)
      const snap = handle.snapshot();
      setClock(snap.simSec);
      // 4Hz: badges, edge flow, bottleneck, log flush, metrics, win check
      if (frameRef.current % 15 === 0) {
        const summary = handle.summarize();
        setMetrics(summary);
        setSpark((p) => [...p.slice(-39), summary.p99Ms]);
        const bottleneck = summary.bottleneck;
        const counts = new Map<string, number>();
        const trips = new Map<string, number>();
        for (const p of snap.inFlight) counts.set(`${p.fromId}→${p.toId}`, (counts.get(`${p.fromId}→${p.toId}`) ?? 0) + 1);
        // Completion window: instantaneous inFlight systematically misses fast
        // hops (client/LB/gateway service is ~ms, drained within one substep),
        // so those edges read flow≈0 while metrics stay live. Count traversed
        // edges from requests completed since the last flush — hops record the
        // actual path taken, including cache-shortcut cutoffs.
        let maxTraceId = lastTraceIdRef.current;
        for (const t of handle.traces()) {
          if (t.id <= lastTraceIdRef.current) continue;
          if (t.id > maxTraceId) maxTraceId = t.id;
          for (let i = 1; i < t.hops.length; i++) {
            const key = `${t.hops[i - 1].nodeId}→${t.hops[i].nodeId}`;
            counts.set(key, (counts.get(key) ?? 0) + 1);
            trips.set(key, (trips.get(key) ?? 0) + 1);
          }
        }
        lastTraceIdRef.current = maxTraceId;
        const simElapsed = snap.simSec - lastRpsSimRef.current;
        lastRpsSimRef.current = snap.simSec;
        const kindById = new Map(nodesRef.current.map((n) => [n.id, (n.data as unknown as CanvasNodeData).kind]));
        setEdges((eds) =>
          eds.map((e) => {
            const flow = Math.min(1, (counts.get(`${e.source}→${e.target}`) ?? 0) / 8);
            const failed = failedRef.current.has(kindById.get(e.target) as DesignKind);
            const rps = simElapsed > 1e-6 ? (trips.get(`${e.source}→${e.target}`) ?? 0) / simElapsed : 0;
            const prev = (e.data ?? {}) as FlowEdgeData;
            if (prev.flow === flow && prev.failed === failed && prev.rps === rps) return e;
            return { ...e, data: { ...prev, flow, failed, rps } };
          }),
        );
        setNodes((nds) =>
          nds.map((n) => {
            const d = n.data as unknown as CanvasNodeData;
            return {
              ...n,
              data: {
                ...n.data,
                queued: snap.queueByNode[n.id] ?? 0,
                failed: failedRef.current.has(d.kind),
                bottleneck: bottleneck !== '—' && d.kind !== 'client' && DESIGN_KIND_LABELS[d.kind] === bottleneck,
              },
            };
          }),
        );
        const lines: string[] = [];
        for (const e of pendingEventsRef.current) {
          if (e.kind === 'hop') {
            hopSampleRef.current += 1;
            if (hopSampleRef.current % 40 === 0) lines.push(`${fmtClock(e.t)} ${e.text}`);
            else suppressedRef.current += 1;
          } else {
            lines.push(`${fmtClock(e.t)} ${e.text}`);
          }
        }
        pendingEventsRef.current = [];
        if (suppressedRef.current >= 200) {
          lines.push(`… ${suppressedRef.current} routine hops sampled out — spikes, failures, and drops always shown`);
          suppressedRef.current = 0;
        }
        pushLog(lines);
        setRecentTraces(handle.traces().slice(-20).reverse());
        evaluateWin(summary);
      }
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase, speed, mode, preset.id, ensureHandle, pushLog, evaluateWin, fmtClock, setNodes, setEdges]);

  const onPlay = useCallback(() => {
    const topo = deriveTopology();
    const problems = validateTopology({
      nodes: topo.nodes.map((n) => ({ ...n, label: n.id })),
      edges: topo.edges.map((e) => ({ id: e.id, from: e.from, to: e.to })),
      scenario: { qps, readRatio: readPct / 100, failedKind: null },
    });
    if (problems.length > 0) {
      pushLog(problems);
      return;
    }
    setPhase('playing');
  }, [deriveTopology, qps, readPct, pushLog]);

  const onPause = useCallback(() => setPhase('paused'), []);

  const onStepOnce = useCallback(() => {
    const handle = ensureHandle();
    const evs = handle.tick(0.2);
    const lines = evs.filter((e) => e.kind !== 'hop').map((e) => `${fmtClock(e.t)} ${e.text}`);
    if (lines.length === 0) lines.push(`${fmtClock(handle.snapshot().simSec)} +0.2s — queues draining, no notable events.`);
    pushLog(lines);
    const snap = handle.snapshot();
    setClock(snap.simSec);
    setMetrics(handle.summarize());
    setRecentTraces(handle.traces().slice(-20).reverse());
    setPhase('step');
  }, [ensureHandle, pushLog, fmtClock]);

  const fireManual = useCallback(
    (kind: 'spike' | 'fail' | 'heal', arg?: DesignKind) => {
      const handle = ensureHandle();
      let ev = kind === 'spike' ? { type: 'spike', factor: 4, secs: 15 } as const : kind === 'fail' && arg ? { type: 'fail', kind: arg } as const : arg ? { type: 'heal', kind: arg } as const : null;
      if (!ev) return;
      const out = handle.trigger(ev);
      if (ev.type === 'fail') {
        failedRef.current.add(ev.kind);
        failureSeenRef.current = ev.kind;
      } else if (ev.type === 'heal') {
        failedRef.current.delete(ev.kind);
      }
      pushLog(out.map((e) => `${fmtClock(e.t)} ${e.text}`));
      setNodes((nds) =>
        nds.map((n) => {
          const d = n.data as unknown as CanvasNodeData;
          return { ...n, data: { ...n.data, failed: failedRef.current.has(d.kind) } };
        }),
      );
    },
    [ensureHandle, pushLog, fmtClock, setNodes],
  );

  const touchTopology = useCallback(() => {
    if (phase === 'playing' || phase === 'paused' || phase === 'step') {
      handleRef.current = null;
      firedRef.current = 0;
      setClock(0);
      setMetrics(null);
      setSpark([]);
      setHasWon(false);
      setPhase('idle');
      setEdges((eds) => eds.map((e) => ({ ...e, data: { ...((e.data ?? {}) as FlowEdgeData), flow: 0, failed: false, rps: 0 } })));
      pushLog(['Topology edited — press Play to start a fresh run.']);
    }
  }, [phase, pushLog, setEdges]);

  // structural canvas changes only (drag/select pass through silently)
  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      const removed = changes.filter((c) => c.type === 'remove');
      if (removed.length > 0) {
        pushHistory();
        const byId = new Map(nodesRef.current.map((n) => [n.id, n]));
        if (removed.some((c) => (c.type === 'remove' ? byId.get(c.id)?.type !== 'note' && byId.get(c.id)?.type !== 'section' : false))) touchTopology();
      }
      onNodesChange(changes);
    },
    [onNodesChange, pushHistory, touchTopology],
  );

  const handleEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChange>[0]) => {
      if (changes.some((c) => c.type === 'remove')) {
        pushHistory();
        touchTopology();
      }
      onEdgesChange(changes);
    },
    [onEdgesChange, pushHistory, touchTopology],
  );
  const undo = useCallback(() => {
    const prev = pastRef.current.pop();
    if (!prev) return;
    futureRef.current.push({ nodes: JSON.parse(JSON.stringify(nodesRef.current)), edges: JSON.parse(JSON.stringify(edgesRef.current)) });
    setNodes(prev.nodes);
    setEdges(prev.edges);
    setHistTick((v) => v + 1);
    touchTopology();
  }, [setNodes, setEdges, touchTopology]);

  const redo = useCallback(() => {
    const next = futureRef.current.pop();
    if (!next) return;
    pastRef.current.push({ nodes: JSON.parse(JSON.stringify(nodesRef.current)), edges: JSON.parse(JSON.stringify(edgesRef.current)) });
    setNodes(next.nodes);
    setEdges(next.edges);
    setHistTick((v) => v + 1);
    touchTopology();
  }, [setNodes, setEdges, touchTopology]);

  const duplicateSelected = useCallback(() => {
    const sel = nodesRef.current.filter((n) => n.selected);
    if (sel.length === 0) return;
    pushHistory();
    const idMap = new Map<string, string>();
    sel.forEach((n) => idMap.set(n.id, `${n.id}-copy-${Date.now().toString(36)}-${idMap.size}`));
    const clones: Node[] = sel.map((n) => {
      const copy = JSON.parse(JSON.stringify(n)) as Node;
      copy.id = idMap.get(n.id) as string;
      copy.position = { x: n.position.x + 28, y: n.position.y + 28 };
      copy.selected = true;
      if (n.parentId && idMap.has(n.parentId)) copy.parentId = idMap.get(n.parentId);
      return copy;
    });
    const selIds = new Set(sel.map((n) => n.id));
    const edgeClones: Edge[] = edgesRef.current
      .filter((e) => selIds.has(e.source) && selIds.has(e.target))
      .map((e, i) => {
        const copy = JSON.parse(JSON.stringify(e)) as Edge;
        copy.id = `${e.id}-copy-${i}`;
        copy.source = idMap.get(e.source) as string;
        copy.target = idMap.get(e.target) as string;
        copy.selected = false;
        return copy;
      });
    setNodes((nds) => [...nds.map((n) => (n.selected ? { ...n, selected: false } : n)), ...clones]);
    if (edgeClones.length > 0) setEdges((eds) => [...eds, ...edgeClones]);
    if (sel.some((n) => n.type === 'design')) touchTopology();
  }, [pushHistory, setNodes, setEdges, touchTopology]);

  const deleteSelected = useCallback(() => {
    const selN = nodesRef.current.filter((n) => n.selected);
    const selE = edgesRef.current.filter((e) => e.selected);
    if (selN.length === 0 && selE.length === 0) return;
    pushHistory();
    const dead = new Set(selN.map((n) => n.id));
    const byId = new Map(nodesRef.current.map((n) => [n.id, n]));
    setNodes((nds) =>
      nds
        .filter((n) => !dead.has(n.id))
        .map((n) => {
          if (n.parentId && dead.has(n.parentId)) {
            const p = byId.get(n.parentId);
            return { ...n, parentId: undefined, position: { x: n.position.x + (p?.position.x ?? 0), y: n.position.y + (p?.position.y ?? 0) } };
          }
          return n.selected ? { ...n, selected: false } : n;
        }),
    );
    setEdges((eds) => eds.filter((e) => !dead.has(e.source) && !dead.has(e.target) && !e.selected));
    if (selN.some((n) => n.type === 'design') || selE.length > 0) touchTopology();
  }, [pushHistory, setNodes, setEdges, touchTopology]);

  const clearCanvas = useCallback(() => {
    if (nodesRef.current.length === 0 && edgesRef.current.length === 0) return;
    pushHistory();
    setNodes([]);
    setEdges([]);
    touchTopology();
  }, [pushHistory, setNodes, setEdges, touchTopology]);

  const resetCanvas = useCallback(() => {
    pushHistory();
    const fresh = initialStateFor(preset.id);
    setNodes(toFlowNodes(fresh, direction));
    setEdges(toFlowEdges(fresh));
    try {
      localStorage.removeItem(studioKey);
    } catch {
      // Non-fatal: starter canvas is already in memory.
    }
    touchTopology();
  }, [pushHistory, preset.id, direction, setNodes, setEdges, touchTopology, studioKey]);

  const groupIntoSection = useCallback(() => {
    const sel = nodesRef.current.filter((n) => n.selected && n.type === 'design' && !n.parentId);
    if (sel.length === 0) return;
    pushHistory();
    const W = 170;
    const H = 110;
    const minX = Math.min(...sel.map((n) => n.position.x));
    const minY = Math.min(...sel.map((n) => n.position.y));
    const maxX = Math.max(...sel.map((n) => n.position.x));
    const maxY = Math.max(...sel.map((n) => n.position.y));
    const pad = 28;
    const head = 52;
    const sx = minX - pad;
    const sy = minY - head;
    const section = makeSectionNode({ x: sx, y: sy }, maxX - minX + W + pad * 2, maxY - minY + H + head + pad);
    section.selected = false;
    (section.data as SectionNodeData).title = `${sel.length} components`;
    const selIds = new Set(sel.map((n) => n.id));
    setNodes((nds) => [
      ...nds.map((n) =>
        selIds.has(n.id)
          ? { ...n, parentId: section.id, selected: true, position: { x: n.position.x - sx, y: n.position.y - sy } }
          : n.selected
            ? { ...n, selected: false }
            : n,
      ),
      section,
    ]);
  }, [pushHistory, setNodes]);

  const ungroupSelectedSections = useCallback(() => {
    const secs = nodesRef.current.filter((n) => n.selected && n.type === 'section');
    if (secs.length === 0) return;
    pushHistory();
    const dead = new Set(secs.map((s) => s.id));
    const byId = new Map(nodesRef.current.map((n) => [n.id, n]));
    setNodes((nds) =>
      nds
        .filter((n) => !dead.has(n.id))
        .map((n) => {
          if (n.parentId && dead.has(n.parentId)) {
            const p = byId.get(n.parentId);
            return { ...n, parentId: undefined, position: { x: n.position.x + (p?.position.x ?? 0), y: n.position.y + (p?.position.y ?? 0) } };
          }
          return n;
        }),
    );
  }, [pushHistory, setNodes]);

  const placeNode = useCallback(
    (item: { tab: 'kind'; kind: DesignKind } | { tab: 'note' } | { tab: 'section' }, at?: { x: number; y: number }) => {
      pushHistory();
      const pos = at ?? layoutPos(nodesRef.current.length, direction);
      const host = at ? sectionAt(nodesRef.current, at) : undefined;
      const parentId = host?.id;
      const rel = host ? { x: pos.x - host.position.x, y: pos.y - host.position.y } : pos;
      const node =
        item.tab === 'note' ? makeNoteNode(rel, parentId) : item.tab === 'section' ? makeSectionNode(rel) : makeDesignNode(item.kind, rel, direction, parentId);
      setNodes((nds) => [...nds.map((n) => (n.selected ? { ...n, selected: false } : n)), node]);
      if (item.tab === 'kind') touchTopology();
    },
    [pushHistory, direction, setNodes, touchTopology],
  );

  const onPaletteDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const instance = reactFlowRef.current;
      if (!instance) return;
      const at = instance.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const kind = e.dataTransfer.getData('application/x-design-kind') as DesignKind | '';
      const annot = e.dataTransfer.getData('application/x-studio-annot');
      if (kind && PALETTE_GROUPS.some((g) => g.items.includes(kind))) placeNode({ tab: 'kind', kind }, at);
      else if (annot === 'note' || annot === 'section') placeNode({ tab: annot }, at);
    },
    [placeNode],
  );

  const onPaletteDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onNodeDragStart = useCallback(() => {
    dragSnapshotRef.current = { nodes: JSON.parse(JSON.stringify(nodesRef.current)), edges: JSON.parse(JSON.stringify(edgesRef.current)) };
  }, []);

  const onNodeDragStop = useCallback(() => {
    const snap = dragSnapshotRef.current;
    dragSnapshotRef.current = null;
    if (snap) pushHistory(snap);
  }, [pushHistory]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateSelected();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, duplicateSelected]);

  const selectedNodes = useMemo(() => nodes.filter((n) => n.selected), [nodes]);
  const selectedEdges = useMemo(() => edges.filter((e) => e.selected), [edges]);
  const designCount = useMemo(() => nodes.filter((n) => n.type === 'design').length, [nodes]);
  const noteCount = useMemo(() => nodes.filter((n) => n.type === 'note').length, [nodes]);
  const sectionCount = useMemo(() => nodes.filter((n) => n.type === 'section').length, [nodes]);

  const toggleDirection = useCallback(() => {
    setDirection((prev) => {
      const next = prev === 'vertical' ? 'horizontal' : 'vertical';
      setNodes((nds) =>
        nds.map((n, i) => ({
          ...n,
          position: layoutPos(i, next),
          data: { ...(n.data as unknown as CanvasNodeData), direction: next },
        })),
      );
      return next;
    });
  }, [setNodes]);

  const addKind = useCallback(
    (kind: DesignKind) => {
      pushHistory();
      setNodes((nds) => {
        let position = layoutPos(nds.length, direction);
        const instance = reactFlowRef.current;
        const wrapper = flowWrapperRef.current;
        if (instance && wrapper) {
          try {
            const rect = wrapper.getBoundingClientRect();
            const center = instance.screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
            if (Number.isFinite(center.x) && Number.isFinite(center.y)) {
              let nearest: Node | null = null;
              let best = Infinity;
              for (const node of nds) {
                const dx = node.position.x + 75 - center.x;
                const dy = node.position.y + 50 - center.y;
                const d = dx * dx + dy * dy;
                if (d < best) {
                  best = d;
                  nearest = node;
                }
              }
              if (nearest) {
                const step = direction === 'horizontal' ? { x: 250, y: 0 } : { x: 0, y: 160 };
                let candidate = { x: nearest.position.x + step.x, y: nearest.position.y + step.y };
                let guard = 0;
                while (
                  nds.some((q) => Math.abs(q.position.x - candidate.x) < 170 && Math.abs(q.position.y - candidate.y) < 110) &&
                  guard < 12
                ) {
                  candidate =
                    direction === 'horizontal'
                      ? { x: candidate.x, y: candidate.y + 130 }
                      : { x: candidate.x + 180, y: candidate.y };
                  guard += 1;
                }
                const topLeft = instance.screenToFlowPosition({ x: rect.left + 16, y: rect.top + 16 });
                const bottomRight = instance.screenToFlowPosition({ x: rect.right - 166, y: rect.bottom - 126 });
                if (
                  [topLeft.x, topLeft.y, bottomRight.x, bottomRight.y].every((v) => Number.isFinite(v)) &&
                  bottomRight.x > topLeft.x &&
                  bottomRight.y > topLeft.y
                ) {
                  candidate = {
                    x: Math.min(Math.max(candidate.x, topLeft.x), bottomRight.x),
                    y: Math.min(Math.max(candidate.y, topLeft.y), bottomRight.y),
                  };
                }
                position = candidate;
              } else {
                position = { x: center.x - 75, y: center.y - 50 };
              }
            }
          } catch {
            position = layoutPos(nds.length, direction);
          }
        }
        const host = sectionAt(nds, position);
        const node = host
          ? makeDesignNode(kind, { x: position.x - host.position.x, y: position.y - host.position.y }, direction, host.id)
          : makeDesignNode(kind, position, direction);
        return [...nds.map((nd) => (nd.selected ? { ...nd, selected: false } : nd)), node];
      });
      touchTopology();
    },
    [direction, pushHistory, setNodes, touchTopology],
  );

  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target || c.source === c.target) return;
      const byId = new Map(nodesRef.current.map((n) => [n.id, n]));
      if (byId.get(c.source)?.type !== 'design' || byId.get(c.target)?.type !== 'design') return;
      pushHistory();
      setEdges((eds) => addEdge({ ...c, type: 'flow', data: { flow: 0, failed: false, rps: 0 } satisfies FlowEdgeData, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: '#71717a', strokeWidth: 2.5 } }, eds));
      touchTopology();
    },
    [pushHistory, setEdges, touchTopology],
  );

  const inspected = useMemo(
    () => recentTraces.find((t) => t.id === inspectId) ?? null,
    [recentTraces, inspectId],
  );

  const objective = mode === 'free' ? getPreset('free').objective : preset.objective;
  const slo = sloFor(preset.id);

  if (!ready) return <div className="flex h-full items-center justify-center text-xs text-zinc-500">{t(locale, 'loadingSimulation')}</div>;

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-50 dark:bg-zinc-950">
      {layout === 'studio' && (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-zinc-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900" aria-label={t(locale, 'scenarioLibrary')}>
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">{t(locale, 'scenarios')}</span>
          {STUDIO_SCENARIOS.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setActiveScenario(s.id);
                setMode(s.id === 'free' ? 'free' : 'guided');
              }}
              className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition ${activeScenario === s.id ? 'bg-sky-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'}`}
            >
              <s.Icon width={13} height={13} className="shrink-0" aria-hidden />
              {s.label}
            </button>
          ))}
        </div>
      )}
      {layout === 'studio' && (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-zinc-200 bg-white px-4 py-1.5 dark:border-zinc-800 dark:bg-zinc-900" aria-label="Canvas tools">
          <span className="mr-1 inline-flex items-center gap-1.5 text-[11px] text-zinc-500" title={savedAt ? `Autosaved at ${savedAt.toLocaleTimeString()}` : 'Changes autosave to this browser'}>
            <span className={`h-1.5 w-1.5 rounded-full ${savedAt ? 'bg-emerald-500' : 'bg-zinc-400'}`} aria-hidden />
            {savedAt ? `SAVED ${savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'UNSAVED'}
          </span>
          <span className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-700" aria-hidden />
          <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800"><ResetIcon width={13} height={13} aria-hidden />Undo</button>
          <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800"><ReloadIcon width={13} height={13} aria-hidden />Redo</button>
          <span className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-700" aria-hidden />
          <button onClick={duplicateSelected} disabled={selectedNodes.length === 0} title="Duplicate selection (Ctrl+D)" className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800"><CopyIcon width={13} height={13} aria-hidden />Duplicate</button>
          <button onClick={deleteSelected} disabled={selectedNodes.length === 0 && selectedEdges.length === 0} title="Delete selection (Del)" className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-600 hover:bg-red-500/10 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-300 dark:hover:text-red-400"><TrashIcon width={13} height={13} aria-hidden />Delete</button>
          <button onClick={groupIntoSection} disabled={!selectedNodes.some((n) => n.type === 'design' && !n.parentId)} title="Wrap selected components in a section frame" className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800"><GroupIcon width={13} height={13} aria-hidden />Group into section</button>
          <span className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-700" aria-hidden />
          <button onClick={clearCanvas} title="Remove everything from the canvas (undoable)" className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"><TrashIcon width={13} height={13} aria-hidden />Clear</button>
          <button onClick={resetCanvas} title="Restore the scenario starter canvas" className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"><ResetIcon width={13} height={13} aria-hidden />Reset</button>
          <span className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-700" aria-hidden />
          <span className="font-mono text-[11px] text-zinc-500">{designCount} components · {edges.length} connections · {noteCount} notes · {sectionCount} sections</span>
        </div>
      )}
      <div className="shrink-0 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-sky-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">Design Simulation</span>
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{objective.title}</span>
              {hasWon && <span className="inline-flex items-center gap-1 rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white"><CheckIcon width={11} height={11} aria-hidden />{t(locale, 'objectiveMet')}</span>}
              <span className="inline-flex items-center gap-1 font-mono text-xs text-zinc-500"><ClockIcon width={12} height={12} aria-hidden />{fmtClock(clock)}</span>
            </div>
            <p className="mt-1 max-w-[60ch] text-xs leading-5 text-zinc-600 dark:text-zinc-400">{objective.description}</p>
            {mode === 'guided' && <p className="mt-1 font-mono text-xs text-zinc-500"><span className="mr-1 inline-flex translate-y-[2px] items-center"><TargetIcon width={12} height={12} aria-hidden /></span>SLO: {[
              slo.p99LtMs !== undefined ? `p99 < ${slo.p99LtMs}ms` : null,
              slo.errLtPct !== undefined ? `errors < ${slo.errLtPct}%` : null,
              slo.minCompleted !== undefined ? `≥${slo.minCompleted} served` : null,
            ].filter(Boolean).join(' • ')}{timelineFor(preset.id).length > 0 ? ' • scripted spike/failure incoming' : ''}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <div className="flex overflow-hidden rounded border border-zinc-200 dark:border-zinc-700" role="tablist" aria-label={t(locale, 'canvasDirection')}>
              {(['vertical', 'horizontal'] as const).map((d) => (
                <button
                  key={d}
                  role="tab"
                  aria-selected={direction === d}
                  title={t(locale, d === 'vertical' ? 'topDownView' : 'leftRightView')}
                  onClick={() => { if (direction !== d) toggleDirection(); }}
                  className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium capitalize transition ${direction === d ? 'bg-sky-600 text-white' : 'bg-white text-zinc-500 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'}`}
                >
                  {t(locale, d === 'vertical' ? 'topDown' : 'horizontal')}
                </button>
              ))}
            </div>
            <div className="flex overflow-hidden rounded border border-zinc-200 dark:border-zinc-700" role="tablist" aria-label={t(locale, 'simulationMode')}>
              {([{ id: 'guided', Icon: TargetIcon }, { id: 'free', Icon: CubeIcon }] as const).map(({ id: m, Icon }) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => { setMode(m); setHasWon(false); }}
                  className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium capitalize transition ${mode === m ? 'bg-sky-600 text-white' : 'bg-white text-zinc-500 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'}`}
                >
                  <Icon width={12} height={12} className="shrink-0" aria-hidden />
                  {m}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowHints((v) => !v)}
              className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition ${showHints ? 'bg-sky-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'}`}
            >
              <QuestionMarkCircledIcon width={13} height={13} className="shrink-0" aria-hidden />
              {t(locale, 'patterns')}
            </button>
            <button
              onClick={() => restartRun('Canvas reset')}
              className="inline-flex items-center gap-1 rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              <ResetIcon width={13} height={13} className="shrink-0" aria-hidden />
              {t(locale, 'reset')}
            </button>
            <button
              onClick={() => setStatus(skillId, status === 'completed' ? 'in-progress' : 'completed')}
              className={`inline-flex items-center gap-1 rounded px-3 py-1 text-xs font-semibold transition ${status === 'completed' || hasWon ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'}`}
            >
              {(status === 'completed' || hasWon) && <CheckIcon width={13} height={13} className="shrink-0" aria-hidden />}
              {status === 'completed' ? t(locale, 'completed') : t(locale, 'markComplete')}
            </button>
          </div>
        </div>
        {/* transport */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5" aria-label={t(locale, 'playbackControls')}>
          {phase !== 'playing' ? (
            <button onClick={onPlay} className="inline-flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500"><PlayIcon width={13} height={13} className="shrink-0" aria-hidden />{t(locale, 'play')}</button>
          ) : (
            <button onClick={onPause} className="inline-flex items-center gap-1.5 rounded bg-amber-500 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-400"><PauseIcon width={13} height={13} className="shrink-0" aria-hidden />{t(locale, 'pause')}</button>
          )}
          <button onClick={onStepOnce} title="Advance 0.2 simulated seconds" className="inline-flex items-center gap-1.5 rounded bg-zinc-100 px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"><TrackNextIcon width={13} height={13} className="shrink-0" aria-hidden />{t(locale, 'step')}</button>
          <span className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-700" aria-hidden />
          <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo" className="inline-flex items-center gap-1 rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:border-sky-500/60 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300"><ResetIcon width={13} height={13} className="shrink-0" aria-hidden />Undo</button>
          <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo" className="inline-flex items-center gap-1 rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:border-sky-500/60 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300"><ReloadIcon width={13} height={13} className="shrink-0" aria-hidden />Redo</button>
          <div className="flex overflow-hidden rounded border border-zinc-200 dark:border-zinc-700" aria-label="Speed">
            {[1, 2, 4].map((s) => (
              <button key={s} onClick={() => setSpeed(s)} aria-pressed={speed === s} className={`px-2 py-1 font-mono text-xs transition ${speed === s ? 'bg-sky-600 text-white' : 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700'}`}>{s}×</button>
            ))}
          </div>
          <span className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-700" aria-hidden />
          <button onClick={() => fireManual('spike')} className="inline-flex items-center gap-1 rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:border-amber-500/60 hover:text-amber-600 dark:border-zinc-700 dark:text-zinc-300"><LightningBoltIcon width={13} height={13} className="shrink-0" aria-hidden />Spike</button>
          <button onClick={() => fireManual('fail', 'app')} className="inline-flex items-center gap-1 rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:border-red-500/60 hover:text-red-500 dark:border-zinc-700 dark:text-zinc-300"><CrossCircledIcon width={13} height={13} className="shrink-0" aria-hidden />Kill app</button>
          <button onClick={() => fireManual('fail', 'sql')} className="inline-flex items-center gap-1 rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:border-red-500/60 hover:text-red-500 dark:border-zinc-700 dark:text-zinc-300"><CrossCircledIcon width={13} height={13} className="shrink-0" aria-hidden />Kill SQL</button>
          <button onClick={() => fireManual('fail', 'auth')} className="inline-flex items-center gap-1 rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:border-red-500/60 hover:text-red-500 dark:border-zinc-700 dark:text-zinc-300"><CrossCircledIcon width={13} height={13} className="shrink-0" aria-hidden />Kill auth</button>
          <button onClick={() => fireManual('heal', 'app')} className="inline-flex items-center gap-1 rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:border-emerald-500/60 hover:text-emerald-600 dark:border-zinc-700 dark:text-zinc-300"><CheckCircledIcon width={13} height={13} className="shrink-0" aria-hidden />Heal app</button>
          <button onClick={() => fireManual('heal', 'sql')} className="inline-flex items-center gap-1 rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:border-emerald-500/60 hover:text-emerald-600 dark:border-zinc-700 dark:text-zinc-300"><CheckCircledIcon width={13} height={13} className="shrink-0" aria-hidden />Heal SQL</button>
          <button onClick={() => fireManual('heal', 'auth')} className="inline-flex items-center gap-1 rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:border-emerald-500/60 hover:text-emerald-600 dark:border-zinc-700 dark:text-zinc-300"><CheckCircledIcon width={13} height={13} className="shrink-0" aria-hidden />Heal auth</button>
        </div>
      {layout !== 'studio' && (
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label={t(locale, 'addComponents')}>
          {preset.palette.map((kind) => (
            <button
              key={kind}
              onClick={() => addKind(kind)}
              className="inline-flex items-center gap-1 rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-700 hover:border-sky-500/60 hover:bg-sky-500/10 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            >
              <PlusIcon width={12} height={12} className="shrink-0" aria-hidden />
              {DESIGN_KIND_LABELS[kind]}
            </button>
          ))}
          <span className="mx-1 h-5 w-px self-center bg-zinc-200 dark:bg-zinc-700" aria-hidden />
          <button
            onClick={() => placeNode({ tab: 'note' })}
            title="Add an annotation note (drag from sidebar in studio, or click to place)"
            className="inline-flex items-center gap-1 rounded border border-dashed border-amber-500/60 bg-amber-500/10 px-2 py-1 text-xs text-amber-700 hover:bg-amber-500/20 dark:text-amber-300"
          >
            <Pencil2Icon width={12} height={12} className="shrink-0" aria-hidden />
            Note
          </button>
          <button
            onClick={() => placeNode({ tab: 'section' })}
            title="Add a section frame to group components"
            className="inline-flex items-center gap-1 rounded border border-dashed border-sky-500/60 bg-sky-500/10 px-2 py-1 text-xs text-sky-700 hover:bg-sky-500/20 dark:text-sky-300"
          >
            <FrameIcon width={12} height={12} className="shrink-0" aria-hidden />
            Section
          </button>
        </div>
      )}
      </div>

      <div className="flex min-h-0 flex-1">
        {layout === 'studio' && (
          <aside className="hidden w-52 shrink-0 flex-col overflow-y-auto border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 lg:flex" aria-label="Component library">
            <div className="sticky top-0 border-b border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center gap-1.5 rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700">
                <MagnifyingGlassIcon width={12} height={12} className="shrink-0 text-zinc-400" aria-hidden />
                <input
                  value={paletteQuery}
                  onChange={(e) => setPaletteQuery(e.target.value)}
                  placeholder="Search components…"
                  aria-label="Search components"
                  className="w-full bg-transparent text-xs text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
                />
              </div>
              <p className="mt-1.5 px-1 text-[10px] leading-4 text-zinc-500">Drag onto the canvas, or click to place.</p>
            </div>
            {PALETTE_GROUPS.map((group) => {
              const items = group.items.filter((k) => DESIGN_KIND_LABELS[k].toLowerCase().includes(paletteQuery.trim().toLowerCase()));
              if (items.length === 0) return null;
              return (
                <div key={group.title} className="border-b border-zinc-100 px-2 py-2 dark:border-zinc-800/60">
                  <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{group.title}</div>
                  {items.map((kind) => (
                    <div
                      key={kind}
                      role="button"
                      tabIndex={0}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('application/x-design-kind', kind);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onClick={() => addKind(kind)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          addKind(kind);
                        }
                      }}
                      title={`Add ${DESIGN_KIND_LABELS[kind]}`}
                      className="group flex cursor-grab items-center gap-2 rounded px-1.5 py-1.5 text-xs text-zinc-700 hover:bg-zinc-100 active:cursor-grabbing dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: KIND_ACCENT[kind] }} aria-hidden />
                      <span className="flex-1 truncate">{DESIGN_KIND_LABELS[kind]}</span>
                      <PlusIcon width={12} height={12} className="shrink-0 text-zinc-300 opacity-0 transition group-hover:opacity-100 dark:text-zinc-600" aria-hidden />
                    </div>
                  ))}
                </div>
              );
            })}
            <div className="px-2 py-2">
              <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Annotate</div>
              <div
                role="button"
                tabIndex={0}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/x-studio-annot', 'note');
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => placeNode({ tab: 'note' })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    placeNode({ tab: 'note' });
                  }
                }}
                title="Sticky note — explain a decision inline"
                className="group flex cursor-grab items-center gap-2 rounded px-1.5 py-1.5 text-xs text-zinc-700 hover:bg-zinc-100 active:cursor-grabbing dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <Pencil2Icon width={13} height={13} className="shrink-0 text-amber-500" aria-hidden />
                <span className="flex-1">Note</span>
                <PlusIcon width={12} height={12} className="shrink-0 text-zinc-300 opacity-0 transition group-hover:opacity-100 dark:text-zinc-600" aria-hidden />
              </div>
              <div
                role="button"
                tabIndex={0}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/x-studio-annot', 'section');
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => placeNode({ tab: 'section' })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    placeNode({ tab: 'section' });
                  }
                }}
                title="Section frame — group components under a labeled area"
                className="group flex cursor-grab items-center gap-2 rounded px-1.5 py-1.5 text-xs text-zinc-700 hover:bg-zinc-100 active:cursor-grabbing dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <FrameIcon width={13} height={13} className="shrink-0 text-sky-500" aria-hidden />
                <span className="flex-1">Section</span>
                <PlusIcon width={12} height={12} className="shrink-0 text-zinc-300 opacity-0 transition group-hover:opacity-100 dark:text-zinc-600" aria-hidden />
              </div>
            </div>
            <div className="mt-auto px-3 py-2 text-[10px] leading-4 text-zinc-400">
              Ctrl+Z undo · Ctrl+D duplicate · Del delete · Shift+drag selects
            </div>
          </aside>
        )}
        <ResizableSplit
          storageKey="backend-roadmap:split:design-inner"
          defaultPct={layout === 'studio' ? 62 : 55}
          minPct={30}
          maxPct={70}
          left={
            <div ref={flowWrapperRef} className="relative h-full min-h-[300px]">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
                onConnect={onConnect}
                onInit={(instance) => {
                  reactFlowRef.current = instance;
                }}
                onDrop={onPaletteDrop}
                onDragOver={onPaletteDragOver}
                onNodeDragStart={onNodeDragStart}
                onNodeDragStop={onNodeDragStop}
                onMove={(_e, viewport) => setZoom((z) => (Math.abs(z - viewport.zoom) < 0.005 ? z : viewport.zoom))}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                minZoom={0.2}
                maxZoom={2}
                colorMode={theme === 'dark' ? 'dark' : 'light'}
                proOptions={{ hideAttribution: false }}
                deleteKeyCode={['Backspace', 'Delete']}
                panOnScroll
                selectionOnDrag
                panOnDrag={[1, 2]}
              >
                <Background variant={BackgroundVariant.Dots} gap={24} size={1} color={theme === 'dark' ? '#27272a' : '#e4e4e7'} />
                <Controls />
                {showMap && (
                  <MiniMap
                    pannable
                    zoomable
                    className="!border !border-zinc-200 !bg-white/90 dark:!border-zinc-700 dark:!bg-zinc-900/90"
                    maskColor={theme === 'dark' ? 'rgba(9, 9, 11, 0.7)' : 'rgba(244, 244, 245, 0.7)'}
                  />
                )}
              </ReactFlow>
              {phase === 'idle' && (
                <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded bg-zinc-900/85 px-3 py-1.5 text-xs text-zinc-200 dark:bg-zinc-100/90 dark:text-zinc-900">
                  {t(locale, 'pressPlayHint')}
                </div>
              )}
            </div>
          }
          right={
            <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3">
              {(selectedNodes.length > 0 || selectedEdges.length > 0) && (
                <div className="rounded-lg border border-sky-500/40 bg-white p-3 dark:border-sky-500/30 dark:bg-zinc-900" aria-label="Selection inspector">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      {selectedNodes.length > 1
                        ? `${selectedNodes.length} selected`
                        : selectedNodes.length === 1
                          ? selectedNodes[0].type === 'note'
                            ? 'Note'
                            : selectedNodes[0].type === 'section'
                              ? 'Section'
                              : DESIGN_KIND_LABELS[(selectedNodes[0].data as unknown as CanvasNodeData).kind] ?? 'Component'
                          : `${selectedEdges.length} connection${selectedEdges.length === 1 ? '' : 's'}`}
                    </span>
                    <button onClick={deleteSelected} title="Delete selection (Del)" className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-zinc-500 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400">
                      <TrashIcon width={12} height={12} aria-hidden />Delete
                    </button>
                  </div>
                  {selectedNodes.length === 1 && selectedNodes[0].type === 'design' && (
                    <label className="mt-2 block text-xs text-zinc-600 dark:text-zinc-300">
                      Label
                      <input
                        value={(selectedNodes[0].data as unknown as CanvasNodeData).label}
                        onFocus={() => studioEditBridge.begin?.()}
                        onBlur={() => studioEditBridge.end?.()}
                        onChange={(e) => {
                          const label = e.target.value;
                          const id = selectedNodes[0].id;
                          setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, label } } : n)));
                        }}
                        className="mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800"
                      />
                    </label>
                  )}
                  {selectedNodes.length === 1 && selectedNodes[0].type === 'note' && (
                    <div className="mt-2">
                      <div className="flex gap-1.5" aria-label="Note color">
                        {NOTE_COLORS.map((c) => (
                          <button
                            key={c}
                            onClick={() => {
                              studioEditBridge.begin?.();
                              const id = selectedNodes[0].id;
                              setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, color: c } } : n)));
                              studioEditBridge.end?.();
                            }}
                            title={c}
                            aria-label={`Note color ${c}`}
                            className={`h-5 w-5 rounded-full ring-offset-1 ${(selectedNodes[0].data as unknown as NoteNodeData).color === c ? 'ring-2 ring-sky-500' : 'ring-1 ring-black/20'}`}
                            style={{ background: c }}
                          />
                        ))}
                      </div>
                      <textarea
                        value={(selectedNodes[0].data as unknown as NoteNodeData).text}
                        rows={3}
                        onFocus={() => studioEditBridge.begin?.()}
                        onBlur={() => studioEditBridge.end?.()}
                        onChange={(e) => {
                          const text = e.target.value;
                          const id = selectedNodes[0].id;
                          setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, text } } : n)));
                        }}
                        placeholder="Write an annotation…"
                        aria-label="Note text"
                        className="mt-2 w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800"
                      />
                    </div>
                  )}
                  {selectedNodes.length === 1 && selectedNodes[0].type === 'section' && (
                    <div className="mt-2">
                      <label className="block text-xs text-zinc-600 dark:text-zinc-300">
                        Title
                        <input
                          value={(selectedNodes[0].data as unknown as SectionNodeData).title}
                          onFocus={() => studioEditBridge.begin?.()}
                          onBlur={() => studioEditBridge.end?.()}
                          onChange={(e) => {
                            const title = e.target.value;
                            const id = selectedNodes[0].id;
                            setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, title } } : n)));
                          }}
                          className="mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800"
                        />
                      </label>
                      <div className="mt-2 flex gap-1.5" aria-label="Section color">
                        {(Object.keys(SECTION_STYLES) as SectionColor[]).map((c) => (
                          <button
                            key={c}
                            onClick={() => {
                              studioEditBridge.begin?.();
                              const id = selectedNodes[0].id;
                              setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, color: c } } : n)));
                              studioEditBridge.end?.();
                            }}
                            title={c}
                            aria-label={`Section color ${c}`}
                            className={`h-5 w-8 rounded ring-offset-1 ${(selectedNodes[0].data as unknown as SectionNodeData).color === c ? 'ring-2 ring-sky-500' : 'ring-1 ring-black/20'} ${SECTION_STYLES[c].chip}`}
                          />
                        ))}
                      </div>
                      <button onClick={ungroupSelectedSections} className="mt-2 inline-flex items-center gap-1 rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:border-sky-500/60 hover:text-sky-600 dark:border-zinc-700 dark:text-zinc-300">
                        Ungroup section
                      </button>
                    </div>
                  )}
                  {selectedNodes.length > 1 && (
                    <button onClick={groupIntoSection} className="mt-2 inline-flex items-center gap-1 rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:border-sky-500/60 hover:text-sky-600 dark:border-zinc-700 dark:text-zinc-300">
                      <GroupIcon width={12} height={12} aria-hidden />Group into section
                    </button>
                  )}
                </div>
              )}
              <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Live metrics</span>
                  <span className="font-mono text-xs text-zinc-500">{fmtClock(clock)} · {speed}×</span>
                </div>
                <div className="mt-1 grid grid-cols-3 gap-2 font-mono text-center">
                  <div className="rounded bg-zinc-50 px-1 py-1.5 dark:bg-zinc-950"><div className="flex items-center justify-center gap-1 text-[10px] text-zinc-500"><TimerIcon width={11} height={11} aria-hidden />p99</div><div className="text-sm text-emerald-600 dark:text-emerald-400">{metrics ? `${metrics.p99Ms}ms` : '—'}</div></div>
                  <div className="rounded bg-zinc-50 px-1 py-1.5 dark:bg-zinc-950"><div className="flex items-center justify-center gap-1 text-[10px] text-zinc-500"><ExclamationTriangleIcon width={11} height={11} aria-hidden />errors</div><div className={`text-sm ${metrics && metrics.errPct > 5 ? 'text-red-600 dark:text-red-400' : 'text-zinc-500 dark:text-zinc-200'}`}>{metrics ? `${metrics.errPct}%` : '—'}</div></div>
                  <div className="rounded bg-zinc-50 px-1 py-1.5 dark:bg-zinc-950"><div className="flex items-center justify-center gap-1 text-[10px] text-zinc-500"><ActivityLogIcon width={11} height={11} aria-hidden />rps</div><div className="text-sm text-sky-600 dark:text-sky-400">{metrics ? metrics.rps : '—'}</div></div>
                </div>
                <div className="mt-2 flex h-8 items-end gap-[2px]" aria-hidden>
                  {spark.map((v, i) => (
                    <div key={i} className="min-w-[2px] flex-1 rounded-sm bg-sky-500/60" style={{ height: `${Math.min(100, Math.max(4, (v / Math.max(1, ...spark)) * 100))}%` }} />
                  ))}
                  {spark.length === 0 && <div className="text-[10px] text-zinc-600">throughput history appears while playing</div>}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                  <label className="block">QPS <span className="font-mono">{qps}</span>
                    <input type="range" min={10} max={3000} step={10} value={qps} onChange={(e) => onQps(Number(e.target.value))} className="mt-1 w-full" aria-label="Queries per second" />
                  </label>
                  <label className="block">Reads <span className="font-mono">{readPct}%</span>
                    <input type="range" min={0} max={100} step={5} value={readPct} onChange={(e) => onReadPct(Number(e.target.value))} className="mt-1 w-full" aria-label="Read percentage" />
                  </label>
                </div>
                <p className="mt-1 text-[10px] text-zinc-500">Sliders apply live. Editing topology restarts the run on next Play.</p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500"><MagnifyingGlassIcon width={13} height={13} aria-hidden />Inspect a request</div>
                <div className="mt-1 flex gap-1.5">
                  <select value={inspectId} onChange={(e) => setInspectId(e.target.value === '' ? '' : Number(e.target.value))} className="min-w-0 flex-1 rounded border border-zinc-300 bg-white px-2 py-1 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-800" aria-label="Select request to inspect">
                    <option value="">{recentTraces.length === 0 ? 'Run or step to capture requests' : 'Pick a request…'}</option>
                    {recentTraces.map((t) => (
                      <option key={t.id} value={t.id}>req#{t.id} · {t.latencyMs}ms{t.hit ? ' · HIT' : ''}{t.error ? ` · ${t.error}` : ''}</option>
                    ))}
                  </select>
                </div>
                {inspected && (
                  <ol className="mt-2 space-y-0.5 font-mono text-[11px] leading-4">
                    {inspected.hops.map((h, i) => (
                      <li key={i} className="text-zinc-700 dark:text-zinc-300"><span className="text-sky-600 dark:text-sky-400">{i + 1}.</span> {h.nodeId} <span className="text-zinc-500">+{Math.round((h.departed - h.arrived) * 1000)}ms</span></li>
                    ))}
                    <li className="pt-1 text-emerald-700 dark:text-emerald-300">= {inspected.latencyMs}ms total{inspected.hit ? ' (cache hit)' : ''}{inspected.error ? ` — ${inspected.error}` : ''}</li>
                  </ol>
                )}
              </div>
              <div ref={logRef} className="min-h-[120px] flex-1 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs leading-5" aria-label="Simulation event log" aria-live="off">
                {log.length === 0 && <span className="text-zinc-500">Event log — play the simulation and watch requests, spikes, and failures stream by.</span>}
                {log.map((line, i) => (
                  <div key={`${i}-${line.slice(0, 12)}`} className={line.startsWith('…') ? 'text-zinc-500' : line.startsWith('Add a') || line.startsWith('Connect') || line.startsWith('No request') || line.startsWith('A connection') ? 'text-red-400' : line.includes('failed') || line.includes('Spike') || line.includes('spike') ? 'text-amber-300' : line.includes('recovered') || line.includes('Objective') ? 'text-emerald-300' : 'text-zinc-300'}>{line}</div>
                ))}
                {mode === 'guided' && hasWon && <div className="mt-1 font-sans text-xs font-semibold text-emerald-600 dark:text-emerald-400">{preset.objective.winMessage}</div>}
              </div>
            </div>
          }
        />
      </div>
      {layout === 'studio' && (
        <div className="flex shrink-0 items-center gap-3 border-t border-zinc-200 bg-white px-4 py-1.5 text-[11px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400" aria-label="Canvas status">
          <span className="hidden font-mono xl:inline">SCROLL TO PAN · CTRL+SCROLL TO ZOOM · SHIFT+DRAG TO SELECT</span>
          <span className="font-mono">{designCount} COMPONENTS · {edges.length} CONNECTIONS</span>
          <span className="ml-auto inline-flex items-center gap-1">
            <button
              onClick={() => setShowMap((v) => !v)}
              aria-pressed={showMap}
              title="Toggle minimap"
              className={`rounded px-1.5 py-0.5 font-mono ${showMap ? 'bg-sky-600 text-white' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
            >
              MAP
            </button>
            <button
              onClick={() => reactFlowRef.current?.zoomOut()}
              title="Zoom out"
              aria-label="Zoom out"
              className="rounded px-1.5 py-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <MinusIcon width={12} height={12} aria-hidden />
            </button>
            <span className="min-w-10 text-center font-mono">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => reactFlowRef.current?.zoomIn()}
              title="Zoom in"
              aria-label="Zoom in"
              className="rounded px-1.5 py-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <PlusIcon width={12} height={12} aria-hidden />
            </button>
            <button
              onClick={() => reactFlowRef.current?.fitView({ padding: 0.2 })}
              title="Fit canvas to view"
              aria-label="Fit canvas to view"
              className="rounded px-1.5 py-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <EnterFullScreenIcon width={12} height={12} aria-hidden />
            </button>
          </span>
        </div>
      )}

      {showHints && (
        <div className="max-h-[40vh] overflow-auto border-t border-zinc-200 bg-white px-4 py-3 text-xs leading-5 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">Patterns: </span>
          cache-first reads for read-heavy loads • LB + ≥2 app replicas for scale • gateway at the edge for policy •
          one writer per entity • shard when one DB saturates • queues absorb bursts • timeouts + backoff + idempotency as one mechanism.
        </div>
      )}
    </div>
  );
}

export default function SimulationStage(props: SimulationStageProps) {
  return (
    <ProgressProvider>
      <SimulationStageContent {...props} />
    </ProgressProvider>
  );
}
