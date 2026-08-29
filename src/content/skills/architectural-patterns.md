---
title: Architectural Patterns
category: Architecture
order: 110
dependsOn: [rest-api]
starterCode:
  go: |
    // Concept: a tiny message broker publish (Kafka/RabbitMQ idea).
    package main

    import "fmt"

    func publish(topic string, msg string) { fmt.Printf("[%s] %s\n", topic, msg) }

    func main() { publish("orders", "created:42") }
  java: |
    // Concept: publish to a topic (Kafka/RabbitMQ idea).
    public class Main {
        static void publish(String topic, String msg) {
            System.out.printf("[%s] %s%n", topic, msg);
        }
        public static void main(String[] args) { publish("orders", "created:42"); }
    }
  typescript: |
    // Concept: publish to a topic (Kafka/RabbitMQ idea).
    function publish(topic: string, msg: string) {
      console.log(`[${topic}] ${msg}`);
    }
    publish('orders', 'created:42');
  python: |
    # Concept: publish to a topic (Kafka/RabbitMQ idea).
    def publish(topic, msg):
        print(f"[{topic}] {msg}")

    publish("orders", "created:42")
---

As systems grow you choose how to split responsibilities. Roadmap.sh covers monoliths, microservices, serverless, and event-driven design.

## Patterns

- **Monolith** — one deployable unit; simple, until it gets big.
- **Microservices** — small, independent services communicating over the network.
- **Serverless / Functions** — run code per request; no always-on server.
- **Event-driven** — services react to events via a **message broker** (Kafka, RabbitMQ).

## Trade-offs

- Microservices add deployment/operational complexity for team autonomy and scale.
- Event-driven decouples producers/consumers but introduces eventual consistency.
- Serverless scales to zero but can have cold starts and vendor lock-in.

The snippet shows a publish call — the building block of event-driven systems. Combine with web servers and scaling next.

## Resources

- **Reference:** [Microservices.io (Chris Richardson)](https://microservices.io/)
- **Roadmap:** [roadmap.sh/system-design](https://roadmap.sh/system-design)
- **Video:** [ByteByteGo — System design](https://www.youtube.com/@bytebytego)
- **Paid:** [Educative — Grokking System Design](https://www.educative.io/courses/grokking-the-system-design-interview)
