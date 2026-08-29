---
title: Authentication & Authorization
category: Security
order: 90
dependsOn: [rest-api]
starterCode:
  go: |
    // Concept: verify a bearer token, then authorize.
    package main

    import (
        "fmt"
        "strings"
    )

    func authorize(header string) bool {
        return strings.HasPrefix(header, "Bearer ")
    }

    func main() {
        fmt.Println("valid request:", authorize("Bearer eyJ...token"))
    }
  java: |
    // Concept: verify a bearer token, then authorize.
    public class Main {
        static boolean authorize(String header) {
            return header.startsWith("Bearer ");
        }
        public static void main(String[] args) {
            System.out.println("valid request: " + authorize("Bearer eyJ...token"));
        }
    }
  typescript: |
    // Concept: verify a bearer token, then authorize.
    function authorize(header: string | undefined): boolean {
      return !!header?.startsWith('Bearer ');
    }
    console.log('valid request:', authorize('Bearer eyJ...token'));
  python: |
    # Concept: verify a bearer token, then authorize.
    def authorize(header: str) -> bool:
        return header.startswith("Bearer ")

    print("valid request:", authorize("Bearer eyJ...token"))
---

**Authentication** proves *who* a user is; **authorization** decides *what* they may do. APIs must check both on every request.

## Common approaches

- **Session / cookie auth** — server stores a session id in a signed cookie (stateful).
- **JWT (JSON Web Token)** — signed, stateless token the client sends as a `Bearer` header.
- **OAuth2 / OpenID Connect** — delegate login to an identity provider (Google, GitHub).
- **API keys / tokens** — simple service-to-service auth.

## Pitfalls

- Hash passwords with **bcrypt/scrypt/argon2** — never store plaintext.
- Use **HTTPS** so tokens can't be sniffed.
- Keep tokens short-lived; use refresh tokens for longevity.
- Validate and verify signatures server-side; don't trust the client.

The snippet shows the simplest gate: a request is only authorized if it carries a bearer token. Build real auth on top of this with a verified JWT library.

## Resources

- **Reference:** [JWT Introduction](https://jwt.io/introduction)
- **Roadmap:** [roadmap.sh/api-security](https://roadmap.sh/api-security)
- **Video:** [Hussein Nasser — Auth](https://www.youtube.com/@husseinnasser)
- **Free course:** [freeCodeCamp — Authentication](https://www.freecodecamp.org)
