---
title: Databases, Replication & Sharding
category: System Design
order: 190
dependsOn: [data-modeling-apis]
simulation: design
starterCode:
  go: |
    // Concept: consistent-hash ring — keys stick to nodes, only neighbors move on change.
    package main

    import (
        "fmt"
        "hash/fnv"
    )

    func slot(key string, nodes int) int {
        h := fnv.New32a()
        h.Write([]byte(key))
        return int(h.Sum32() % uint32(nodes))
    }

    func main() {
        for _, k := range []string{"user:1", "user:2", "order:9", "feed:7"} {
            fmt.Printf("%s -> node-%d\n", k, slot(k, 3))
        }
    }
  java: |
    // Concept: consistent-hash ring sketch.
    public class Main {
        static int slot(String key, int nodes) { return Math.floorMod(key.hashCode(), nodes); }
        public static void main(String[] args) {
            for (String k : new String[]{"user:1", "user:2", "order:9", "feed:7"}) {
                System.out.println(k + " -> node-" + slot(k, 3));
            }
        }
    }
  typescript: |
    // Concept: consistent-hash ring sketch.
    const slot = (key: string, nodes: number) =>
      [...key].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0) % nodes;
    for (const k of ['user:1', 'user:2', 'order:9', 'feed:7']) {
      console.log(`${k} -> node-${slot(k, 3)}`);
    }
  python: |
    # Concept: consistent-hash ring sketch.
    def slot(key, nodes):
        return sum(ord(c) for c in key) % nodes

    for k in ["user:1", "user:2", "order:9", "feed:7"]:
        print(f"{k} -> node-{slot(k, 3)}")
---

Pick storage by workload and consistency needs — not popularity. Distilled from the [roadmap's Phase 3–4](https://www.systemdesignhandbook.com/guides/system-design-roadmap/) and [database guide](https://www.systemdesignhandbook.com/guides/database-system-design/).

## SQL vs NoSQL

| Choice | Pros | Cons |
|---|---|---|
| SQL (Postgres/MySQL) | ACID, joins, structured integrity | Harder horizontal scale without sharding |
| NoSQL (Dynamo/Cassandra/Mongo) | Elastic scale, flexible schema | Eventual consistency, limited joins |
| Blob / KV / time-series / graph / vector | Best fit for media, flags, metrics, relations, embeddings | Each adds operational surface |

Banking ledger → SQL. Social feed → NoSQL + cache. Don't default to NoSQL.

## Scaling data

- **Replication:** copies for availability/reads (leader-follower, multi-leader). Handles crashes, not write scale.
- **Partitioning/sharding:** split by key (user ID, region). Distributes load but complicates routing, rebalancing, and cross-shard queries.
- **Consistent hashing:** minimizes key movement when nodes join/leave (the snippet).

## CAP and PACELC

Under a network partition you choose **Consistency (CP)** or **Availability (AP)** — partitions are mandatory, so "CA" is not a distributed option. PACELC adds: when healthy (E), choose Latency vs Consistency. Say which you pick and why — e.g. payments CP, likes/feed AP.

## Resources

- **Guide:** [Database System Design](https://www.systemdesignhandbook.com/guides/database-system-design/)
- **Guide:** [CAP Theorem in System Design](https://www.systemdesignhandbook.com/guides/cap-theorem-in-system-design/)
- **Guide:** [DynamoDB System Design](https://www.systemdesignhandbook.com/guides/dynamodb-system-design/)
- **Guide:** [Availability vs Consistency](https://www.systemdesignhandbook.com/guides/availability-vs-consistency/)
