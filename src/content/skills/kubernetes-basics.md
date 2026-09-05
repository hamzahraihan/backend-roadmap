---
title: Kubernetes Basics
category: Infrastructure
order: 103
dependsOn: [docker-containers]
simulation: design
starterCode:
  python: |
    # kubectl equivalent: declare desired state, controllers converge it
    # kubectl apply -f deploy.yaml  # replicas: 3
    # kubectl get pods -w
    print('desired state -> controllers converge pods')
  typescript: |
    // kubectl apply -f deploy.yaml  # replicas: 3
    // kubectl get pods -w
    console.log('desired state -> controllers converge pods');
  go: |
    // kubectl apply -f deploy.yaml (replicas: 3)
    package main
    import "fmt"
    func main() { fmt.Println("desired state -> controllers converge pods") }
  java: |
    // kubectl apply -f deploy.yaml (replicas: 3)
    public class Main {
        public static void main(String[] args) {
            System.out.println("desired state -> controllers converge pods");
        }
    }
---

**Kubernetes** orchestrates containers: it keeps **desired state** (Deployments, Services, Ingress, ConfigMaps, Secrets, Volumes) converged across a cluster.

Learn: Pod, ReplicaSet, Deployment, Service, Ingress, ConfigMap, Secret, `kubectl` basics, Helm charts.

```yaml
# deploy.yaml
apiVersion: apps/v1
kind: Deployment
metadata: { name: svc }
spec:
  replicas: 3
  template:
    spec:
      containers:
        - { name: svc, image: svc:1.0 }
```

## Try it (right pane)

Open the **K8s deploy** scenario: Client → Service → 2+ app replicas → durable sink, then inject an app failure and Run.

## Resources

- **Source:** [DevOps-Roadmap §7 — Container Orchestration](https://github.com/milanm/DevOps-Roadmap) (Apache-2.0)
- **Video:** [Kubernetes Crash Course — TechWorld with Nana](https://www.youtube.com/watch?v=s_o8dwzRlu4)
- **Docs:** [Kubernetes concepts](https://kubernetes.io/docs/concepts/)
