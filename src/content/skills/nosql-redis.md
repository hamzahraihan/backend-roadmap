---
title: NoSQL & Caching (Redis)
category: Databases
order: 80
dependsOn: [relational-databases]
starterCode:
  go: |
    // Redis stores key/value pairs in memory. With go-redis you'd do:
    // rdb.Set(ctx, "visits", 1, 0)
    // n, _ := rdb.Incr(ctx, "visits").Result()
    package main

    import "fmt"

    func main() {
        cache := map[string]int{"visits": 0}
        cache["visits"]++
        fmt.Println("visits:", cache["visits"])
    }
  java: |
    // With the Java Lettuce client:
    // redis.set("visits", "0");
    // long n = redis.incr("visits");
    public class Main {
        public static void main(String[] args) {
            var cache = new java.util.HashMap<String, Integer>();
            cache.put("visits", cache.getOrDefault("visits", 0) + 1);
            System.out.println("visits: " + cache.get("visits"));
        }
    }
  typescript: |
    // With ioredis:
    // await redis.set('visits', '0');
    // const n = await redis.incr('visits');
    const cache = new Map<string, number>([['visits', 0]]);
    cache.set('visits', (cache.get('visits') ?? 0) + 1);
    console.log('visits:', cache.get('visits'));
  python: |
    # With redis-py:
    # r.set('visits', 0)
    # n = r.incr('visits')
    cache = {"visits": 0}
    cache["visits"] += 1
    print("visits:", cache["visits"])
---

**NoSQL** databases drop rigid schemas for flexibility or scale. **Redis** is an in-memory key/value store used mainly for **caching**.

## When NoSQL

- **Document stores** (MongoDB) — flexible, nested JSON-like documents.
- **Key/value** (Redis, DynamoDB) — ultra-fast lookups by key.
- **Column / graph** (Cassandra, Neo4j) — specialized scale or relationship queries.

## Redis as a cache

- Store expensive query results by key; serve from memory next time.
- Use **TTL** (`EXPIRE`) so stale data is evicted automatically.
- Patterns: **Cache-Aside** (app checks cache, falls back to DB and repopulates), **write-through**.

Trade-off vs relational: Redis loses durability guarantees and complex queries in exchange for speed. Pair it with your relational DB rather than replacing it.

## Resources

- **Reference:** [Redis Documentation](https://redis.io/docs/latest/)
- **Roadmap:** [roadmap.sh/backend](https://roadmap.sh/backend) (Databases / NoSQL section)
- **Video:** [Fireship — Redis & databases](https://www.youtube.com/@fireship)
- **Free course:** [freeCodeCamp — Redis](https://www.freecodecamp.org)
