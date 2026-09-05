import { clonePipelineState } from './engine';
import type { PipelinePreset, PipelineState } from './types';

function emptyPipeline(runId = 1): PipelineState {
  const stage = () => ({ status: 'idle' as const, attempts: 0, logs: [] as string[] });
  return {
    runId,
    deployed: false,
    environment: 'staging',
    stages: {
      build: { id: 'build', ...stage() },
      test: { id: 'test', ...stage() },
      scan: { id: 'scan', ...stage() },
      deploy: { id: 'deploy', ...stage() },
    },
  };
}

function makeCicd(): PipelinePreset {
  return {
    id: 'cicd',
    initialState: emptyPipeline(7),
    objective: {
      title: 'Ship a green pipeline',
      description: 'Run build → test → scan → deploy. The test stage flakes on the first attempt — retry it, then deploy.',
      hint: 'Try: pipe status → pipe run → pipe retry test → pipe run → pipe run',
      winCondition: (s) => s.stages.build.status === 'pass' && s.stages.test.status === 'pass' && s.stages.scan.status === 'pass' && s.stages.deploy.status === 'pass' && s.deployed,
      winMessage: '✓ Pipeline green and deployed to staging!',
    },
  };
}

function makeFree(): PipelinePreset {
  return {
    id: 'free',
    initialState: emptyPipeline(1),
    objective: {
      title: 'Free Pipeline',
      description: 'A sandbox pipeline. No fixed goal — explore every command.',
      hint: 'Try pipe run, pipe status, pipe logs test, pipe reset.',
      winCondition: () => false,
      winMessage: '',
    },
  };
}

export const PIPELINE_PRESETS: Record<string, PipelinePreset> = {
  cicd: makeCicd(),
  free: makeFree(),
};

export function getPreset(id: string): PipelinePreset | undefined {
  return PIPELINE_PRESETS[id];
}

export function clonePresetState(id: string): PipelineState | null {
  const p = PIPELINE_PRESETS[id];
  return p ? clonePipelineState(p.initialState) : null;
}
