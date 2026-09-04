# Design: System Design Roadmap Track

**Date:** 2026-09-04
**Status:** Approved
**Source:** https://www.systemdesignhandbook.com/ (homepage, /guides/system-design-roadmap/, /guides/system-design/, /guides/system-design-interview/) — distilled, paraphrased, linked back.

## Overview

Add a new linear `System Design` track branching off `building-for-scale`
(order 130). Eleven new skill nodes cover the handbook's 6-phase progression
(Fundamentals → Data/APIs → Scalability → Distributed failures → Advanced
patterns → Interview practice) plus full practice walkthroughs (rate limiter,
TinyURL, chat, Uber/geo, YouTube capstone) and a repeatable interview
framework. Follows existing content conventions (frontmatter + Markdown body,
category, order, dependsOn, 4-language starterCode). No component or routing
changes.

## Nodes

| File | Title | Category | Order | dependsOn |
|------|-------|----------|-------|-----------|
| `system-design-fundamentals.md` | System Design Fundamentals (SPARCS) | System Design | 140 | `building-for-scale` |
| `scalability-performance.md` | Scalability & Performance (SLOs) | System Design | 150 | `system-design-fundamentals` |
| `caching-cdn.md` | Caching & CDN Strategies | System Design | 160 | `scalability-performance` |
| `load-balancing-gateway.md` | Load Balancing & API Gateway | System Design | 170 | `caching-cdn` |
| `data-modeling-apis.md` | Data Modeling & API Design | System Design | 180 | `rest-api`, `relational-databases` |
| `databases-sharding.md` | Databases, Replication & Sharding | System Design | 190 | `data-modeling-apis` |
| `messaging-queues.md` | Messaging, Queues & Event-Driven | System Design | 200 | `databases-sharding` |
| `distributed-failures.md` | Distributed Failures & Observability | System Design | 210 | `messaging-queues` |
| `rate-limiting-url-shortener.md` | Practice: Rate Limiter & URL Shortener | System Design | 220 | `distributed-failures` |
| `realtime-rides-feed.md` | Practice: Chat, Rides & Feed | System Design | 230 | `rate-limiting-url-shortener` |
| `interview-framework.md` | System Design Interview Framework | System Design | 235 | `realtime-rides-feed` |

## Content per node

- **Fundamentals (SPARCS)** — scalability/performance/availability/reliability/consistency/security, HLD vs LLD, request lifecycle.
- **Scalability & Performance** — horizontal vs vertical, latency p95/p99 vs throughput/QPS, SLI/SLO/SLA nines, bottleneck habit.
- **Caching & CDN** — client/CDN/server layers, look-aside vs write-through, invalidation/staleness, eviction (LRU).
- **Load Balancing & Gateway** — round-robin/least-conn/hash, health checks, LB vs API gateway, stateless routing.
- **Data Modeling & APIs** — entity ownership, read- vs write-heavy, REST/gRPC/GraphQL, pagination, idempotency, versioning.
- **Databases & Sharding** — SQL vs NoSQL, replication, partitioning/sharding + consistent hashing, CAP/PACELC CP-vs-AP.
- **Messaging & Queues** — task queue flow, pub-sub/event streams, SLIC FAST context, async costs (ordering, exactly-once).
- **Distributed Failures** — timeouts/retries/backoff/idempotency, eventual consistency UX, graceful degradation, metrics/logs/tracing.
- **Practice: Rate limiter + URL shortener** — token bucket, TinyURL requirements/estimations (100:1, Base62, cache-first reads).
- **Practice: Chat, rides, feed** — WhatsApp (WebSocket + offline queue + ordering), Uber (geohash grid + transient store), YouTube/Instagram capstone pointer.
- **Interview framework** — clarify/scope/HLD/deep-dive/trade-offs flow, 5/10/15/10/5 timebox, junior/mid/senior expectations, anti-patterns (memorizing, happy-path-only, premature microservices, buzzwords).

## Decisions

- New nodes use auto-layout (no manual `position` frontmatter).
- Every node ships runnable 4-language `starterCode` simulations (no network — Wandbox has no outbound access). Label as concept simulations.
- Close adaptation: keep handbook phase/table names for navigability, paraphrase body in neutral instructional voice, every node ends with Resources linking back to the specific handbook guide.
- Chain is linear except `data-modeling-apis` which fans in from `rest-api` + `relational-databases` (both ancestors of `building-for-scale`, so no cycle).
- Existing nodes (`architectural-patterns`, `building-for-scale`) left unchanged.

## Out of scope

- No changes to components, routing, Wandbox runner, or theme.
- No AI/ML-specialized tracks (GenAI/LLM/agentic) — future work.
- No company-specific interview nodes (Meta/Google/etc.) — future work.

## Verification

- `npm run check` (Astro content schema passes for all 11 files).
- `npm run build` (dagre layout renders ~35 nodes, no cycle errors).
- Spot-check 2-3 skill pages: split-pane renders, Run works in all 4 languages, Resources links resolve.
