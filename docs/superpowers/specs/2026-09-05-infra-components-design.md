# Design: Infrastructure Components for System Design Canvas

**Date:** 2026-09-05
**Status:** Approved

## Overview

Extend the design-simulation palette (currently client, cdn, lb, gateway,
app, cache, sql, nosql, queue, storage) with the missing infrastructure
building blocks that real system designs need: DNS, WAF, Rate Limiter, Auth
Service, and Search Index. New kinds are full citizens — per-hop latency,
failure injection, queueing, palettes, and win conditions — exactly like
existing components. Two relabels make existing coverage obvious; two
requested items are deliberately excluded as non-placeable.

## New kinds (`src/lib/design/types.ts`)

| Kind | Label | Role | Base ms | Load-sensitive | Sink |
|---|---|---|---|---|---|
| `dns` | DNS | first hop, edge resolution | 2 | no | no |
| `waf` | WAF | malicious-traffic filtering at edge | 3 | no | no |
| `ratelimit` | Rate Limiter | policy/quota enforcement | 2 | no | no |
| `auth` | Auth Service | login + token validation | 10 | yes | no |
| `search` | Search Index | read-optimized full-text tier | 12 | yes | yes |

`search` joins `SINK_KINDS` alongside sql/nosql/storage, so path-finding,
sink checks, and win conditions treat it as a valid durable target with no
further code. Insert order in `DESIGN_KINDS`: `dns` after `client`, `waf`
after `cdn`, `ratelimit` after `gateway`, `auth` after `ratelimit`, `search`
before `sql`.

## Relabels (no behavior change)

- `queue`: 'Queue' → 'Message Queue' (covers brokers: Kafka/RabbitMQ).
- `storage`: 'Blob Storage' → 'Object Storage' (covers blob/object/DFS
  for simulation purposes — all are durable sinks with the same model).

## Engine model (`src/lib/design/engine.ts`)

`BASE_LATENCY_MS` gains dns 2, waf 3, ratelimit 2, auth 10, search 12.
`LOAD_SENSITIVE` gains `auth`, `search` (replicas help); dns/waf/ratelimit
stay fixed-cost like lb/gateway/cdn. One explanatory note each in
`simulateTraffic`: WAF filtering, auth token validation, search
read-optimized, rate-limiter over-limit note at qps ≥ 5000 (same threshold
as the existing high-QPS note). `findRequestPath`
and `validateTopology` are kind-generic — no changes.

## Player (`src/lib/design/player.ts`)

Replace the two hardcoded `['sql', 'nosql', 'storage']` sink lists with
the shared `SINK_KINDS` import so search routes, queues, and degrades
correctly. Mirror `LOAD_SENSITIVE` (`auth`, `search`). `serviceTime`,
failure penalties, and the cache shortcut are kind-generic — no changes.

## UI (`src/components/react/SimulationStage.tsx`, `src/lib/design/presets.ts`)

- All five kinds join the `FULL` palette: usable in Free canvas and
  Interview-framework immediately. Guided presets stay untouched (no lesson
  changes, no unreachable preset pages).
- Add a `Kill auth` manual failure button next to Kill app / Kill SQL —
  auth failure is the interesting chaos case. No timeline changes.
- Palette buttons, starter nodes, and badges render from
  `DESIGN_KIND_LABELS` — automatic.

## Excluded (deliberate)

- **Distributed Tracing & Metrics** — cross-cutting, not a box on the
  request path; wiring it inline would distort every topology. No change
  (observability already appears in Patterns hints).
- **Service Mesh** — a property of app-to-app hops (sidecars), not a
  placeable component. No change.

## Testing

`npm run check` (0 errors), `npm run build`, headless esbuild smoke test:
route `client → dns → waf → ratelimit → gateway → auth → app → search`
completes; failure injection on `auth` degrades; `search` satisfies sink
validation. Manual spot-check: horizontal + vertical layouts, dark mode,
Kill-auth flow animation.

## Decisions

- Full citizens (approach A), not visual-only pass-throughs — metrics must
  account for every placeable node.
- No new guided preset — a preset id without a skill page would be
  unreachable; FULL-palette availability covers Free + Interview-framework.
- Merge duplicates (broker→queue, object/blob/DFS→storage) instead of
  near-identical kinds — palette clarity over count.
- Reuse existing failure/degradation machinery — no new error semantics
  (no 429 shedding model for the rate limiter; note only).

## Out of scope

- No changes to git/pipeline simulations, homepage graph, or existing
  guided-preset lessons and SLOs.
- No 429 load-shedding simulation, no sidecar/mesh modeling, no new deps.
