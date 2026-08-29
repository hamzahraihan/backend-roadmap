# AI Agent Directive: Backend Proficiency Platform (Neetcode-Style)

## 1. Project Overview

**Objective:** Build a streamlined, high-performance web platform focused on backend proficiency. The architecture mimics the "Neetcode" model: a highly visual, interactive skill tree that routes users to specific topic pages featuring explanations, examples, and an embedded code playground.
**Supported Languages:** Go, Java, TypeScript, and Python.
**Stack Requirements:** Astro, TypeScript, Tailwind CSS, and React Flow (or similar graph library) for the interactive tree.

## 2. Core Features & Requirements

### 2.1 The Interactive Skill Tree (Homepage)

- **Visual Structure:** Implement a Directed Acyclic Graph (DAG) or visual tree data structure representing the backend roadmap (e.g., Basics → Databases → APIs → Concurrency).
- **Interactivity:** Nodes must be clickable, visually indicating completion status (Not Started, In Progress, Completed).
- **Implementation:** Use a library like `React Flow` or build a custom SVG-based tree with `framer-motion`. Clicking a node routes the user to `/skill/[skill-id]`.

### 2.2 The Skill Page (Content + Playground)

- **Layout:** A split-screen interface.
  - _Left Pane (Content):_ Render Markdown/MDX containing the concept explanation, diagrams, and static code examples.
  - _Right Pane (Playground):_ An embedded, interactive code editor.
- **State Management:** Maintain the user's selected programming language globally across sessions so they don't have to switch it on every new page.

### 2.3 Multi-Language Code Playground

- **Editor:** Integrate `@monaco-editor/react` for the code input, pre-configured with syntax highlighting for Go, Java, TypeScript, and Python.
- **Execution Backend:**
  - Create a Next.js API route (`/api/execute`) that accepts the code payload and the selected language.
  - Integrate with a secure code execution engine (e.g., Piston API, Judge0, or a custom lightweight Docker runner) to compile/interpret the code and return stdout/stderr to the frontend console component.

## 3. Data Structure (Static or Database)

The agent should structure the curriculum data as follows (can be mocked in JSON initially):

```json
// tree-data.json
{
  "nodes": [
    { "id": "http-basics", "label": "HTTP Protocols", "status": "completed" },
    {
      "id": "rest-api",
      "label": "RESTful Design",
      "status": "locked",
      "dependencies": ["http-basics"]
    }
  ],
  "skills": {
    "http-basics": {
      "title": "Understanding HTTP",
      "content_md": "...",
      "starter_code": {
        "go": "package main\n...",
        "java": "public class Main {\n...",
        "typescript": "const server = ...",
        "python": "import http.server\n..."
      }
    }
  }
}
```
