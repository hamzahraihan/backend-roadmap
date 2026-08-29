---
title: Go
category: Languages
order: 64
dependsOn: [pick-language]
starterCode:
  go: |
    package main

    import (
        "encoding/json"
        "net/http"
    )

    func main() {
        http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
            w.Header().Set("Content-Type", "application/json")
            json.NewEncoder(w).Encode(map[string]string{"language": "Go"})
        })
        http.ListenAndServe(":8080", nil)
    }
  java: |
    public class Main {
        public static void main(String[] args) {
            System.out.println("Go is your pick? Great choice.");
        }
    }
  typescript: |
    console.log('Go is your pick? Great choice.');
  python: |
    print('Go is your pick? Great choice.')
---

Go (Golang) was built at Google for large-scale, concurrent services — a favorite for infrastructure and APIs.

## Why Go for backend

- **Fast compile + tiny binaries** — easy to containerize and deploy.
- **Built-in concurrency** — goroutines and channels make high-throughput services straightforward.
- **Opinionated & simple** — a small language that's easy for teams to standardize on.

## The trade-offs

- Less "batteries included" than Python; more manual wiring.
- Generics are newer and lighter than in Java/TS.

The snippet serves JSON with just the standard library — no framework needed.

## Resources

- **Reference:** [Go Documentation](https://go.dev/doc/)
- **Roadmap:** [roadmap.sh/golang](https://roadmap.sh/golang)
- **Interactive:** [A Tour of Go](https://go.dev/tour/)
- **Video:** [Tech With Tim — Go](https://www.youtube.com/@techwithtim)
