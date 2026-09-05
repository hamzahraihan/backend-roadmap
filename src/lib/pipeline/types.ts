export type PipelineStageId = 'build' | 'test' | 'scan' | 'deploy';
export type PipelineStageStatus = 'idle' | 'running' | 'pass' | 'fail';

export interface PipelineStage {
  id: PipelineStageId;
  status: PipelineStageStatus;
  attempts: number;
  logs: string[];
}

export interface PipelineState {
  stages: Record<PipelineStageId, PipelineStage>;
  runId: number;
  deployed: boolean;
  environment: string;
}

export interface PipelineExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface PipelineObjective {
  title: string;
  description: string;
  hint: string;
  winCondition: (state: PipelineState) => boolean;
  winMessage: string;
}

export interface PipelinePreset {
  id: string;
  initialState: PipelineState;
  objective: PipelineObjective;
}

export interface PipelineCheatItem {
  command: string;
  usage: string;
  example: string;
  explanation: string;
  group: 'Run' | 'Inspect' | 'Recover';
}
