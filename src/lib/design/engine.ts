import {
  DESIGN_KIND_LABELS,
  SINK_KINDS,
  type DesignKind,
  type DesignPreset,
  type DesignResult,
  type DesignState,
} from './types';

/** Base per-hop latency in ms. Queue is async: 0 blocking, noted separately. */
export const BASE_LATENCY_MS: Record<DesignKind, number> = {
  client: 5,
  cdn: 10,
  lb: 2,
  gateway: 4,
  app: 20,
  cache: 3,
  sql: 25,
  nosql: 12,
  queue: 0,
  storage: 30,
};

/** Kinds that feel load pressure (replicas help). */
const LOAD_SENSITIVE: DesignKind[] = ['app', 'sql', 'nosql', 'storage'];

function nodeById(state: DesignState, id: string) {
  return state.nodes.find((n) => n.id === id);
}

function adjacency(state: DesignState): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const n of state.nodes) adj.set(n.id, []);
  for (const e of state.edges) {
    if (adj.has(e.from) && adj.has(e.to)) adj.get(e.from)!.push(e.to);
  }
  return adj;
}

/** BFS path of node ids from any client to any sink. Returns [] when unreachable. */
export function findRequestPath(state: DesignState): string[] {
  const adj = adjacency(state);
  const starts = state.nodes.filter((n) => n.kind === 'client').map((n) => n.id);
  const sinks = new Set(state.nodes.filter((n) => SINK_KINDS.includes(n.kind)).map((n) => n.id));
  const visited = new Set<string>();
  const queue: string[][] = starts.map((s) => [s]);
  for (const s of starts) visited.add(s);
  while (queue.length > 0) {
    const path = queue.shift()!;
    const head = path[path.length - 1];
    if (sinks.has(head)) return path;
    for (const next of adj.get(head) ?? []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push([...path, next]);
      }
    }
  }
  return [];
}

/** True when a directed path exists from any of `fromKinds` to any of `toKinds`. */
export function hasPath(state: DesignState, fromKinds: DesignKind[], toKinds: DesignKind[]): boolean {
  const adj = adjacency(state);
  const starts = state.nodes.filter((n) => fromKinds.includes(n.kind)).map((n) => n.id);
  const targets = new Set(state.nodes.filter((n) => toKinds.includes(n.kind)).map((n) => n.id));
  const visited = new Set<string>(starts);
  const queue = [...starts];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (targets.has(cur)) return true;
    for (const next of adj.get(cur) ?? []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return false;
}

export function countKind(state: DesignState, kind: DesignKind): number {
  return state.nodes.filter((n) => n.kind === kind).length;
}

/** Plain-language structural problems. Empty means the topology is simulatable. */
export function validateTopology(state: DesignState): string[] {
  const errors: string[] = [];
  if (countKind(state, 'client') === 0) errors.push('Add a Client — every request path starts there.');
  const sinks = state.nodes.filter((n) => SINK_KINDS.includes(n.kind));
  if (sinks.length === 0) errors.push('Add a data sink (SQL, NoSQL, or Storage) — requests must land somewhere durable.');
  const connected = new Set<string>();
  for (const e of state.edges) {
    connected.add(e.from);
    connected.add(e.to);
  }
  const lonely = state.nodes.filter((n) => !connected.has(n.id) && state.nodes.length > 1);
  if (lonely.length > 0) errors.push(`Connect ${lonely.map((n) => n.label).join(', ')} — isolated components carry no traffic.`);
  if (errors.length === 0 && findRequestPath(state).length === 0) {
    errors.push('No request path from Client to a data sink — connect the chain.');
  }
  // dangling edge endpoints (shouldn't happen via UI, but engine never throws)
  for (const e of state.edges) {
    if (!nodeById(state, e.from) || !nodeById(state, e.to)) {
      errors.push('A connection points to a removed component — delete and reconnect it.');
      break;
    }
  }
  return errors;
}

export function simulateTraffic(state: DesignState): DesignResult {
  const notes: string[] = [];
  const structural = validateTopology(state);
  if (structural.length > 0) {
    return { p99Ms: 0, bottleneck: '—', notes: structural, passed: false };
  }

  const { qps, readRatio, failedKind } = state.scenario;
  const pathIds = findRequestPath(state);
  const path = pathIds.map((id) => nodeById(state, id)!);
  const kinds = path.map((n) => n.kind);

  const loadFactor = 1 + Math.max(0, qps) / 2000;
  const hasCache = kinds.includes('cache');
  const cacheEffective = hasCache && readRatio >= 0.5;
  if (hasCache && readRatio < 0.5) {
    notes.push('Write-heavy traffic — the cache helps reads but most requests still hit durable storage.');
  }

  const contributions = new Map<DesignKind, number>();
  let total = 0;
  for (const kind of kinds) {
    if (kind === 'queue') {
      notes.push('Queue decouples slow work — requests return fast, workers drain async (+15ms background).');
      continue;
    }
    let ms = BASE_LATENCY_MS[kind];
    if (LOAD_SENSITIVE.includes(kind)) ms *= loadFactor;
    // cache-first reads shortcut durable hops
    if (cacheEffective && (kind === 'sql' || kind === 'nosql' || kind === 'storage')) {
      const served = Math.round(readRatio * 85);
      notes.push(`Cache-first reads serve ~${served}% of reads from memory — durable hop sees ~${100 - served}%.`);
      ms *= 1 - readRatio * 0.85;
    }
    if (kind === 'cdn' && cacheEffective) {
      ms = 3;
      notes.push('CDN edge serves hot reads near the user (~3ms).');
    }
    if (failedKind && kind === failedKind) {
      ms += 150;
      notes.push(`${DESIGN_KIND_LABELS[kind]} is degraded — traffic reroutes with +150ms penalty.`);
    }
    total += ms;
    contributions.set(kind, (contributions.get(kind) ?? 0) + ms);
  }

  if (failedKind && !kinds.includes(failedKind)) {
    notes.push(`Failure injection targets ${DESIGN_KIND_LABELS[failedKind]}, which is not on the request path — no impact.`);
  }
  if (qps >= 5000) notes.push('High QPS — consider more app replicas behind the load balancer.');

  let bottleneck = '—';
  let worst = 0;
  for (const [kind, ms] of contributions) {
    if (ms > worst) {
      worst = ms;
      bottleneck = DESIGN_KIND_LABELS[kind];
    }
  }

  const p99Ms = Math.round(total);
  notes.unshift(`Simulated estimate: p99 ~${p99Ms}ms at ${qps} QPS (${Math.round(readRatio * 100)}% reads). Bottleneck: ${bottleneck}.`);
  return { p99Ms, bottleneck, notes, passed: true };
}

export function checkObjective(preset: DesignPreset, state: DesignState, result: DesignResult): boolean {
  try {
    return result.passed && preset.winCondition(state, result);
  } catch {
    return false;
  }
}
