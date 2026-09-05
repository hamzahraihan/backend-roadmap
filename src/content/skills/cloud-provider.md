---
title: Cloud Provider Basics
category: Infrastructure
order: 105
dependsOn: [web-servers, terraform-iac]
starterCode:
  python: |
    # aws cli equivalent: provision + inspect
    # aws ec2 run-instances --image-id ami-0abc123 --instance-type t3.micro
    # aws ec2 describe-instances
    print('console -> cli -> IaC: same APIs, increasing repeatability')
  typescript: |
    // aws ec2 run-instances --image-id ami-0abc123 --instance-type t3.micro
    console.log('console -> cli -> IaC: same APIs, increasing repeatability');
  go: |
    // aws ec2 run-instances --image-id ami-0abc123 --instance-type t3.micro
    package main
    import "fmt"
    func main() { fmt.Println("console -> cli -> IaC") }
  java: |
    // aws ec2 run-instances --image-id ami-0abc123 --instance-type t3.micro
    public class Main {
        public static void main(String[] args) {
            System.out.println("console -> cli -> IaC");
        }
    }
---

Pick **one cloud** (AWS, Azure, or GCP) and learn its primitives: IAM (users/roles), networks (VPC), compute (VMs), managed databases, object storage, billing boundaries.

Learn: least-privilege IAM first, private networking by default, managed services over self-hosting, cost alerts from day one.

## Resources

- **Source:** [DevOps-Roadmap §11 — Cloud](https://github.com/milanm/DevOps-Roadmap) (Apache-2.0)
- **AWS:** [AWS Well-Architected](https://aws.amazon.com/architecture/well-architected/)
- **Azure:** [AZ-900 Microsoft Azure Fundamentals](https://learn.microsoft.com/en-us/certifications/exams/az-900)
