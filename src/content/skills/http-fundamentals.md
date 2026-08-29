---
title: HTTP Protocol
category: Web Basics
order: 20
dependsOn: [internet-basics]
starterCode:
  go: |
    package main

    import (
        "fmt"
        "net/http"
    )

    func handler(w http.ResponseWriter, r *http.Request) {
        fmt.Fprintf(w, "Hello from %s %s", r.Method, r.URL.Path)
    }

    func main() {
        http.HandleFunc("/", handler)
        fmt.Println("Server listening on :8080")
        http.ListenAndServe(":8080", nil)
    }
  java: |
    import com.sun.net.httpserver.HttpServer;
    import java.io.IOException;
    import java.io.OutputStream;
    import java.net.InetSocketAddress;

    public class Main {
        public static void main(String[] args) throws IOException {
            HttpServer server = HttpServer.create(new InetSocketAddress(8080), 0);
            server.createContext("/", exchange -> {
                String body = "Hello, HTTP!";
                exchange.sendResponseHeaders(200, body.getBytes().length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(body.getBytes());
                }
            });
            server.setExecutor(null);
            System.out.println("Server listening on :8080");
            server.start();
        }
    }
  typescript: |
    import { createServer } from 'node:http';

    const server = createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(`Hello from ${req.method ?? ''} ${req.url ?? '/'}`);
    });

    server.listen(8080, () => {
      console.log('Server listening on :8080');
    });
  python: |
    import http.server
    import socketserver

    PORT = 8080

    class Handler(http.server.SimpleHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200)
            self.end_headers()
            self.wfile.write(f"Hello from GET {self.path}".encode())

    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Server listening on :{PORT}")
        httpd.serve_forever()
---

HTTP is the language of the web. Every request your backend receives — and every API you build — speaks HTTP.

## Request / Response

A client (browser, mobile app, another service) sends an HTTP **request**; the server answers with an HTTP **response**:

- **Method** — the intent (`GET`, `POST`, `PUT`, `DELETE`, …)
- **Path** — the resource addressed (`/users/42`)
- **Headers** — metadata (content type, auth, caching)
- **Body** — optional payload, mostly for `POST`/`PUT`

## Status codes

| Range | Meaning | Examples |
| --- | --- | --- |
| 2xx | Success | `200 OK`, `201 Created` |
| 3xx | Redirect | `301`, `304 Not Modified` |
| 4xx | Client error | `400`, `401`, `404` |
| 5xx | Server error | `500`, `503` |

## HTTPS, CORS, headers

- **HTTPS** wraps HTTP in TLS so traffic is encrypted and authenticated.
- **CORS** controls which browser origins may call your API.
- **Headers** like `Content-Type`, `Authorization`, and `Cache-Control` carry the contract between client and server.

> The sandbox has no network access, so you'll only see the server start up. Use it to experiment with the request/response shape. Next, you'll turn this into a real REST API.

## Resources

- **Reference:** [MDN — HTTP](https://developer.mozilla.org/en-US/docs/Web/HTTP)
- **Roadmap:** [roadmap.sh/backend](https://roadmap.sh/backend) (Internet / HTTP section)
- **Video:** [Hussein Nasser — HTTP & networking](https://www.youtube.com/@husseinnasser)
- **Free course:** [MDN Learn Web Development](https://developer.mozilla.org/en-US/docs/Learn)
