---
title: Monitoring & Observability
category: Quality
order: 122
dependsOn: [testing-cicd]
starterCode:
  python: |
    # PromQL equivalent: rate of errors over 5m
    # rate(http_requests_total{status=~"5.."}[5m])
    print('metrics -> dashboards -> alerts -> runbooks')
  typescript: |
    // rate(http_requests_total{status=~"5.."}[5m])
    console.log('metrics -> dashboards -> alerts -> runbooks');
  go: |
    // rate(http_requests_total{status=~"5.."}[5m])
    package main
    import "fmt"
    func main() { fmt.Println("metrics -> dashboards -> alerts -> runbooks") }
  java: |
    // rate(http_requests_total{status=~"5.."}[5m])
    public class Main {
        public static void main(String[] args) {
            System.out.println("metrics -> dashboards -> alerts -> runbooks");
        }
    }
---

**Monitoring** watches known signals; **observability** lets you ask new questions (metrics, logs, traces). The standard open-source pair is **Prometheus** (collect + alert) + **Grafana** (visualize).

Learn: RED (rate/errors/duration) or USE (utilization/saturation/errors), SLOs, alert routing, runbooks, log aggregation.

## Resources

- **Source:** [DevOps-Roadmap §10 — Monitoring & Observability](https://github.com/milanm/DevOps-Roadmap) (Apache-2.0)
- **Guide:** [What Is Observability?](https://devopscube.com/what-is-observability/)
- **Docs:** [Prometheus getting started](https://prometheus.io/docs/tutorials/getting_started/) · [Grafana tutorials](https://grafana.com/tutorials/)
