import { parseInput } from './parser';
import type { PipelineExecResult, PipelineStageId, PipelineState } from './types';

const ORDER: PipelineStageId[] = ['build', 'test', 'scan', 'deploy'];

export function clonePipelineState(s: PipelineState): PipelineState {
  return {
    runId: s.runId,
    deployed: s.deployed,
    environment: s.environment,
    stages: {
      build: { ...s.stages.build, logs: [...s.stages.build.logs] },
      test: { ...s.stages.test, logs: [...s.stages.test.logs] },
      scan: { ...s.stages.scan, logs: [...s.stages.scan.logs] },
      deploy: { ...s.stages.deploy, logs: [...s.stages.deploy.logs] },
    },
  };
}

export class PipelineEngine {
  state: PipelineState;

  constructor(initial: PipelineState) {
    this.state = clonePipelineState(initial);
  }

  clone(): PipelineEngine {
    return new PipelineEngine(clonePipelineState(this.state));
  }

  exec(raw: string): { result: PipelineExecResult; newState: PipelineState } {
    const parsed = parseInput(raw);
    if (!parsed) return { result: { stdout: '', stderr: '', exitCode: 0 }, newState: this.state };
    const { cmd, args } = parsed;
    if (cmd === 'clear') return { result: { stdout: '__CLEAR__', stderr: '', exitCode: 0 }, newState: this.state };
    if (cmd === 'help' || (cmd === 'pipe' && args[0] === 'help')) return this.handleHelp(args[0] === 'help' ? args[1] : args[0]);
    if (cmd !== 'pipe') {
      return { result: { stdout: '', stderr: `bash: ${cmd}: command not found`, exitCode: 127 }, newState: this.state };
    }
    if (args.length === 0) {
      return { result: { stdout: 'usage: pipe <run|retry|status|logs|reset|help> [stage]', stderr: '', exitCode: 1 }, newState: this.state };
    }
    const [sub, target] = args;
    switch (sub) {
      case 'run': return this.handleRun(target as PipelineStageId | undefined);
      case 'retry': return this.handleRetry(target as PipelineStageId);
      case 'status': return this.handleStatus();
      case 'logs': return this.handleLogs(target as PipelineStageId);
      case 'reset': return this.handleReset();
      default:
        return { result: { stdout: '', stderr: `pipe: '${sub}' is not a pipe command. See 'pipe help'.`, exitCode: 1 }, newState: this.state };
    }
  }

  private handleHelp(sub?: string): { result: PipelineExecResult; newState: PipelineState } {
    const detail: Record<string, string> = {
      run: 'pipe run [stage] — run the next pending stage, or one named stage.',
      retry: 'pipe retry <stage> — re-run a failed stage.',
      status: 'pipe status — show all stages.',
      logs: 'pipe logs <stage> — show stage logs.',
      reset: 'pipe reset — back to all idle.',
    };
    if (sub && detail[sub]) return { result: { stdout: detail[sub], stderr: '', exitCode: 0 }, newState: this.state };
    return { result: { stdout: 'Available: pipe run [stage] · pipe retry <stage> · pipe status · pipe logs <stage> · pipe reset', stderr: '', exitCode: 0 }, newState: this.state };
  }

  private gate(id: PipelineStageId): string | null {
    const idx = ORDER.indexOf(id);
    for (const earlier of ORDER.slice(0, idx)) {
      if (this.state.stages[earlier].status !== 'pass') return `${id} is gated: '${earlier}' must pass first.`;
    }
    return null;
  }

  private handleRun(target?: PipelineStageId): { result: PipelineExecResult; newState: PipelineState } {
    const id = target ?? ORDER.find((s) => this.state.stages[s].status === 'idle' || this.state.stages[s].status === 'fail');
    if (!id) return { result: { stdout: 'Pipeline already green — every stage passed.', stderr: '', exitCode: 0 }, newState: this.state };
    if (!ORDER.includes(id)) return { result: { stdout: '', stderr: `pipe: unknown stage '${target}'. Use build|test|scan|deploy.`, exitCode: 1 }, newState: this.state };
    const blocked = this.gate(id);
    if (blocked) return { result: { stdout: '', stderr: blocked, exitCode: 1 }, newState: this.state };
    return this.runStage(id, false);
  }

