---
title: Load Balancing & API Gateway
category: System Design
order: 170
dependsOn: [caching-cdn]
simulation: design
starterCode:
  go: |
    // Concept: round-robin that skips unhealthy backends.
    package main

    import "fmt"

    func main() {
        backends := []string{"a:8080", "b:8080", "c:8080"}
        healthy := map[string]bool{"a:8080": true, "b:8080": false, "c:8080": true}
        idx := 0
        for i := 0; i < 5; i++ {
            for !healthy[backends[idx%len(backends)]] {
                idx++
            }
            fmt.Println("route ->", backends[idx%len(backends)])
            idx++
        }
    }
  java: |
    // Concept: round-robin that skips unhealthy backends.
    import java.util.*;
    public class Main {
        public static void main(String[] args) {
            List<String> backends = List.of("a:8080", "b:8080", "c:8080");
            Set<String> healthy = Set.of("a:8080", "c:8080");
            int idx = 0;
            for (int i = 0; i < 5; i++) {
                while (!healthy.contains(backends.get(idx % backends.size()))) idx++;
                System.out.println("route -> " + backends.get(idx % backends.size()));
                idx++;
            }
        }
    }
  typescript: |
    // Concept: round-robin that skips unhealthy backends.
    const backends = ['a:8080', 'b:8080', 'c:8080'];
    const healthy = new Set(['a:8080', 'c:8080']);
    let idx = 0;
    for (let i = 0; i < 5; i++) {
      while (!healthy.has(backends[idx % backends.length])) idx++;
      console.log('route ->', backends[idx % backends.length]);
      idx++;
    }
  python: |
    # Concept: round-robin that skips unhealthy backends.
    backends = ["a:8080", "b:8080", "c:8080"]
    healthy = {"a:8080", "c:8080"}
    idx = 0
    for _ in range(5):
        while backends[idx % len(backends)] not in healthy:
            idx += 1
        print("route ->", backends[idx % len(backends)])
        idx += 1
---

Load balancers spread traffic so no single server becomes the bottleneck. Distilled from the [Complete Guide](https://www.systemdesignhandbook.com/guides/system-design/) and [API Gateway vs Load Balancer](https://www.systemdesignhandbook.com/guides/api-gateway-vs-load-balancer/).

## Algorithms

- **Round-robin:** simple rotation. Fair when backends are equal.
- **Least-connections:** send to the emptiest server. Better for uneven work.
- **Hash (IP/URL):** same client sticks to one backend. Useful for warm caches, but rebalancing hurts.

Always pair with **health checks** — automatically remove failing servers, re-add when healthy (the snippet simulates this).

## Load balancer vs API gateway

| Concern | Load balancer (L4/L7) | API gateway |
|---|---|---|
| Job | Distribute traffic, fail over | Auth, rate limiting, routing, versioning, aggregation |
| Sees | Hosts + health | APIs + clients + quotas |
| Example | HAProxy, NLB/ALB, nginx | Kong, API Gateway, Envoy edge |

A common stack is gateway at the edge (policy) → load balancer per service (spread).

## Interview lines

Where do TLS, retries, and timeouts live? What happens when one AZ fails? How do sticky sessions limit your horizontal scale?

## Resources

- **Guide:** [API Gateway vs Load Balancer](https://www.systemdesignhandbook.com/guides/api-gateway-vs-load-balancer/)
- **Guide:** [System Design Concepts](https://www.systemdesignhandbook.com/guides/system-design-concepts/)
- **Blog:** [How Does Load Balancing Work](https://www.systemdesignhandbook.com/blog/how-does-load-balancing-work/)
