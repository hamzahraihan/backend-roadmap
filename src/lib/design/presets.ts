import { countKind, hasPath } from './engine';
import {
  SINK_KINDS,
  type DesignKind,
  type DesignPreset,
  type DesignState,
  type RunSLO,
} from './types';
import type { RunSummary } from './player';

function kindsPresent(state: DesignState, kinds: DesignKind[]): boolean {
  return kinds.every((k) => countKind(state, k) >= 1);
}

function chainOk(state: DesignState): boolean {
  return hasPath(state, ['client'], SINK_KINDS);
}

const FULL: DesignKind[] = ['client', 'cdn', 'lb', 'gateway', 'app', 'cache', 'sql', 'nosql', 'queue', 'storage'];

function preset(
  id: string,
  palette: DesignKind[],
  starterNodes: DesignKind[],
  title: string,
  description: string,
  hint: string,
  winMessage: string,
  winCondition: DesignPreset['winCondition'],
): DesignPreset {
  return { id, palette, objective: { title, description, hint, winMessage }, starterNodes, winCondition };
}

const PRESETS: DesignPreset[] = [
  preset(
    'system-design-fundamentals',
    ['client', 'lb', 'app', 'sql', 'nosql'],
    ['client', 'app', 'sql'],
    'Draw the request path',
    'Build a complete path from Client to durable storage through an app tier. This is the backbone every later design extends.',
    'Add Client → App Server → SQL DB, then connect them in order and Run.',
    'Request path complete — the backbone of every design.',
    (s) => chainOk(s) && kindsPresent(s, ['client', 'app']),
  ),
  preset(
    'scalability-performance',
    ['client', 'lb', 'app', 'sql'],
    ['client', 'lb', 'app', 'sql'],
    'Scale out the app tier',
    'One app server saturates under load. Put a load balancer in front and run at least two app replicas, then raise QPS and watch the bottleneck.',
    'Add a second App Server, connect LB → both apps, set QPS to 3000, then Run.',
    'Horizontally scaled — LB spreads load across replicas.',
    (s) => hasPath(s, ['client'], ['lb']) && hasPath(s, ['lb'], ['app']) && countKind(s, 'app') >= 2 && chainOk(s),
  ),
  preset(
    'caching-cdn',
    ['client', 'cdn', 'app', 'cache', 'sql'],
    ['client', 'app', 'sql'],
    'Put cache on the read path',
    'Reads dominate. Insert a cache between the app tier and SQL so repeated reads skip the database, then run with reads above 50%.',
    'Add Cache, wire App → Cache → SQL DB, set reads to 80%, then Run.',
    'Cache-first reads — durable load collapses on the hot path.',
    (s, r) => hasPath(s, ['app'], ['cache']) && hasPath(s, ['cache'], ['sql']) && s.scenario.readRatio >= 0.5 && r.p99Ms > 0,
  ),
  preset(
    'load-balancing-gateway',
    ['client', 'lb', 'gateway', 'app', 'sql'],
    ['client', 'lb', 'app', 'sql'],
    'Balance and gate traffic',
    'Distribute across app replicas and terminate client policy (auth, limits) at a gateway. Fail one app replica to prove failover.',
    'Wire Client → LB → 2× App, add Gateway in front, inject an App failure, then Run.',
    'Balanced and gated — failure no longer takes the site down.',
    (s) => kindsPresent(s, ['lb', 'gateway']) && countKind(s, 'app') >= 2 && chainOk(s),
  ),
  preset(
    'data-modeling-apis',
    ['client', 'gateway', 'app', 'sql', 'nosql'],
    ['client', 'gateway', 'app', 'sql'],
    'Separate policy from ownership',
    'Gateway owns API policy; exactly one durable store owns the entity. No shared mutable tables — one writer per entity.',
    'Keep a single sink (SQL or NoSQL), keep Gateway on the path, then Run.',
    'Clean boundary — one owner per entity, policy at the edge.',
    (s) => {
      const sinks = countKind(s, 'sql') + countKind(s, 'nosql') + countKind(s, 'storage');
      return hasPath(s, ['client'], ['gateway']) && sinks === 1 && chainOk(s);
    },
  ),
  preset(
    'databases-sharding',
    ['client', 'lb', 'app', 'sql', 'nosql', 'cache'],
    ['client', 'app', 'sql'],
    'Shard the data tier',
    'A single database becomes the bottleneck. Run two database nodes (SQL pair or SQL + NoSQL split) so the data tier scales with the app tier.',
    'Add a second DB node, connect App → both, set QPS to 4000, then Run.',
    'Sharded data tier — no single-node ceiling.',
    (s) => countKind(s, 'sql') + countKind(s, 'nosql') >= 2 && chainOk(s),
  ),
  preset(
    'messaging-queues',
    ['client', 'app', 'queue', 'sql', 'nosql'],
    ['client', 'app', 'sql'],
    'Decouple slow work',
    'Move heavy writes behind a queue so requests return fast and workers drain async. Bursts get absorbed instead of timing out.',
    'Insert Queue between App and the DB, then Run and read the async note.',
    'Event-driven — bursts absorbed, requests stay fast.',
    (s) => hasPath(s, ['app'], ['queue']) && hasPath(s, ['queue'], SINK_KINDS),
  ),
  preset(
    'distributed-failures',
    ['client', 'lb', 'app', 'cache', 'sql', 'queue'],
    ['client', 'lb', 'app', 'sql'],
    'Survive a failure',
    'Something will fail. Build redundancy (second app or cache fallback) and inject a failure to prove graceful degradation.',
    'Add a second App or a Cache, inject an App failure, then Run.',
    'Failure-aware — degraded, not down.',
    (s, r) =>
      (countKind(s, 'app') >= 2 || countKind(s, 'cache') >= 1) &&
      chainOk(s) &&
      r.notes.some((n) => n.includes('degraded') || n.includes('reroutes')) &&
      s.scenario.failedKind !== null,
  ),
  preset(
    'rate-limiting-url-shortener',
    ['client', 'gateway', 'cache', 'nosql', 'sql'],
    ['client', 'gateway', 'nosql'],
    'Protect and accelerate writes',
    'Gateway enforces limits, cache absorbs the 100:1 read flood, NoSQL holds the mapping. Run hot reads and confirm the durable hop collapses.',
    'Wire Client → Gateway → Cache → NoSQL, set reads to 95%, then Run.',
    'TinyURL-shaped — guarded edge, cache-first reads.',
    (s) => kindsPresent(s, ['gateway', 'cache']) && chainOk(s) && s.scenario.readRatio >= 0.8,
  ),
  preset(
    'realtime-rides-feed',
    ['client', 'gateway', 'app', 'queue', 'nosql', 'cache', 'storage'],
    ['client', 'app', 'nosql'],
    'Stream live state',
    'Chat, rides, and feeds all fan out through async paths. Put a queue or fast NoSQL tier behind app servers so live updates flow without blocking.',
    'Add Queue (or second NoSQL) behind App, then Run.',
    'Realtime path — live state flows async.',
    (s) => (countKind(s, 'queue') >= 1 || countKind(s, 'nosql') >= 1) && countKind(s, 'app') >= 1 && chainOk(s),
  ),
  preset(
    'interview-framework',
    FULL,
    ['client', 'lb', 'app', 'cache', 'sql'],
    'Defend a full architecture',
    'Assemble the complete story: edge → balanced apps → cache-first reads → durable sink. Then raise QPS, inject a failure, and confirm it still passes.',
    'Complete the chain, set QPS to 3000 with an App failure injected, then Run.',
    'Interview-ready — clear path, named bottleneck, handled failure.',
    (s, r) => chainOk(s) && kindsPresent(s, ['lb']) && r.p99Ms > 0 && s.scenario.failedKind !== null,
  ),
  preset(
    'docker-containers',
    ['client', 'app', 'cache', 'sql'],
    ['client', 'app', 'sql'],
    'Containerize the service',
    'One container is a single point of failure. Put a cache in front of SQL or add a second app replica, then run — failure injection (stop/start) is your chaos control.',
    'Add Cache between App and SQL (or a second App), then Run.',
    'Container-resilient — no single container sinks the path.',
    (s) => chainOk(s) && kindsPresent(s, ['app']) && (countKind(s, 'app') >= 2 || countKind(s, 'cache') >= 1),
  ),
  preset(
    'kubernetes-basics',
    ['client', 'lb', 'app', 'sql'],
    ['client', 'lb', 'app', 'sql'],
    'Declare the deployment',
    'Desired state: a Service fronts replicated pods over a durable sink. Run at least two app replicas behind the LB with a full client-to-sink path.',
    'Add a second App Server, wire Client → LB → both apps → SQL, then Run.',
    'Deployed — service fronts healthy replicas.',
    (s) => hasPath(s, ['client'], ['lb']) && hasPath(s, ['lb'], ['app']) && countKind(s, 'app') >= 2 && chainOk(s),
  ),
  preset(
    'free',
    FULL,
    ['client', 'app', 'sql'],
    'Free canvas',
    'No fixed goal — explore any topology. Palette, traffic controls, and failure injection are all live.',
    'Drag components, connect them, raise QPS, inject a failure.',
    '',
    () => false,
  ),
];

