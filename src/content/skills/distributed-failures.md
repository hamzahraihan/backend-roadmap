---
title: Distributed Failures & Observability
category: System Design
order: 210
dependsOn: [messaging-queues]
simulation: design
starterCode:
  go: |
    // Concept: retry with backoff + jitter; idempotent work stays safe.
    package main

    import "fmt"

    func main() {
        attempts := []string{"timeout", "timeout", "ok"}
        backoff := []int{100, 200, 400}
        for i, r := range attempts {
            if r == "ok" {
                fmt.Println("succeeded on attempt", i+1)
                return
            }
            fmt.Printf("attempt %d failed, wait %dms (+jitter)\n", i+1, backoff[i])
        }
    }
  java: |
    // Concept: retry with backoff; idempotent work stays safe.
    public class Main {
        public static void main(String[] args) {
            String[] attempts = {"timeout", "timeout", "ok"};
            int[] backoff = {100, 200, 400};
            for (int i = 0; i < attempts.length; i++) {
                if (attempts[i].equals("ok")) { System.out.println("succeeded on attempt " + (i + 1)); return; }
                System.out.println("attempt " + (i + 1) + " failed, wait " + backoff[i] + "ms (+jitter)");
            }
        }
    }
  typescript: |
    // Concept: retry with backoff; idempotent work stays safe.
    const attempts = ['timeout', 'timeout', 'ok'];
    const backoff = [100, 200, 400];
    for (let i = 0; i < attempts.length; i++) {
      if (attempts[i] === 'ok') { console.log('succeeded on attempt', i + 1); break; }
      console.log(`attempt ${i + 1} failed, wait ${backoff[i]}ms (+jitter)`);
    }
  python: |
    # Concept: retry with backoff; idempotent work stays safe.
    attempts = ["timeout", "timeout", "ok"]
    backoff = [100, 200, 400]
    for i, r in enumerate(attempts, 1):
        if r == "ok":
            print("succeeded on attempt", i)
            break
        print(f"attempt {i} failed, wait {backoff[i-1]}ms (+jitter)")
---

In distributed systems failure is the default — networks stall, machines crash, dependencies slow down. Distilled from the [roadmap's Phase 4](https://www.systemdesignhandbook.com/guides/system-design-roadmap/).

## The trio: timeouts, retries, idempotency

- **Timeouts** bound every wait; without them one slow dependency parks all workers.
- **Retries** with exponential backoff + jitter recover from blips; retries without timeouts or budgets amplify outages.
- **Idempotency** (keys, dedupe, safe replays) makes retries correct.

Treat them as one coordinated mechanism, not three tips.

## Eventual consistency UX

Say what users see during the window: pending badge, read-your-write for the writer, convergent count later. Design the recovery (reconciliation job, version vectors/LWW, CRDT where apt), not just the steady state.

## Failure responses

| Scenario | Response |
|---|---|
| Service crash | Replication, fast restart, health-gated traffic |
| Slow dependency | Timeout, circuit breaker, cached fallback |
| Partial outage | Graceful degradation (read-only mode, reduced features) |

## Observability

Metrics (RED/USE, p95/p99, error budget burn), structured logs (request IDs), distributed tracing across services. If you can't see the bottleneck, you can't fix it — add dashboards and alerts before scale, not after.

## Resources

- **Guide:** [Reliability in System Design](https://www.systemdesignhandbook.com/guides/reliability-in-system-design/)
- **Guide:** [High Availability System Design](https://www.systemdesignhandbook.com/guides/high-availability-system-design/)
- **Blog:** [Distributed Systems Principles](https://www.systemdesignhandbook.com/blog/distributed-systems-principles/)
