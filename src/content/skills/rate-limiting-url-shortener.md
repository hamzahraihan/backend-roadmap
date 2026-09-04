---
title: 'Practice: Rate Limiter & URL Shortener'
category: System Design
order: 220
dependsOn: [distributed-failures]
simulation: design
starterCode:
  go: |
    // Concept: token bucket (rate limit) + Base62 (short codes).
    package main

    import "fmt"

    const alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"

    func encode(n int) string {
        if n == 0 {
            return string(alphabet[0])
        }
        out := ""
        for n > 0 {
            out = string(alphabet[n%62]) + out
            n /= 62
        }
        return out
    }

    func main() {
        tokens := 5
        for i := 0; i < 7; i++ {
            if tokens > 0 {
                tokens--
                fmt.Println("allow, remaining:", tokens)
            } else {
                fmt.Println("deny 429, retry later")
            }
        }
        fmt.Println("id 125 ->", encode(125))
    }
  java: |
    // Concept: token bucket + Base62 short codes.
    public class Main {
        static final String ABC = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
        static String encode(int n) {
            if (n == 0) return "0";
            String out = "";
            while (n > 0) { out = ABC.charAt(n % 62) + out; n /= 62; }
            return out;
        }
        public static void main(String[] args) {
            int tokens = 5;
            for (int i = 0; i < 7; i++) {
                if (tokens > 0) { tokens--; System.out.println("allow, remaining: " + tokens); }
                else System.out.println("deny 429, retry later");
            }
            System.out.println("id 125 -> " + encode(125));
        }
    }
  typescript: |
    // Concept: token bucket + Base62 short codes.
    const ABC = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const encode = (n: number): string => {
      if (n === 0) return '0';
      let out = '';
      while (n > 0) { out = ABC[n % 62] + out; n = Math.floor(n / 62); }
      return out;
    };
    let tokens = 5;
    for (let i = 0; i < 7; i++) {
      if (tokens > 0) { tokens--; console.log('allow, remaining:', tokens); }
      else console.log('deny 429, retry later');
    }
    console.log('id 125 ->', encode(125));
  python: |
    # Concept: token bucket + Base62 short codes.
    ABC = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
    def encode(n):
        if n == 0:
            return "0"
        out = ""
        while n > 0:
            out = ABC[n % 62] + out
            n //= 62
        return out

    tokens = 5
    for _ in range(7):
        if tokens > 0:
            tokens -= 1
            print("allow, remaining:", tokens)
        else:
            print("deny 429, retry later")
    print("id 125 ->", encode(125))
---

Start interview practice with two foundational problems. Distilled from [design a rate limiter](https://www.systemdesignhandbook.com/guides/design-a-rate-limiter/), [URL shortening service](https://www.systemdesignhandbook.com/guides/design-a-url-shortening-service/), and the [interview questions guide](https://www.systemdesignhandbook.com/guides/system-design-interview-questions/).

## A. Rate limiter

**Requirements:** cap abuse (e.g. 100 req/min/user), low overhead, distributed-safe.
**Estimations:** keys = users × windows; counters are tiny, Redis-friendly.
**Design:** gateway middleware → Redis counters (token bucket or sliding-window log) → `429 + Retry-After` on exceed. Shard by user ID; watch hot keys and clock skew.
**Deep dive:** why token bucket (bursts allowed) vs fixed window (boundary bursts)? Where do headers (`X-RateLimit-Remaining`) come from?

## B. URL shortener (TinyURL/Bitly)

**Requirements:** create + redirect, 100:1 read:write, low-latency reads, unique codes.
**Estimations:** 100M URLs/mo × ~500 B metadata ≈ 50 GB/mo before replicas; QPS split reads/writes early to size cache.
**Design:** REST `POST /urls` → ID service (counter/range or hash + collision check) → Base62 7-char code → KV store (sharded) with Redis cache-first reads; CDN for hot links.
**Trade-offs:** counter (dense, needs coordination) vs hash (decentralized, needs dedupe); SQL for mapping integrity vs NoSQL for read scale.

Practice loop: clarify → estimate → HLD boxes → one deep dive (limiter algorithm *or* ID generation) → failure handling (Redis down? counter gap?) → recap.

## Resources

- **Guide:** [Design a Rate Limiter](https://www.systemdesignhandbook.com/guides/design-a-rate-limiter/)
- **Guide:** [Design a URL Shortening Service](https://www.systemdesignhandbook.com/guides/design-a-url-shortening-service/)
- **Guide:** [Top System Design Interview Questions](https://www.systemdesignhandbook.com/guides/top-system-design-interview-questions/)
