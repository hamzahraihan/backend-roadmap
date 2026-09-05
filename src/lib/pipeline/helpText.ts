import type { PipelineCheatItem } from './types';

export const PIPELINE_CHEAT_SHEET: PipelineCheatItem[] = [
  { command: 'pipe run', usage: 'pipe run', example: 'pipe run', explanation: 'Run the next pending stage in order.', group: 'Run' },
  { command: 'pipe run <stage>', usage: 'pipe run <build|test|scan|deploy>', example: 'pipe run test', explanation: 'Run one stage. Earlier stages must already pass.', group: 'Run' },
  { command: 'pipe retry <stage>', usage: 'pipe retry <stage>', example: 'pipe retry test', explanation: 'Re-run a failed stage (flaky tests pass on retry).', group: 'Recover' },
  { command: 'pipe status', usage: 'pipe status', example: 'pipe status', explanation: 'Show every stage with attempts.', group: 'Inspect' },
  { command: 'pipe logs <stage>', usage: 'pipe logs <stage>', example: 'pipe logs test', explanation: 'Show the log lines of a stage.', group: 'Inspect' },
  { command: 'pipe reset', usage: 'pipe reset', example: 'pipe reset', explanation: 'Reset the pipeline to all idle.', group: 'Recover' },
];

export const PIPELINE_GROUP_ORDER = ['Run', 'Inspect', 'Recover'] as const;
