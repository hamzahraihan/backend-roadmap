---
title: Caching & CDN Strategies
category: System Design
order: 160
dependsOn: [scalability-performance]
simulation: design
starterCode:
  go: |
    // Concept: tiny LRU cache (capacity 3) — watch hits vs misses.
    package main

    import "fmt"

    func main() {
        cap := 3
        order := []string{}
        cache := map[string]string{}
        get := func(k string) string {
            if v, ok := cache[k]; ok {
                fmt.Println("HIT", k)
                return v
            }
            fmt.Println("MISS", k)
            if len(order) >= cap {
                delete(cache, order[0])
                order = order[1:]
            }
            cache[k] = "v:" + k
            order = append(order, k)
            return cache[k]
        }
        get("a"); get("b"); get("c"); get("a"); get("d"); get("b")
    }
  java: |
    // Concept: tiny LRU cache (capacity 3).
    import java.util.*;
    public class Main {
        public static void main(String[] args) {
            int cap = 3;
            LinkedHashMap<String, String> cache = new LinkedHashMap<>(cap, 0.75f, true) {
                protected boolean removeEldestEntry(Map.Entry<String, String> e) { return size() > cap; }
            };
            String[] keys = {"a", "b", "c", "a", "d", "b"};
            for (String k : keys) {
                if (cache.containsKey(k)) System.out.println("HIT " + k);
                else { System.out.println("MISS " + k); cache.put(k, "v:" + k); }
            }
        }
    }
  typescript: |
    // Concept: tiny LRU cache (capacity 3).
    const cap = 3;
    const cache = new Map<string, string>();
    const get = (k: string) => {
      if (cache.has(k)) { console.log('HIT', k); const v = cache.get(k)!; cache.delete(k); cache.set(k, v); return v; }
      console.log('MISS', k);
      if (cache.size >= cap) { const oldest = cache.keys().next().value!; cache.delete(oldest); }
      cache.set(k, 'v:' + k); return cache.get(k);
    };
    ['a', 'b', 'c', 'a', 'd', 'b'].forEach(get);
  python: |
    # Concept: tiny LRU cache (capacity 3).
    from collections import OrderedDict
    cap = 3
    cache = OrderedDict()
    for k in ["a", "b", "c", "a", "d", "b"]:
        if k in cache:
            print("HIT", k)
            cache.move_to_end(k)
        else:
            print("MISS", k)
            if len(cache) >= cap:
                cache.popitem(last=False)
            cache[k] = "v:" + k
---

Caching is the highest-leverage performance tool — and the easiest to misuse. Distilled from the [roadmap's Phase 3](https://www.systemdesignhandbook.com/guides/system-design-roadmap/) and [caching guide](https://www.systemdesignhandbook.com/guides/caching-in-system-design/).

## Where caches live

| Layer | Benefit | Risk |
|---|---|---|
| Client (browser/app) | Lowest latency | Stale data per device |
| CDN (edge) | Global scale, offloads origin | Invalidation complexity |
| Server (Redis/Memcached) | Reduced DB load | Consistency bugs, extra hop |

Real systems combine all three.

## Strategies

- **Cache-aside (look-aside):** app checks cache, falls back to DB, repopulates. Simple, tolerant of cache loss.
- **Write-through:** writes go to cache + DB together. Fresher reads, slower writes.
- **TTL + eviction:** expire entries (`EXPIRE`); evict with LRU/LFU/FIFO when full. Know [eviction policies](https://www.systemdesignhandbook.com/guides/cache-eviction-policies/).

## Interview probes to prepare

When does caching hurt? What is your invalidation plan? What happens on a cold start or cache crash — does the DB survive the thundering herd? How stale may this data be (seconds vs minutes)?

## Resources

- **Guide:** [Caching in System Design](https://www.systemdesignhandbook.com/guides/caching-in-system-design/)
- **Guide:** [Cache Eviction Policies](https://www.systemdesignhandbook.com/guides/cache-eviction-policies/)
- **Guide:** [Design a CDN](https://www.systemdesignhandbook.com/guides/design-a-cdn-system-design/)
- **Guide:** [Design a Distributed Cache](https://www.systemdesignhandbook.com/guides/design-a-distributed-cache-system/)
