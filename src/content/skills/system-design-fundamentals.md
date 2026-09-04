---
title: System Design Fundamentals (SPARCS)
category: System Design
order: 140
dependsOn: [building-for-scale]
simulation: design
starterCode:
  go: |
    // Concept: trace a request through each layer (DNS -> LB -> app -> DB).
    package main

    import "fmt"

    func handle(path string, stateful bool) string {
        mode := "stateless"
        if stateful {
            mode = "stateful"
        }
        return fmt.Sprintf("GET %s -> dns -> lb -> app(%s) -> db", path, mode)
    }

    func main() {
        fmt.Println(handle("/users", false))
        fmt.Println(handle("/cart", true))
    }
  java: |
    // Concept: request lifecycle with stateless vs stateful app tier.
    public class Main {
        static String handle(String path, boolean stateful) {
            String mode = stateful ? "stateful" : "stateless";
            return "GET " + path + " -> dns -> lb -> app(" + mode + ") -> db";
        }
        public static void main(String[] args) {
            System.out.println(handle("/users", false));
            System.out.println(handle("/cart", true));
        }
    }
  typescript: |
    // Concept: request lifecycle with stateless vs stateful app tier.
    const handle = (path: string, stateful: boolean) =>
      `GET ${path} -> dns -> lb -> app(${stateful ? 'stateful' : 'stateless'}) -> db`;
    console.log(handle('/users', false));
    console.log(handle('/cart', true));
  python: |
    # Concept: request lifecycle with stateless vs stateful app tier.
    def handle(path, stateful):
        mode = "stateful" if stateful else "stateless"
        return f"GET {path} -> dns -> lb -> app({mode}) -> db"

    print(handle("/users", False))
    print(handle("/cart", True))
---

System Design is how components meet requirements under growth, failure, and change. Distilled from the [System Design Roadmap](https://www.systemdesignhandbook.com/guides/system-design-roadmap/) and [Complete Guide](https://www.systemdesignhandbook.com/guides/system-design/): there is rarely one correct answer, only trade-offs between performance, availability, consistency, cost, and complexity.

## SPARCS — the six qualities

- **Scalability:** handle more users, data, traffic without proportional slowdown.
- **Performance:** meet latency and throughput goals (p95/p99, QPS).
- **Availability:** fraction of time the system responds (nines of uptime).
- **Reliability:** behaves correctly despite failures (redundancy, failover).
- **Consistency:** all parts agree on data state (strong vs eventual).
- **Security:** auth, encryption in transit/at rest, least privilege from day one.

## Two levels

- **High-level design:** services, APIs, databases, queues — boxes, arrows, data flow.
- **Low-level design:** data models, class structure, internal module logic.

## Request lifecycle (your backbone mental model)

`client -> DNS -> load balancer -> app servers -> cache/database`, with latency and failure possible at every hop. Stateless app tiers scale and recover easily; push state to databases, caches, or external stores. That trade-off (easy scale vs consistency/recovery work) recurs in every design discussion.

The snippet prints that flow for a stateless read (`/users`) and a stateful write (`/cart`).

## Resources

- **Guide:** [System Design Roadmap](https://www.systemdesignhandbook.com/guides/system-design-roadmap/)
- **Guide:** [System Design: The Complete Guide 2026](https://www.systemdesignhandbook.com/guides/system-design/)
- **Guide:** [System Design Fundamentals](https://www.systemdesignhandbook.com/guides/system-design-fundamentals/)
- **Guide:** [System Design Principles](https://www.systemdesignhandbook.com/guides/system-design-principles/)
