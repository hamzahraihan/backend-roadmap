---
title: Docker & Compose
category: Infrastructure
order: 102
dependsOn: [linux-shell, web-servers]
simulation: design
starterCode:
  python: |
    # Dockerfile equivalent: pin runtime, copy code, declare port
    # FROM python:3.12-slim
    # COPY app.py /srv/app.py
    # EXPOSE 8000
    print('image = code + runtime + config')
  typescript: |
    // FROM node:22-slim
    // COPY dist/ /srv/ — EXPOSE 3000
    console.log('image = code + runtime + config');
  go: |
    // FROM golang:1.23 AS build ... COPY --from=build /app/svc /svc
    package main
    import "fmt"
    func main() { fmt.Println("image = code + runtime + config") }
  java: |
    // FROM eclipse-temurin:21-jre — COPY app.jar /srv/app.jar
    public class Main {
        public static void main(String[] args) {
            System.out.println("image = code + runtime + config");
        }
    }
---

**Containers** package code + dependencies so apps run identically anywhere. **Docker** is the standard; **Compose** runs multi-container apps from one YAML file.

## Core loop

```bash
docker build -t svc:1.0 .
docker run -p 8000:8000 svc:1.0
docker compose up --build
```

Learn: images vs containers, layers + layer caching, volumes (state), networks, `Dockerfile` instructions, one service per container.

## Try it (right pane)

Open the **Docker lifecycle** scenario: build the request path, then use failure injection as stop/start to prove redundancy.

## Resources

- **Source:** [DevOps-Roadmap §6 — Containers](https://github.com/milanm/DevOps-Roadmap) (Apache-2.0)
- **Video:** [Docker Crash Course — TechWorld with Nana](https://www.youtube.com/watch?v=pg19Z8LL06w)
- **Video:** [Ultimate Docker Compose Tutorial — TechWorld with Nana](https://www.youtube.com/watch?v=SXwC9fSwct8)
