---
title: 'Practice: Chat, Rides & Feed'
category: System Design
order: 230
dependsOn: [rate-limiting-url-shortener]
simulation: design
starterCode:
  go: |
    // Concept: grid-cell matching (geo-index) + ordered message log.
    package main

    import "fmt"

    func cell(lat, lon float64) string {
        return fmt.Sprintf("cell:%d,%d", int(lat*10), int(lon*10))
    }

    func main() {
        fmt.Println("rider", cell(37.77, -122.41), "matched in same cell as driver")
        seq := 0
        send := func(text string) {
            seq++
            fmt.Printf("msg#%d %s\n", seq, text)
        }
        send("hello"); send("still there?"); send("sharing trip")
    }
  java: |
    // Concept: grid-cell matching + ordered log.
    public class Main {
        static String cell(double lat, double lon) {
            return "cell:" + ((int)(lat * 10)) + "," + ((int)(lon * 10));
        }
        public static void main(String[] args) {
            System.out.println("rider " + cell(37.77, -122.41) + " matched in same cell as driver");
            send("hello", 1); send("still there?", 2); send("sharing trip", 3);
        }
        static void send(String text, int seq) { System.out.println("msg#" + seq + " " + text); }
    }
  typescript: |
    // Concept: grid-cell matching + ordered log.
    const cell = (lat: number, lon: number) => `cell:${Math.floor(lat * 10)},${Math.floor(lon * 10)}`;
    console.log('rider', cell(37.77, -122.41), 'matched in same cell as driver');
    ['hello', 'still there?', 'sharing trip'].forEach((t, i) => console.log(`msg#${i + 1} ${t}`));
  python: |
    # Concept: grid-cell matching + ordered log.
    def cell(lat, lon):
        return f"cell:{int(lat*10)},{int(lon*10)}"

    print("rider", cell(37.77, -122.41), "matched in same cell as driver")
    for i, t in enumerate(["hello", "still there?", "sharing trip"], 1):
        print(f"msg#{i} {t}")
---

Three classic systems that combine everything so far. Distilled from [design WhatsApp](https://www.systemdesignhandbook.com/guides/design-whatsapp/), [design Uber](https://www.systemdesignhandbook.com/guides/design-uber/), [design YouTube](https://www.systemdesignhandbook.com/guides/design-youtube/), and [design Instagram](https://www.systemdesignhandbook.com/guides/design-instagram/).

## A. Chat (WhatsApp)

**Requirements:** real-time delivery, offline support, group chats, E2EE.
**Design:** persistent WebSocket per client → gateway → message queue (Kafka-style) → storage (wide-column like Cassandra for write throughput). Sequence IDs per conversation for ordering; receipts (sent/delivered/read) as separate events.
**Hard parts:** ordering across partitions, exactly-once display with at-least-once delivery (idempotent message IDs), presence at scale (heartbeat sharding).

## B. Ride-hailing (Uber)

**Requirements:** match riders/drivers in real time, location updates every few seconds, low-latency ETA.
**Design:** driver locations → transient store (Redis) keyed by spatial index (geohash/S2/quadtree grid cells — the snippet) → dispatch service queries nearby cells → trip/billing microservices own their entities.
**Hard parts:** write volume (batch/throttle updates), cell hotspots (downtown), consistency (one driver, one trip — CP for assignment, AP for ETAs).

## C. Feed / video (YouTube/Instagram capstone)

Combine: upload → transcode queue → blob store + CDN; feed = fan-out-on-write (push, fast reads, heavy writes) vs fan-out-on-read (pull, slow reads) vs hybrid for celebrities. Cache hot videos at edge; metadata in sharded DB; analytics async.

Revisit each problem twice — second pass should be simpler and clearer, not bigger.

## Resources

- **Guide:** [Design WhatsApp](https://www.systemdesignhandbook.com/guides/design-whatsapp/)
- **Guide:** [Design Uber](https://www.systemdesignhandbook.com/guides/design-uber/)
- **Guide:** [Design YouTube](https://www.systemdesignhandbook.com/guides/design-youtube/)
- **Guide:** [Design Instagram](https://www.systemdesignhandbook.com/guides/design-instagram/)
- **Guide:** [Design a Notification System](https://www.systemdesignhandbook.com/guides/design-a-notification-system/)
