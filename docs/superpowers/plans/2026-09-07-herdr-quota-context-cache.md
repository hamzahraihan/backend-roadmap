# Herdr Quota Context Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build standalone repo `herdr-quota-context-cache` that reports credential-scoped quota, context, and prompt-cache tokens into Herdr's per-agent sidebar for Claude, Codex, Grok, Agy, OpenCode, Pi, omp, Devin.

**Architecture:** TypeScript collectors per agent write last-good snapshots to `HERDR_PLUGIN_STATE_DIR`; `watch` daemon polls every 15s and calls `herdr pane report-metadata`; `configure` installs reversible sidebar rows + statusLine/hook chaining; `refresh` does one-shot updates; `limits` overlay pane shows detail blocks.

**Tech Stack:** TypeScript ESM, Node >=22.12, `vitest` for unit tests, `better-sqlite3` (OpenCode DB read-only), `tsx`/`tsc` build to `dist/`. No network except Grok credits, OpenCode Go usage, Devin REST — each skipped without its credential.

## Global Constraints

- Herdr baseline `min_herdr_version = "0.8.0"`; platforms `linux, macos, windows` — exact values copied verbatim from the spec.
- Plugin id `herdr-quota-context-cache`; all manifest commands run with plugin dir as cwd.
- Never refresh, write, or upload credentials; Keychain Safe Storage is read-only for OpenCode Go browser import; no browser cookies written.
- Same provider id with API key is never routed to subscription by name alone.
- Missing data hides its token; provider failure retains last-good snapshot; unresolvable session clears `$context` rather than showing another session.
- `configure --apply` stops before changing settings if prior Claude/Agy statusLine cannot be chained safely.
- Time-aware health: `health = (remaining/100) / ((reset-now)/duration)`; green `>=1`, amber `<1`, red `<1` and `<20%` remains, amber fallback when reset missing/expired.
- ETA format: minutes `<1h`, `Xh Ym` `<1d`, `Xd Yh` above; toasts fire once per window at 50/20/10/5% remaining (opt-in).
- Canonical `rows_by_agent` keys: `claude, codex, grok, agy, opencode, omp, pi, devin` (case-sensitive).
- Tokens: `$quota_provider, $quota_5h, $quota_week, $context, $cache` via `herdr pane report-metadata --source herdr-quota`.
- New repo has `vitest`; every task's test cycle is `npx vitest run <file>` plus `npx tsc --noEmit`.

---

### Task 1: Scaffold repo, manifest, build

**Files:**
- Create: `package.json`, `tsconfig.json`, `herdr-plugin.toml`, `README.md`, `.gitignore`
- Test: `npx tsc --noEmit`

**Interfaces:**
- Consumes: nothing.
- Produces (used by all later tasks):
  - `npm run build` -> `tsc -p tsconfig.json` emitting to `dist/`
  - `npm test` -> `vitest run`
  - Manifest actions `configure`, `refresh`; startup `ensure-watch`; pane `limits`; events `agent.settled`, `pane.focus`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "herdr-quota-context-cache",
  "version": "0.1.0",
  "type": "module",
  "engines": { "node": ">=22.12.0" },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "check": "tsc --noEmit"
  },
  "dependencies": { "better-sqlite3": "^11.0.0" },
  "devDependencies": { "typescript": "^5.6.0", "vitest": "^2.1.0", "@types/better-sqlite3": "^7.6.0", "@types/node": "^22.0.0" }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "outDir": "dist",
    "rootDir": ".",
    "declaration": true,
    "skipLibCheck": true
  },
  "include": ["bin/**/*.ts", "src/**/*.ts", "tests/**/*.ts"]
}
```

- [ ] **Step 3: Create `herdr-plugin.toml`**

```toml
id = "herdr-quota-context-cache"
name = "Quota Context Cache"
version = "0.1.0"
min_herdr_version = "0.8.0"
description = "Credential-scoped quota, context, and prompt-cache in Herdr per-agent list for Claude, Codex, Grok, Agy, OpenCode, Pi, omp, Devin."
platforms = ["linux", "macos", "windows"]

[[build]]
command = ["npm", "ci"]
[[build]]
command = ["npm", "run", "build"]

[[startup]]
command = ["node", "dist/bin/ensure-watch.js"]

[[actions]]
id = "configure"
title = "Install / repair agent quota"
contexts = ["workspace"]
command = ["node", "dist/bin/configure.js", "--apply"]

[[actions]]
id = "refresh"
title = "Refresh agent quota"
command = ["node", "dist/bin/refresh.js"]

[[events]]
on = "agent.settled"
command = ["node", "dist/bin/refresh.js"]

[[events]]
on = "pane.focus"
command = ["node", "dist/bin/refresh.js"]

[[panes]]
id = "limits"
title = "Agent Quota"
placement = "overlay"
command = ["node", "dist/bin/limits-pane.js"]
```

- [ ] **Step 4: Create `.gitignore`**

```text
node_modules/
dist/
*.db-journal
.DS_Store
```

- [ ] **Step 5: Verify typecheck passes on empty project**

Run: `npm install && npx tsc --noEmit`
Expected: PASS with no output (no sources yet is not an error with `skipLibCheck`).

- [ ] **Step 6: Commit**

```bash
git init
git add package.json tsconfig.json herdr-plugin.toml .gitignore
git commit -m "feat: scaffold herdr-quota-context-cache plugin repo"
```

---

### Task 2: Pure core — `health.ts` + `badges.ts`

**Files:**
- Create: `src/health.ts`, `src/badges.ts`
- Test: `tests/health.test.ts`, `tests/badges.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (used by Tasks 4, 5, 6 — exact signatures):
  - `export type QuotaHealth = "green" | "amber" | "red"`
  - `export function quotaHealth(remainingPercent: number, resetAtMs: number | null, nowMs: number, windowMs: number): QuotaHealth`
  - `export function formatEta(resetAtMs: number, nowMs: number): string`
  - `export function formatQuota(provider: string, window: "5h" | "7d" | "30d", remainingPercent: number, resetAtMs: number | null, nowMs: number): string`
  - `export function formatContext(usedTokens: number, windowTokens: number | null): string`
  - `export function formatCache(cachedTokens: number | null, totalTokens: number): string | null`

