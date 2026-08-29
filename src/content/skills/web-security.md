---
title: Web Security
category: Security
order: 95
dependsOn: [http-fundamentals]
starterCode:
  go: |
    // Concept: set security headers the way a framework middleware would.
    package main

    import (
        "fmt"
        "net/http"
    )

    func secure(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            w.Header().Set("Content-Security-Policy", "default-src 'self'")
            w.Header().Set("X-Content-Type-Options", "nosniff")
            next.ServeHTTP(w, r)
        })
    }

    func main() {
        _ = secure
        fmt.Println("security headers applied")
    }
  java: |
    // Concept: security headers via a filter.
    public class Main {
        public static void main(String[] args) {
            System.out.println("Content-Security-Policy: default-src 'self'");
        }
    }
  typescript: |
    // Concept: security headers the way a framework middleware would.
    function secure(headers: Record<string, string>) {
      headers['Content-Security-Policy'] = "default-src 'self'";
      headers['X-Content-Type-Options'] = 'nosniff';
    }
    const h: Record<string, string> = {};
    secure(h);
    console.log(h);
  python: |
    # Concept: security headers the way a framework middleware would.
    headers = {}
    headers["Content-Security-Policy"] = "default-src 'self'"
    headers["X-Content-Type-Options"] = "nosniff"
    print(headers)
---

Backend security is defending your service and its data. Roadmap.sh groups this under web security, covering transport, browser boundaries, and common vulnerabilities.

## Essentials

- **HTTPS / TLS** — encrypt traffic; terminate at the load balancer or server.
- **CORS** — control which browser origins may call your API.
- **CSP / security headers** — limit XSS and MIME sniffing in browsers.
- **OWASP Top 10** — injection, broken auth, XSS, insecure deserialization, etc.

## Defenses you wire in code

- **Parameterized queries** stop SQL injection.
- **Input validation** and output encoding stop XSS.
- **Rate limiting / throttling** blunts abuse and brute force.
- Keep dependencies patched.

The snippet sets the headers a real middleware would add. Security builds on auth (above) and HTTP fundamentals.

## Resources

- **Reference:** [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- **Roadmap:** [roadmap.sh/security](https://roadmap.sh/security)
- **Video:** [Fireship — Web Security](https://www.youtube.com/@fireship)
- **Free course:** [PortSwigger — Web Security Academy](https://portswigger.net/web-security)
