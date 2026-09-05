# DevOps Track (Plan C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 6-skill DevOps track sourced from milanm/DevOps-Roadmap with a new pipeline simulator (cicd switches to it) and two presets-only design scenarios (Docker, K8s).

**Architecture:** Content-first: 6 new `src/content/skills/*.md` files auto-join the DAG via `dependsOn`. New `src/lib/pipeline/` engine clones the `src/lib/git/` state-machine pattern (synchronous `exec`, preset `winCondition`). Docker/K8s reuse the untouched design engine via new presets. Routing extends the existing `[slug].astro` sim switch.

**Tech Stack:** Astro content collections, React islands, TypeScript, Tailwind v4, existing `ResizableSplit`/`ProgressProvider`/`GitTerminal` patterns. No new dependencies.

## Global Constraints

- No new npm dependencies.
- Every coding skill keeps 4-language `starterCode` (representative snippets allowed for conceptual skills per PRODUCT.md).
- `npm run check` must report 0 errors after each task; `npm run build` must pass at the end.
- Each new skill carries an Apache-2.0 source note linking its milanm/DevOps-Roadmap section.
- No changes to `src/lib/git/*`, `src/lib/design/engine.ts`, `src/lib/design/player.ts`.
- One commit per task; push only when the user asks.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/content/skills/linux-shell.md` (create) | Linux & shell basics, code pane |
| `src/content/skills/docker-containers.md` (create) | Docker & Compose, design sim |
| `src/content/skills/kubernetes-basics.md` (create) | K8s basics, design sim |
| `src/content/skills/terraform-iac.md` (create) | Terraform & IaC, code pane |
| `src/content/skills/observability.md` (create) | Monitoring & observability, code pane |
| `src/content/skills/cloud-provider.md` (create) | Cloud basics, code pane |
| `src/lib/pipeline/types.ts` (create) | Pipeline state/objective/preset types |
| `src/lib/pipeline/parser.ts` (create) | `pipe` command tokenizer (reuses git parser grammar) |
| `src/lib/pipeline/helpText.ts` (create) | Cheat-sheet items |
| `src/lib/pipeline/engine.ts` (create) | `PipelineEngine.exec` state machine |
| `src/lib/pipeline/presets.ts` (create) | `cicd` + `free` presets, clone helpers |
| `src/components/react/PipelineGraph.tsx` (create) | Stage-lane visualization |
| `src/components/react/PipelineSimulation.tsx` (create) | Orchestrator (banner, split, terminal, cheat) |
| `src/content.config.ts` (modify) | Add `'pipeline'` to simulation enum |
| `src/pages/skill/[slug].astro` (modify) | `isPipelineSimulation` branch; drop `'cicd'` from git list |
| `src/content/skills/cicd.md` (modify) | `simulation: pipeline`, terminal-oriented hint |
| `src/lib/design/presets.ts` (modify) | Add `docker-lifecycle`, `k8s-deploy` presets + SLOs |

**Interfaces (locked):**
- `PipelineEngine.exec(raw: string): { result: ExecResult; newState: PipelineState }` (mirrors `GitEngine.exec`).
- `getPreset(id: string): PipelinePreset | undefined`, `clonePresetState(id: string): PipelineState | null` (mirror git preset helpers).
- Stage order enforced: `build → test → scan → deploy`. First `test` run always fails (flaky test); `retry` passes it. `deploy` requires build+test+scan `pass`; sets `deployed: true`.
- `winCondition` for `cicd`: all four stages `pass` AND `deployed === true`.

---

### Task 1: DevOps content skills (6 new markdown files)

**Files:**
- Create: `src/content/skills/linux-shell.md`, `docker-containers.md`, `kubernetes-basics.md`, `terraform-iac.md`, `observability.md`, `cloud-provider.md`
- Modify: none
- Test: `npm run check` + `npm run build` (new nodes appear; no type errors)

**Interfaces:**
- Consumes: frontmatter schema in `src/content.config.ts:5-31` (`title, category, order, dependsOn, simulation, starterCode`).
- Produces: skill ids `linux-shell, docker-containers, kubernetes-basics, terraform-iac, observability, cloud-provider` that Tasks 3–4 wire simulators to.

- [ ] **Step 1: Write `linux-shell.md`**

```md
---
title: Linux & Shell Basics
category: Infrastructure
order: 36
dependsOn: [internet-basics]
starterCode:
  python: |
    # Shell equivalent: ls -la /etc | grep conf
    import os
    print([f for f in os.listdir('/etc')][:5])
  typescript: |
    // Shell equivalent: ls -la | grep conf
    import { readdirSync } from 'fs';
    console.log(readdirSync('.').slice(0, 5));
  go: |
    // Shell equivalent: ls | grep conf
    package main
    import "fmt"
    func main() { fmt.Println("ls, grep, find, chmod, ssh, curl") }
  java: |
    // Shell equivalent: ls | grep conf
    public class Main {
        public static void main(String[] args) {
            System.out.println("ls, grep, find, chmod, ssh, curl");
        }
    }
