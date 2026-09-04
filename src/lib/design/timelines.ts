import type { TimelineEvent } from './types';

export const SCENARIO_TIMELINES: Record<string, TimelineEvent[]> = {
  'scalability-performance': [
    { atSec: 10, trigger: { type: 'spike', factor: 4, secs: 15 } },
    { atSec: 30, trigger: { type: 'note', text: 'Spike over — watch the queues drain.' } },
  ],
  'distributed-failures': [
    { atSec: 8, trigger: { type: 'fail', kind: 'app' } },
    { atSec: 25, trigger: { type: 'heal', kind: 'app' } },
  ],
  'interview-framework': [
    { atSec: 10, trigger: { type: 'spike', factor: 3, secs: 12 } },
    { atSec: 24, trigger: { type: 'fail', kind: 'app' } },
    { atSec: 38, trigger: { type: 'heal', kind: 'app' } },
  ],
  'rate-limiting-url-shortener': [
    { atSec: 8, trigger: { type: 'spike', factor: 5, secs: 12 } },
  ],
  free: [],
};

export function timelineFor(presetId: string): TimelineEvent[] {
  return SCENARIO_TIMELINES[presetId] ?? [];
}