export const DESIGN_PRESETS: Record<string, DesignPreset> = Object.fromEntries(PRESETS.map((p) => [p.id, p]));

const SLOS: Record<string, RunSLO> = {
  'system-design-fundamentals': { minCompleted: 20 },
  'scalability-performance': { p99LtMs: 400, minCompleted: 100 },
  'caching-cdn': { p99LtMs: 200, minCompleted: 100 },
  'load-balancing-gateway': { errLtPct: 5, minCompleted: 100 },
  'data-modeling-apis': { minCompleted: 50 },
  'databases-sharding': { p99LtMs: 400, minCompleted: 100 },
  'messaging-queues': { errLtPct: 5, minCompleted: 100 },
  'distributed-failures': { errLtPct: 25, minCompleted: 100 },
  'rate-limiting-url-shortener': { p99LtMs: 250, minCompleted: 100 },
  'realtime-rides-feed': { errLtPct: 5, minCompleted: 100 },
  'interview-framework': { p99LtMs: 400, errLtPct: 10, minCompleted: 150 },
  'docker-containers': { errLtPct: 5, minCompleted: 50 },
  'kubernetes-basics': { errLtPct: 5, minCompleted: 100 },
  free: {},
};

export function sloFor(presetId: string): RunSLO {
  return SLOS[presetId] ?? {};
}

