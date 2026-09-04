---
title: Messaging, Queues & Event-Driven
category: System Design
order: 200
dependsOn: [databases-sharding]
simulation: design
starterCode:
  go: |
    // Concept: publish to a topic; workers drain a queue async.
    package main

    import "fmt"

    func main() {
        topics := map[string][]string{}
        publish := func(topic, msg string) {
            topics[topic] = append(topics[topic], msg)
            fmt.Printf("published [%s] %s\n", topic, msg)
        }
        publish("orders", "created:42")
        publish("orders", "paid:42")
        fmt.Println("worker drains 2 jobs, requests already returned fast")
    }
  java: |
    // Concept: publish to a topic; workers drain async.
    import java.util.*;
    public class Main {
        public static void main(String[] args) {
            Map<String, List<String>> topics = new HashMap<>();
            publish(topics, "orders", "created:42");
            publish(topics, "orders", "paid:42");
            System.out.println("worker drains 2 jobs, requests already returned fast");
        }
        static void publish(Map<String, List<String>> t, String topic, String msg) {
            t.computeIfAbsent(topic, k -> new ArrayList<>()).add(msg);
            System.out.printf("published [%s] %s%n", topic, msg);
        }
    }
  typescript: |
    // Concept: publish to a topic; workers drain async.
    const topics = new Map<string, string[]>();
    const publish = (topic: string, msg: string) => {
      topics.set(topic, [...(topics.get(topic) ?? []), msg]);
      console.log(`published [${topic}] ${msg}`);
    };
    publish('orders', 'created:42');
    publish('orders', 'paid:42');
    console.log('worker drains 2 jobs, requests already returned fast');
  python: |
    # Concept: publish to a topic; workers drain async.
    topics = {}
    def publish(topic, msg):
        topics.setdefault(topic, []).append(msg)
        print(f"published [{topic}] {msg}")

    publish("orders", "created:42")
    publish("orders", "paid:42")
    print("worker drains 2 jobs, requests already returned fast")
---

Async architectures decouple producers from consumers so traffic spikes don't crush the database. Distilled from the [roadmap's Phase 5](https://www.systemdesignhandbook.com/guides/system-design-roadmap/) and [message queue guide](https://www.systemdesignhandbook.com/guides/message-queue-system-design/).

## Building blocks (SLIC FAST reminder)

Search, Load balancer, CDN interaction, Cache, Front-end, Analytics, Storage, Task queue — plus pub-sub, DNS, and typeahead in the full set. Reach for them deliberately, not by default.

## Queue vs stream vs pub-sub

- **Task queue** (SQS, Celery, RQ): jobs run once, asynchronously. Emails, thumbnails, reports.
- **Log/stream** (Kafka): ordered, replayable partitions. Events, analytics, CDC.
- **Pub-sub** (SNS, Redis pub-sub): fan-out to many subscribers. Notifications, cache invalidation.

## Costs to name

Ordering (per-partition vs global), delivery (at-least-once + idempotent consumers vs exactly-once claims), retention/replay, schema evolution, and operational load (brokers, consumer lag, dead-letter queues). Event-driven buys decoupling and burst absorption — it charges eventual consistency and debuggability.

Coordination (rate limiters, locks, leader election) solves specific control-plane problems; minimize it, since coordinators become bottlenecks.

## Resources

- **Guide:** [Message Queue System Design](https://www.systemdesignhandbook.com/guides/message-queue-system-design/)
- **Guide:** [Messaging Systems](https://www.systemdesignhandbook.com/guides/messaging-systems/)
- **Guide:** [System Design Patterns](https://www.systemdesignhandbook.com/guides/system-design-patterns/)
