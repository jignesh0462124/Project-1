# Collaborative Platform — Layout System

> **Status:** Design Proposal · **Scope:** Grid, spacing, structure, and responsive/resizable behavior only — no color or type decisions live here.
> **Companion to:** `collab-platform-design-system.md` (tokens referenced below — `--space-*`, `--radius-*`, `--accent`, etc. — are defined there, not redefined here)

---

## Table of Contents

1. [Why a Separate Layout Pass](#1-why-a-separate-layout-pass)
2. [Spacing Scale](#2-spacing-scale)
3. [Grid Foundations](#3-grid-foundations)
4. [Room Workspace Layout](#4-room-workspace-layout)
5. [Resizable Panes](#5-resizable-panes)
6. [Landing Page Grid](#6-landing-page-grid)
7. [Density Modes](#7-density-modes)
8. [Container Queries vs. Breakpoints](#8-container-queries-vs-breakpoints)
9. [Z-Index & Layering](#9-z-index--layering)
10. [Layout Anti-Patterns to Avoid](#10-layout-anti-patterns-to-avoid)
11. [Build Notes](#11-build-notes)

---

## 1. Why a Separate Layout Pass

The design system doc fixed *what things look like* — color, type, shadow, the presence rail concept. It left structure mostly fixed: `280px` rail, `360px` rail, one set of breakpoints. That's enough to build a first version, but it's not how modern dev tools actually feel in the hand.

What "modern" means here, concretely, for *this* product:

- **Panes resize**, they don't just collapse at breakpoints. Linear, VS Code, Figma, Notion — every tool people compare this to lets you drag the session rail wider or the activity rail narrower. A fixed `280px` rail reads as a template default the moment someone tries to drag it and nothing happens.
- **Spacing has rhythm, not just a token list.** The current doc lists `4/8/12/16/24/32/48` but never says which gap goes between a player row and the next, vs. between sections. That ambiguity is exactly what makes hand-built layouts feel slightly off — gaps that are "close enough" instead of intentional.
- **Density is a real user preference** for a tool used for hours at a stretch, not a nice-to-have. Power users want compact; first-time users want comfortable. Shipping only one fixed density is the single biggest "this still feels like a demo" tell in code tools.
- **The grid should respond to the pane's own width**, not the window's. A 360px activity rail at a 1280px-wide window and a 360px activity rail at a 2560px-wide window need to lay out identically — that's a container query, not a media query.

This document fixes those four things. Everything below assumes the color/type tokens from the design system doc already exist.

---

## 2. Spacing Scale

The design system doc defines a 4px base unit. This section defines **the rule for which multiple to use where** — the part that was previously left to judgment call.

| Step | Value | Where it's used |
|---|---|---|
| `space-1` | 4px | Icon-to-label gap inside a single control (e.g. status dot to "Connected" text) |
| `space-2` | 8px | Padding inside chips/badges; gap between stacked mono labels (eyebrow → value) |
| `space-3` | 12px | Padding inside buttons and inputs; gap between a player row's avatar and name block |
| `space-4` | 16px | Gap between player rows in a list; internal padding of cards; gutter between editor gutter and code |
| `space-6` | 24px | Gap between distinct groups within a panel (e.g. "Players" block to "Chat" block in the session rail) |
| `space-8` | 32px | Padding around an entire panel's content area (session rail, activity rail) |
| `space-12` | 48px | Gap between major page sections on the landing page; top/bottom padding of the landing hero |
| `space-16` | 64px | Outer page margin on the landing page at desktop widths |

**Rule of thumb:** the spacing step roughly doubles every time you cross a structural boundary — same-control (`space-1`–`space-2`) → same-group (`space-3`–`space-4`) → between-groups (`space-6`) → between-panels (`space-8`) → between-page-sections (`space-12`–`space-16`). If two elements need a gap that doesn't fit a clear tier, that's usually a sign they belong in the same group and should use the smaller value, not a sign to invent a one-off number.

**Vertical rhythm inside lists** (player list, chat messages, AI suggestion items): every repeating list in the product uses `space-4` between items and `space-3` internal padding per item, with no exceptions — this is what makes the player list and the chat feed feel like they belong to the same system instead of two different developers having built them.

---

## 3. Grid Foundations

Two different grid logics for two different kinds of screen — this matters and shouldn't be flattened into one "the grid" rule:

| Context | Grid type | Reasoning |
|---|---|---|
| **Room Workspace** | Flex-based, 3 regions, resizable | This is an application shell, not editorial content. Fixed-width application panes plus a flexible center is the correct mental model (it's what every IDE does), not a content column grid. |
| **Landing Page** | 12-column fluid grid, `64px` outer margin, `24px` gutter | This is marketing/content. A column grid is the right tool because the content (hero copy, feature list, form) is genuinely compositional in a way the workspace isn't. |

### Landing page column grid

```
Desktop (≥1280px):  12 columns · 24px gutter · 64px outer margin · max-width 1280px
Tablet (720–1279px): 8 columns  · 20px gutter · 40px outer margin
Mobile (<720px):     4 columns  · 16px gutter · 20px outer margin
```

Current landing spec (from the design doc, §5.1) used an even 50/50 two-column split. Refined here: **7/5**, not 6/6. The product statement + feature list (left) is short-form and benefits from a narrower measure for readability; the form (right) needs width for comfortable input fields. An even split makes the form awkwardly narrow on a 1280px viewport — measured at 12-col/7-5: left column ≈ 696px, right column ≈ 536px, which keeps form inputs at a comfortable 480–520px content width after internal card padding.

```
┌────────────────────────────┬──────────────────────┐
│  cols 1–7 (≈696px)         │  cols 8–12 (≈536px)   │
│  Product statement          │  Form card            │
│  + feature list              │                       │
└────────────────────────────┴──────────────────────┘
```

---

## 4. Room Workspace Layout

### 4.1 Region Model

Three regions, flex row, center region flexible:

```
┌─ Session Rail ─┬──────────── Editor ────────────┬─ Activity Rail ─┐
│  flex: 0 0 var(--rail-session-w)                │  flex: 0 0 var(--rail-activity-w) │
│  min: 240px  max: 420px                          │  min: 300px  max: 480px            │
│                 │  flex: 1 1 auto                 │                  │
│                 │  min-width: 480px               │                  │
└─────────────────┴──────────────────────────────────┴──────────────────┘
        Top bar: full width, fixed height 56px, sits above all three regions
```

- Session rail and activity rail are **user-resizable** between their min/max (see §5). Their *current* width is stored as a CSS custom property (`--rail-session-w`, `--rail-activity-w`) so the resize handle just writes to that variable rather than triggering a layout recalculation pattern.
- Editor region has `flex: 1 1 auto` with a hard `min-width: 480px` — below that, the editor stops shrinking and the rails give way first (collapse to icon-rail / bottom-sheet per the responsive table in the design doc, §9), because code legibility is the one thing that should never get sacrificed to make room for chrome.
- Top bar is the one fixed-height element in the whole shell (`56px`) — everything else is flexible height within the viewport, no internal scrollbars except inside the chat message list and the AI Analysis result body.

### 4.2 Internal Panel Padding

| Region | Outer padding | Content gap |
|---|---|---|
| Session rail | `space-4` (16px) sides, `space-6` (24px) top | `space-6` between Players block and Chat block |
| Editor | `0` (code fills edge-to-edge below the tab bar; the presence rail gutter is part of the editor chrome, not padding) | n/a |
| Activity rail | `space-4` (16px) sides, `space-4` top | `space-4` between tab bar and content |

The editor having zero outer padding is deliberate and is the thing most templated layouts get wrong — code editors that pad the text area make every line wrap point and column-count expectation slightly wrong versus what the user's terminal/IDE muscle memory expects. The session and activity rails, being read as prose/UI rather than code, use normal padding.

---

## 5. Resizable Panes

This is the single highest-leverage layout change in this document — it's what makes the shell feel like a real desktop-class tool rather than a fixed marketing template.

### Behavior

- A 1px-wide hit target sits at each rail/editor boundary, with a 6px invisible drag zone around it for forgiving grab — a 1px-only target is a common implementation mistake that makes resize handles feel broken even when the feature technically exists.
- On hover, the handle shows a 2px `--line-strong` highlight; on active drag, it shows `--accent`.
- Dragging writes directly to `--rail-session-w` / `--rail-activity-w`, clamped to each rail's min/max from §4.1.
- Width persists per-user (localStorage, keyed by rail) — not per-room — since pane width is a personal reading preference, not something that should reset every time someone joins a new session.
- Double-clicking a handle resets that rail to its default width (`280px` session, `360px` activity), giving an explicit way back to the baseline without hunting for a setting.

### Why not collapsible accordions instead

The current screenshots' Output/AI Analysis sections expand and collapse vertically, pushing content below them down the page — that pattern is fine for a single stacked column but breaks down the moment there are three regions side by side, because vertical collapse in one region doesn't give horizontal space back to its neighbors. Resizable width, not collapsible height, is the correct mechanism for a multi-pane shell.

---

## 6. Landing Page Grid

Building on the 12-column grid in §3:

```
Hero band            → full-width background, content constrained to 12-col / 1280px max
  Eyebrow             → row 1, cols 1–7
  Headline            → row 2, cols 1–7
  Form card           → cols 8–12, spans rows 1–3 (right-aligned, vertically centered against headline block)
  Feature list (3)    → row 3, cols 1–7, stacked single-column list (not a 3-up icon grid — see design doc §2)
```

Below the hero, if additional landing sections are added later (testimonials, screenshots, footer), each section uses the same 12-column frame with `space-12` (48px) between sections and respects the 7/5 asymmetry established by the hero rather than reverting to even splits — consistency of the column rhythm across sections is part of what reads as "designed" rather than "assembled."

---

## 7. Density Modes

A setting, not a breakpoint — exposed in the Settings panel, defaults to **Comfortable**.

| Token | Comfortable (default) | Compact |
|---|---|---|
| `--row-h` (player row, chat message, list item height) | 56px | 40px |
| `--editor-line-height` | 1.6 | 1.4 |
| `--panel-padding` | `space-4` (16px) | `space-3` (12px) |
| `--font-scale` | 1.0 | 0.93 |

Compact mode doesn't shrink the *minimum* tap targets below 32px even though row height drops — buttons and icon-buttons keep a 32px minimum hit area regardless of density, only their visual padding tightens. This keeps Compact legitimately usable rather than just visually smaller.

Density is a personal, persisted preference (localStorage), independent of room and independent of light/dark theme — the same way pane width is in §5. Both are "how I like to work," not "how this room looks."

---

## 8. Container Queries vs. Breakpoints

Two different responsive mechanisms, used for two different things — conflating them is a common source of layout bugs:

| Mechanism | Used for | Why |
|---|---|---|
| **Viewport media queries** | Whole-shell decisions: does the session rail become an icon rail, does the activity rail become a bottom sheet | These are decisions about the *window*, and only the window — a small browser window on a large monitor should behave the same as a small window anywhere else |
| **Container queries** (`@container`) | Internal layout of a single panel, based on *that panel's own current width* | Because rails are user-resizable (§5), a 320px-wide activity rail can exist inside a 2560px browser window. The AI Analysis card's internal layout (e.g. whether improvement-suggestion items show inline or stacked) needs to respond to its own box, not the viewport, or it'll render wrong the moment someone drags the rail narrow on a big screen |

Practical split: the breakpoint table in the design system doc (§9) governs the *shell* (rail → icon-rail → bottom-sheet). Everything *inside* a rail or panel — player row layout, chat bubble width, AI card internals — should be wrapped in a `container-type: inline-size` container and queried against its own width, not the viewport's.

---

## 9. Z-Index & Layering

A flat, documented stack — the kind of thing that's easy to let sprawl into ad-hoc `z-50`s across a codebase if it isn't fixed once, here:

| Layer | z-index | Contents |
|---|---|---|
| Base | `0` | Session rail, editor, activity rail (all siblings, same layer) |
| Sticky chrome | `10` | Top bar, editor file-tab bar (sticky within their own scroll containers) |
| Resize handles | `15` | The drag handles from §5, just above content so they're always grabbable |
| Dropdowns / tooltips | `30` | Presence rail tick tooltips, language selector, player row overflow menu |
| Bottom sheet (mobile) | `40` | The collapsed activity/session content on <720px, per design doc §9 |
| Modal / overlay | `50` | Invite modal, leave-room confirmation |
| Toast | `60` | Always above everything, including modals — a connection-loss toast should be visible even mid-modal |

---

## 10. Layout Anti-Patterns to Avoid

Specific to what was visible in the original screenshots — flagged here so a rebuild doesn't reintroduce them under the new visual skin:

- **Two stacked "tab-like" rows above the editor** (a player-tab row directly above a separate "2 PLAYERS" label row). Collapse to one row — file tabs — per design doc §5.2. A second permanent row for player context duplicates what the session rail already shows.
- **Output and AI Analysis as independently-collapsible accordions in the same column.** Already addressed as tabs in the design doc (§5.2) — restated here because it's fundamentally a layout problem (vertical space contention), not just a visual one.
- **A full-width banner toast that shifts the top bar down when it appears** (`CODE EXECUTED SUCCESSFULLY!` in the original). Toasts must overlay (`position: fixed`, layer per §9), never reflow sticky chrome — a layout that shifts on every run/analyze action reads as unstable even when nothing is actually broken.
- **Fixed pixel rail widths with no resize affordance.** Addressed throughout §5 — this is the core deliverable of this document.
- **Equal visual weight on every card border**, with no panel distinguishing "currently relevant" from "ambient." Handled by pairing this layout doc's regions with the design doc's `--shadow-active` rule (§3.3 there): exactly one surface gets the active treatment at a time, never all of them.

---

## 11. Build Notes

- Implement rail width and density as CSS custom properties set on a wrapping element (`<div data-density="comfortable" style="--rail-session-w: 280px; --rail-activity-w: 360px">`), so resize and density-switching are pure CSS-variable writes with no layout-thrashing re-renders required.
- Use `react-resizable-panels` (or equivalent) for the drag-to-resize mechanics in §5 rather than hand-rolling pointer-event math — the min/max/persist behavior specified here maps directly onto that library's API.
- Container queries (§8) require `container-type: inline-size` on each rail's root element; Tailwind v4 supports `@container` variants natively, so panel-internal responsive classes can stay in the same utility-class workflow as the rest of the build.
- This document and `collab-platform-design-system.md` should be read together — this one answers "how big, how far apart, does it resize," the other answers "what color, what font, what shadow." Neither should duplicate the other's tokens; if a number is needed here, reference the design doc's token name rather than restating a raw hex or font value.

---

*Layout specification for the Collaborative Platform product — companion to `collab-platform-design-system.md`, written for an autonomous coding agent or developer handoff.*
