---
title: Pick a Backend Language
category: Foundations
order: 12
dependsOn: [internet-basics]
starterCode:
  go: |
    package main

    import "fmt"

    func main() {
        fmt.Println("Pick a language and start building.")
    }
  java: |
    public class Main {
        public static void main(String[] args) {
            System.out.println("Pick a language and start building.");
        }
    }
  typescript: |
    console.log('Pick a language and start building.');
  python: |
    print('Pick a language and start building.')
---

Roadmap.sh groups backend languages into two buckets: **interpreted/scripting** (JavaScript, Python, Ruby, PHP) and **compiled** (Go, Java, C#, Rust). You only need to go deep on **one** to be productive.

## Common choices

- **JavaScript / TypeScript (Node.js)** — one language across frontend and backend, huge ecosystem.
- **Python** — readable, dominant in data/ML, great standard library for services.
- **Go** — small, fast, built-in concurrency; popular for infra and high-throughput APIs.
- **Java** — mature, enterprise-standard, strong typing and tooling.

## Why it doesn't matter too much

Once you understand the *concepts* (HTTP, data, concurrency, auth) you can move between languages. Each skill later in this roadmap shows the same idea in Go, Java, TypeScript, and Python so you can follow along in your chosen language.

Open any of the language nodes below to try a runnable "hello" in each runtime. Nothing is locked — explore in whatever order you like.

## Resources

- **Reference:** [roadmap.sh/backend](https://roadmap.sh/backend) (Pick a language section)
- **Docs:** [Go](https://go.dev/doc/) · [Python](https://docs.python.org/3/) · [Node.js](https://nodejs.org/en/docs) · [Java](https://docs.oracle.com/en/java/)
- **Video:** [Fireship — language comparisons](https://www.youtube.com/@fireship)
- **Free course:** [The Odin Project](https://www.theodinproject.com)
