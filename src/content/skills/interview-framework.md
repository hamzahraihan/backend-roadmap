---
title: System Design Interview Framework
category: System Design
order: 235
dependsOn: [realtime-rides-feed]
simulation: design
starterCode:
  go: |
    // Concept: back-of-envelope estimator — size QPS, storage, servers first.
    package main

    import "fmt"

    func main() {
        dau := 10_000_000
        reqPerUser := 20
        qps := dau * reqPerUser / 86400
        bytesPerRecord := 500
        writesPerDay := 1_000_000
        storageGB := float64(writesPerDay*bytesPerRecord) / 1e9
        fmt.Printf("est. %d QPS avg, %.1f GB new/day\n", qps, storageGB)
        fmt.Println("plan: 5m clarify, 10m HLD, 15m deep dive, 10m scale, 5m recap")
    }
  java: |
    // Concept: back-of-envelope estimator.
    public class Main {
        public static void main(String[] args) {
            int dau = 10_000_000;
            int qps = dau * 20 / 86400;
            double storageGB = (1_000_000 * 500) / 1e9;
            System.out.printf("est. %d QPS avg, %.1f GB new/day%n", qps, storageGB);
            System.out.println("plan: 5m clarify, 10m HLD, 15m deep dive, 10m scale, 5m recap");
        }
    }
  typescript: |
    // Concept: back-of-envelope estimator.
    const dau = 10_000_000;
    const qps = Math.floor((dau * 20) / 86400);
    const storageGB = (1_000_000 * 500) / 1e9;
    console.log(`est. ${qps} QPS avg, ${storageGB.toFixed(1)} GB new/day`);
    console.log('plan: 5m clarify, 10m HLD, 15m deep dive, 10m scale, 5m recap');
  python: |
    # Concept: back-of-envelope estimator.
    dau = 10_000_000
    qps = dau * 20 // 86400
    storage_gb = (1_000_000 * 500) / 1e9
    print(f"est. {qps} QPS avg, {storage_gb:.1f} GB new/day")
    print("plan: 5m clarify, 10m HLD, 15m deep dive, 10m scale, 5m recap")
---

Interviews test reasoning under ambiguity, not reference architectures. Distilled from the [Complete Interview Guide](https://www.systemdesignhandbook.com/guides/system-design-interview/), the [roadmap's Phase 6](https://www.systemdesignhandbook.com/guides/system-design-roadmap/), and the [master template](https://www.systemdesignhandbook.com/guides/system-design-template/).

## Repeatable flow (practice until automatic)

| Step | What interviewers grade |
|---|---|
| Clarify requirements | Comfort with ambiguity — functional + non-functional, scale, constraints |
| Define scope | Judgment — in/out, core entities, API shape |
| High-level design | Clear mental model — boxes, arrows, happy-path data flow |
| Deep dives | Technical depth — one or two components (storage, scaling, or failures) |
| Trade-offs + wrap-up | Maturity — why this choice, what breaks, what you would monitor next |

Don't jump to diagrams before questions — early solutioneering is a negative signal.

## Timebox (45–60 min)

5 clarify → 10 HLD → 15 deep dive → 10 scale/failures → 5 recap. Think aloud ("millions of reads, so cache-first") so the interviewer can steer you.

## Expectations by level

| Level | Graded on |
|---|---|
| Junior | Clear components + request flow |
| Mid | Bottlenecks, scaling, failure scenarios |
| Senior | Ambiguity handling, consistency guarantees, cost/ops constraints |

## Anti-patterns

- Memorizing architectures instead of reasoning (say *why* each box exists).
- Happy-path only (proactively raise crash/slow/partial-outage cases).
- Over-designing early (start simple, earn microservices/sharding/queues with numbers).
- Buzzwords without application (CAP, CQRS, saga only when tied to a decision).

## Readiness checklist

Request lifecycle ☐ · justify choices ☐ · reason about scale ☐ · handle failures ☐ · explicit trade-offs ☐ · clear under pressure ☐. Unchecked boxes are your next study target, not panic.

## Resources

- **Guide:** [System Design Interview](https://www.systemdesignhandbook.com/guides/system-design-interview/)
- **Guide:** [System Design Template](https://www.systemdesignhandbook.com/guides/system-design-template/)
- **Guide:** [Interview Preparation](https://www.systemdesignhandbook.com/guides/system-design-interview-preparation/)
- **Guide:** [Mock Interview](https://www.systemdesignhandbook.com/guides/system-design-mock-interview/)
- **Guide:** [Interview Questions](https://www.systemdesignhandbook.com/guides/system-design-interview-questions/)
