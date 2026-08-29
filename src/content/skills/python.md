---
title: Python
category: Languages
order: 62
dependsOn: [pick-language]
starterCode:
  go: |
    package main

    import "fmt"

    func main() { fmt.Println("Python is your pick? Great choice.") }
  java: |
    public class Main {
        public static void main(String[] args) {
            System.out.println("Python is your pick? Great choice.");
        }
    }
  typescript: |
    console.log('Python is your pick? Great choice.');
  python: |
    from http.server import BaseHTTPRequestHandler, HTTPServer
    import json

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            body = json.dumps({"language": "Python"}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body)

    HTTPServer(("", 8080), Handler).serve_forever()
---

Python is famously readable and is a top choice for backends, data pipelines, and ML services.

## Why Python for backend

- **Readability** — fast to write and maintain.
- **Batteries included** — `http.server`, `sqlite3`, and more ship in the standard library.
- **Ecosystem** — Django, Flask, and FastAPI for web; dominant in data/ML.

## The trade-offs

- **GIL** limits true multi-core parallelism for CPU work (use multiprocessing or offload).
- Dynamic typing — mitigate with type hints + `mypy`.

The snippet starts a minimal JSON API with the standard library. FastAPI is the usual next step for a real service.

## Resources

- **Reference:** [Python Documentation](https://docs.python.org/3/)
- **Roadmap:** [roadmap.sh/python](https://roadmap.sh/python)
- **Video:** [Corey Schafer — Python](https://www.youtube.com/@coreymschafer)
- **Free course:** [freeCodeCamp — Python](https://www.freecodecamp.org)
