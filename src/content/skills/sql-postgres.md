---
title: SQL & PostgreSQL
category: Databases
order: 50
dependsOn: [relational-databases]
starterCode:
  go: |
    // Go uses database/sql. With the pgx driver you'd do:
    // rows, _ := db.Query("SELECT id, name FROM users WHERE active = $1", true)
    // for rows.Next() { var id int; var name string; rows.Scan(&id, &name) }
    package main

    import "fmt"

    func main() {
        type User struct{ ID int; Name string }
        users := []User{{1, "Ada"}, {2, "Alan"}}
        for _, u := range users {
            fmt.Printf("%d %s\n", u.ID, u.Name)
        }
    }
  java: |
    // Java uses JDBC or an ORM. With JDBC:
    // var rs = stmt.executeQuery("SELECT id, name FROM users WHERE active = ?");
    public class Main {
        record User(int id, String name) {}
        public static void main(String[] args) {
            var users = java.util.List.of(new User(1, "Ada"), new User(2, "Alan"));
            users.forEach(u -> System.out.println(u.id() + " " + u.name()));
        }
    }
  typescript: |
    // TypeScript ORMs (Prisma/Drizzle) compile to parameterized SQL.
    // const users = await db.select().from(userTable).where(eq(userTable.active, true));
    type User = { id: number; name: string };
    const users: User[] = [
      { id: 1, name: 'Ada' },
      { id: 2, name: 'Alan' },
    ];
    for (const u of users) console.log(`${u.id} ${u.name}`);
  python: |
    # Python: psycopg3 or SQLAlchemy.
    # cur.execute("SELECT id, name FROM users WHERE active = %s", (True,))
    users = [
        {"id": 1, "name": "Ada"},
        {"id": 2, "name": "Alan"},
    ]
    for u in users:
        print(f"{u['id']} {u['name']}")
---

**SQL** is the declarative language for querying relational databases. **PostgreSQL** is the most common open-source choice for backends.

## Core statements

```sql
-- create
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT true
);

-- read
SELECT id, name FROM users WHERE active = true ORDER BY name;

-- write
INSERT INTO users (name) VALUES ('Ada');
UPDATE users SET active = false WHERE id = 1;
DELETE FROM users WHERE id = 2;
```

## Things to internalize

- **`JOIN`** combines tables via keys (`INNER`, `LEFT`).
- **Transactions** (`BEGIN`/`COMMIT`/`ROLLBACK`) keep multi-step writes atomic — see ACID.
- **Indexes** (`CREATE INDEX`) make `WHERE`/`JOIN` fast.
- **Parameterized queries** (`$1`, `?`) prevent SQL injection — never concatenate user input into SQL.

The snippet shows the row→object mapping each language does under the hood. Build on this with REST APIs and auth.

## Resources

- **Reference:** [PostgreSQL Tutorial](https://www.postgresql.org/docs/current/tutorial.html)
- **Roadmap:** [roadmap.sh/sql](https://roadmap.sh/sql)
- **Video:** [Hussein Nasser — SQL](https://www.youtube.com/@husseinnasser)
- **Free course:** [freeCodeCamp — SQL](https://www.freecodecamp.org)