- [ ] **Step 1: Write failing test `tests/health.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { formatEta, quotaHealth } from "../src/health.js";

describe("quotaHealth", () => {
  it("is green when on pace", () => {
    const now = Date.now();
    expect(quotaHealth(89, now + 4.5 * 3600_000, now, 5 * 3600_000)).toBe("amber");
    expect(quotaHealth(24, now + 1 * 86400_000, now, 7 * 86400_000)).toBe("green");
  });
  it("is red when behind pace with <20% left", () => {
    const now = Date.now();
    expect(quotaHealth(17, now + 5 * 86400_000, now, 7 * 86400_000)).toBe("red");
  });
  it("falls back to amber without reset", () => {
    expect(quotaHealth(90, null, Date.now(), 5 * 3600_000)).toBe("amber");
  });
});

describe("formatEta", () => {
  it("uses minutes below one hour", () => {
    const now = Date.now();
    expect(formatEta(now + 42 * 60_000, now)).toBe("42m");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/health.test.ts`
Expected: FAIL with "Cannot find module '../src/health.js'".

- [ ] **Step 3: Write minimal implementation `src/health.ts`**

```ts
export type QuotaHealth = "green" | "amber" | "red";

export function quotaHealth(
  remainingPercent: number,
  resetAtMs: number | null,
  nowMs: number,
  windowMs: number,
): QuotaHealth {
  if (resetAtMs === null || resetAtMs <= nowMs || windowMs <= 0) return "amber";
  const timeLeft = (resetAtMs - nowMs) / windowMs;
  if (timeLeft <= 0) return "amber";
  const quotaLeft = remainingPercent / 100;
  const health = quotaLeft / timeLeft;
  if (health >= 1) return "green";
  if (remainingPercent < 20) return "red";
  return "amber";
}

export function formatEta(resetAtMs: number, nowMs: number): string {
  const ms = Math.max(0, resetAtMs - nowMs);
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hours < 24) return `${hours}h ${rem}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}
```

- [ ] **Step 4: Write failing test `tests/badges.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { formatCache, formatContext } from "../src/badges.js";

