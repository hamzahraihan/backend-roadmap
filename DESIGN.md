---
name: Backend Roadmap
description: An interactive backend proficiency platform — a calm, terminal-like reference where learners read, run code, and track progress.
colors:
  paper: "#ffffff"
  ink: "#09090b"
  surface: "#f4f4f5"
  surface-deep: "#18181b"
  hairline: "#e4e4e7"
  hairline-deep: "#27272a"
  graphite: "#3f3f46"
  graphite-muted: "#71717a"
  ink-text: "#18181b"
  paper-text: "#f4f4f5"
  signal-blue: "#0ea5e9"
  signal-blue-deep: "#0284c7"
  success: "#10b981"
  success-deep: "#059669"
  caution: "#f59e0b"
typography:
  display:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.05em"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.success-deep}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.success}"
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.graphite-muted}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-ghost-hover:
    backgroundColor: "{colors.hairline}"
  button-active:
    backgroundColor: "{colors.signal-blue-deep}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  chip-status:
    backgroundColor: "{colors.surface-deep}"
    textColor: "{colors.paper-text}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
---

# Design System: Backend Roadmap

## Overview

**Creative North Star: "The Reference Terminal"**

Backend Roadmap is built like a precise man page, not a marketing site. Every element earns its place: the homepage is a navigable skill graph, each skill page is a split reference — explanation on the left, a runnable terminal on the right. The personality is calm, neutral, and functional: information-dense but unhurried, with no decorative flourish. Color is reserved for meaning, not mood. The product is for interview preppers who want to read a topic, run real code in Go, Java, TypeScript, or Python, and watch their coverage accumulate — so the interface behaves like a trustworthy instrument, not a splashy course landing.

The system runs in two equivalent themes (light/dark) that share one logic: a graphite neutral base with three signal colors that mean exactly one thing each. Surfaces are flat at rest; depth comes from tonal layering (page → panel → control), not from heavy shadows. Type is the platform default sans for UI and a mono stack for code, so the only "voice" is structure and signal.

**Key Characteristics:**
- Neutral graphite base in light and dark; no brand hue, only signal accents.
- Three functional accents — Signal Blue (available / active), Success Emerald (completed / run), Caution Amber (in progress) — used solely as status, never decoration.
- Flat-by-default surfaces; depth through tonal steps, with a single soft shadow reserved for the skill-graph nodes.
- Dual-pane "reference terminal" layout: prose left, code right; full-viewport, no scrolling chrome.
- Two themes, one logic; theme choice persists and defaults to OS preference.

## Colors

A graphite neutral scale carries structure and text; three signal accents carry state. Nothing is decorative — every color is either a surface, a text role, or a status.

