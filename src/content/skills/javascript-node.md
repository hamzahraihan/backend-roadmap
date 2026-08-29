---
title: JavaScript (Node.js)
category: Languages
order: 60
dependsOn: [pick-language]
starterCode:
  go: |
    // This node is about JavaScript/Node.js. The Go snippet below shows the
    // same "listen" idea for comparison.
    package main

    import (
        "fmt"
        "net/http"
    )

    func main() {
        http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
            fmt.Fprintln(w, "JavaScript is your pick? Great choice.")
        })
        http.ListenAndServe(":8080", nil)
    }
  java: |
    // Node.js equivalent concept in Java:
    import com.sun.net.httpserver.HttpServer;
    import java.io.IOException;
    import java.net.InetSocketAddress;

    public class Main {
        public static void main(String[] args) throws IOException {
            HttpServer s = HttpServer.create(new InetSocketAddress(8080), 0);
            s.createContext("/", e -> { e.sendResponseHeaders(200, 0); e.close(); });
            s.start();
        }
    }
  typescript: |
    import { createServer } from 'node:http';

    const server = createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ language: 'JavaScript', runtime: 'Node.js' }));
    });

    server.listen(8080, () => console.log('Node server on :8080'));
  python: |
    # Node.js equivalent concept in Python:
    import http.server, socketserver

    class H(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'{"language": "JavaScript", "runtime": "Node.js"}')

    socketserver.TCPServer(("", 8080), H).serve_forever()
---

JavaScript on the server runs via **Node.js** — the same language as the browser, which removes a whole context switch.

## Why Node for backend

- **One language end-to-end** (frontend + backend + scripts).
- **Huge ecosystem** via `npm` — frameworks like Express, Fastify, and NestJS.
- **Event-driven, non-blocking I/O** — great for many concurrent connections doing I/O.

## The trade-offs

Node is single-threaded; CPU-heavy work should be offloaded (worker threads, queues, or a separate service). Use **TypeScript** to add static types and catch errors before runtime.

Try the snippet: it returns JSON, the shape most REST APIs use. Later skills build on this with REST, auth, and databases.

## Resources

- **Reference:** [Node.js Docs](https://nodejs.org/en/docs)
- **Roadmap:** [roadmap.sh/nodejs](https://roadmap.sh/nodejs)
- **Video:** [The Net Ninja — Node.js](https://www.youtube.com/@thenetninja)
- **Paid:** [Udemy — Node.js courses](https://www.udemy.com/topic/nodejs/)
