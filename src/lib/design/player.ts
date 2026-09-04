import { BASE_LATENCY_MS, findRequestPath, validateTopology } from './engine';
import { DESIGN_KIND_LABELS, type DesignKind } from './types';

export interface PlayerTopology {
  nodes: { id: string; kind: DesignKind }[];
  edges: { from: string; to: string }[];
}

export interface PlayerOpts {
  qps: number;
  readRatio: number;
  seed?: number;
  failedKinds?: DesignKind[];
}

export type SimTrigger =
  | { type: 'spike'; factor: number; secs: number }
  | { type: 'fail'; kind: DesignKind }
  | { type: 'heal'; kind: DesignKind }
  | { type: 'note'; text: string };

export interface Hop {
  nodeId: string;
  arrived: number;
  departed: number;
}

export interface RequestTrace {
  id: number;
  path: string[];
  hops: Hop[];
  latencyMs: number;
  hit?: boolean;
  error?: string;
}

export interface RunEvent {
  t: number;
  kind: 'spawned' | 'hop' | 'completed' | 'dropped' | 'trigger' | 'note';
  text: string;
  requestId?: number;
  nodeId?: string;
}

export interface NodeLoad {
  inFlight: number;
  queue: number;
  served: number;
  errors: number;
}

export interface RunSummary {
  simSec: number;
  completed: number;
  errors: number;
  p99Ms: number;
  errPct: number;
  rps: number;
  bottleneck: string;
  loadByKind: Record<string, NodeLoad>;
}

export interface InFlightPacket {
  requestId: number;
  edgeKey: string;
  fromId: string;
  toId: string;
  progress: number;
  hit?: boolean;
  error?: boolean;
}

export interface RunHandle {
  tick(dtSec: number): RunEvent[];
  trigger(ev: SimTrigger): RunEvent[];
  retune(qps: number, readRatio: number): void;
  snapshot(): { simSec: number; loads: Record<string, NodeLoad>; inFlight: InFlightPacket[] };
  summarize(): RunSummary;
  traces(): RequestTrace[];
}