### Primary
- **Signal Blue** (#0ea5e9 / deep #0284c7): the main interactive accent. Marks a skill as *available* on the graph and lights the *active language* tab in the playground. Deep is the filled active state.

### Secondary
- **Success Emerald** (#10b981 / deep #059669): the "go" signal. Marks a skill *completed* and fills the Run and Mark-complete actions.

### Tertiary
- **Caution Amber** (#f59e0b): the in-progress signal. Marks a skill currently being studied.

### Neutral
- **Paper** (#ffffff): light-mode page background.
- **Ink** (#09090b): dark-mode page background (zinc-950).
- **Surface** (#f4f4f5) / **Surface Deep** (#18181b): panels and cards in light / dark.
- **Hairline** (#e4e4e7) / **Hairline Deep** (#27272a): borders and dividers in light / dark.
- **Graphite** (#3f3f46) / **Graphite Muted** (#71717a): mid-neutral fills and muted text; also the graph edge stroke.
- **Ink Text** (#18181b) / **Paper Text** (#f4f4f5): primary text in light / dark.

### Named Rules
**The Signal Coding Rule.** The three accents mean exactly one thing — status or the primary action. They are never used for decoration, illustration, or emphasis on non-stateful elements. A screen may show all three only because three states are genuinely present.

**The No Hue Rule.** Outside the three signals, the palette is strictly graphite. Introducing a fourth chromatic color (purple, red, pink) breaks the system and must be rejected unless it maps to a new, documented status.

## Typography

**Display Font:** System UI Sans (with system-ui, Segoe UI, Roboto fallback)
**Body Font:** System UI Sans (same stack)
**Label/Mono Font:** UI Monospace for code output; System UI Sans in uppercase tracking-wide for labels

**Character:** The type is deliberately unstyled — the platform default everywhere — so attention stays on content and code. Distinction comes from weight, size, and uppercase tracking, not from a custom typeface. The only "special" face is mono, which signals "this is machine output."

### Hierarchy
- **Display** (700, 1.25rem / 20px, 1.2): page and skill titles.
- **Body** (400, 1rem / 16px, 1.6): prose explanations; aim for 65–75ch measure in the reading pane.
- **Label** (500, 0.75rem / 12px, 0.05em, uppercase): category chips, status badges, Output caption.
- **Mono** (400, 0.75rem / 12px, 1.5): code editor and execution output.

### Named Rules
**The Mono Is Truth Rule.** Anything produced by or typed into the system (editor, stdout, stderr) is set in mono; everything the system says is set in sans. The face alone tells the reader what is machine versus narrative.

## Layout

The product is full-viewport and chrome-free. The homepage is a header bar above a vertical (top-to-bottom) skill graph that fills the remaining height; the skill page is a header bar above a two-pane split — prose on the left, code playground on the right — that becomes a stacked single column below the `lg` breakpoint (1024px). The graph uses a top-to-bottom DAG (beginner at top, advanced at bottom) auto-laid out with dagre; nodes are 200×64px. Density is moderate: comfortable padding (header 16–24px), clear pane divider. Both pages share the same header pattern (title left, theme toggle right) so navigation feels like one terminal.

## Elevation & Depth

Flat-by-default. Surfaces sit flush; depth is conveyed by tonal steps — page (Paper/Ink) → panel (Surface/Surface Deep) → control (hairline-bordered or filled) — not by shadows. The only shadow in the system is `shadow-lg` on the skill-graph nodes, used so they read as tangible cards floating above the canvas. Both themes use the same logic; dark mode simply shifts the neutral steps darker.

### Shadow Vocabulary
- **Node Lift** (`box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)`): applied only to skill-graph node cards, in both themes (softened automatically on dark via the zinc base).

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. Shadow appears only on the skill-graph nodes as a response to being a distinct, clickable object — never on panels, buttons, or chips.

## Shapes

Gently rounded, consistent, and quiet. Cards and skill nodes use an 8px radius (lg); chips, language tabs, and action buttons use a 4px radius (sm); the theme-toggle control uses 6px (md). The signature silhouette is the skill node: a rounded card with a 2px status-colored border ring and small connection handles top (target) and bottom (source). Borders are hairline-weight; nothing is pill-shaped or sharply cornered.

## Components

### Buttons
- **Shape:** 4px radius (sm); 8px 16px padding.
- **Primary (Run / Mark complete):** filled Success Emerald deep, white label; hover lightens to Success.
- **Ghost (Reset / inactive language):** Surface fill, Graphite Muted label; hover shifts to Hairline.
- **Active (selected language):** filled Signal Blue deep, white label.

### Chips
- **Style:** Surface Deep fill, Paper Text label, 4px radius, 2px 8px padding; used for category and status badges (status badges carry a 2px signal-colored border).

### Cards / Containers
- **Corner Style:** 8px (lg).
- **Background:** Surface (light) / Surface Deep (dark).
- **Shadow Strategy:** flat except skill-graph nodes (Node Lift).
- **Border:** Hairline; skill nodes add a 2px status-colored ring.
- **Internal Padding:** 12–16px.

### Inputs / Fields
- Not present as form fields; the only "input" is the Monaco code editor, which uses its own light/dark theme matching the app theme.

### Navigation
- Header pattern: title left, theme toggle right; on the skill page a "← Roadmap" link returns home. Links are Graphite Muted → Ink Text (light) / Paper Text (dark) on hover. No persistent sidebar; the graph itself is the navigation.

### Signature Component — Skill Node
The recurring custom unit: a 200×64px rounded card showing the skill title and category, a status badge, a 2px signal-colored ring (sky/amber/emerald), and React Flow handles (target top, source bottom) that draw the dependency edges. It is the only shadowed element and the primary wayfinding object.

### Signature Component — Code Playground
The right pane: a language-tab bar (Ghost/Active buttons), a Monaco editor, a divider, and an Output panel rendering stdout/stderr in mono. Run triggers the Wandbox sandbox; Mark complete flips the node's status on the graph.

## Do's and Don'ts

### Do:
- **Do** use Signal Blue, Success Emerald, and Caution Amber only for status or the primary action.
- **Do** keep surfaces flat; reserve `shadow-lg` for skill-graph nodes alone.
- **Do** set all machine output (editor, stdout, stderr) in mono and all narrative in the system sans.
- **Do** honor both themes with one logic; never hardcode a color that breaks in the opposite theme.

### Don't:
- **Don't** introduce a fourth chromatic color for decoration or emphasis.
- **Don't** add shadows, gradients, or decorative imagery to panels, buttons, or chips.
- **Don't** use a custom display typeface; the neutral system sans is the committed voice.
- **Don't** let the graph or panes scroll the page chrome — both surfaces are full-viewport and internally scrollable only.
