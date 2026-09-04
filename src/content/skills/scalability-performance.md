---
title: Scalability & Performance (SLOs)
category: System Design
order: 150
dependsOn: [system-design-fundamentals]
simulation: design
starterCode:
  go: |
    // Concept: find the slowest stage — that is your bottleneck.
    package main

    import "fmt"

    func slowest(stages map[string]int) string {
        worst, ms := "", 0
        for name, latency := range stages {
            if latency > ms {
                worst, ms = name, latency
            }
        }
        return worst
    }

    func main() {
        stages := map[string]int{"dns": 5, "app": 40, "db": 180}
        fmt.Println("bottleneck:", slowest(stages))
    }
  java: |
    // Concept: slowest stage is the bottleneck.
    import java.util.Map;
    public class Main {
        static String slowest(Map<String, Integer> stages) {
            String worst = "";
            int ms = 0;
            for (var e : stages.entrySet()) {
                if (e.getValue() > ms) { worst = e.getKey(); ms = e.getValue(); }
            }
            return worst;
        }
        public static void main(String[] args) {
            System.out.println("bottleneck: " + slowest(Map.of("dns", 5, "app", 40, "db", 180)));
        }
    }
  typescript: |
    // Concept: slowest stage is the bottleneck.
    const stages: Record<string, number> = { dns: 5, app: 40, db: 180 };
    const slowest = Object.entries(stages).sort((a, b) => b[1] - a[1])[0][0];
    console.log('bottleneck:', slowest);
  python: |
    # Concept: slowest stage is the bottleneck.
    stages = {"dns": 5, "app": 40, "db": 180}
    slowest = max(stages, key=stages.get)
    print("bottleneck:", slowest)
---

Scalability means holding acceptable performance as load grows — without linear cost growth. Distilled from the [roadmap's Phase 3](https://www.systemdesignhandbook.com/guides/system-design-roadmap/) and [scalability guide](https://www.systemdesignhandbook.com/guides/scalability-in-system-design/).

## Horizontal vs vertical

- **Vertical (scale up):** bigger machine. Simple, fast to try, hard ceiling.
- **Horizontal (scale out):** more machines. Near-infinite growth, but needs stateless services, routing, and data partitioning.

Most large systems end horizontal despite the complexity. Be able to say what makes a service horizontally scalable — and what blocks it (local state, sticky sessions, single-writer DB).

## Latency vs throughput

- **Latency:** time for one request (report p95/p99, not averages — averages hide slow users).
- **Throughput:** requests per second the system sustains (RPS/QPS).

Memory is orders of magnitude faster than network hops, so cutting cross-service round trips usually beats micro-optimizing code.

## SLI / SLO / SLA

- **SLI:** what you measure (e.g. current p99 latency).
- **SLO:** your target (e.g. 99% of requests under 200ms).
- **SLA:** the contract with users (e.g. 99.9% monthly uptime = ~43 min downtime).

| Availability | Downtime/year |
|---|---|
| 99% | 3.65 days |
| 99.9% | 8.76 hours |
| 99.99% | 52.6 minutes |
| 99.999% | 5.26 minutes |

Interviewer habit: name the likely bottleneck before proposing a fix. The snippet models that — find the slowest stage first.

## Resources

- **Guide:** [Scalability in System Design](https://www.systemdesignhandbook.com/guides/scalability-in-system-design/)
- **Guide:** [High Availability System Design](https://www.systemdesignhandbook.com/guides/high-availability-system-design/)
- **Guide:** [Reliability in System Design](https://www.systemdesignhandbook.com/guides/reliability-in-system-design/)
- **Guide:** [Back of the Envelope Calculation](https://www.systemdesignhandbook.com/guides/back-of-the-envelope-calculation/)
