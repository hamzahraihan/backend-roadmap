---
title: Branching & Merging
category: Tooling
order: 32
dependsOn: [git-fundamentals]
simulation: git
starterCode:
  go: |
    // git branch feature/login
    // git checkout feature/login
    // (work...)
    // git checkout main
    // git merge feature/login
    package main

    import "fmt"

    func main() { fmt.Println("Isolate work, merge when ready.") }
  java: |
    // git branch feature/login
    // git checkout feature/login
    // (work...)
    // git checkout main
    // git merge feature/login
    public class Main {
        public static void main(String[] args) {
            System.out.println("Isolate work, merge when ready.");
        }
    }
  typescript: |
    // git branch feature/login
    // git checkout feature/login
    // (work...)
    // git checkout main
    // git merge feature/login
    console.log('Isolate work, merge when ready.');
  python: |
    # git branch feature/login
    # git checkout feature/login
    # (work...)
    # git checkout main
    # git merge feature/login
    print('Isolate work, merge when ready.')
---

Branches let you work on multiple features, fixes, or experiments in isolation.
A branch is just a movable pointer to a commit.

## Branch basics

```
git branch              # list local branches
git branch <name>       # create a new branch
git switch <name>       # switch to it (newer alternative to checkout)
git switch -c <name>    # create + switch in one step
```

## Merge vs rebase

Both integrate changes from one branch into another, but they produce different
history shapes.

**Merge** creates a merge commit that preserves the exact timeline:

```
git checkout main
git merge feature/login
```

**Rebase** replays your commits on top of the target branch, producing a linear
history:

```
git checkout feature/login
git rebase main
```

Use merge when you want to preserve context ("these commits were developed
together"). Use rebase for a clean, linear history before merging into main.

## Merge conflicts

When two branches modify the same lines, Git can't decide which version to keep.
You'll see:

```
<<<<<<< HEAD
your existing code
=======
incoming change
>>>>>>> feature/login
```

Edit the file to keep what you want, remove the markers, then:

```
git add <file>
git commit
```

## Branching strategies

- **GitHub Flow** — `main` is always deployable; feature branches → PR → merge.
- **Git Flow** — `main`, `develop`, `feature/`, `release/`, `hotfix/` branches.
- **Trunk-based** — short-lived branches, frequent merges to `main`.

## Resources

- **Reference:** [Git SCM — Branching](https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell)
- **Roadmap:** [roadmap.sh/git-github](https://roadmap.sh/git-github)
- **Video:** [Learn Git Branching](https://learngitbranching.js.org/)
- **Community:** [Atlassian — Merge vs Rebase](https://www.atlassian.com/git/tutorials/merging-vs-rebasing)