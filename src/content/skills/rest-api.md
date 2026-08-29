---
title: REST APIs
category: APIs
order: 70
dependsOn: [http-fundamentals]
starterCode:
  go: |
    package main

    import (
        "encoding/json"
        "fmt"
        "net/http"
    )

    type User struct {
        ID   int    `json:"id"`
        Name string `json:"name"`
    }

    func main() {
        users := map[int]User{1: {ID: 1, Name: "Ada"}}

        http.HandleFunc("/users", func(w http.ResponseWriter, r *http.Request) {
            if r.Method != http.MethodGet {
                w.WriteHeader(http.StatusMethodNotAllowed)
                return
            }
            w.Header().Set("Content-Type", "application/json")
            json.NewEncoder(w).Encode(users)
        })

        fmt.Println("API listening on :8080")
        http.ListenAndServe(":8080", nil)
    }
  java: |
    import com.sun.net.httpserver.HttpServer;
    import java.io.IOException;
    import java.net.InetSocketAddress;

    public class Main {
        public static void main(String[] args) throws IOException {
            HttpServer server = HttpServer.create(new InetSocketAddress(8080), 0);
            server.createContext("/users", exchange -> {
                String body = "{\"id\":1,\"name\":\"Ada\"}";
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, body.getBytes().length);
                exchange.getResponseBody().write(body.getBytes());
                exchange.close();
            });
            server.start();
            System.out.println("API listening on :8080");
        }
    }
  typescript: |
    import { createServer } from 'node:http';

    type User = { id: number; name: string };

    const users: Record<number, User> = { 1: { id: 1, name: 'Ada' } };

    const server = createServer((req, res) => {
      if (req.method !== 'GET' || req.url !== '/users') {
        res.writeHead(405).end();
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(users));
    });

    server.listen(8080, () => console.log('API listening on :8080'));
  python: |
    from http.server import BaseHTTPRequestHandler, HTTPServer
    import json

    USERS = {1: {"id": 1, "name": "Ada"}}

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path == "/users":
                body = json.dumps(USERS).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(body)
            else:
                self.send_response(404)
                self.end_headers()

    HTTPServer(("", 8080), Handler).serve_forever()
---

REST (Representational State Transfer) is a style for building APIs where **resources** are addressed by URL and manipulated with HTTP methods.

## Resources & Collections

```
GET    /users        → list users        (collection)
POST   /users        → create a user
GET    /users/1      → fetch user 1
PUT    /users/1      → replace user 1
DELETE /users/1      → delete user 1
```

## Principles

- **Stateless** — each request carries everything the server needs; no session state stored server-side.
- **Uniform interface** — use HTTP methods and status codes consistently.
- **Representations** — clients exchange JSON/XML representations of resources, not internal objects.

## Idempotency

`GET`, `PUT`, `DELETE` are **idempotent**: repeating them has the same effect as doing them once. `POST` is not.

Try editing the starter code to add a `GET /users/1` route returning a single user.

## Resources

- **Reference:** [REST API Tutorial](https://restfulapi.net/)
- **Roadmap:** [roadmap.sh/api-design](https://roadmap.sh/api-design)
- **Video:** [Hussein Nasser — API design](https://www.youtube.com/@husseinnasser)
- **Free course:** [freeCodeCamp — APIs](https://www.freecodecamp.org)
