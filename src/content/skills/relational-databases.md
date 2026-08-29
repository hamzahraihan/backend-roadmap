---
title: Relational Databases
category: Databases
order: 40
dependsOn: [internet-basics]
starterCode:
  go: |
    // Relational data is usually modeled as tables. In Go you'd map rows to
    // structs with database/sql + a driver. Concept sketch:
    package main

    import "fmt"

    type User struct {
        ID   int
        Name string
    }

    func main() {
        users := []User{{ID: 1, Name: "Ada"}, {ID: 2, Name: "Alan"}}
        for _, u := range users {
            fmt.Printf("%d %s\n", u.ID, u.Name)
        }
    }
  java: |
    // In Java you'd map rows to records and use JDBC or an ORM.
    public class Main {
        record User(int id, String name) {}
        public static void main(String[] args) {
            var users = java.util.List.of(new User(1, "Ada"), new User(2, "Alan"));
            users.forEach(u -> System.out.println(u.id() + " " + u.name()));
        }
    }
  typescript: |
    // In TypeScript you'd query with an ORM (Prisma, Drizzle) or a driver.
    type User = { id: number; name: string };
    const users: User[] = [
      { id: 1, name: 'Ada' },
      { id: 2, name: 'Alan' },
    ];
    for (const u of users) console.log(`${u.id} ${u.name}`);
  python: |
    # In Python you'd use sqlite3, Psycopg, or an ORM like SQLAlchemy.
    users = [
        {"id": 1, "name": "Ada"},
        {"id": 2, "name": "Alan"},
    ]
    for u in users:
        print(f"{u['id']} {u['name']}")
---

A relational database stores data in **tables** of rows and columns, linked by **keys**. PostgreSQL and MySQL are the workhorses of backend.

## Key ideas

- **Tables & schemas** — define columns and types up front.
- **Primary / foreign keys** — relate rows across tables.
- **Normalization** — reduce duplication (typically to 3NF); **denormalization** when reads need speed.
- **ACID** — Atomicity, Consistency, Isolation, Durability guarantee reliable transactions.
- **Indexes** — speed up lookups at the cost of write overhead.

## SQL vs NoSQL

Pick relational first: it enforces structure and integrity. Reach for NoSQL (MongoDB, Redis) when you have flexible schemas or need extreme scale/throughput. Next: write real SQL, then contrast with NoSQL.

## Resources

- **Reference:** [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- **Roadmap:** [roadmap.sh/backend](https://roadmap.sh/backend) (Databases section)
- **Video:** [Hussein Nasser — Databases](https://www.youtube.com/@husseinnasser)
- **Free course:** [freeCodeCamp — Databases & SQL](https://www.freecodecamp.org)
