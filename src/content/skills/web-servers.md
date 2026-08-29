---
title: Web Servers & Hosting
category: Infrastructure
order: 100
dependsOn: [rest-api]
starterCode:
  go: |
    // Concept: a reverse proxy (Nginx) sits in front of your app server.
    // nginx.conf:
    //   location /api/ {
    //     proxy_pass http://127.0.0.1:8080;
    //   }
    package main

    import "fmt"

    func main() { fmt.Println("Nginx proxies /api -> app on :8080") }
  java: |
    // Nginx reverse-proxy snippet:
    // location /api/ { proxy_pass http://127.0.0.1:8080; }
    public class Main {
        public static void main(String[] args) {
            System.out.println("Nginx proxies /api -> app on :8080");
        }
    }
  typescript: |
    // Nginx reverse-proxy snippet:
    // location /api/ { proxy_pass http://127.0.0.1:8080; }
    console.log('Nginx proxies /api -> app on :8080');
  python: |
    # Nginx reverse-proxy snippet:
    # location /api/ { proxy_pass http://127.0.0.1:8080; }
    print('Nginx proxies /api -> app on :8080')
---

Your app usually runs behind a **web server** (Nginx, Apache, Caddy) that acts as a **reverse proxy**, TLS terminator, and static-file server.

## What the web server does

- **TLS termination** — handle HTTPS so your app speaks plain HTTP internally.
- **Reverse proxy** — route `/api` to your app process(es).
- **Static files & caching** — serve assets fast without hitting your code.
- **Load balancing** — spread traffic across app instances (often via a load balancer).

## Hosting

- **VPS / containers** (Docker) — package your app and deploy anywhere.
- **PaaS / serverless** — let a provider manage the runtime (e.g., a Function as a Service).
- **Process managers** (systemd, PM2) keep the app alive and restart it.

The snippet shows the Nginx rule that fronts a Node/Go/Python app. Pair this with architectural patterns next.

## Resources

- **Reference:** [Nginx Documentation](https://nginx.org/en/docs/)
- **Roadmap:** [roadmap.sh/devops](https://roadmap.sh/devops)
- **Video:** [Hussein Nasser — Servers & infra](https://www.youtube.com/@husseinnasser)
- **Free course:** [freeCodeCamp — DevOps](https://www.freecodecamp.org)
