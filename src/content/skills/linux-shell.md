---
title: Linux & Shell Basics
category: Infrastructure
order: 36
dependsOn: [internet-basics]
starterCode:
  python: |
    # Shell equivalent: ls -la /etc | grep conf
    import os
    print([f for f in os.listdir('/etc')][:5])
  typescript: |
    // Shell equivalent: ls -la | grep conf
    import { readdirSync } from 'fs';
    console.log(readdirSync('.').slice(0, 5));
  go: |
    // Shell equivalent: ls | grep conf
    package main
    import "fmt"
    func main() { fmt.Println("ls, grep, find, chmod, ssh, curl") }
  java: |
    // Shell equivalent: ls | grep conf
    public class Main {
        public static void main(String[] args) {
            System.out.println("ls, grep, find, chmod, ssh, curl");
        }
    }
---

**Linux** runs most servers. Learn to move, inspect, and automate from the CLI: `ls, cd, mkdir, rm, cp, mv, cat, grep, find, chmod, ps, kill, df, du, tar, ssh, scp, curl`.

## Scripting

Automate with Bash (or Python/Go): loops, conditionals, pipes (`|`), redirection (`>`, `>>`), exit codes (`$?`).

```bash
for host in web1 web2; do ssh "$host" "df -h / | tail -1"; done
```

## Resources

- **Source:** [DevOps-Roadmap §3 — Linux & Scripting](https://github.com/milanm/DevOps-Roadmap) (Apache-2.0)
- **Guide:** [Linux command handbook](https://www.freecodecamp.org/news/the-linux-commands-handbook/) (freeCodeCamp)
- **Manual:** [Bash Reference Manual](https://www.gnu.org/savannah-checkouts/gnu/bash/manual/bash.html)