  private handleRetry(target?: PipelineStageId): { result: PipelineExecResult; newState: PipelineState } {
    if (!target || !ORDER.includes(target)) {
      return { result: { stdout: '', stderr: 'usage: pipe retry <build|test|scan|deploy>', exitCode: 1 }, newState: this.state };
    }
    const st = this.state.stages[target];
    if (st.status !== 'fail') {
      return { result: { stdout: `Nothing to retry — '${target}' is ${st.status}.`, stderr: '', exitCode: 0 }, newState: this.state };
    }
    const blocked = this.gate(target);
    if (blocked) return { result: { stdout: '', stderr: blocked, exitCode: 1 }, newState: this.state };
    return this.runStage(target, true);
  }

  private runStage(id: PipelineStageId, isRetry: boolean): { result: PipelineExecResult; newState: PipelineState } {
    const ns = clonePipelineState(this.state);
    const st = ns.stages[id];
    st.attempts += 1;
    // Deterministic outcomes: test flakes on first attempt, everything else passes.
    if (id === 'test' && st.attempts === 1 && !isRetry) {
      st.status = 'fail';
      st.logs.push(`run #${ns.runId} attempt ${st.attempts}: 42 passed, 1 failed (flaky: checkout-timeout)`);
      this.state = ns;
      return { result: { stdout: `[${id}] FAIL — 1 flaky test. Fix: 'pipe retry test'.`, stderr: '', exitCode: 1 }, newState: ns };
    }
    st.status = 'pass';
    const lines: Record<PipelineStageId, string> = {
      build: `run #${ns.runId} attempt ${st.attempts}: compiled 18 packages, image svc:${ns.runId} pushed`,
      test: `run #${ns.runId} attempt ${st.attempts}: 43 passed, 0 failed`,
      scan: `run #${ns.runId} attempt ${st.attempts}: 0 critical, 2 low — within policy`,
      deploy: `run #${ns.runId} attempt ${st.attempts}: deployed svc:${ns.runId} to ${ns.environment} (health: 200 OK)`,
    };
    st.logs.push(lines[id]);
    if (id === 'deploy') ns.deployed = true;
    this.state = ns;
    const done = ORDER.every((s) => ns.stages[s].status === 'pass');
    const tail = done && ns.deployed ? '\nPipeline GREEN and deployed.' : '';
    return { result: { stdout: `[${id}] PASS — ${lines[id]}${tail}`, stderr: '', exitCode: 0 }, newState: ns };
  }

  private handleStatus(): { result: PipelineExecResult; newState: PipelineState } {
    const rows = ORDER.map((s) => {
      const st = this.state.stages[s];
      return `${s.padEnd(7)} ${st.status.padEnd(5)} attempts=${st.attempts}`;
    });
    const head = `run #${this.state.runId} → ${this.state.environment} · deployed=${this.state.deployed ? 'yes' : 'no'}`;
    return { result: { stdout: [head, ...rows].join('\n'), stderr: '', exitCode: 0 }, newState: this.state };
  }

  private handleLogs(target?: PipelineStageId): { result: PipelineExecResult; newState: PipelineState } {
    if (!target || !ORDER.includes(target)) {
      return { result: { stdout: '', stderr: 'usage: pipe logs <build|test|scan|deploy>', exitCode: 1 }, newState: this.state };
    }
    const logs = this.state.stages[target].logs;
    return { result: { stdout: logs.length ? logs.join('\n') : `(no logs for '${target}' yet)`, stderr: '', exitCode: 0 }, newState: this.state };
  }

  private handleReset(): { result: PipelineExecResult; newState: PipelineState } {
    const ns = clonePipelineState(this.state);
    for (const s of ORDER) ns.stages[s] = { id: s, status: 'idle', attempts: 0, logs: [] };
    ns.deployed = false;
    ns.runId += 1;
    this.state = ns;
    return { result: { stdout: `Pipeline reset (now run #${ns.runId}).`, stderr: '', exitCode: 0 }, newState: ns };
  }
}
