---
title: CI/CD Pipelines
category: Quality
order: 35
dependsOn: [github-workflow, testing-cicd]
simulation: git
starterCode:
  go: |
    // CI: every push runs build + tests.
    // CD: passing main deploys automatically.
    // GitHub Actions example in .github/workflows/ci.yml
    package main

    import "fmt"

    func main() { fmt.Println("Pipeline = automated path to production.") }
  java: |
    // CI: every push runs build + tests.
    // CD: passing main deploys automatically.
    // GitHub Actions example in .github/workflows/ci.yml
    public class Main {
        public static void main(String[] args) {
            System.out.println("Pipeline = automated path to production.");
        }
    }
  typescript: |
    // CI: every push runs build + tests.
    // CD: passing main deploys automatically.
    // GitHub Actions example in .github/workflows/ci.yml
    console.log('Pipeline = automated path to production.');
  python: |
    # CI: every push runs build + tests.
    # CD: passing main deploys automatically.
    # GitHub Actions example in .github/workflows/ci.yml
    print('Pipeline = automated path to production.')
---

**CI/CD** automates everything between "commit" and "deployed":

- **Continuous Integration (CI)** — on every push, build the code, run tests and
  linters, and report the result.
- **Continuous Delivery (CD)** — if the pipeline is green, deploy to staging /
  production automatically (or on a one-click trigger).

## Pipeline anatomy

A workflow is a YAML file under `.github/workflows/` made of jobs and steps:

```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test
  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run build
      - run: ./deploy.sh
```

Jobs run in parallel by default; `needs: test` makes `deploy` wait until tests pass.

## Key concepts

- **Workflow** — the whole automation file.
- **Job** — a set of steps on one runner (parallel by default).
- **Step** — a single command or reusable action.
- **Runner** — the machine executing the job (`ubuntu-latest`, `windows-latest`, self-hosted).
- **Trigger (`on`)** — push, pull_request, schedule (cron), workflow_dispatch (manual).

## Secrets & environments

Never hardcode credentials in a workflow file. Store them in GitHub → Settings →
**Secrets and variables**:

```
- run: deploy --token ${{ secrets.DEPLOY_TOKEN }}
```

Secrets are masked in logs. For multi-stage delivery, define **environments**
(staging, production) with their own secrets and protection rules (manual
approval before prod deploy).

## Quality gates

A mature pipeline runs: lint → typecheck → unit tests → build → integration
tests → security scan → deploy. Fail fast: if lint fails, don't bother running
the rest.

## Resources

- **Reference:** [GitHub Docs — Actions](https://docs.github.com/en/actions)
- **Roadmap:** [roadmap.sh/ci-cd](https://roadmap.sh/ci-cd)
- **Video:** [freeCodeCamp — CI/CD](https://www.freecodecamp.org)
- **Community:** [GitHub Actions Marketplace](https://github.com/marketplace?type=actions)