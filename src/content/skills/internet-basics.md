---
title: Internet Fundamentals
category: Web Basics
order: 10
dependsOn: []
starterCode:
  go: |
    // The internet is a network of networks. Backend code runs on a server
    // and talks over TCP/IP. Here's a tiny TCP listener to feel the layers:
    package main

    import (
        "fmt"
        "net"
    )

    func main() {
        ln, _ := net.Listen("tcp", ":8080")
        fmt.Println("listening on :8080")
        for {
            conn, _ := ln.Accept()
            conn.Write([]byte("HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nhi"))
            conn.Close()
        }
    }
  java: |
    // A server socket is the lowest-level building block the internet runs on.
    import java.net.ServerSocket;
    import java.net.Socket;
    import java.io.PrintWriter;

    public class Main {
        public static void main(String[] args) throws Exception {
            try (ServerSocket server = new ServerSocket(8080)) {
                System.out.println("listening on :8080");
                while (true) {
                    Socket s = server.accept();
                    new PrintWriter(s.getOutputStream(), true)
                        .println("HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nhi");
                    s.close();
                }
            }
        }
    }
  typescript: |
    // Node uses the built-in `net` module for raw TCP, the foundation of HTTP.
    import { createServer } from 'node:net';

    const server = createServer((socket) => {
      socket.write('HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nhi');
      socket.end();
    });

    server.listen(8080, () => console.log('listening on :8080'));
  python: |
    # Python's socket module exposes the raw internet protocol stack.
    import socket

    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.bind(("", 8080))
    server.listen()
    print("listening on :8080")
    while True:
        conn, _ = server.accept()
        conn.sendall(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nhi")
        conn.close()
---

Before writing any backend code you should understand the pipes it runs on.

## How the internet works

- **Clients and servers** exchange packets over **TCP/IP**. Your code usually sits on the *server* side.
- A **DNS** lookup turns a domain name (e.g. `api.example.com`) into an IP address before any connection opens.
- Data is broken into packets, routed independently, and reassembled at the destination.

## Where HTTP sits

HTTP is an *application* protocol layered on top of TCP (port 80) and TLS (HTTPS, port 443). Your web framework almost never touches raw sockets — it hands that job to a web server (Nginx, Apache) or a runtime's built-in listener.

## Why this matters for you

Every backend skill below — languages, databases, APIs, auth — ultimately produces a service that answers requests over this stack. Keep the layers in mind when something is "slow" or "unreachable": it is usually DNS, the network, or the process not listening.

> The sandbox here has no network access, so you can only observe the code starting up — not actually talk to it from outside.

## Resources

- **Reference:** [MDN — How the Web works](https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview)
- **Roadmap:** [roadmap.sh/backend](https://roadmap.sh/backend) (Internet section)
- **Video:** [Hussein Nasser — networking deep dives](https://www.youtube.com/@husseinnasser)
- **Free course:** [freeCodeCamp — Computer Networking](https://www.freecodecamp.org)
