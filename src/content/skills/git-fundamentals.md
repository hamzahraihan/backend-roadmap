---
title: Git Fundamentals
category: Tooling
order: 31
dependsOn: [version-control]
starterCode:
  go: |
    // git init
    // git add .
    // git commit -m "feat: initial backend service"
    // git status
    // git log --oneline
    package main

    import "fmt"

    func main() { fmt.Println("Track every change from day one.") }
  java: |
    // git init
    // git add .
    // git commit -m "feat: initial backend service"
    // git status
    // git log --oneline
    public class Main {
        public static void main(String[] args) {
            System.out.println("Track every change from day one.");
        }
    }
  typescript: |
    // git init
    // git add .
    // git commit -m "feat: initial backend service"
    // git status
    // git log --oneline
    console.log('Track every change from day one.');
  python: |
    # git init
    # git add .
    # git commit -m "feat: initial backend service"
    # git status
    # git log --oneline
    print('Track every change from day one.')
---

Every project starts with `git init`. These are the commands you'll use dozens
of times a day — learn them until they're muscle memory.

## The daily cycle

```
git status          # what changed?
git add <file>      # stage a file (or git add . for everything)
git commit -m "msg" # snapshot the staged changes
git log --oneline   # review recent history
```

## The staging area

Git has three states for every file:

- **Working directory** — the file on disk, maybe modified.
- **Staging area (index)** — changes you've marked for the next commit.
- **Repository** — committed snapshots in `.git/`.

`git add` moves a file from working → staging. `git commit` moves staging →
repository. This lets you craft atomic commits without committing every
half-finished change.

## `.gitignore`

Not everything belongs in version control — `node_modules/`, `.env`, build
artifacts. A `.gitignore` file tells Git to ignore them:

```
node_modules/
.env
dist/
*.log
```

## Commit hygiene

- **Atomic commits** — one logical change per commit.
- **Good messages** — start with a capital letter, use imperative mood, keep the
  first line under 72 characters. Prefix with type: `feat:`, `fix:`, `refactor:`.
- **Don't commit secrets** — API keys, passwords, and tokens never belong in Git.

## Resources

- **Reference:** [Git SCM — Getting Started](https://git-scm.com/book/en/v2/Getting-Started-Git-Basics)
- **Roadmap:** [roadmap.sh/git-github](https://roadmap.sh/git-github)
- **Video:** [The Net Ninja — Git Tutorial](https://www.youtube.com/playlist?list=PL4cUxeGkcC9goXbgTDQ0n_KDTB4o8vydw)
- **Community:** [GitHub Git Guides](https://github.com/git-guides/)