---
title: Remotes & Collaboration
category: Tooling
order: 33
dependsOn: [git-fundamentals]
starterCode:
  go: |
    // git remote add origin https://github.com/you/repo.git
    // git push -u origin main
    // git pull
    // git fetch
    package main

    import "fmt"

    func main() { fmt.Println("Push, pull, and stay in sync.") }
  java: |
    // git remote add origin https://github.com/you/repo.git
    // git push -u origin main
    // git pull
    // git fetch
    public class Main {
        public static void main(String[] args) {
            System.out.println("Push, pull, and stay in sync.");
        }
    }
  typescript: |
    // git remote add origin https://github.com/you/repo.git
    // git push -u origin main
    // git pull
    // git fetch
    console.log('Push, pull, and stay in sync.');
  python: |
    # git remote add origin https://github.com/you/repo.git
    # git push -u origin main
    # git pull
    # git fetch
    print('Push, pull, and stay in sync.')
---

A remote is a copy of your repository hosted on another machine — typically
GitHub, GitLab, or Bitbucket. Remotes are how teams share code.

## Managing remotes

```
git remote -v                          # list remotes
git remote add origin <url>            # add a remote named "origin"
git remote remove <name>               # remove a remote
```

## The sync cycle

```
git push origin main                   # upload commits to main
git pull origin main                   # download + merge (fetch + merge)
git fetch origin                       # download without merging
```

`git pull` is shorthand for `git fetch && git merge`. Use `git fetch` when you
want to review changes before integrating them.

## Working with forks

In open-source projects you don't have write access to the upstream repo, so
you fork it on GitHub, clone your fork, and add the upstream as a second remote:

```
git remote add upstream https://github.com/original/repo.git
git fetch upstream
git checkout main
git merge upstream/main
```

This keeps your fork in sync while you work on a feature branch.

## Pull vs push

- **Push fails** if your local history is behind the remote — pull first, then push.
- **Force push** (`git push --force`) overwrites remote history. Use it only on
  personal branches, never on shared branches like `main`.

## Authentication

GitHub no longer accepts passwords over HTTPS. Use:
- **Personal Access Token (classic or fine-grained)** as your password.
- **SSH keys** — add your public key to GitHub, then use `git@github.com:...` URLs.

## Resources

- **Reference:** [Git SCM — Remotes](https://git-scm.com/book/en/v2/Git-Basics-Working-with-Remotes)
- **Roadmap:** [roadmap.sh/git-github](https://roadmap.sh/git-github)
- **Video:** [GitHub — Forking a repo](https://docs.github.com/en/get-started/quickstart/fork-a-repo)
- **Community:** [Atlassian — Syncing](https://www.atlassian.com/git/tutorials/syncing)