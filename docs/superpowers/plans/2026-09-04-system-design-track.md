# System Design Track Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an 11-node System Design track to the backend skill graph distilled from systemdesignhandbook.com.

**Architecture:** Content-only change — 11 Markdown collection entries in `src/content/skills/` chained via `dependsOn`; dagre auto-layout and existing split-pane + Wandbox runner handle the rest with no component changes.

**Tech Stack:** Astro content collections, TypeScript, Wandbox-compatible Go/Java/TypeScript/Python snippets.

## Global Constraints

- Schema is `src/content.config.ts`: `title: string, category: string, order: number, dependsOn: string[], starterCode: {go, java, typescript, python} (partial), simulation default code, no position`.
- Four-language parity on every node — runnable `main` printing to stdout, no network, no external deps, <30 lines per language.
- Neutral instructional voice, no hype; every node ends with `## Resources` linking back to the handbook guide.
- Linear chain 140→235; only `data-modeling-apis` fans in from `rest-api, relational-databases` (no cycles).
- Verify with `npm run check` and `npm run build`.

---

### Task 1: Fundamentals + scalability base (140, 150)

**Files:**
- Create: `src/content/skills/system-design-fundamentals.md`
- Create: `src/content/skills/scalability-performance.md`

**Interfaces:**
- Produces: slugs `system-design-fundamentals`, `scalability-performance` consumed as `dependsOn` by Task 2.

- [ ] **Step 1: Create `system-design-fundamentals.md`** with frontmatter `title: System Design Fundamentals (SPARCS)`, `category: System Design`, `order: 140`, `dependsOn: [building-for-scale]`, 4-language request-flow/stateless-router snippet, body (SPARCS table, HLD vs LLD, lifecycle), Resources backlinks.
- [ ] **Step 2: Create `scalability-performance.md`** with `order: 150`, `dependsOn: [system-design-fundamentals]`, bottleneck-timing snippet x4, body (horiz vs vert, latency p95/p99 vs throughput, nines table, SLI/SLO/SLA), Resources.
- [ ] **Step 3: Validate** Run: `npx astro check` Expected: no schema errors for new files.

### Task 2: Caching + load balancing (160, 170)

**Files:**
- Create: `src/content/skills/caching-cdn.md`
- Create: `src/content/skills/load-balancing-gateway.md`

**Interfaces:**
- Consumes: `scalability-performance` slug. Produces: `caching-cdn`, `load-balancing-gateway`.

- [ ] **Step 1: Create `caching-cdn.md`** `order: 160`, `dependsOn: [scalability-performance]`, LRU-3 snippet x4, layers/strategies/eviction tables.
- [ ] **Step 2: Create `load-balancing-gateway.md`** `order: 170`, `dependsOn: [caching-cdn]`, round-robin + skip-failed snippet x4, LB-vs-gateway table.
- [ ] **Step 3: Validate** Run: `npx astro check` Expected: PASS.

### Task 3: Data + storage (180, 190)

**Files:**
- Create: `src/content/skills/data-modeling-apis.md`
- Create: `src/content/skills/databases-sharding.md`

**Interfaces:**
- Consumes: `rest-api`, `relational-databases` (existing), `load-balancing-gateway`. Produces: `data-modeling-apis`, `databases-sharding`.

- [ ] **Step 1: Create `data-modeling-apis.md`** `order: 180`, `dependsOn: [rest-api, relational-databases]`, idempotency-key + pagination snippet x4.
- [ ] **Step 2: Create `databases-sharding.md`** `order: 190`, `dependsOn: [data-modeling-apis]`, consistent-hash-ring snippet x4, SQL-vs-NoSQL + CAP table.
- [ ] **Step 3: Validate** Run: `npx astro check` Expected: PASS (no cycle: rest-api/relational-databases are ancestors of building-for-scale).

### Task 4: Async + failures (200, 210)

**Files:**
- Create: `src/content/skills/messaging-queues.md`
- Create: `src/content/skills/distributed-failures.md`

**Interfaces:**
- Consumes: `databases-sharding`. Produces: `messaging-queues`, `distributed-failures`.

- [ ] **Step 1: Create `messaging-queues.md`** `order: 200`, `dependsOn: [databases-sharding]`, topic publish/subscribe snippet x4.
- [ ] **Step 2: Create `distributed-failures.md`** `order: 210`, `dependsOn: [messaging-queues]`, retry-with-backoff snippet x4, degradation + observability tables.
- [ ] **Step 3: Validate** Run: `npx astro check` Expected: PASS.

### Task 5: Practice + framework (220, 230, 235)

**Files:**
- Create: `src/content/skills/rate-limiting-url-shortener.md`
- Create: `src/content/skills/realtime-rides-feed.md`
- Create: `src/content/skills/interview-framework.md`

**Interfaces:**
- Consumes: `distributed-failures`. Produces: terminal chain `rate-limiting-url-shortener → realtime-rides-feed → interview-framework`.

- [ ] **Step 1: Create `rate-limiting-url-shortener.md`** `order: 220`, `dependsOn: [distributed-failures]`, token-bucket + Base62 snippet x4, TinyURL estimations.
- [ ] **Step 2: Create `realtime-rides-feed.md`** `order: 230`, `dependsOn: [rate-limiting-url-shortener]`, geohash-bucket + sequence-log snippet x4.
- [ ] **Step 3: Create `interview-framework.md`** `order: 235`, `dependsOn: [realtime-rides-feed]`, QPS/storage estimator snippet x4, timebox + seniority + anti-patterns.
- [ ] **Step 4: Full build** Run: `npm run build` Expected: static build succeeds, ~35 nodes laid out.