/** Run-based objective: topology must be sound and the run must meet the SLO. */
export function checkRunObjective(presetId: string, topologyOk: boolean, summary: RunSummary): boolean {
  if (!topologyOk || summary.completed === 0) return false;
  const slo = sloFor(presetId);
  if (slo.minCompleted !== undefined && summary.completed < slo.minCompleted) return false;
  if (slo.p99LtMs !== undefined && summary.p99Ms >= slo.p99LtMs) return false;
  if (slo.errLtPct !== undefined && summary.errPct >= slo.errLtPct) return false;
  return true;
}

export function getPreset(id: string): DesignPreset {
  return DESIGN_PRESETS[id] ?? DESIGN_PRESETS.free;
}

let nodeSeq = 0;

export function initialStateFor(id: string): DesignState {
  const preset = getPreset(id);
  nodeSeq += 1;
  const nodes = preset.starterNodes.map((kind, i) => ({
    id: `${kind}-${nodeSeq}-${i}`,
    kind,
    label: kind,
  }));
  const edges = nodes.slice(1).map((n, i) => ({ id: `e-${nodeSeq}-${i}`, from: nodes[i].id, to: n.id }));
  return { nodes, edges, scenario: { qps: 300, readRatio: 0.8, failedKind: null } };
}

export function starterNode(id: string, kind: DesignKind): { id: string; kind: DesignKind; label: string } {
  nodeSeq += 1;
  return { id: `${kind}-${nodeSeq}`, kind, label: kind };
}
