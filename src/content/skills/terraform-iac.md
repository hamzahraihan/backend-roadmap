---
title: Terraform & IaC
category: Infrastructure
order: 104
dependsOn: [linux-shell]
starterCode:
  python: |
    # Terraform equivalent: declare infra, plan, apply
    # resource "aws_instance" "web" { ami = "..."  instance_type = "t3.micro" }
    print('plan -> apply -> state tracks reality')
  typescript: |
    // resource "aws_instance" "web" { instance_type = "t3.micro" }
    console.log('plan -> apply -> state tracks reality');
  go: |
    // terraform plan / terraform apply
    package main
    import "fmt"
    func main() { fmt.Println("plan -> apply -> state tracks reality") }
  java: |
    // terraform plan / terraform apply
    public class Main {
        public static void main(String[] args) {
            System.out.println("plan -> apply -> state tracks reality");
        }
    }
---

**Infrastructure as Code** defines environments in versioned files so setup is automated, reviewable, and repeatable. **Terraform** provisions; **Ansible** configures.

## Core loop

```hcl
resource "aws_instance" "web" {
  ami           = "ami-0abc123"
  instance_type = "t3.micro"
}
```

```bash
terraform init && terraform plan && terraform apply
```

Learn: providers, resources, state, modules, plan-before-apply, never commit secrets (use vaults / CI secrets).

## Resources

- **Source:** [DevOps-Roadmap §8 — IaC](https://github.com/milanm/DevOps-Roadmap) (Apache-2.0)
- **Tutorials:** [Official Terraform Tutorials](https://learn.hashicorp.com/terraform)
- **Guide:** [A Comprehensive Guide to Terraform](https://blog.gruntwork.io/a-comprehensive-guide-to-terraform-b3d32832baca)
