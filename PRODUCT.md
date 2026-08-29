# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: **Interview preppers** — engineers and career-changers preparing for backend and system-design interviews who want targeted, structured practice rather than passive reading. They arrive with a goal (master a topic before an interview), learn fast, and value being able to *run* code and *track* what they have covered.

Secondary (served by the same surface): self-taught and junior backend developers studying independently, and CS students reinforcing practical backend skills alongside coursework.

## Product Purpose

An interactive backend proficiency platform that turns the backend learning path into a navigable skill graph and a hands-on coding workspace. It exists so a learner can go from "I don't know backend" to "I can explain and demonstrate the core backend topics" with proof of progress. Success means a user can open a topic, read a concise explanation, edit and run real code in their chosen language, and see their coverage grow.

## Positioning

The product combines three differentiators that neighboring tools lack together:

- **Hands-on execution** — users run real backend code inline in Go, Java, TypeScript, and Python via the Wandbox sandbox, not just read about it (vs roadmap.sh, which is read-only).
- **Tracked progression** — completion state persists per browser so learners see and steer their coverage (vs roadmap.sh's static map).
- **Curated backend depth** — an opinionated, backend-only path distilled from roadmap.sh's material, instead of a broad all-purpose or algorithm-only map (vs Neetcode, which is algorithm practice).

A neighboring product could not truthfully copy "run four languages of backend code inline with persistent progression on a curated backend-only path" as a single offer.

## Operating Context

- **Entry:** vertical skill-tree homepage; click a node to open its split-screen page.
- **Skill page:** left = markdown explanation (prose), right = code playground with language tabs, Run, and output.
- **Progress:** per-browser `localStorage`; no accounts, no server, no backend database.
- **Execution:** code runs client-side against the public Wandbox compile API; the sandbox has no outbound network access, so only startup/output is observable for networked examples.
- **Theme:** light/dark toggle, persisted in `localStorage`, defaults to OS preference.
- **Source material:** the curriculum is curated from roadmap.sh's backend topic list (156 source topics reduced to an 18-node backbone by learning level).

## Capabilities and Constraints

- **Stack (confirmed by codebase):** Astro (content collections) + React islands (`@astrojs/react`), Tailwind v4, React Flow (`@xyflow/react`) for the graph, `@monaco-editor/react` for the editor, `@dagrejs/dagre` for layout, Wandbox for execution.
- **Content model:** skills are markdown files in `src/content/skills/*.md` with frontmatter `title, category, order, dependsOn[], starterCode{go,java,typescript,python}`; the DAG is derived from `dependsOn`.
- **No auth/server:** all state is client-side; design must not assume a user account or shared backend.
- **Four-language parity:** every coding skill must offer meaningful starter code in all four languages; conceptual skills may use representative snippets.
- **Undecided:** whether to expand beyond the 18-node backbone, add user accounts, or add more languages.

## Brand Commitments

- **Name:** "Backend Roadmap" is the committed product name; do not rebrand.
- **Voice/tone:** neutral, practical, and instructional; no hype or marketing flourish.
- No logo, color, or typography is committed yet (visual world is established later in new-work / document).

## Evidence on Hand

- Curriculum source: roadmap.sh backend topic list (the `kamranahmedse/developer-roadmap` `roadmaps/backend/content/*.md` set, 156 topics) — used to curate the 18-node backbone.
- Implementation: the Astro project at this repository root (skill-tree homepage, split-screen skill pages, theme toggle).
- Absent (do not fabricate): testimonials, case studies, metrics, press, and any brand assets beyond the name.

## Product Principles

1. **Learning is doing.** Every concept should be reachable by reading a short explanation and running real code, not just scrolling a map.
2. **Progress is motivating.** Coverage should be visible and persistent so learners can see and direct their own advancement.
3. **Backend-only and curated.** Stay focused and opinionated about backend depth rather than broadening into a general-purpose roadmap.
4. **Language-agnostic entry.** Respect the learner's chosen runtime; the four-language playground keeps the path open.
5. **Honest and neutral.** Present material factually; no invented proof, no marketing spin.

## Accessibility & Inclusion

No product-specific accessibility standard was established by the user. The incumbent implementation should nonetheless keep keyboard-reachable nodes/links, sufficient contrast in both themes, and readable typography as a baseline; a committed WCAG level can be added later as a product constraint.
