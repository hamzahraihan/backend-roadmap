export const DESIGN_KINDS = [
  'client',
  'cdn',
  'lb',
  'gateway',
  'app',
  'cache',
  'sql',
  'nosql',
  'queue',
  'storage',
] as const;

export type DesignKind = (typeof DESIGN_KINDS)[number];

export const DESIGN_KIND_LABELS: Record<DesignKind, string> = {
  client: 'Client',
  cdn: 'CDN',
  lb: 'Load Balancer',
  gateway: 'API Gateway',
  app: 'App Server',
  cache: 'Cache',
  sql: 'SQL DB',
  nosql: 'NoSQL DB',
  queue: 'Queue',
  storage: 'Blob Storage',
};

export const SINK_KINDS: DesignKind[] = ['sql', 'nosql', 'storage'];

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