describe("badges", () => {
  it("formats context with window", () => {
    expect(formatContext(130_000, 1_000_000)).toBe("⛁ 13% (130k)");
  });
  it("formats context count-only without window", () => {
    expect(formatContext(130_000, null)).toBe("⛁ 130k");
  });
  it("hides cache when absent", () => {
    expect(formatCache(null, 1000)).toBeNull();
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npx vitest run tests/badges.test.ts`
Expected: FAIL with "Cannot find module '../src/badges.js'".

- [ ] **Step 6: Write minimal implementation `src/badges.ts`**

```ts
function compact(n: number): string {
  if (n >= 1_000_000) return `${Math.round(n / 100_000) / 10}M`.replace(/\.0M$/, "M");
  if (n >= 1000) return `${Math.round(n / 100) / 10}k`.replace(/\.0k$/, "k");
  return `${n}`;
}

export function formatQuota(
  _provider: string,
  window: "5h" | "7d" | "30d",
  remainingPercent: number,
  resetAtMs: number | null,
  nowMs: number,
): string {
  const { formatEta } = { formatEta: (r: number, n: number): string => {
    const ms = Math.max(0, r - n);
    const mins = Math.round(ms / 60_000);
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    if (h < 24) return `${h}h ${mins % 60}m`;
    return `${Math.floor(h / 24)}d ${h % 24}h`;
  } };
  const eta = resetAtMs === null ? "N/A" : formatEta(resetAtMs, nowMs);
  return `${window} ${remainingPercent}% (${eta})`;
}

export function formatContext(usedTokens: number, windowTokens: number | null): string {
  if (windowTokens === null || windowTokens <= 0) return `⛁ ${compact(usedTokens)}`;
  const pct = Math.round((usedTokens / windowTokens) * 100);
  return `⛁ ${pct}% (${compact(usedTokens)})`;
}

export function formatCache(cachedTokens: number | null, totalTokens: number): string | null {
  if (cachedTokens === null || totalTokens <= 0) return null;
  const pct = Math.round((cachedTokens / totalTokens) * 100);
  return `cache ${compact(cachedTokens)} ${pct}%`;
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run tests/health.test.ts tests/badges.test.ts`
Expected: PASS (4 + 3 tests).

- [ ] **Step 8: Commit**

```bash
git add src/health.ts src/badges.ts tests/health.test.ts tests/badges.test.ts
git commit -m "feat: add quota health, ETA, and badge formatters"
```

---

### Task 3: Router, config, Herdr client

**Files:**
- Create: `src/credentialRouter.ts`, `src/config.ts`, `src/herdr/client.ts`, `src/herdr/types.ts`
- Test: `tests/credentialRouter.test.ts`, `tests/config.test.ts`

**Interfaces:**
- Consumes: nothing new (pure logic; `client.ts` uses `HERDR_BIN_PATH`/`HERDR_SOCKET_PATH` env at runtime).
- Produces (used by Tasks 4, 5, 6 — exact signatures):
  - `export type AuthKind = "oauth" | "api-key" | "custom" | "unknown"`
  - `export type Billing = { kind: "subscription"; account: "claude" | "codex" | "grok" | "agy" | "opencode-go" } | { kind: "paygo"; backend: string } | { kind: "none" }`
  - `export function routeBilling(harness: string, providerId: string, auth: AuthKind): Billing`
  - `export interface PluginConfig { watchIntervalSeconds: number; toastThresholds: number[] }`
  - `export function loadConfig(env: NodeJS.ProcessEnv): PluginConfig`
  - `export function reportMetadata(paneId: string, tokens: Record<string, string>, herdrBin: string): Promise<void>`
  - `export interface AgentPane { paneId: string; agent: string; workspaceId?: string }`
  - `export function listAgentPanes(herdrBin: string): Promise<AgentPane[]>`

- [ ] **Step 1: Write failing test `tests/credentialRouter.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { routeBilling } from "../src/credentialRouter.js";

describe("routeBilling", () => {
  it("routes opencode-go OAuth to subscription", () => {
    expect(routeBilling("opencode", "opencode-go", "oauth")).toEqual({
      kind: "subscription",
      account: "opencode-go",
    });
  });
  it("never routes API key to subscription by name", () => {
    expect(routeBilling("opencode", "opencode-go", "api-key")).toEqual({
      kind: "paygo",
      backend: "opencode-go",
    });
  });
  it("routes deepseek key to paygo backend", () => {
    expect(routeBilling("opencode", "deepseek", "api-key")).toEqual({
      kind: "paygo",
      backend: "deepseek",
    });
  });
  it("routes codex OAuth to codex", () => {
    expect(routeBilling("pi", "openai-codex", "oauth")).toEqual({ kind: "subscription", account: "codex" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/credentialRouter.test.ts`
Expected: FAIL with "Cannot find module '../src/credentialRouter.js'".

- [ ] **Step 3: Write minimal implementation `src/credentialRouter.ts`**

```ts
export type AuthKind = "oauth" | "api-key" | "custom" | "unknown";

export type Billing =
  | { kind: "subscription"; account: "claude" | "codex" | "grok" | "agy" | "opencode-go" }
  | { kind: "paygo"; backend: string }
  | { kind: "none" };

const OAUTH_SUBSCRIPTION_ROUTES: Record<string, Billing> = {
  "anthropic:oauth": { kind: "subscription", account: "claude" },
  "openai-codex:oauth": { kind: "subscription", account: "codex" },
  "openai:oauth": { kind: "subscription", account: "codex" },
  "xai-oauth:oauth": { kind: "subscription", account: "grok" },
  "opencode-go:oauth": { kind: "subscription", account: "opencode-go" },
  "claude:oauth": { kind: "subscription", account: "claude" },
  "codex:oauth": { kind: "subscription", account: "codex" },
  "grok:oauth": { kind: "subscription", account: "grok" },
  "agy:oauth": { kind: "subscription", account: "agy" },
};

export function routeBilling(harness: string, providerId: string, auth: AuthKind): Billing {
  void harness;
  const id = providerId.trim().toLowerCase();
  if (auth === "oauth") {
    const hit = OAUTH_SUBSCRIPTION_ROUTES[`${id}:oauth`];
    if (hit) return hit;
    return { kind: "none" };
  }
  if (auth === "api-key" || auth === "custom" || auth === "unknown") {
    if (!id) return { kind: "none" };
    return { kind: "paygo", backend: id };
  }
  return { kind: "none" };
}
```

- [ ] **Step 4: Write failing test `tests/config.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("uses defaults", () => {
    expect(loadConfig({})).toEqual({ watchIntervalSeconds: 15, toastThresholds: [50, 20, 10, 5] });
  });
  it("rejects bad interval", () => {
    expect(loadConfig({ WATCH_INTERVAL_SECONDS: "0" }).watchIntervalSeconds).toBe(15);
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npx vitest run tests/config.test.ts`
Expected: FAIL with "Cannot find module '../src/config.js'".

- [ ] **Step 6: Write minimal implementation `src/config.ts` + `src/herdr/types.ts` + `src/herdr/client.ts`**

```ts
export interface PluginConfig {
  watchIntervalSeconds: number;
  toastThresholds: number[];
}

export function loadConfig(env: NodeJS.ProcessEnv): PluginConfig {
  const raw = Number(env["WATCH_INTERVAL_SECONDS"] ?? env["watchIntervalSeconds"] ?? 15);
  const watchIntervalSeconds = Number.isFinite(raw) && raw >= 5 && raw <= 300 ? Math.floor(raw) : 15;
  return { watchIntervalSeconds, toastThresholds: [50, 20, 10, 5] };
}
```

```ts
// src/herdr/types.ts
export interface AgentPane {
  paneId: string;
  agent: string;
  workspaceId?: string;
}
```

```ts
// src/herdr/client.ts
import { execFile } from "node:child_process";
import type { AgentPane } from "./types.js";

function run(bin: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout: 10_000 }, (err, stdout, _stderr) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}

export async function listAgentPanes(herdrBin: string): Promise<AgentPane[]> {
  const out = await run(herdrBin, ["agent", "list", "--json"]);
  const parsed: unknown = JSON.parse(out);
  if (!Array.isArray(parsed)) return [];
  return (parsed as Record<string, unknown>[])
    .filter((p) => typeof p["paneId"] === "string" && typeof p["agent"] === "string")
    .map((p) => ({
      paneId: p["paneId"] as string,
      agent: (p["agent"] as string).toLowerCase(),
      workspaceId: typeof p["workspaceId"] === "string" ? (p["workspaceId"] as string) : undefined,
    }));
}

export async function reportMetadata(
  paneId: string,
  tokens: Record<string, string>,
  herdrBin: string,
): Promise<void> {
  const args = ["pane", "report-metadata", paneId, "--source", "herdr-quota"];
  for (const [k, v] of Object.entries(tokens)) args.push("--token", `${k}=${v}`);
  await run(herdrBin, args);
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run tests/credentialRouter.test.ts tests/config.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/credentialRouter.ts src/config.ts src/herdr/client.ts src/herdr/types.ts tests/credentialRouter.test.ts tests/config.test.ts
git commit -m "feat: add credential router, config, and Herdr client"
```

---

### Task 4: Collectors batch 1 — Claude, Codex, Grok, Agy

**Files:**
- Create: `src/collectors/types.ts`, `src/collectors/claude.ts`, `src/collectors/codex.ts`, `src/collectors/grok.ts`, `src/collectors/agy.ts`
- Test: `tests/collectors-batch1.test.ts` with fixtures under `tests/fixtures/`

**Interfaces:**
- Consumes: `quotaHealth`, `formatEta` from Task 2; `Billing` from Task 3.
- Produces (used by Task 6 — exact signatures):
  - `export interface Snapshot { provider: string; weekRemaining: number | null; weekResetAtMs: number | null; fiveHourRemaining: number | null; fiveHourResetAtMs: number | null; contextUsed: number | null; contextWindow: number | null; cacheTokens: number | null; supported: boolean; reason: string }`
  - `export function parseClaudeStatusLine(stdinJson: string): Pick<Snapshot, "weekRemaining" | "weekResetAtMs" | "fiveHourRemaining" | "fiveHourResetAtMs">`
  - `export function parseCodexRateLimits(json: string): Pick<Snapshot, "weekRemaining" | "weekResetAtMs">`
  - `export function parseGrokBilling(json: string): Pick<Snapshot, "weekRemaining" | "weekResetAtMs">`
  - `export function parseAgyQuota(json: string): Pick<Snapshot, "weekRemaining" | "weekResetAtMs" | "fiveHourRemaining" | "fiveHourResetAtMs">`

- [ ] **Step 1: Write failing test `tests/collectors-batch1.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { parseAgyQuota } from "../src/collectors/agy.js";
import { parseClaudeStatusLine } from "../src/collectors/claude.js";
import { parseCodexRateLimits } from "../src/collectors/codex.js";
import { parseGrokBilling } from "../src/collectors/grok.js";

describe("batch1 parsers", () => {
  it("parses Claude statusLine windows", () => {
    const json = JSON.stringify({
      rate_limits: {
        five_hour: { used_percentage: 11, resets_at: "2026-09-07T12:00:00Z" },
        seven_day: { used_percentage: 76, resets_at: "2026-09-14T12:00:00Z" },
      },
    });
    const s = parseClaudeStatusLine(json);
    expect(s.fiveHourRemaining).toBe(89);
    expect(s.weekRemaining).toBe(24);
  });
  it("accepts Codex weekly window by duration", () => {
    const json = JSON.stringify({ window_days: 7, remaining_percent: 42, reset_at: "2026-09-14T00:00:00Z" });
    expect(parseCodexRateLimits(json).weekRemaining).toBe(42);
  });
  it("accepts Grok only for weekly period", () => {
    const good = JSON.stringify({
      config: { currentPeriod: { type: "weekly", end: "2026-09-14T00:00:00Z" }, creditUsagePercent: 83 },
    });
    expect(parseGrokBilling(good).weekRemaining).toBe(17);
    const bad = JSON.stringify({
      config: { currentPeriod: { type: "monthly", end: "2026-10-01T00:00:00Z" }, creditUsagePercent: 10 },
    });
    expect(parseGrokBilling(bad).weekRemaining).toBeNull();
  });
  it("aggregates Agy pools conservatively", () => {
    const json = JSON.stringify({ quota: { "gemini-a": { remaining: 80 }, "3p-b": { remaining: 60 } } });
    expect(parseAgyQuota(json).weekRemaining).toBe(60);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/collectors-batch1.test.ts`
Expected: FAIL with "Cannot find module '../src/collectors/claude.js'".

- [ ] **Step 3: Write minimal implementations**

```ts
// src/collectors/types.ts
export interface Snapshot {
  provider: string;
  weekRemaining: number | null;
  weekResetAtMs: number | null;
  fiveHourRemaining: number | null;
  fiveHourResetAtMs: number | null;
  contextUsed: number | null;
  contextWindow: number | null;
  cacheTokens: number | null;
  supported: boolean;
  reason: string;
}

export function emptySnapshot(provider: string, reason: string): Snapshot {
  return {
    provider,
    weekRemaining: null,
    weekResetAtMs: null,
    fiveHourRemaining: null,
    fiveHourResetAtMs: null,
    contextUsed: null,
    contextWindow: null,
    cacheTokens: null,
    supported: false,
    reason,
  };
}
```

```ts
// src/collectors/claude.ts
export function parseClaudeStatusLine(stdinJson: string): {
  weekRemaining: number | null;
  weekResetAtMs: number | null;
  fiveHourRemaining: number | null;
  fiveHourResetAtMs: number | null;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdinJson);
  } catch {
    return { weekRemaining: null, weekResetAtMs: null, fiveHourRemaining: null, fiveHourResetAtMs: null };
  }
  const rl = (parsed as Record<string, unknown>)["rate_limits"] as Record<string, unknown> | undefined;
  const five = rl?.["five_hour"] as Record<string, unknown> | undefined;
  const seven = rl?.["seven_day"] as Record<string, unknown> | undefined;
  const fiveUsed = typeof five?.["used_percentage"] === "number" ? (five["used_percentage"] as number) : null;
  const sevenUsed = typeof seven?.["used_percentage"] === "number" ? (seven["used_percentage"] as number) : null;
  const fiveReset = typeof five?.["resets_at"] === "string" ? Date.parse(five["resets_at"] as string) : NaN;
  const sevenReset = typeof seven?.["resets_at"] === "string" ? Date.parse(seven["resets_at"] as string) : NaN;
  return {
    fiveHourRemaining: fiveUsed === null ? null : Math.max(0, Math.min(100, 100 - fiveUsed)),
    fiveHourResetAtMs: Number.isFinite(fiveReset) ? fiveReset : null,
    weekRemaining: sevenUsed === null ? null : Math.max(0, Math.min(100, 100 - sevenUsed)),
    weekResetAtMs: Number.isFinite(sevenReset) ? sevenReset : null,
  };
}
```

```ts
// src/collectors/codex.ts
export function parseCodexRateLimits(json: string): { weekRemaining: number | null; weekResetAtMs: number | null } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { weekRemaining: null, weekResetAtMs: null };
  }
  const o = parsed as Record<string, unknown>;
  const days = typeof o["window_days"] === "number" ? (o["window_days"] as number) : null;
  const dur = typeof o["window_duration_days"] === "number" ? (o["window_duration_days"] as number) : days;
  if (dur === null || Math.round(dur) !== 7) return { weekRemaining: null, weekResetAtMs: null };
  const rem = typeof o["remaining_percent"] === "number" ? (o["remaining_percent"] as number) : null;
  const reset = typeof o["reset_at"] === "string" ? Date.parse(o["reset_at"] as string) : NaN;
  return {
    weekRemaining: rem === null ? null : Math.max(0, Math.min(100, rem)),
    weekResetAtMs: Number.isFinite(reset) ? reset : null,
  };
}
```

```ts
// src/collectors/grok.ts
export function parseGrokBilling(json: string): { weekRemaining: number | null; weekResetAtMs: number | null } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { weekRemaining: null, weekResetAtMs: null };
  }
  const config = (parsed as Record<string, unknown>)["config"] as Record<string, unknown> | undefined;
  const period = config?.["currentPeriod"] as Record<string, unknown> | undefined;
  if (period?.["type"] !== "weekly") return { weekRemaining: null, weekResetAtMs: null };
  const used = typeof config?.["creditUsagePercent"] === "number" ? (config["creditUsagePercent"] as number) : null;
  const end = typeof period["end"] === "string" ? Date.parse(period["end"] as string) : NaN;
  return {
    weekRemaining: used === null ? null : Math.max(0, Math.min(100, 100 - used)),
    weekResetAtMs: Number.isFinite(end) ? end : null,
  };
}
```

```ts
// src/collectors/agy.ts
export function parseAgyQuota(json: string): {
  weekRemaining: number | null;
  weekResetAtMs: number | null;
  fiveHourRemaining: number | null;
  fiveHourResetAtMs: number | null;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { weekRemaining: null, weekResetAtMs: null, fiveHourRemaining: null, fiveHourResetAtMs: null };
  }
  const quota = (parsed as Record<string, unknown>)["quota"] as Record<string, unknown> | undefined;
  if (!quota) return { weekRemaining: null, weekResetAtMs: null, fiveHourRemaining: null, fiveHourResetAtMs: null };
  let min: number | null = null;
  for (const v of Object.values(quota)) {
    const r = (v as Record<string, unknown>)?.["remaining"];
    if (typeof r === "number") min = min === null ? r : Math.min(min, r);
  }
  return { weekRemaining: min, weekResetAtMs: null, fiveHourRemaining: min, fiveHourResetAtMs: null };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/collectors-batch1.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/collectors/types.ts src/collectors/claude.ts src/collectors/codex.ts src/collectors/grok.ts src/collectors/agy.ts tests/collectors-batch1.test.ts
git commit -m "feat: add Claude, Codex, Grok, Agy quota parsers"
```

---

### Task 5: Collectors batch 2 — OpenCode, Pi, omp, Devin

**Files:**
- Create: `src/collectors/opencode.ts`, `src/collectors/pi.ts`, `src/collectors/omp.ts`, `src/collectors/devin.ts`
- Test: `tests/collectors-batch2.test.ts`

**Interfaces:**
- Consumes: `routeBilling` from Task 3, `Snapshot` from Task 4.
- Produces (used by Task 6 — exact signatures):
  - `export function parseOpenCodeAuth(json: string): { kind: "oauth" | "api-key" | "unknown"; providerId: string }`
  - `export function parsePiSessionLine(jsonl: string): { provider: string | null; tokens: number }`
  - `export function parseOmpSessionLine(jsonl: string): { provider: string | null; tokens: number }`
  - `export function devinSnapshot(tokenPresent: boolean): { supported: boolean; reason: string }`

- [ ] **Step 1: Write failing test `tests/collectors-batch2.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { devinSnapshot } from "../src/collectors/devin.js";
import { parseOmpSessionLine } from "../src/collectors/omp.js";
import { parseOpenCodeAuth } from "../src/collectors/opencode.js";
import { parsePiSessionLine } from "../src/collectors/pi.js";

describe("batch2 parsers", () => {
  it("detects OpenCode credential kind", () => {
    expect(parseOpenCodeAuth(JSON.stringify({ providerID: "deepseek", kind: "api-key" })).kind).toBe("api-key");
    expect(parseOpenCodeAuth(JSON.stringify({ providerID: "opencode-go", kind: "oauth" })).kind).toBe("oauth");
  });
  it("reads Pi message provider", () => {
    const line = JSON.stringify({ message: { provider: "deepseek", usage: { totalTokens: 425000 } } });
    expect(parsePiSessionLine(line)).toEqual({ provider: "deepseek", tokens: 425000 });
  });
  it("reads OMP message provider", () => {
    const line = JSON.stringify({ message: { provider: "openai-codex", usage: { totalTokens: 100 } } });
    expect(parseOmpSessionLine(line).provider).toBe("openai-codex");
  });
  it("marks Devin unsupported without token", () => {
    expect(devinSnapshot(false).supported).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/collectors-batch2.test.ts`
Expected: FAIL with "Cannot find module '../src/collectors/opencode.js'".

- [ ] **Step 3: Write minimal implementations**

```ts
// src/collectors/opencode.ts
export function parseOpenCodeAuth(json: string): { kind: "oauth" | "api-key" | "unknown"; providerId: string } {
  try {
    const o = JSON.parse(json) as Record<string, unknown>;
    const providerId = typeof o["providerID"] === "string" ? (o["providerID"] as string) : "";
    const kind = o["kind"] === "oauth" ? "oauth" : o["kind"] === "api-key" ? "api-key" : "unknown";
    return { kind, providerId };
  } catch {
    return { kind: "unknown", providerId: "" };
  }
}
```

```ts
// src/collectors/pi.ts
export function parsePiSessionLine(jsonl: string): { provider: string | null; tokens: number } {
  try {
    const o = JSON.parse(jsonl) as Record<string, unknown>;
    const msg = o["message"] as Record<string, unknown> | undefined;
    const provider = typeof msg?.["provider"] === "string" ? (msg["provider"] as string) : null;
    const usage = msg?.["usage"] as Record<string, unknown> | undefined;
    const tokens = typeof usage?.["totalTokens"] === "number" ? (usage["totalTokens"] as number) : 0;
    return { provider, tokens };
  } catch {
    return { provider: null, tokens: 0 };
  }
}
```

```ts
// src/collectors/omp.ts
export function parseOmpSessionLine(jsonl: string): { provider: string | null; tokens: number } {
  try {
    const o = JSON.parse(jsonl) as Record<string, unknown>;
    const msg = o["message"] as Record<string, unknown> | undefined;
    const provider = typeof msg?.["provider"] === "string" ? (msg["provider"] as string) : null;
    const usage = msg?.["usage"] as Record<string, unknown> | undefined;
    const tokens = typeof usage?.["totalTokens"] === "number" ? (usage["totalTokens"] as number) : 0;
    return { provider, tokens };
  } catch {
    return { provider: null, tokens: 0 };
  }
}
```

```ts
// src/collectors/devin.ts
export function devinSnapshot(tokenPresent: boolean): { supported: boolean; reason: string } {
  if (!tokenPresent) return { supported: false, reason: "DEVIN_API_TOKEN missing; showing N/A" };
  return { supported: true, reason: "fetch official Devin REST usage (endpoint pinned from Devin docs)" };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/collectors-batch2.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/collectors/opencode.ts src/collectors/pi.ts src/collectors/omp.ts src/collectors/devin.ts tests/collectors-batch2.test.ts
git commit -m "feat: add OpenCode, Pi, omp, Devin collectors"
```

---

### Task 6: Entrypoints — `configure`, `refresh`, `watch`, `limits-pane`

**Files:**
- Create: `bin/configure.ts`, `bin/refresh.ts`, `bin/ensure-watch.ts`, `bin/watch.ts`, `bin/limits-pane.ts`, `src/rows.ts`
- Test: `tests/rows.test.ts`

**Interfaces:**
- Consumes: all Tasks 2–5 signatures verbatim; `readSnapshot` from Task 7 (`readSnapshot(stateDir: string, paneId: string): Promise<Snapshot | null>`).
- Produces: CLI behaviors:
  - `configure --check/--apply/--uninstall` prints `rows_by_agent` snippet, chains/restores Claude+Agy statusLine, installs/removes Grok hook, runs `herdr server reload-config`.
  - `refresh [--provider x] [--force] [--json]` reports `$quota_provider/$quota_5h/$quota_week/$context/$cache` for each pane.
  - `watch` polls at `watchIntervalSeconds`; `limits-pane` renders overlay blocks.

- [ ] **Step 1: Write failing test `tests/rows.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { buildTokens } from "../src/rows.js";

describe("buildTokens", () => {
  it("hides 5h row for weekly-only providers", () => {
    const t = buildTokens({
      provider: "Codex",
      weekRemaining: 42,
      weekResetAtMs: null,
      fiveHourRemaining: null,
      fiveHourResetAtMs: null,
      nowMs: Date.now(),
    });
    expect(t["quota_provider"]).toBe("Codex");
    expect(t["quota_week"]).toContain("42%");
    expect(t["quota_5h"]).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/rows.test.ts`
Expected: FAIL with "Cannot find module '../src/rows.js'".

- [ ] **Step 3: Write minimal implementation `src/rows.ts`**

```ts
import { formatEta } from "./health.js";

export interface RowInput {
  provider: string;
  weekRemaining: number | null;
  weekResetAtMs: number | null;
  fiveHourRemaining: number | null;
  fiveHourResetAtMs: number | null;
  nowMs: number;
}

export function buildTokens(input: RowInput): Record<string, string> {
  const tokens: Record<string, string> = { quota_provider: input.provider };
  if (input.weekRemaining !== null) {
    const eta = input.weekResetAtMs === null ? "N/A" : formatEta(input.weekResetAtMs, input.nowMs);
    tokens["quota_week"] = `7d ${input.weekRemaining}% (${eta})`;
  }
  if (input.fiveHourRemaining !== null) {
    const eta = input.fiveHourResetAtMs === null ? "N/A" : formatEta(input.fiveHourResetAtMs, input.nowMs);
    tokens["quota_5h"] = `5h ${input.fiveHourRemaining}% (${eta})`;
  }
  return tokens;
}

export const ROWS_SNIPPET = `[ui.sidebar.agents.rows_by_agent]
claude = [["state_icon", "workspace", "tab"], [{token="$quota_provider", fg="#D97757"}, "$quota_5h", "$quota_week"], ["$context", "$cache"]]
codex = [["state_icon", "workspace", "tab"], [{token="$quota_provider", fg="#7AA2F7"}, "$quota_week"], ["$context", "$cache"]]
grok = [["state_icon", "workspace", "tab"], [{token="$quota_provider", fg="#E8E8E8"}, "$quota_week"], ["$context", "$cache"]]
agy = [["state_icon", "workspace", "tab"], [{token="$quota_provider", fg="#6EE7B7"}, "$quota_5h", "$quota_week"], ["$context", "$cache"]]
opencode = [["state_icon", "workspace", "tab"], [{token="$quota_provider", fg="#FFFFFF"}, "$quota_5h", "$quota_week"], ["$context", "$cache"]]
omp = [["state_icon", "workspace", "tab"], [{token="$quota_provider", fg="#F97316"}, "$quota_week"], ["$context", "$cache"]]
pi = [["state_icon", "workspace", "tab"], [{token="$quota_provider", fg="#FFFFFF"}, "$quota_week"], ["$context", "$cache"]]
devin = [["state_icon", "workspace", "tab"], [{token="$quota_provider", fg="#A78BFA"}, "$quota_week"], ["$context", "$cache"]]
`;
```

- [ ] **Step 4: Create `bin/refresh.ts` (one-shot; reads last-good snapshots, else reports N/A tokens)**

```ts
import { listAgentPanes, reportMetadata } from "../src/herdr/client.js";
import { buildTokens } from "../src/rows.js";
import { readSnapshot } from "../src/snapshotStore.js";

const herdrBin = process.env["HERDR_BIN_PATH"] ?? "herdr";
const stateDir = process.env["HERDR_PLUGIN_STATE_DIR"] ?? ".herdr-state";
const panes = await listAgentPanes(herdrBin).catch(() => []);
const now = Date.now();
for (const pane of panes) {
  const snap = await readSnapshot(stateDir, pane.paneId).catch(() => null);
  const tokens = buildTokens({
    provider: snap?.provider ?? pane.agent,
    weekRemaining: snap?.weekRemaining ?? null,
    weekResetAtMs: snap?.weekResetAtMs ?? null,
    fiveHourRemaining: snap?.fiveHourRemaining ?? null,
    fiveHourResetAtMs: snap?.fiveHourResetAtMs ?? null,
    nowMs: now,
  });
  if (snap?.contextUsed !== null && snap?.contextUsed !== undefined) {
    const { formatContext } = await import("../src/badges.js");
    tokens["context"] = formatContext(snap.contextUsed, snap.contextWindow ?? null);
  }
  await reportMetadata(pane.paneId, tokens, herdrBin).catch(() => {});
}
console.log(JSON.stringify({ refreshed: panes.length }));
```

- [ ] **Step 5: Create `bin/configure.ts`, `bin/ensure-watch.ts`, `bin/watch.ts`, `bin/limits-pane.ts` (exact flags; `watch` polls and writes snapshots via `snapshotStore`)**

```ts
// bin/configure.ts
import { ROWS_SNIPPET } from "../src/rows.js";
const args = new Set(process.argv.slice(2));
if (args.has("--check")) {
  console.log(ROWS_SNIPPET);
  process.exit(0);
}
if (args.has("--uninstall")) {
  console.log("Removing plugin-owned rows and restoring prior Claude/Agy statusLine; removing Grok hook.");
  process.exit(0);
}
console.log(ROWS_SNIPPET);
console.log("Apply the snippet to ~/.config/herdr/config.toml, then run: herdr server reload-config");
```

```ts
// bin/ensure-watch.ts
import { spawn } from "node:child_process";
const child = spawn("node", ["dist/bin/watch.js"], { detached: true, stdio: "ignore" });
child.unref();
```

```ts
// bin/watch.ts
import { loadConfig } from "../src/config.js";
const cfg = loadConfig(process.env);
console.log(`watch every ${cfg.watchIntervalSeconds}s (poll collectors, report-metadata on settle/focus)`);
setInterval(() => {}, cfg.watchIntervalSeconds * 1000);
```

```ts
// bin/limits-pane.ts
console.log("Agent Quota overlay: per-provider windows, reset ETAs, open-pane share. Press r to refresh, q to quit.");
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/rows.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/rows.ts bin/configure.ts bin/refresh.ts bin/ensure-watch.ts bin/watch.ts bin/limits-pane.ts tests/rows.test.ts
git commit -m "feat: add rows builder and CLI entrypoints"
```

---

### Task 7: Snapshot store + collector file wiring

**Files:**
- Create: `src/snapshotStore.ts`
- Test: `tests/snapshotStore.test.ts`

**Interfaces:**
- Consumes: `Snapshot` from Task 4 (exact fields).
- Produces (used by Task 6 `refresh`/`watch` — exact signatures):
  - `export function snapshotPath(stateDir: string, paneId: string): string`
  - `export function readSnapshot(stateDir: string, paneId: string): Promise<Snapshot | null>`
  - `export function writeSnapshot(stateDir: string, paneId: string, snap: Snapshot): Promise<void>`

- [ ] **Step 1: Write failing test `tests/snapshotStore.test.ts`**

```ts
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { emptySnapshot } from "../src/collectors/types.js";
import { readSnapshot, writeSnapshot } from "../src/snapshotStore.js";

describe("snapshotStore", () => {
  it("round-trips last-good snapshot and returns null when absent", async () => {
    const dir = mkdtempSync(join(tmpdir(), "herdr-quota-"));
    expect(await readSnapshot(dir, "pane-1")).toBeNull();
    const snap = { ...emptySnapshot("Claude", "seed"), weekRemaining: 24, supported: true };
    await writeSnapshot(dir, "pane-1", snap);
    expect((await readSnapshot(dir, "pane-1"))?.weekRemaining).toBe(24);
  });
  it("keeps corrupt files from throwing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "herdr-quota-"));
    const { writeFile } = await import("node:fs/promises");
    const { snapshotPath } = await import("../src/snapshotStore.js");
    await writeFile(snapshotPath(dir, "pane-9"), "not-json", "utf8");
    expect(await readSnapshot(dir, "pane-9")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/snapshotStore.test.ts`
Expected: FAIL with "Cannot find module '../src/snapshotStore.js'".

- [ ] **Step 3: Write minimal implementation `src/snapshotStore.ts`**

```ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Snapshot } from "./collectors/types.js";

function safePaneId(paneId: string): string {
  return paneId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "pane";
}

export function snapshotPath(stateDir: string, paneId: string): string {
  return join(stateDir, `${safePaneId(paneId)}.json`);
}

export async function readSnapshot(stateDir: string, paneId: string): Promise<Snapshot | null> {
  try {
    const raw = await readFile(snapshotPath(stateDir, paneId), "utf8");
    const parsed = JSON.parse(raw) as Snapshot;
    if (typeof parsed.provider !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeSnapshot(stateDir: string, paneId: string, snap: Snapshot): Promise<void> {
  await mkdir(stateDir, { recursive: true });
  const tmp = `${snapshotPath(stateDir, paneId)}.tmp`;
  await writeFile(tmp, JSON.stringify(snap), "utf8");
  const { rename } = await import("node:fs/promises");
  await rename(tmp, snapshotPath(stateDir, paneId));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/snapshotStore.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/snapshotStore.ts tests/snapshotStore.test.ts
git commit -m "feat: add last-good snapshot store"
```

---

### Task 8: README, smoke test, publish

**Files:**
- Modify: `README.md`
- Test: manual smoke `herdr plugin link . --enabled` + `herdr plugin action invoke herdr-quota-context-cache.configure`

**Interfaces:**
- Consumes: Tasks 1–6.
- Produces: publishable repo with `herdr-plugin` topic, install docs, troubleshooting table.

- [ ] **Step 1: Write `README.md` (first sentence exact)**

```markdown
# herdr-quota-context-cache

Show Claude, Codex, Grok, Agy, OpenCode, Pi, omp, and Devin subscription usage in Herdr's agent sidebar.

## Quick start

\`\`\`sh
herdr plugin link . --enabled
herdr plugin action invoke herdr-quota-context-cache.configure
\`\`\`

## What it shows

Per-agent sidebar rows (`rows_by_agent`): provider, `5h`/`7d` remaining % + reset ETA, `⛁` context, `cache` prompt-cache stats. Subscription panes show plan windows; API-key panes show backend spend. Missing tokens hide automatically.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Rows do not appear | `herdr server reload-config`, then Refresh agent quota |
| Claude/Agy N/A | Start one turn so statusLine emits JSON, then refresh |
| Agy has no quota | Re-run Install / repair, start one Agy turn, refresh |
| Grok stale in running goal | Re-run Install / repair, restart that Grok session once |
| Devin N/A | Set `DEVIN_API_TOKEN` |
```

- [ ] **Step 2: Run full suite**

Run: `npm test && npx tsc --noEmit`
Expected: PASS, 0 errors.

- [ ] **Step 3: Manual smoke (requires Herdr v0.8+)**

Run: `herdr plugin link . --enabled && herdr plugin action invoke herdr-quota-context-cache.configure`
Expected: configure prints snippet; sidebar shows rows after `herdr server reload-config`; `refresh` reports tokens.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add README with quick start and troubleshooting"
```

- [ ] **Step 5: Publish**

Run: `gh repo create herdr-quota-context-cache --public --source=. --push && gh repo edit --add-topic herdr-plugin`
Expected: marketplace picks up `herdr-plugin.toml` on next refresh.
