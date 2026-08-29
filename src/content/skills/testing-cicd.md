---
title: Testing & CI/CD
category: Quality
order: 120
dependsOn: [rest-api]
starterCode:
  go: |
    // Go has a built-in test runner: `go test`. Concept:
    // func TestAdd(t *testing.T) { if add(1,2) != 3 { t.Fail() } }
    package main

    import "fmt"

    func add(a, b int) int { return a + b }

    func main() { fmt.Println("add(1,2) =", add(1, 2)) }
  java: |
    // JUnit concept:
    // @Test void add() { assertEquals(3, add(1, 2)); }
    public class Main {
        static int add(int a, int b) { return a + b; }
        public static void main(String[] args) {
            System.out.println("add(1,2) = " + add(1, 2));
        }
    }
  typescript: |
    // With Vitest/Jest:
    // test('adds', () => expect(add(1, 2)).toBe(3));
    function add(a: number, b: number): number { return a + b; }
    console.log('add(1,2) =', add(1, 2));
  python: |
    # With pytest:
    # def test_add(): assert add(1, 2) == 3
    def add(a, b):
        return a + b

    print("add(1,2) =", add(1, 2))
---

Confidence comes from tests and a pipeline that runs them. Roadmap.sh splits this into unit, integration, and functional testing plus CI/CD.

## Testing levels

- **Unit** — test one function/module in isolation (fast, many).
- **Integration** — test how modules (e.g., app + database) work together.
- **Functional / E2E** — test behavior from the outside (HTTP calls).

## CI/CD

- **CI** (Continuous Integration) runs tests/lint on every push via GitHub Actions, GitLab CI, etc.
- **CD** (Continuous Delivery/Deployment) ships passing builds automatically.

A bare-minimum CI: on push, install deps, lint, `go test` / `pytest` / `npm test`, then build. The snippet shows the `add` you'd assert on.

## Resources

- **Reference:** [GitHub Actions Docs](https://docs.github.com/en/actions)
- **Roadmap:** [roadmap.sh/devops](https://roadmap.sh/devops)
- **Video:** [The Net Ninja — Testing & CI](https://www.youtube.com/@thenetninja)
- **Free course:** [freeCodeCamp — Testing](https://www.freecodecamp.org)
