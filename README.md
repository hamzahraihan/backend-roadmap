# Backend Roadmap

An interactive backend proficiency platform: a navigable skill graph where each topic opens a hands-on workspace — read a concise explanation, run real code, and track your coverage.

## Features

- **Skill-tree homepage** — 40 topics as a dependency graph (React Flow + dagre) with category colors, filters, search, and click-to-focus neighborhoods.
- **Split-screen skill pages** — markdown explanation on the left, live workspace on the right.
- **Code playground** — edit and run Go, Java, TypeScript, and Python inline (Monaco editor, Wandbox sandbox), with per-language starter code.
- **Simulators** — interactive Git terminal with commit graph, CI/CD pipeline runner, and system-design canvas with traffic playback, failure injection, and SLO checks.
- **Tracked progress** — completion state persists per browser in `localStorage`; no accounts, no server.
- **Light/dark themes** — persisted, defaults to OS preference.

## Skills catalog

Snapshot of `src/content/skills/` (40 skills; the graph derives order from `dependsOn`):

- **Web Basics** — Internet Fundamentals, HTTP Protocol
- **Foundations** — Pick a Backend Language
- **Languages** — Go, Java, JavaScript (Node.js), Python
- **APIs** — REST APIs
- **Databases** — Relational Databases, SQL & PostgreSQL, NoSQL & Caching (Redis)
- **Security** — Authentication & Authorization, Web Security
- **Infrastructure** — Web Servers & Hosting, Linux & Shell Basics, Docker & Compose, Kubernetes Basics, Terraform & IaC, Cloud Provider Basics
- **Architecture** — Architectural Patterns
- **Scaling** — Building for Scale
- **Quality** — Testing & CI/CD, CI/CD Pipelines, Monitoring & Observability
- **Tooling** — Git & GitHub, Git Fundamentals, Branching & Merging, Remotes & Collaboration, GitHub Workflow & PRs
- **System Design** — System Design Fundamentals (SPARCS), Scalability & Performance (SLOs), Caching & CDN Strategies, Load Balancing & API Gateway, Data Modeling & API Design, Databases Replication & Sharding, Messaging Queues & Event-Driven, Distributed Failures & Observability, Practice: Rate Limiter & URL Shortener, Practice: Chat Rides & Feed, Interview Framework

## Getting started

Prerequisites: **Node.js ≥ 22.12**.

```sh
npm install
npm run dev -- --background   # serves at localhost:4321
```

Manage the background server with `npm run astro -- dev stop`, `dev status`, and `dev logs` (see `AGENTS.md`).

| Command         | Action                                      |
| :-------------- | :------------------------------------------ |
| `npm run dev`   | Starts the local dev server                 |
| `npm run build` | Builds the production site to `./dist/`     |
| `npm run preview` | Previews the production build locally     |
| `npm run check` | Type-checks the project (`astro check`)     |

## Adding a skill

Skills are markdown files in `src/content/skills/<id>.md` (schema: `src/content.config.ts`):

```md
---
title: My Skill
category: Infrastructure
order: 106
dependsOn: [linux-shell]
simulation: code            # code | git | design | pipeline
starterCode:
  python: |
    print('hello')
  typescript: |
    console.log('hello');
---
```

- `dependsOn` lists prerequisite skill ids — the homepage DAG is derived from it.
- `simulation` picks the right-hand workspace: `code` (playground), `git` (Git terminal), `design` (system-design canvas), `pipeline` (CI/CD runner).
- Simulator-backed skills need a matching preset id in `src/lib/git/presets.ts`, `src/lib/pipeline/presets.ts`, or `src/lib/design/presets.ts` (preset lookup is by skill id).
- Every coding skill should offer meaningful `starterCode` in all four languages (`go`, `java`, `typescript`, `python`); conceptual skills may use representative snippets.

## Architecture

- **Astro** (content collections) + **React islands** (`@astrojs/react`) + **Tailwind CSS v4**.
- Graph: `@xyflow/react` laid out by `@dagrejs/dagre` (`src/components/react/SkillTree.tsx`, helpers in `src/lib/skillGraph.ts`).
- Editor: `@monaco-editor/react`; execution: Wandbox compile API (client-side, no outbound network in the sandbox — see `src/lib/execute.ts`).
- State: client-side only (`src/lib/progress.ts`, `src/lib/theme.ts`); no backend, no auth.

## Docs

- `PRODUCT.md` — product definition and principles.
- `DESIGN.md` — visual system.
- `PLAN.md` — original build directive.
- `docs/superpowers/plans/` and `docs/superpowers/specs/` — implementation plans and design specs.

## Attribution

- Backend curriculum curated from roadmap.sh's backend topics (`kamranahmedse/developer-roadmap`).
- DevOps track (Linux, Docker, Kubernetes, Terraform, observability, cloud) sourced from [milanm/DevOps-Roadmap](https://github.com/milanm/DevOps-Roadmap) (Apache-2.0).
- Built with [Astro](https://docs.astro.build).
