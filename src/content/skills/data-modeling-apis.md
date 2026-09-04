---
title: Data Modeling & API Design
category: System Design
order: 180
dependsOn: [rest-api, relational-databases]
simulation: design
starterCode:
  go: |
    // Concept: idempotency keys make retries safe; pages bound response size.
    package main

    import "fmt"

    func main() {
        seen := map[string]bool{}
        create := func(key, order string) string {
            if seen[key] {
                return "duplicate ignored: " + order
            }
            seen[key] = true
            return "created: " + order
        }
        fmt.Println(create("k1", "order-42"))
        fmt.Println(create("k1", "order-42"))
        fmt.Println("page-1: orders[0:2] of 10")
    }
  java: |
    // Concept: idempotency keys make retries safe.
    import java.util.*;
    public class Main {
        public static void main(String[] args) {
            Set<String> seen = new HashSet<>();
            System.out.println(create(seen, "k1", "order-42"));
            System.out.println(create(seen, "k1", "order-42"));
            System.out.println("page-1: orders[0:2] of 10");
        }
        static String create(Set<String> seen, String key, String order) {
            if (!seen.add(key)) return "duplicate ignored: " + order;
            return "created: " + order;
        }
    }
  typescript: |
    // Concept: idempotency keys make retries safe.
    const seen = new Set<string>();
    const create = (key: string, order: string) =>
      seen.has(key) ? `duplicate ignored: ${order}` : (seen.add(key), `created: ${order}`);
    console.log(create('k1', 'order-42'));
    console.log(create('k1', 'order-42'));
    console.log('page-1: orders[0:2] of 10');
  python: |
    # Concept: idempotency keys make retries safe.
    seen = set()
    def create(key, order):
        if key in seen:
            return f"duplicate ignored: {order}"
        seen.add(key)
        return f"created: {order}"

    print(create("k1", "order-42"))
    print(create("k1", "order-42"))
    print("page-1: orders[0:2] of 10")
---

Most scaling pain traces back to data modeling, not missing infrastructure. Distilled from the [roadmap's Phase 2](https://www.systemdesignhandbook.com/guides/system-design-roadmap/) — design from the data outward.

## Ownership boundaries

Name core entities, then assign one owner service per entity (only the owner creates/updates/validates it). No shared mutable tables across services — clear ownership is what lets teams scale and evolve independently.

## Read vs write patterns

| Pattern | Implication |
|---|---|
| Read-heavy | Denormalize, cache, CQRS-style read models |
| Write-heavy | Normalize, batch, append-only logs |
| Mixed | Separate read/write paths (CQRS) |

Optimizing reads usually complicates writes and vice versa — say the trade explicitly.

## API design as a boundary

- **Sync vs async:** REST/gRPC for request-response; queues/webhooks for slow work. See [RESTful API Design](https://www.systemdesignhandbook.com/guides/restful-api-design/).
- **REST** (public, JSON), **gRPC** (internal, Protobuf, fast), **GraphQL** (client-shaped queries, beware over-fetching shifted to resolvers).
- **Pagination** (cursor > offset at scale), **idempotent writes** (`Idempotency-Key` so retries are safe — the snippet), **versioning** (`/v1`, additive changes, sunset policy).

Good APIs prevent cascading failures and preserve evolvability — interviewers grade semantics and change-safety, not naming.

## Resources

- **Guide:** [RESTful API Design](https://www.systemdesignhandbook.com/guides/restful-api-design/)
- **Guide:** [Database System Design](https://www.systemdesignhandbook.com/guides/database-system-design/)
- **Guide:** [System Design Template](https://www.systemdesignhandbook.com/guides/system-design-template/)
