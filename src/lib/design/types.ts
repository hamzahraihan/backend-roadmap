export const DESIGN_KINDS = [
  'client',
  'dns',
  'cdn',
  'waf',
  'lb',
  'gateway',
  'ratelimit',
  'auth',
  'app',
  'cache',
  'search',
  'sql',
  'nosql',
  'queue',
  'storage',
] as const;

export type DesignKind = (typeof DESIGN_KINDS)[number];

export const DESIGN_KIND_LABELS: Record<DesignKind, string> = {
  client: 'Client',
  dns: 'DNS',
  cdn: 'CDN',
  waf: 'WAF',
  lb: 'Load Balancer',
  gateway: 'API Gateway',
  ratelimit: 'Rate Limiter',
  auth: 'Auth Service',
  app: 'App Server',
  cache: 'Cache',
  search: 'Search Index',
  sql: 'SQL DB',
  nosql: 'NoSQL DB',
  queue: 'Message Queue',
  storage: 'Object Storage',
};

export const SINK_KINDS: DesignKind[] = ['sql', 'nosql', 'storage', 'search'];

export interface DesignNode {
  id: string;
  kind: DesignKind;
  label: string;
}

export interface DesignEdge {
  id: string;
  from: string;
  to: string;
}

export interface DesignScenario {
  /** sustained queries per second */
  qps: number;
  /** 0..1 fraction of reads (rest are writes) */
  readRatio: number;
  /** simulate this component class as failed/down */
  failedKind: DesignKind | null;
}

export interface DesignState {
  nodes: DesignNode[];
  edges: DesignEdge[];
  scenario: DesignScenario;
}

export interface DesignResult {
  /** simulated p99 latency estimate in ms */
  p99Ms: number;
  /** kind label contributing most latency, or '—' */
  bottleneck: string;
  notes: string[];
  passed: boolean;
}

export interface DesignObjective {
  title: string;
  description: string;
  hint: string;
  winMessage: string;
}

import type { SimTrigger } from './player';

export interface TimelineEvent {
  atSec: number;
  trigger: SimTrigger;
}

export interface RunSLO {
  p99LtMs?: number;
  errLtPct?: number;
  minCompleted?: number;
}

export interface DesignPreset {
  id: string;
  palette: DesignKind[];
  objective: DesignObjective;
  starterNodes: DesignKind[];
  winCondition: (state: DesignState, result: DesignResult) => boolean;
}
