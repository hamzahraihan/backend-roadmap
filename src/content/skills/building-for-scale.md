---
title: Building for Scale
category: Scaling
order: 130
dependsOn: [web-servers, architectural-patterns, nosql-redis]
starterCode:
  go: |
    // Concept: a load balancer spreads requests across replicas.
    package main

    import (
        "fmt"
        "math/rand"
    )

    func route(backends []string) string {
        return backends[rand.Intn(len(backends))]
    }

    func main() {
        backends := []string{":8080", ":8081", ":8082"}
        fmt.Println("routing to", route(backends))
    }
  java: |
    // Concept: round-robin across replicas.
    import java.util.List;
    public class Main {
        static String route(List<String> b, int i) { return b.get(i % b.size()); }
        public static void main(String[] args) {
            System.out.println("routing to " + route(List.of(":8080", ":8081"), 0));
        }
    }
  typescript: |
    // Concept: round-robin across replicas.
    const backends = [':8080', ':8081', ':8082'];
    let i = 0;
    const route = () => backends[i++ % backends.length];
    console.log('routing to', route());
  python: |
    # Concept: round-robin across replicas.
    backends = [":8080", ":8081", ":8082"]
    i = 0
    def route():
        global i
        b = backends[i % len(backends)]
        i += 1
        return b
    print("routing to", route())
---

When traffic grows, single instances aren't enough. Roadmap.sh's "building for scale" covers caching, replication, load balancing, and observability.

## Levers

- **Caching** (Redis/CDN) — serve repeated reads without hitting origin.
- **Replication & sharding** — copy or split data across DB nodes for throughput/availability.
- **Load balancing** — spread requests across replicas (round-robin, least-conn).
- **Async work** — move heavy jobs to queues/workers so requests return fast.
- **Observability** — logging, metrics, and tracing to find bottlenecks.

## The trade-off

Every scaling technique adds complexity. Start with one instance + a DB, measure real bottlenecks, then add caching, then replicas, then queues — only when needed.

The snippet shows the round-robin routing a load balancer performs. That's the capstone of the backend roadmap: you now know the whole path from "how the internet works" to "serving at scale".

## Resources

- **Reference:** [Apache Kafka Documentation](https://kafka.apache.org/documentation/)
- **Roadmap:** [roadmap.sh/system-design](https://roadmap.sh/system-design)
- **Video:** [ByteByteGo — Scaling](https://www.youtube.com/@bytebytego)
- **Free course:** [freeCodeCamp — System Design](https://www.freecodecamp.org)
