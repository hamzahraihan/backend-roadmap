---
title: GitHub Workflow & PRs
category: Tooling
order: 34
dependsOn: [git-branching, git-remotes]
starterCode:
  go: |
    // Create a PR on github.com, not in the terminal.
    // 1. git switch -c feature/foo
    // 2. commit your work
    // 3. git push -u origin feature/foo
    // 4. open a Pull Request on GitHub
    package main

    import "fmt"

    func main() { fmt.Println("Pull requests make collaboration reviewable.") }
  java: |
    // Create a PR on github.com, not in the terminal.
    // 1. git switch -c feature/foo
    // 2. commit your work
    // 3. git push -u origin feature/foo
    // 4. open a Pull Request on GitHub
    public class Main {
        public static void main(String[] args) {
            System.out.println("Pull requests make collaboration reviewable.");
        }
    }
  typescript: |
    // Create a PR on github.com, not in the terminal.
    // 1. git switch -c feature/foo
    // 2. commit your work
    // 3. git push -u origin feature/foo
    // 4. open a Pull Request on GitHub
    console.log('Pull requests make collaboration reviewable.');
  python: |
    # Create a PR on github.com, not in the terminal.
    # 1. git switch -c feature/foo
    # 2. commit your work
    # 3. git push -u origin feature/foo
    # 4. open a Pull Request on GitHub
    print('Pull requests make collaboration reviewable.')
---

A **Pull Request (PR)** is a proposal to merge changes from one branch into
another. It's where code review, discussion, and CI checks happen before code
lands on `main`.

## PR anatomy

A good PR has:

- **Clear title** — e.g. `feat: add JWT authentication`
- **Description** — what it does, why, and how to test it.
- **Small scope** — one feature or fix; reviewers review better in short bursts.
- **Linked issue** — reference the issue it resolves (e.g. `Closes #42`).

## Code review

Review comments live on specific lines of the diff. Reviewers use:

- **Comment** — general feedback, doesn't block.
- **Approve** — ready to merge.
- **Request changes** — fixes needed before merge.

Respond to feedback with new commits pushed to the same branch — the PR updates
automatically. Avoid force-pushing on an open PR; it rewrites the review history.

## GitHub Actions basics

PRs and pushes can trigger automated workflows defined in `.github/workflows/`:

```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm test
```

Actions run in the cloud and report pass/fail status on every commit — so
maintainers merge only green PRs.

## GitHub features that matter

- **Issues** — track bugs, features, and tasks; link them to PRs.
- **Branch protection** — require reviews, require CI to pass, block force-pushes.
- **Labels & milestones** — organize work.
- **Code owners** — auto-request review from the people who own a directory.

## Resources

- **Reference:** [GitHub Docs — About pull requests](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/about-pull-requests)
- **Roadmap:** [roadmap.sh/git-github](https://roadmap.sh/git-github)
- **Video:** [GitHub — Understanding the GitHub flow](https://docs.github.com/en/get-started/quickstart/github-flow)
- **Community:** [GitHub Skills](https://skills.github.com/)