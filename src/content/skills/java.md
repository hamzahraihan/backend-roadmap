---
title: Java
category: Languages
order: 66
dependsOn: [pick-language]
starterCode:
  go: |
    package main

    import "fmt"

    func main() { fmt.Println("Java is your pick? Great choice.") }
  java: |
    import com.sun.net.httpserver.HttpServer;
    import java.io.IOException;
    import java.io.OutputStream;
    import java.net.InetSocketAddress;

    public class Main {
        public static void main(String[] args) throws IOException {
            HttpServer server = HttpServer.create(new InetSocketAddress(8080), 0);
            server.createContext("/", exchange -> {
                String body = "{\"language\":\"Java\"}";
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, body.getBytes().length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(body.getBytes());
                }
            });
            server.start();
            System.out.println("Server on :8080");
        }
    }
  typescript: |
    console.log('Java is your pick? Great choice.');
  python: |
    print('Java is your pick? Great choice.')
---

Java is a long-standing, enterprise-standard backend language with a massive ecosystem.

## Why Java for backend

- **Mature & stable** — used by banks, insurers, and large platforms for decades.
- **Strong typing & tooling** — excellent IDEs, static analysis, and refactoring support.
- **JVM** — huge library ecosystem and runtime optimizations.

## The trade-offs

- Verbose compared to Python/JS; heavier startup (mitigated by GraalVM native images).
- Memory footprint larger than Go.

The snippet uses the JDK's built-in `com.sun.net.httpserver` — production apps usually use Spring Boot instead.

## Resources

- **Reference:** [Oracle Java Docs](https://docs.oracle.com/en/java/)
- **Roadmap:** [roadmap.sh/java](https://roadmap.sh/java)
- **Video:** [Programming with Mosh — Java](https://www.youtube.com/@programmingwithmosh)
- **Paid:** [Udemy — Java backend](https://www.udemy.com/topic/java/)