/** Deterministic PRNG — same seed replays the identical run. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LOAD_SENSITIVE: DesignKind[] = ['app', 'sql', 'nosql', 'storage'];

interface LiveRequest {
  id: number;
  path: string[];
  hopIdx: number;
  hopElapsed: number;
  serviceNeeded: number;
  hopTotal: number;
  waited: number;
  hit: boolean;
  hops: Hop[];
  done: boolean;
}

function serviceTime(kind: DesignKind, qps: number, rand: () => number): number {
  let ms = BASE_LATENCY_MS[kind];
  if (LOAD_SENSITIVE.includes(kind)) ms *= 1 + Math.max(0, qps) / 2000;
  return (ms / 1000) * (0.8 + rand() * 0.4);
}

export function createRun(topo: PlayerTopology, opts: PlayerOpts): RunHandle {
  const rand = mulberry32(opts.seed ?? 7);
  const structural = validateTopology({
    nodes: topo.nodes.map((n) => ({ id: n.id, kind: n.kind, label: n.id })),
    edges: topo.edges.map((e, i) => ({ id: `e${i}`, from: e.from, to: e.to })),
    scenario: { qps: opts.qps, readRatio: opts.readRatio, failedKind: null },
  });
  const broken = structural.length > 0;
  const announced = false;

  const kindOf = new Map(topo.nodes.map((n) => [n.id, n.kind]));
  const replicas = new Map<DesignKind, number>();
  for (const n of topo.nodes) replicas.set(n.kind, (replicas.get(n.kind) ?? 0) + 1);

  let simSec = 0;
  let seq = 0;
  let carry = 0;
  let qps = Math.max(1, Math.round(opts.qps));
  let readRatio = Math.min(1, Math.max(0, opts.readRatio));
  const failed = new Set<DesignKind>(opts.failedKinds ?? []);
  const queues = new Map<string, LiveRequest[]>();
  const live = new Map<number, LiveRequest>();
  const traces: RequestTrace[] = [];
  const latencies: number[] = [];
  const loads = new Map<string, NodeLoad>();
  let served = 0;
  let errored = 0;
  let spikeUntil = -1;
  let spikeFactor = 1;

  const loadOf = (kind: DesignKind): NodeLoad => {
    let l = loads.get(kind);
    if (!l) {
      l = { inFlight: 0, queue: 0, served: 0, errors: 0 };
      loads.set(kind, l);
    }
    return l;
  };

  const basePath: string[] = broken
    ? []
    : findRequestPath({
        nodes: topo.nodes.map((n) => ({ id: n.id, kind: n.kind, label: n.id })),
        edges: topo.edges.map((e, i) => ({ id: `e${i}`, from: e.from, to: e.to })),
        scenario: { qps, readRatio, failedKind: null },
      });

  const hasCachePath = basePath.some((id) => kindOf.get(id) === 'cache');
  const cacheEffective = hasCachePath && readRatio >= 0.5;

  function finish(req: LiveRequest, error?: string) {
    req.done = true;
    live.delete(req.id);
    const total = req.hops.reduce((a, h) => a + Math.max(0, h.departed - h.arrived), 0);
    const trace: RequestTrace = {
      id: req.id,
      path: req.path,
      hops: req.hops,
      latencyMs: Math.round(total * 1000),
      hit: req.hit || undefined,
      error,
    };
    traces.push(trace);
    if (traces.length > 300) traces.shift();
    if (error) {
      errored += 1;
    } else {
      served += 1;
      latencies.push(trace.latencyMs);
      if (latencies.length > 2000) latencies.splice(0, latencies.length - 2000);
    }
  }

  function startHop(req: LiveRequest, events: RunEvent[], t: number) {
    const nodeId = req.path[req.hopIdx];
    const kind = kindOf.get(nodeId)!;
    if (kind === 'client') {
      // traffic source: zero-service pass-through, never queues
      req.hops.push({ nodeId, arrived: t, departed: t });
      req.hopIdx += 1;
      if (req.hopIdx >= req.path.length) finish(req);
      else startHop(req, events, t);
      return;
    }
    if (failed.has(kind)) {
      // stall once, then count as degraded-but-served with penalty (client never fails: pass-through above)
      req.hops.push({ nodeId, arrived: t, departed: t + 0.15 });
      req.waited += 0.15;
      events.push({ t, kind: 'hop', text: `req#${req.id} ${DESIGN_KIND_LABELS[kind]} degraded — rerouted (+150ms)`, requestId: req.id, nodeId });
      req.hopIdx += 1;
      if (req.hopIdx >= req.path.length) finish(req);
      else startHop(req, events, t);
      return;
    }
    const q = queues.get(nodeId) ?? [];
    const cap = 50 * (replicas.get(kind) ?? 1);
    if (q.length >= cap) {
      loadOf(kind).errors += 1;
      events.push({ t, kind: 'dropped', text: `req#${req.id} dropped at ${DESIGN_KIND_LABELS[kind]} — queue full`, requestId: req.id, nodeId });
      finish(req, 'queue-full');
      return;
    }
    // arrival stamped at enqueue so queue wait counts toward latency
    req.hops.push({ nodeId, arrived: t, departed: 0 });
    req.hopElapsed = 0;
    req.serviceNeeded = 0;
    q.push(req);
    queues.set(nodeId, q);
    loadOf(kind).queue = q.length;
  }

  function serveQueues(dt: number, events: RunEvent[], t: number) {
    // path order first so downstream hops progress in the same tick they arrive
    const order = [...basePath, ...Array.from(queues.keys()).filter((id) => !basePath.includes(id))];
    for (const nodeId of order) {
      const q = queues.get(nodeId);
      if (!q || q.length === 0) continue;
      const kind = kindOf.get(nodeId)!;
      // parallel workers: up to 16×replicas concurrent services per node
      const slots = 16 * (replicas.get(kind) ?? 1);
      const active = Math.min(q.length, slots);
      for (let i = 0; i < active; i++) {
        const r = q[i];
        if (r.serviceNeeded <= 0) {
          r.serviceNeeded = kind === 'queue' ? 0.001 : serviceTime(kind, qps, rand);
          r.hopTotal = r.serviceNeeded;
        }
      }
      const done: LiveRequest[] = [];
      for (let i = 0; i < active; i++) {
        const r = q[i];
        r.hopElapsed += dt;
        if (r.hopElapsed >= r.serviceNeeded) done.push(r);
      }
      for (const r of done) {
        q.splice(q.indexOf(r), 1);
        const hop = r.hops[r.hops.length - 1];
        // completions stamp at substep end (≤20ms quantization — see SUBSTEP note)
        hop.departed = Math.max(t, hop.arrived);
        loadOf(kind).served += 1;
        const doneAt = hop.departed;
        events.push({ t: doneAt, kind: 'hop', text: `req#${r.id} → ${DESIGN_KIND_LABELS[kind]} ${Math.round((hop.departed - hop.arrived) * 1000)}ms`, requestId: r.id, nodeId });
        // cache shortcut: reads complete here
        if (kind === 'cache' && rand() < readRatio * 0.85 && readRatio >= 0.5) {
          r.hit = true;
          finish(r);
          continue;
        }
        r.hopIdx += 1;
        r.hopElapsed = 0;
        r.serviceNeeded = 0;
        if (r.hopIdx >= r.path.length) finish(r);
        else startHop(r, events, doneAt);
      }
      const l = loadOf(kind);
      l.queue = q.length;
      l.inFlight = q.length;
    }
  }

  function spawn(dt: number, events: RunEvent[], tickStart: number) {
    const active = simSec < spikeUntil ? qps * spikeFactor : qps;
    carry += (active * dt) / 1;
    let n = Math.floor(carry);
    carry -= n;
    for (let i = 0; i < n; i++) {
      seq += 1;
      const req: LiveRequest = { id: seq, path: basePath, hopIdx: 0, hopElapsed: 0, serviceNeeded: 0, hopTotal: 0, waited: 0, hit: false, hops: [], done: false };
      live.set(seq, req);
      // spread arrivals across the substep so fast hops can't predate arrival
      startHop(req, events, tickStart + (dt * (i + 1)) / Math.max(1, n));
    }
  }

  let announcedBroken = announced;

  /** Fixed-step accuracy: service times (~ms) are finer than a frame, so each
   * tick is subdivided into ≤20ms substeps. Deterministic for identical call
   * sequences. */
  const SUBSTEP = 0.02;

  return {
    tick(dtSec: number): RunEvent[] {
      const events: RunEvent[] = [];
      if (broken) {
        if (!announcedBroken) {
          announcedBroken = true;
          for (const s of structural) events.push({ t: simSec, kind: 'note', text: s });
        }
        return events;
      }
      let remaining = Math.min(Math.max(dtSec, 0), 0.5);
      while (remaining > 1e-9) {
        const dt = Math.min(SUBSTEP, remaining);
        remaining -= dt;
        simSec += dt;
        const tickStart = simSec - dt;
        spawn(dt, events, tickStart);
        serveQueues(dt, events, simSec);
      }
      return events;
    },
    trigger(ev: SimTrigger): RunEvent[] {
      const events: RunEvent[] = [];
      if (ev.type === 'spike') {
        spikeUntil = simSec + ev.secs;
        spikeFactor = ev.factor;
        events.push({ t: simSec, kind: 'trigger', text: `Traffic spike ×${ev.factor} for ${ev.secs}s — watch the queues.` });
      } else if (ev.type === 'fail') {
        failed.add(ev.kind);
        events.push({ t: simSec, kind: 'trigger', text: `${DESIGN_KIND_LABELS[ev.kind]} failed — traffic reroutes degraded.` });
      } else if (ev.type === 'heal') {
        failed.delete(ev.kind);
        events.push({ t: simSec, kind: 'trigger', text: `${DESIGN_KIND_LABELS[ev.kind]} recovered — steady state resumes.` });
      } else {
        events.push({ t: simSec, kind: 'note', text: ev.text });
      }
      return events;
    },
    retune(nextQps: number, nextReadRatio: number): void {
      qps = Math.max(1, Math.round(nextQps));
      readRatio = Math.min(1, Math.max(0, nextReadRatio));
    },
    snapshot() {
      const inFlight: InFlightPacket[] = [];
      for (const req of live.values()) {
        if (req.hopIdx >= req.path.length) continue;
        const nodeId = req.path[req.hopIdx];
        const prev = req.hopIdx === 0 ? null : req.path[req.hopIdx - 1];
        if (!prev) continue;
        inFlight.push({
          requestId: req.id,
          edgeKey: `${prev}→${nodeId}`,
          fromId: prev,
          toId: nodeId,
          progress: req.serviceNeeded > 0 ? Math.min(1, req.hopElapsed / req.serviceNeeded) : 0,
          hit: req.hit || undefined,
        });
        if (inFlight.length >= 120) break;
      }
      const out: Record<string, NodeLoad> = {};
      for (const [k, v] of loads) out[k] = { ...v };
      return { simSec, loads: out, inFlight };
    },
    summarize(): RunSummary {
      const sorted = [...latencies].sort((a, b) => a - b);
      const p99 = sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))];
      const total = served + errored;
      // bottleneck: kind with most queue pressure, fallback to slowest base on path
      let bottleneck = '—';
      let worst = -1;
      for (const [kind, l] of loads) {
        const pressure = l.queue + l.errors;
        if (pressure > worst) {
          worst = pressure;
          bottleneck = DESIGN_KIND_LABELS[kind as DesignKind] ?? kind;
        }
      }
      if (worst <= 0 && basePath.length > 0) {
        let slowest = 0;
        for (const id of basePath) {
          const k = kindOf.get(id)!;
          if (k === 'queue') continue;
          if (BASE_LATENCY_MS[k] > slowest) {
            slowest = BASE_LATENCY_MS[k];
            bottleneck = DESIGN_KIND_LABELS[k];
          }
        }
      }
      const out: Record<string, NodeLoad> = {};
      for (const [k, v] of loads) out[k] = { ...v };
      return {
        simSec: Math.round(simSec * 10) / 10,
        completed: served,
        errors: errored,
        p99Ms: p99,
        errPct: total === 0 ? 0 : Math.round((errored / total) * 1000) / 10,
        rps: simSec > 0 ? Math.round((total / simSec) * 10) / 10 : 0,
        bottleneck,
        loadByKind: out,
      };
    },
    traces(): RequestTrace[] {
      return [...traces];
    },
  };
}

/** Headless helper: advance in 0.1s steps, firing triggers at marks. */
export function runToCompletion(
  topo: PlayerTopology,
  opts: PlayerOpts,
  maxSec: number,
  triggers?: { at: number; ev: SimTrigger }[],
): { summary: RunSummary; events: RunEvent[] } {
  const handle = createRun(topo, opts);
  const events: RunEvent[] = [];
  const marks = [...(triggers ?? [])].sort((a, b) => a.at - b.at);
  let t = 0;
  while (t < maxSec) {
    while (marks.length > 0 && marks[0].at <= t) {
      const m = marks.shift()!;
      events.push(...handle.trigger(m.ev));
    }
    events.push(...handle.tick(0.1));
    t += 0.1;
  }
  return { summary: handle.summarize(), events };
}
