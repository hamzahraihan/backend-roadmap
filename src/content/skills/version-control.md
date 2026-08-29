---
title: Git & GitHub
category: Tooling
order: 30
dependsOn: []
starterCode:
  go: |
    // Nothing to compile here — these are the commands you'll run daily:
    // git init
    // git add .
    // git commit -m "first backend service"
    // git push origin main
    package main

    import "fmt"

    func main() { fmt.Println("Version control is a backend essential.") }
  java: |
    // Daily commands:
    // git init
    // git add .
    // git commit -m "first backend service"
    // git push origin main
    public class Main {
        public static void main(String[] args) {
            System.out.println("Version control is a backend essential.");
        }
    }
  typescript: |
    // Daily commands:
    // git init
    // git add .
    // git commit -m "first backend service"
    // git push origin main
    console.log('Version control is a backend essential.');
  python: |
    # Daily commands:
    # git init
    # git add .
    # git commit -m "first backend service"
    # git push origin main
    print('Version control is a backend essential.')
---

No backend roadmap is complete without version control. **Git** tracks your changes; **GitHub/GitLab** host the shared history and unlock code review, CI, and collaboration.

## Core workflow

- `git init` / `git clone` — start or fetch a repo
- `git add` + `git commit` — save a logical change
- `git push` / `git pull` — sync with the remote
- **Branches & PRs** — isolate work and review before merging

## Why it matters

Teams rely on Git history to bisect bugs, roll back bad deploys, and review code. Learn `commit` hygiene (small, well-named commits) early — it pays off for the rest of your career.

## Resources

- **Reference:** [Pro Git book](https://git-scm.com/book/en/v2)
- **Roadmap:** [roadmap.sh/git](https://roadmap.sh/git)
- **Video:** [The Net Ninja — Git & GitHub](https://www.youtube.com/@thenetninja)
- **Free course:** [freeCodeCamp — Git & GitHub](https://www.freecodecamp.org)