---

**Linux** runs most servers. Learn to move, inspect, and automate from the CLI: `ls, cd, mkdir, rm, cp, mv, cat, grep, find, chmod, ps, kill, df, du, tar, ssh, scp, curl`.

## Scripting

Automate with Bash (or Python/Go): loops, conditionals, pipes (`|`), redirection (`>`, `>>`), exit codes (`$?`).

```bash
for host in web1 web2; do ssh "$host" "df -h / | tail -1"; done
```

## Resources

- **Source:** [DevOps-Roadmap §3 — Linux & Scripting](https://github.com/milanm/DevOps-Roadmap) (Apache-2.0)
- **Guide:** [Linux command handbook](https://www.freecodecamp.org/news/the-linux-commands-handbook/) (freeCodeCamp)
- **Manual:** [Bash Reference Manual](https://www.gnu.org/savannah-checkouts/gnu/bash/manual/bash.html)
```

- [ ] **Step 2: Write `docker-containers.md`**

```md
---
title: Docker & Compose
category: Infrastructure
order: 102
dependsOn: [linux-shell, web-servers]
simulation: design
starterCode:
  python: |
    # Dockerfile equivalent: pin runtime, copy code, declare port
    # FROM python:3.12-slim
    # COPY app.py /srv/app.py
    # EXPOSE 8000
    print('image = code + runtime + config')
  typescript: |
    // FROM node:22-slim
    // COPY dist/ /srv/ — EXPOSE 3000
    console.log('image = code + runtime + config');
  go: |
    // FROM golang:1.23 AS build ... COPY --from=build /app/svc /svc
    package main
    import "fmt"
    func main() { fmt.Println("image = code + runtime + config") }
  java: |
    // FROM eclipse-temurin:21-jre — COPY app.jar /srv/app.jar
    public class Main {
        public static void main(String[] args) {
            System.out.println("image = code + runtime + config");
        }
    }
---

**Containers** package code + dependencies so apps run identically anywhere. **Docker** is the standard; **Compose** runs multi-container apps from one YAML file.

## Core loop

```bash
docker build -t svc:1.0 .
docker run -p 8000:8000 svc:1.0
docker compose up --build
```

Learn: images vs containers, layers + layer caching, volumes (state), networks, `Dockerfile` instructions, one service per container.

## Try it (right pane)

Open the **Docker lifecycle** scenario: build the request path, then use failure injection as stop/start to prove redundancy.

## Resources

- **Source:** [DevOps-Roadmap §6 — Containers](https://github.com/milanm/DevOps-Roadmap) (Apache-2.0)
- **Video:** [Docker Crash Course — TechWorld with Nana](https://www.youtube.com/watch?v=pg19Z8LL06w)
- **Video:** [Ultimate Docker Compose Tutorial — TechWorld with Nana](https://www.youtube.com/watch?v=SXwC9fSwct8)
```

- [ ] **Step 3: Write `kubernetes-basics.md`**

```md
---
title: Kubernetes Basics
category: Infrastructure
order: 103
dependsOn: [docker-containers]
simulation: design
starterCode:
  python: |
    # kubectl equivalent: declare desired state, controllers converge it
    # kubectl apply -f deploy.yaml  # replicas: 3
    # kubectl get pods -w
    print('desired state -> controllers converge pods')
  typescript: |
    // kubectl apply -f deploy.yaml  # replicas: 3
    // kubectl get pods -w
    console.log('desired state -> controllers converge pods');
  go: |
    // kubectl apply -f deploy.yaml (replicas: 3)
    package main
    import "fmt"
    func main() { fmt.Println("desired state -> controllers converge pods") }
  java: |
    // kubectl apply -f deploy.yaml (replicas: 3)
    public class Main {
        public static void main(String[] args) {
            System.out.println("desired state -> controllers converge pods");
        }
    }
---

**Kubernetes** orchestrates containers: it keeps **desired state** (Deployments, Services, Ingress, ConfigMaps, Secrets, Volumes) converged across a cluster.

Learn: Pod, ReplicaSet, Deployment, Service, Ingress, ConfigMap, Secret, `kubectl` basics, Helm charts.

```yaml
# deploy.yaml
apiVersion: apps/v1
kind: Deployment
metadata: { name: svc }
spec:
  replicas: 3
  template:
    spec:
      containers:
        - { name: svc, image: svc:1.0 }
```

## Try it (right pane)

Open the **K8s deploy** scenario: Client → Service → 2+ app replicas → durable sink, then inject an app failure and Run.

## Resources

- **Source:** [DevOps-Roadmap §7 — Container Orchestration](https://github.com/milanm/DevOps-Roadmap) (Apache-2.0)
- **Video:** [Kubernetes Crash Course — TechWorld with Nana](https://www.youtube.com/watch?v=s_o8dwzRlu4)
- **Docs:** [Kubernetes concepts](https://kubernetes.io/docs/concepts/)
```

- [ ] **Step 4: Write `terraform-iac.md`**

```md
---
title: Terraform & IaC
category: Infrastructure
order: 104
dependsOn: [linux-shell]
starterCode:
  python: |
    # Terraform equivalent: declare infra, plan, apply
    # resource "aws_instance" "web" { ami = "..."  instance_type = "t3.micro" }
    print('plan -> apply -> state tracks reality')
  typescript: |
    // resource "aws_instance" "web" { instance_type = "t3.micro" }
    console.log('plan -> apply -> state tracks reality');
  go: |
    // terraform plan / terraform apply
    package main
    import "fmt"
    func main() { fmt.Println("plan -> apply -> state tracks reality") }
  java: |
    // terraform plan / terraform apply
    public class Main {
        public static void main(String[] args) {
            System.out.println("plan -> apply -> state tracks reality");
        }
    }
---

**Infrastructure as Code** defines environments in versioned files so setup is automated, reviewable, and repeatable. **Terraform** provisions; **Ansible** configures.

## Core loop

```hcl
resource "aws_instance" "web" {
  ami           = "ami-0abc123"
  instance_type = "t3.micro"
}
```

```bash
terraform init && terraform plan && terraform apply
```

Learn: providers, resources, state, modules, plan-before-apply, never commit secrets (use vaults / CI secrets).

## Resources

- **Source:** [DevOps-Roadmap §8 — IaC](https://github.com/milanm/DevOps-Roadmap) (Apache-2.0)
- **Tutorials:** [Official Terraform Tutorials](https://learn.hashicorp.com/terraform)
- **Guide:** [A Comprehensive Guide to Terraform](https://blog.gruntwork.io/a-comprehensive-guide-to-terraform-b3d32832baca)
```

- [ ] **Step 5: Write `observability.md`**

```md
---
title: Monitoring & Observability
category: Quality
order: 122
dependsOn: [testing-cicd]
starterCode:
  python: |
    # PromQL equivalent: rate of errors over 5m
    # rate(http_requests_total{status=~"5.."}[5m])
    print('metrics -> dashboards -> alerts -> runbooks')
  typescript: |
    // rate(http_requests_total{status=~"5.."}[5m])
    console.log('metrics -> dashboards -> alerts -> runbooks');
  go: |
    // rate(http_requests_total{status=~"5.."}[5m])
    package main
    import "fmt"
    func main() { fmt.Println("metrics -> dashboards -> alerts -> runbooks") }
  java: |
    // rate(http_requests_total{status=~"5.."}[5m])
    public class Main {
        public static void main(String[] args) {
            System.out.println("metrics -> dashboards -> alerts -> runbooks");
        }
    }
---

**Monitoring** watches known signals; **observability** lets you ask new questions (metrics, logs, traces). The standard open-source pair is **Prometheus** (collect + alert) + **Grafana** (visualize).

Learn: RED (rate/errors/duration) or USE (utilization/saturation/errors), SLOs, alert routing, runbooks, log aggregation.

## Resources

- **Source:** [DevOps-Roadmap §10 — Monitoring & Observability](https://github.com/milanm/DevOps-Roadmap) (Apache-2.0)
- **Guide:** [What Is Observability?](https://devopscube.com/what-is-observability/)
- **Docs:** [Prometheus getting started](https://prometheus.io/docs/tutorials/getting_started/) · [Grafana tutorials](https://grafana.com/tutorials/)
```

- [ ] **Step 6: Write `cloud-provider.md`**

```md
---
title: Cloud Provider Basics
category: Infrastructure
order: 105
dependsOn: [web-servers, terraform-iac]
starterCode:
  python: |
    # aws cli equivalent: provision + inspect
    # aws ec2 run-instances --image-id ami-0abc123 --instance-type t3.micro
    # aws ec2 describe-instances
    print('console -> cli -> IaC: same APIs, increasing repeatability')
  typescript: |
    // aws ec2 run-instances --image-id ami-0abc123 --instance-type t3.micro
    console.log('console -> cli -> IaC: same APIs, increasing repeatability');
  go: |
    // aws ec2 run-instances --image-id ami-0abc123 --instance-type t3.micro
    package main
    import "fmt"
    func main() { fmt.Println("console -> cli -> IaC") }
  java: |
    // aws ec2 run-instances --image-id ami-0abc123 --instance-type t3.micro
    public class Main {
        public static void main(String[] args) {
            System.out.println("console -> cli -> IaC");
        }
    }
---

Pick **one cloud** (AWS, Azure, or GCP) and learn its primitives: IAM (users/roles), networks (VPC), compute (VMs), managed databases, object storage, billing boundaries.

Learn: least-privilege IAM first, private networking by default, managed services over self-hosting, cost alerts from day one.

## Resources

- **Source:** [DevOps-Roadmap §11 — Cloud](https://github.com/milanm/DevOps-Roadmap) (Apache-2.0)
- **AWS:** [AWS Well-Architected](https://aws.amazon.com/architecture/well-architected/)
- **Azure:** [AZ-900 Microsoft Azure Fundamentals](https://learn.microsoft.com/en-us/certifications/exams/az-900)
```

- [ ] **Step 7: Run check**

Run: `npm run check`
Expected: 0 errors (6 new files use existing schema; `simulation: design` is already in the enum).

- [ ] **Step 8: Commit**

```bash
git add src/content/skills/linux-shell.md src/content/skills/docker-containers.md src/content/skills/kubernetes-basics.md src/content/skills/terraform-iac.md src/content/skills/observability.md src/content/skills/cloud-provider.md
git commit -m "feat(content): add DevOps track skills from DevOps-Roadmap"
```

---

### Task 2: Pipeline engine library (`src/lib/pipeline/`)

**Files:**
- Create: `src/lib/pipeline/types.ts`, `parser.ts`, `helpText.ts`, `engine.ts`, `presets.ts`
- Modify: none
- Test: `src/lib/pipeline/smoke.mjs` (temporary, deleted after green) + `npm run check`

**Interfaces:**
- Consumes: nothing (self-contained; parser grammar mirrors `src/lib/git/parser.ts` behavior for quotes/flags).
- Produces: `PipelineEngine`, `getPreset`, `clonePresetState`, `PIPELINE_CHEAT_SHEET` for Task 3.

- [ ] **Step 1: Write `types.ts`**

```ts
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
```

- [ ] **Step 2: Write `parser.ts`** (same tokenizing contract as `src/lib/git/parser.ts`: returns `{ cmd, args, flags }` or null on empty; honors double quotes and `--flag=value` / `--flag value` / `-m value`)

```ts
export interface ParsedInput {
  cmd: string;
  args: string[];
  flags: Map<string, string | true>;
}

export function parseInput(raw: string): ParsedInput | null {
  const tokens = tokenize(raw.trim());
  if (tokens.length === 0) return null;
  const [cmd, ...rest] = tokens;
  const args: string[] = [];
  const flags = new Map<string, string | true>();
  for (let i = 0; i < rest.length; i++) {
    const t = rest[i];
    if (t.startsWith('--')) {
      const eq = t.indexOf('=');
      if (eq !== -1) flags.set(t.slice(2, eq), t.slice(eq + 1));
      else if (i + 1 < rest.length && !rest[i + 1].startsWith('-')) flags.set(t.slice(2), rest[++i]);
      else flags.set(t.slice(2), true);
    } else if (t === '-m' && i + 1 < rest.length) {
      args.push(t, rest[++i]);
    } else args.push(t);
  }
  return { cmd, args, flags };
}

function tokenize(raw: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quote: string | null = null;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (quote) {
      if (c === quote) quote = null;
      else if (c === '\\' && i + 1 < raw.length) out.push(cur), cur = '', out.push(raw[++i]);
      else cur += c;
    } else if (c === '"' || c === "'") quote = c;
    else if (/\s/.test(c)) {
      if (cur) out.push(cur), (cur = '');
    } else cur += c;
  }
  if (cur) out.push(cur);
  return out;
}
```

- [ ] **Step 3: Write `helpText.ts`**

```ts
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
```

- [ ] **Step 4: Write `engine.ts`**

```ts
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
```

- [ ] **Step 5: Write `presets.ts`**

```ts
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
```

- [ ] **Step 6: Behavioral check — temporary esbuild-bundled smoke script**

Write `src/lib/pipeline/__smoke__.ts` (deleted after green):

```ts
import { PipelineEngine } from './engine';
import { clonePresetState, getPreset } from './presets';

const fail = (msg: string): never => {
  console.error(`SMOKE FAIL: ${msg}`);
  process.exit(1);
};

const eng = new PipelineEngine(clonePresetState('cicd')!);
const run = (cmd: string) => eng.exec(cmd).result;

// Gate: test cannot run before build passes.
const gated = run('pipe run test');
if (gated.exitCode === 0) fail('test ran before build passed');

// Golden path: build pass → test flakes → retry passes → scan → deploy.
if (run('pipe run build').exitCode !== 0) fail('build should pass');
const flaky = run('pipe run test');
if (flaky.exitCode === 0) fail('first test run should FAIL (deterministic flake)');
if (run('pipe retry test').exitCode !== 0) fail('retry test should pass');
if (run('pipe run scan').exitCode !== 0) fail('scan should pass');
if (run('pipe run deploy').exitCode !== 0) fail('deploy should pass');

const won = getPreset('cicd')!.objective.winCondition(eng.state);
if (!won) fail('winCondition should be true after green deploy');
if (!eng.state.deployed) fail('deployed flag should be true');
console.log('SMOKE PASS: gate + flake + retry + deploy + winCondition all green');
```

Run (bundles with the repo's own esbuild, no new deps):

```bash
node_modules/.bin/esbuild src/lib/pipeline/__smoke__.ts --bundle --platform=node --format=esm --outfile=node_modules/.cache/pipe-smoke.mjs --log-level=error && node node_modules/.cache/pipe-smoke.mjs
```

Expected: `SMOKE PASS: gate + flake + retry + deploy + winCondition all green`.

- [ ] **Step 7: Run `npm run check`**

Expected: 0 errors.

- [ ] **Step 8: Delete smoke files and commit**

```bash
rm src/lib/pipeline/__smoke__.ts node_modules/.cache/pipe-smoke.mjs
git add src/lib/pipeline/types.ts src/lib/pipeline/parser.ts src/lib/pipeline/helpText.ts src/lib/pipeline/engine.ts src/lib/pipeline/presets.ts
git commit -m "feat(pipeline): add pipeline engine with deterministic test flake"
```

---

### Task 3: Pipeline UI + routing (`cicd` switches sims)

**Files:**
- Create: `src/components/react/PipelineGraph.tsx`, `src/components/react/PipelineSimulation.tsx`
- Modify: `src/content.config.ts:27` (enum), `src/pages/skill/[slug].astro:27-28,40`, `src/content/skills/cicd.md` (frontmatter + hint line)
- Test: `npm run check` + `npm run build`

**Interfaces:**
- Consumes: `PipelineEngine`, `getPreset`, `clonePresetState`, `PIPELINE_CHEAT_SHEET` from Task 2; `ResizableSplit`, `ProgressProvider` patterns from `GitSimulation.tsx`.
- Produces: `cicd` renders `PipelineSimulation`; all other git ids unchanged.

- [ ] **Step 1: Write `PipelineGraph.tsx`**

```tsx
import { CheckIcon, CrossCircledIcon } from '@radix-ui/react-icons';
import type { PipelineState } from '../../lib/pipeline/types';

const ORDER = ['build', 'test', 'scan', 'deploy'] as const;

const STATUS_STYLE: Record<string, string> = {
  idle: 'border-zinc-300 bg-white text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400',
  running: 'border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  pass: 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  fail: 'border-red-500 bg-red-500/10 text-red-600 dark:text-red-400',
};

export default function PipelineGraph({ state }: { state: PipelineState }) {
  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-zinc-500">run #{state.runId} → {state.environment}</span>
        {state.deployed && (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
            <CheckIcon width={11} height={11} aria-hidden />Deployed
          </span>
        )}
      </div>
      {ORDER.map((id, i) => {
        const st = state.stages[id];
        return (
          <div key={id}>
            <div className={`rounded border px-3 py-2 ${STATUS_STYLE[st.status]}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold capitalize">{i + 1}. {id}</span>
                <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                  {st.status === 'pass' && <CheckIcon width={11} height={11} aria-hidden />}
                  {st.status === 'fail' && <CrossCircledIcon width={11} height={11} aria-hidden />}
                  {st.status} · {st.attempts} attempt{st.attempts === 1 ? '' : 's'}
                </span>
              </div>
              {st.logs.length > 0 && (
                <div className="mt-1 font-mono text-[11px] opacity-80">{st.logs[st.logs.length - 1]}</div>
              )}
            </div>
            {i < ORDER.length - 1 && <div className="mx-auto h-3 w-px bg-zinc-300 dark:bg-zinc-700" aria-hidden />}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Write `PipelineSimulation.tsx`** (structure mirrors `GitSimulation.tsx:15-141`; terminal block reuses the injectable-terminal pattern with pipeline commands)

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckIcon, QuestionMarkCircledIcon, ResetIcon } from '@radix-ui/react-icons';
import { PipelineEngine } from '../../lib/pipeline/engine';
import { clonePresetState, getPreset } from '../../lib/pipeline/presets';
import { PIPELINE_CHEAT_SHEET, PIPELINE_GROUP_ORDER } from '../../lib/pipeline/helpText';
import type { PipelineState } from '../../lib/pipeline/types';
import PipelineGraph from './PipelineGraph';
import ResizableSplit from './ResizableSplit';
import { ProgressProvider, useProgressContext } from './ProgressProvider';

interface PipelineSimulationProps {
  skillId: string;
}

function PipelineSimulationContent({ skillId }: PipelineSimulationProps) {
  const { getStatus, setStatus } = useProgressContext();
  const status = getStatus(skillId);
  const preset = useMemo(() => getPreset(skillId) ?? getPreset('free'), [skillId]);
  const initial = useMemo(() => clonePresetState(preset!.id) ?? clonePresetState('free')!, [preset]);

  const [state, setState] = useState<PipelineState>(() => initial);
  const engineRef = useRef<PipelineEngine>(new PipelineEngine(initial));
  const [injectCmd, setInjectCmd] = useState<string | null>(null);
  const [showCheat, setShowCheat] = useState(false);
  const [hasWon, setHasWon] = useState(false);

  useEffect(() => {
    engineRef.current = new PipelineEngine(state);
  }, [state]);

  useEffect(() => {
    if (!preset) return;
    setHasWon(preset.objective.winCondition(state));
  }, [state, preset]);

  const handleExec = useCallback((raw: string) => {
    const engine = engineRef.current;
    const { result, newState } = engine.exec(raw);
    setState(newState);
    engineRef.current.state = newState;
    return result;
  }, []);

  const handleReset = useCallback(() => {
    const cloned = clonePresetState(preset!.id);
    if (cloned) {
      setState(cloned);
      setHasWon(false);
    }
  }, [preset]);

  const handleInject = useCallback((cmd: string) => {
    setInjectCmd(cmd);
    setTimeout(() => setInjectCmd(null), 0);
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-50 dark:bg-zinc-950">
      <div className="shrink-0 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">Pipeline Simulation</span>
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{preset?.objective.title}</span>
              {hasWon && <span className="inline-flex items-center gap-1 rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white"><CheckIcon width={11} height={11} aria-hidden />Objective met</span>}
            </div>
            <p className="mt-1 max-w-[60ch] text-xs leading-5 text-zinc-600 dark:text-zinc-400">{preset?.objective.description}</p>
            <p className="mt-1 font-mono text-xs text-zinc-500 dark:text-zinc-500">Hint: {preset?.objective.hint}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={() => setShowCheat((v) => !v)}
              className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition ${showCheat ? 'bg-sky-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'}`}
            >
              <QuestionMarkCircledIcon width={13} height={13} className="shrink-0" aria-hidden />
              Cheat sheet
            </button>
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1 rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              <ResetIcon width={13} height={13} className="shrink-0" aria-hidden />
              Reset run
            </button>
            <button
              onClick={() => setStatus(skillId, status === 'completed' ? 'in-progress' : 'completed')}
              className={`inline-flex items-center gap-1 rounded px-3 py-1 text-xs font-semibold transition ${status === 'completed' || hasWon ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'}`}
            >
              {(status === 'completed' || hasWon) && <CheckIcon width={13} height={13} className="shrink-0" aria-hidden />}
              {status === 'completed' ? 'Completed' : 'Mark complete'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <ResizableSplit
          storageKey="backend-roadmap:split:pipe-inner"
          defaultPct={50}
          minPct={30}
          maxPct={70}
          left={
            <div className="flex min-h-[280px] h-full flex-col p-2 lg:p-3">
              <PipelineGraph state={state} />
            </div>
          }
          right={
            <div className="flex min-h-[260px] h-full flex-col p-2 lg:p-3">
              <PipelineTerminal onExec={handleExec} injectCmd={injectCmd} runId={state.runId} />
            </div>
          }
        />
      </div>

      {showCheat && (
        <div className="max-h-[50vh] overflow-auto border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="grid gap-4 p-4 md:grid-cols-3">
            {PIPELINE_GROUP_ORDER.map((group) => (
              <div key={group}>
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{group}</div>
                <div className="mt-2 flex flex-col gap-1.5">
                  {PIPELINE_CHEAT_SHEET.filter((it) => it.group === group).map((it) => (
                    <button
                      key={it.command}
                      onClick={() => handleInject(it.example)}
                      className="rounded border border-zinc-200 px-2 py-1.5 text-left hover:border-sky-500/60 hover:bg-sky-500/10 dark:border-zinc-700"
                    >
                      <div className="font-mono text-[11px] font-semibold text-zinc-800 dark:text-zinc-100">{it.command}</div>
                      <div className="text-[11px] text-zinc-500">{it.explanation}</div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Terminal: same injectable pattern as GitSimulation's InjectableGitTerminal,
// retitled for pipelines. Commands: pipe run [stage], pipe retry <stage>,
// pipe status, pipe logs <stage>, pipe reset, clear.
function PipelineTerminal({ onExec, injectCmd, runId }: {
  onExec: (c: string) => { stdout: string; stderr: string; exitCode: number };
  injectCmd: string | null;
  runId: number;
}) {
  const [lines, setLines] = useState<{ type: 'input' | 'stdout' | 'stderr' | 'hint'; text: string }[]>([
    { type: 'hint', text: 'Pipeline terminal — type `pipe status` to start. ↑/↓ history, Tab autocomplete, `clear` to reset.' },
  ]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const append = useCallback((newLines: { type: 'input' | 'stdout' | 'stderr' | 'hint'; text: string }[]) => {
    setLines((prev) => [...prev, ...newLines]);
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [lines]);

  const execAndAppend = useCallback((raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    setHistory((h) => [...h, raw]);
    setHistIdx(null);
    append([{ type: 'input', text: `$ ${raw}` }]);
    const res = onExec(raw);
    if ((res.stdout as string) === '__CLEAR__') {
      setLines([{ type: 'hint', text: 'Cleared.' }]);
      return;
    }
    if (res.stderr) append([{ type: 'stderr', text: res.stderr }]);
    if (res.stdout) append([{ type: 'stdout', text: res.stdout }]);
  }, [onExec, append]);

  const lastInjectRef = useRef<string | null>(null);
  useEffect(() => {
    if (injectCmd && injectCmd !== lastInjectRef.current) {
      lastInjectRef.current = injectCmd;
      execAndAppend(injectCmd);
    }
    if (!injectCmd) lastInjectRef.current = null;
  }, [injectCmd, execAndAppend]);

  const ALL_COMMANDS = [
    'pipe run', 'pipe run build', 'pipe run test', 'pipe run scan', 'pipe run deploy',
    'pipe retry test', 'pipe retry build', 'pipe retry scan', 'pipe retry deploy',
    'pipe status', 'pipe logs build', 'pipe logs test', 'pipe logs scan', 'pipe logs deploy',
    'pipe reset', 'clear',
  ];

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      execAndAppend(input);
      setInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!history.length) return;
      const nextIdx = histIdx === null ? history.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(nextIdx);
      setInput(history[nextIdx]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (histIdx === null) return;
      const nextIdx = histIdx + 1;
      if (nextIdx >= history.length) { setHistIdx(null); setInput(''); } else { setHistIdx(nextIdx); setInput(history[nextIdx]); }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const cand = ALL_COMMANDS.filter((c) => c.startsWith(input) && c !== input);
      if (cand.length === 1) setInput(cand[0]);
      else if (cand.length > 1) append([{ type: 'hint', text: cand.slice(0, 8).join('  ') }]);
    } else if (e.key === 'l' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setLines([{ type: 'hint', text: 'Cleared.' }]);
    }
  };

  return (
    <div className="flex h-full min-h-[240px] flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
          <span className="ml-2 font-mono text-[11px] uppercase tracking-wide text-zinc-400">Pipeline Terminal</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">run #{runId}</span>
          <button onClick={() => setLines([{ type: 'hint', text: 'Cleared.' }])} className="rounded px-2 py-0.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">clear</button>
        </div>
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-2 font-mono text-xs leading-5">
        {lines.map((l, i) => {
          if (l.type === 'input') return <div key={i} className="whitespace-pre-wrap text-sky-400">{l.text}</div>;
          if (l.type === 'stderr') return <div key={i} className="whitespace-pre-wrap text-red-400">{l.text}</div>;
          if (l.type === 'hint') return <div key={i} className="whitespace-pre-wrap text-zinc-500">{l.text}</div>;
          return <div key={i} className="whitespace-pre-wrap text-zinc-200">{l.text}</div>;
        })}
        <div className="mt-1 flex items-center gap-2">
          <span className="shrink-0 text-emerald-400">$</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="pipe status"
            spellCheck={false}
            autoComplete="off"
            className="flex-1 bg-transparent font-mono text-xs text-zinc-100 placeholder-zinc-600 outline-none"
          />
        </div>
      </div>
      <div className="border-t border-zinc-800 bg-zinc-900/50 px-3 py-1 text-[10px] text-zinc-500">↑/↓ history • Tab autocomplete • pipe help</div>
    </div>
  );
}

export default function PipelineSimulation(props: PipelineSimulationProps) {
  return (
    <ProgressProvider>
      <PipelineSimulationContent {...props} />
    </ProgressProvider>
  );
}
```

- [ ] **Step 3: Extend `src/content.config.ts:27`**

Old: `simulation: z.enum(['code', 'git', 'design']).default('code'),`
New: `simulation: z.enum(['code', 'git', 'design', 'pipeline']).default('code'),`

- [ ] **Step 4: Rewire `src/pages/skill/[slug].astro:27-28,40`**

Old line 27:
`const isGitSimulation = skill.data.simulation === 'git' || ['version-control','git-fundamentals','git-branching','git-remotes','github-workflow','cicd'].includes(skill.id);`
New:
```astro
import PipelineSimulation from '../../components/react/PipelineSimulation.tsx';
const isGitSimulation = skill.data.simulation === 'git' || ['version-control','git-fundamentals','git-branching','git-remotes','github-workflow'].includes(skill.id);
const isPipelineSimulation = skill.data.simulation === 'pipeline' || skill.id === 'cicd';
```
Old line 40 ternary — new:
`{isGitSimulation ? <GitSimulation client:load skillId={skill.id} /> : isPipelineSimulation ? <PipelineSimulation client:load skillId={skill.id} /> : isDesignSimulation ? <SimulationStage client:load skillId={skill.id} layout="panel" /> : <CodePlayground client:load skillId={skill.id} starterCode={starterCode} />}`

- [ ] **Step 5: Update `src/content/skills/cicd.md`** — frontmatter `simulation: git` → `simulation: pipeline`; append to body before `## Resources`:

```md
## Try it (right pane)

Run the pipeline terminal: `pipe status`, `pipe run`, `pipe retry test`, `pipe run`, `pipe run`. The test stage flakes once by design — retry it, then deploy to staging.
```

- [ ] **Step 6: Run check + build**

Run: `npm run check` — Expected: 0 errors.
Run: `npm run build` — Expected: exit 0, `/skill/cicd` renders pipeline sim.

- [ ] **Step 7: Commit**

```bash
git add src/components/react/PipelineGraph.tsx src/components/react/PipelineSimulation.tsx src/content.config.ts "src/pages/skill/[slug].astro" src/content/skills/cicd.md
git commit -m "feat(pipeline): add pipeline simulator and switch cicd to it"
```

---

### Task 4: Docker + K8s design presets (presets-only MVP)

**Files:**
- Modify: `src/lib/design/presets.ts` (2 presets + 2 SLO entries)
- Modify: none else (`docker-containers.md`, `kubernetes-basics.md` already declare `simulation: design`; lookup is by skill id)
- Test: `npm run check` + `npm run build`

**Interfaces:**
- Consumes: `preset()` helper signature `src/lib/design/presets.ts:21-32`, `DESIGN_KINDS` (no new kinds).
- Produces: `DESIGN_PRESETS['docker-containers']`, `DESIGN_PRESETS['kubernetes-basics']` rendered by the untouched `SimulationStage`. **Preset ids MUST equal the skill ids** — `SimulationStage.tsx:199-200` resolves `getPreset(activeScenario)` with `activeScenario ??= skillId` and falls back to `free`, so any other id would silently render the free canvas.

- [ ] **Step 1: Add presets before the `free` entry (`src/lib/design/presets.ts:152`)**

```ts
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
```

- [ ] **Step 2: Add SLOs (`src/lib/design/presets.ts:166-179`)**

```ts
'docker-containers': { errLtPct: 5, minCompleted: 50 },
'kubernetes-basics': { errLtPct: 5, minCompleted: 100 },
```

- [ ] **Step 3: Run check + build**

Run: `npm run check` — Expected: 0 errors.
Run: `npm run build` — Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/lib/design/presets.ts
git commit -m "feat(design): add docker-lifecycle and k8s-deploy presets"
```

---

### Task 5: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full check**

Run: `npm run check` — Expected: 0 errors.

- [ ] **Step 2: Full build**

Run: `npm run build` — Expected: exit 0.

- [ ] **Step 3: Click-through (dev server)**

Run: `npm run dev`, then open `/` (6 new nodes visible, edges sane), `/skill/cicd` (pipeline sim: status → run → retry test → run → run → Objective met → Mark complete persists), `/skill/docker-containers` and `/skill/kubernetes-basics` (design sim with new objectives), one code skill (e.g. `/skill/linux-shell`).

- [ ] **Step 4: Report** — no commit (nothing to commit). Summarize evidence per the verification-before-completion rule.
