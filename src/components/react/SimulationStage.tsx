import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  ActivityLogIcon,
  BarChartIcon,
  ChatBubbleIcon,
  CheckCircledIcon,
  CheckIcon,
  ClockIcon,
  Cross1Icon,
  CrossCircledIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  LightningBoltIcon,
  Link2Icon,
  MagnifyingGlassIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  QuestionMarkCircledIcon,
  ResetIcon,
  TargetIcon,
  TimerIcon,
  TrackNextIcon,
} from '@radix-ui/react-icons';
import { simulateTraffic, validateTopology } from '../../lib/design/engine';
import { createRun, type RequestTrace, type RunEvent, type RunHandle, type RunSummary } from '../../lib/design/player';
import { checkRunObjective, getPreset, initialStateFor, sloFor, starterNode } from '../../lib/design/presets';
import { timelineFor } from '../../lib/design/timelines';
import { DESIGN_KIND_LABELS, type DesignKind } from '../../lib/design/types';
import ResizableSplit from './ResizableSplit';
import { ProgressProvider, useProgressContext } from './ProgressProvider';
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

function DesignCanvasNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as CanvasNodeData;
  const horizontal = d.direction === 'horizontal';
  const updateNodeInternals = useUpdateNodeInternals();
  // Handle sides flip with direction — React Flow caches handle geometry, so
  // it must be notified or edges stay glued to the stale side (detached lines).
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, horizontal, updateNodeInternals]);
  return (
    <div
      className={`w-[150px] rounded-lg border-2 bg-white p-2 shadow-lg transition dark:bg-zinc-900/90 ${
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
        <div className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100">{d.label}</div>
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
    </div>
  );
}

const nodeTypes = { design: DesignCanvasNode };

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
              aria-label="Delete connection"
              title="Delete connection"
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

function SimulationStageContent({ skillId, scenarioId, layout }: SimulationStageProps) {
  const { getStatus, setStatus } = useProgressContext();
  const status = getStatus(skillId);
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
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  // (re)initialize canvas when scenario changes
  useEffect(() => {
    const fresh = initialStateFor(preset.id);
    setNodes(toFlowNodes(fresh, direction));
    setEdges(toFlowEdges(fresh));
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
    setReady(true);
  }, [preset.id, setNodes, setEdges]);

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
      nodes: nodes.map((n) => {
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
        nodes: nodes.map((n) => {
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
      onNodesChange(changes);
      if (changes.some((c) => c.type === 'remove')) touchTopology();
    },
    [onNodesChange, touchTopology],
  );

  const handleEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChange>[0]) => {
      onEdgesChange(changes);
      if (changes.some((c) => c.type === 'remove')) touchTopology();
    },
    [onEdgesChange, touchTopology],
  );

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
      const n = starterNode(kind, kind);
      const idx = nodes.length;
      setNodes((nds) => [
        ...nds,
        {
          id: n.id,
          type: 'design',
          position: layoutPos(idx, direction),
          data: { kind, label: DESIGN_KIND_LABELS[kind], bottleneck: false, failed: false, queued: 0, direction } satisfies CanvasNodeData,
        },
      ]);
      touchTopology();
    },
    [nodes.length, direction, setNodes, touchTopology],
  );

  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target || c.source === c.target) return;
      setEdges((eds) => addEdge({ ...c, type: 'flow', data: { flow: 0, failed: false, rps: 0 } satisfies FlowEdgeData, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: '#71717a', strokeWidth: 2.5 } }, eds));
      touchTopology();
    },
    [setEdges, touchTopology],
  );

  const inspected = useMemo(
    () => recentTraces.find((t) => t.id === inspectId) ?? null,
    [recentTraces, inspectId],
  );

  const objective = mode === 'free' ? getPreset('free').objective : preset.objective;
  const slo = sloFor(preset.id);

  if (!ready) return <div className="flex h-full items-center justify-center text-xs text-zinc-500">Loading simulation…</div>;

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-50 dark:bg-zinc-950">
      {layout === 'studio' && (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-zinc-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900" aria-label="Scenario library">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Scenarios:</span>
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
      <div className="shrink-0 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-sky-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">Design Simulation</span>
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{objective.title}</span>
              {hasWon && <span className="inline-flex items-center gap-1 rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white"><CheckIcon width={11} height={11} aria-hidden />Objective met</span>}
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
            <div className="flex overflow-hidden rounded border border-zinc-200 dark:border-zinc-700" role="tablist" aria-label="Canvas direction">
              {(['vertical', 'horizontal'] as const).map((d) => (
                <button
                  key={d}
                  role="tab"
                  aria-selected={direction === d}
                  title={d === 'vertical' ? 'Top-down view' : 'Left-to-right view'}
                  onClick={() => { if (direction !== d) toggleDirection(); }}
                  className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium capitalize transition ${direction === d ? 'bg-sky-600 text-white' : 'bg-white text-zinc-500 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'}`}
                >
                  {d === 'vertical' ? '↕ Top-down' : '↔ Horizontal'}
                </button>
              ))}
            </div>
            <div className="flex overflow-hidden rounded border border-zinc-200 dark:border-zinc-700" role="tablist" aria-label="Simulation mode">
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
              Patterns
            </button>
            <button
              onClick={() => restartRun('Canvas reset')}
              className="inline-flex items-center gap-1 rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              <ResetIcon width={13} height={13} className="shrink-0" aria-hidden />
              Reset
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
        {/* transport */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5" aria-label="Playback controls">
          {phase !== 'playing' ? (
            <button onClick={onPlay} className="inline-flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500"><PlayIcon width={13} height={13} className="shrink-0" aria-hidden />Play</button>
          ) : (
            <button onClick={onPause} className="inline-flex items-center gap-1.5 rounded bg-amber-500 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-400"><PauseIcon width={13} height={13} className="shrink-0" aria-hidden />Pause</button>
          )}
          <button onClick={onStepOnce} title="Advance 0.2 simulated seconds" className="inline-flex items-center gap-1.5 rounded bg-zinc-100 px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"><TrackNextIcon width={13} height={13} className="shrink-0" aria-hidden />Step</button>
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
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Add components">
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
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <ResizableSplit
          storageKey="backend-roadmap:split:design-inner"
          defaultPct={layout === 'studio' ? 62 : 55}
          minPct={30}
          maxPct={70}
          left={
            <div className="relative h-full min-h-[300px]">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                minZoom={0.3}
                maxZoom={1.5}
                colorMode={theme === 'dark' ? 'dark' : 'light'}
                proOptions={{ hideAttribution: false }}
                deleteKeyCode={['Backspace', 'Delete']}
              >
                <Background variant={BackgroundVariant.Dots} gap={24} size={1} color={theme === 'dark' ? '#27272a' : '#e4e4e7'} />
                <Controls />
              </ReactFlow>
              {phase === 'idle' && (
                <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded bg-zinc-900/85 px-3 py-1.5 text-xs text-zinc-200 dark:bg-zinc-100/90 dark:text-zinc-900">
                  Press Play — requests will flow through your architecture live
                </div>
              )}
            </div>
          }
          right={
            <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3">
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
