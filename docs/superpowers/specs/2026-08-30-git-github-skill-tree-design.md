# Design: Git & GitHub Skill Tree Expansion

**Date:** 2026-08-30
**Status:** Approved

## Overview

Expand the existing single `version-control.md` skill node into a detailed Git &
GitHub subtree while keeping the existing node untouched. Add five new skill nodes
that branch off `version-control` and teach each topic in depth, following the
existing content conventions (frontmatter + Markdown body, category, order,
dependsOn, multi-language starterCode).

## Nodes

| File | Title | Category | Order | dependsOn |
|------|-------|----------|-------|-----------|
| `git-fundamentals.md` | Git Fundamentals | Tooling | 31 | `version-control` |
| `git-branching.md` | Branching & Merging | Tooling | 32 | `git-fundamentals` |
| `git-remotes.md` | Remotes & Collaboration | Tooling | 33 | `git-fundamentals` |
| `github-workflow.md` | GitHub Workflow & PRs | Tooling | 34 | `git-branching`, `git-remotes` |
| `cicd.md` | CI/CD Pipelines | Quality | 35 | `github-workflow`, `testing-cicd` |

## Content per node

- **Git Fundamentals** — `git init/clone/add/commit/status/log`, the staging
  area, `.gitignore`, commit hygiene.
- **Branching & Merging** — branches, `merge` vs `rebase`, conflict resolution,
  `git flow`.
- **Remotes & Collaboration** — `push/pull/fetch`, remote management, forks,
  keeping in sync.
- **GitHub Workflow & PRs** — pull requests, code review, issues, GitHub Actions
  basics, `.github/` workflows.
- **CI/CD Pipelines** — YAML pipeline anatomy, build → test → deploy stages,
  Actions runners/secrets/environments.

## Decisions

- The existing `testing-cicd.md` node is left unchanged.
- New nodes use auto-layout (no manual `position` frontmatter).
- Nodes follow existing style: detailed body, code blocks, best practices, and a
  Resources section with reference/roadmap/video/community links.

## Out of scope

- No code changes to components or routing.
- No changes to existing skill nodes.
