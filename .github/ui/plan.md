# Collaborative Platform — Product UI Redesign

> **Status:** Design Proposal · **Surface:** Web App (Desktop-first, responsive) · **Stack target:** Next.js + Tailwind CSS

---

## Table of Contents

1. [Redesign Brief](#1-redesign-brief)
2. [What's Changing & Why](#2-whats-changing--why)
3. [Design System](#3-design-system)
4. [Screen Map](#4-screen-map)
5. [Screen Specs](#5-screen-specs)
6. [Component Library](#6-component-library)
7. [Signature Element — Presence Rail](#7-signature-element--presence-rail)
8. [Motion](#8-motion)
9. [Responsive Behavior](#9-responsive-behavior)
10. [Accessibility Floor](#10-accessibility-floor)
11. [Build Notes](#11-build-notes)

---

## 1. Redesign Brief

The product is a **real-time multiplayer code room** — up to 4 people share one file, run it, and get AI feedback together. The current UI (see source screenshots) communicates that idea through a retro-arcade skin: pixel font everywhere, neon teal/purple on navy, heavy borders, low-contrast body text. It reads like a hackathon demo, not a tool people work in for an hour at a time.

The redesign keeps the bones — session rail, player list, editor, chat, output, AI analysis — and rebuilds the surface around the thing that actually makes this product interesting: **you can see other people thinking in the same file as you, live.** Everything else (chrome, type, color) is reduced so that signal stays loud.

**Single job of this UI:** make shared editing feel *present* — like sitting next to someone — without the visual noise getting in the way of reading code.

---

## 2. What's Changing & Why

| Current | Problem | New |
|---|---|---|
| Pixel/blocky display font for body text, labels, chat | Hurts legibility at small sizes; reads as a game, not a workspace | Mono for code/data/labels, humanist sans for prose — see [§3.2](#32-typography) |
| Neon teal + violet + amber + red + green badges, all saturated, all at once | No visual hierarchy — everything shouts | One accent (mint) for "you / live," one secondary (violet) for "owner / AI," everything else desaturated to muted grey-blue |
| Navy/indigo background (`#0d1b2e`-ish) | Slightly purple cast reads "default dark template," low contrast against white text | True near-black ink background — higher contrast, calmer |
| Player presence = a colored dot + name in a list | Presence is the core feature but is the least visually interesting part of the screen | **Presence Rail** — live cursor ticks in the editor gutter, see [§7](#7-signature-element--presence-rail) |
| Output panel, AI Analysis panel, and Chat all compete for the same vertical space below the editor | Scrolling to find AI feedback while output is also open | Tabbed activity rail on the right; editor stays full-height |
| Flat card borders everywhere at equal weight | No focal point — owner badge, connection status, and a code comment all look equally important | 2px hairline by default; only the *active* surface gets the offset hard-shadow treatment |
| Hard-coded "MAX 4 PLAYERS" copy styled like a stat/badge | Reads as a marketing callout inside a product screen | Moved to room-creation copy only; in-room UI shows live count, not a sales line |

---

## 3. Design System

### 3.1 Color Palette

Dark base, two signal colors, everything else desaturated. No more than two saturated hues on screen at once.

| Token | Hex | Role |
|---|---|---|
| `--ink` | `#0B0D12` | Page background |
| `--surface` | `#13161D` | Panel / rail background |
| `--surface-raised` | `#1B1F29` | Cards, inputs, editor tabs |
| `--surface-hover` | `#222733` | Hover state on raised surfaces |
| `--line` | `#262B36` | Default hairline border |
| `--line-strong` | `#363D4B` | Emphasized border (active tab, focused input) |
| `--text` | `#EDEFF3` | Primary text |
| `--text-dim` | `#A7ADBB` | Secondary text |
| `--muted` | `#5C6373` | Tertiary text, placeholders, line numbers |
| `--accent` | `#6FF0BD` | Mint — "you," live/connected, primary actions |
| `--accent-dim` | `#173B30` | Mint at low opacity for backgrounds/badges |
| `--accent-2` | `#B79CFF` | Violet — owner, AI, secondary actions |
| `--accent-2-dim` | `#2A2347` | Violet at low opacity for backgrounds/badges |
| `--warn` | `#FFB454` | Caution, pending states |
| `--danger` | `#FF6B6B` | Destructive, errors, disconnected |
| `--success` | `#6FF0BD` | Reuses accent — success and "live" share meaning intentionally |

Player cursor colors (assigned round-robin per session, never reused within a room):

| Slot | Hex | Name |
|---|---|---|
| 1 | `#6FF0BD` | Mint |
| 2 | `#B79CFF` | Violet |
| 3 | `#FFB454` | Amber |
| 4 | `#7BB8FF` | Sky |

> Rule: badge/status color vocabulary is capped at five meanings (you, owner, warn, danger, neutral). Anything beyond that uses `--text-dim` and a text label instead of inventing a sixth color.

### 3.2 Typography

Two-family system. Mono is earned here — it's a code product — but only for things that *are* code, data, or short labels. Long-form text (chat, AI explanations) uses a humanist sans so paragraphs stay readable.

| Role | Family | Weight | Size | Tracking |
|---|---|---|---|---|
| Editor code | JetBrains Mono | 400/500 | 14px | 0 |
| UI labels / eyebrows | JetBrains Mono | 500 | 11px | +0.06em, uppercase |
| Buttons | JetBrains Mono | 600 | 13px | +0.02em |
| Stat numbers (player count, session id) | JetBrains Mono | 600 | 14–16px | 0 |
| Page / section headings | Inter | 700 | 20–28px | -0.01em |
| Body / chat / AI analysis prose | Inter | 400–500 | 14px | 0 |
| Secondary / meta text | Inter | 400 | 12px | 0 |

Rationale: the old UI set *headings, body, chat, and buttons* all in one pixel display face. That face is fine as a one-off accent (e.g. the empty-state wordmark) but fails at 12–13px body sizes — the redesign reserves mono for places where its "this is data/code" connotation is true, and lets Inter carry everything meant to be read in sentences.

### 3.3 Shadows & Elevation

Neo-brutalist hard-offset shadow, used sparingly — only on the *one* currently-active/focused surface, not on every card.

| Token | Value | Usage |
|---|---|---|
| `--shadow-flat` | none | Default panel — flat, just a hairline border |
| `--shadow-active` | `2px 2px 0 0 var(--accent)` | The focused editor tab, the primary CTA, your own player row |
| `--shadow-active-violet` | `2px 2px 0 0 var(--accent-2)` | Owner-only controls, AI panel header |
| `--shadow-pop` | `0 8px 24px -4px rgba(0,0,0,0.5)` | Floating elements: toasts, dropdowns, modals |

### 3.4 Spacing & Radius

| Token | Value |
|---|---|
| `--radius-sm` | `4px` — inputs, chips, inline buttons |
| `--radius-md` | `8px` — cards, panels |
| `--radius-lg` | `14px` — modals |
| `--space-unit` | `4px` base grid (4/8/12/16/24/32/48) |
| Session rail width | `280px` (collapsible to `0`, icon-rail at `64px`) |
| Activity rail width | `360px` |
| Editor min-width | `560px` before activity rail auto-collapses |
| Page max-width (landing only) | `1280px` |

### 3.5 Buttons

| Class | Background | Border | Text | Use |
|---|---|---|---|---|
| `.btn-primary` | `--accent` | none | `--ink` (dark text on mint) | Run, Create Room, primary CTA |
| `.btn-secondary` | `--surface-raised` | `1px solid --line-strong` | `--text` | Join Room, secondary actions |
| `.btn-ai` | `--accent-2` | none | `--ink` | Analyze / AI actions |
| `.btn-ghost` | transparent | `1px solid --line` | `--text-dim` | Tertiary, icon buttons |
| `.btn-danger` | transparent | `1px solid --danger` | `--danger` | Leave room, remove player, delete |

All buttons: `--radius-sm`, 13px JetBrains Mono 600, 10px/16px padding, `--shadow-active` only on `:focus-visible` and the single "primary" button per view — not on every button, to avoid the old UI's everything-is-shouting effect.

### 3.6 Status & Badges

| Badge | Background | Text color | Meaning |
|---|---|---|---|
| `LIVE` / `CONNECTED` | `--accent-dim` | `--accent` | Active connection |
| `OWNER` | `--accent-2-dim` | `--accent-2` | Room host |
| `MEMBER` | transparent, `1px solid --line` | `--text-dim` | Non-host player |
| `YOU` | `--surface-raised` | `--text` | Self-identifier, no color — deliberately quiet |
| `RECONNECTING` | transparent, `1px solid --warn` | `--warn` | Connection retry |
| `OFFLINE` | transparent, `1px solid --danger` | `--danger` | Disconnected |

---

## 4. Screen Map

```
Landing / Create-Join  (unauthenticated entry)
        │
        ▼
   Room Workspace ─────┬──── Session Rail (players, chat)
        │               ├──── Editor (center, full height)
        │               └──── Activity Rail (tabs: Output · AI Analysis)
        │
        ├──▶ Run          → Output tab auto-opens
        ├──▶ Analyze       → AI Analysis tab auto-opens
        ├──▶ Invite        → Share-link modal
        └──▶ Leave         → confirm → back to Landing
```

---

## 5. Screen Specs

### 5.1 Landing / Create-Join

Replaces the current pixel-font hero with a calmer, content-first entry screen.

- **Header row** — wordmark (Inter 700, 18px, no icon-soup) left; theme toggle right. No giant centered logo treatment.
- **Two-column layout above 960px:**
  - **Left** — one-line product statement ("Code together, in real time.") in Inter 28px, plus three quiet feature notes as a simple list (not icon-card grid): real-time sync, AI analysis, sandboxed execution. Each note is one line — no decorative icon tiles.
  - **Right** — the form, in a `--surface` card with `--radius-md` and `--shadow-flat`:
    - Display name input
    - Language select
    - `Create Room` — `.btn-primary`, full width
    - `Join Room` — `.btn-secondary`, full width, opens a session-code field inline rather than a separate screen
- Removed: the badge-style "MAX 4 PLAYERS PER ROOM" pill as a hero callout (moved to helper text under the form, 12px `--text-dim`) and the 4-tile feature-icon grid (replaced by the inline list above — four icon cards for three sentences of information was disproportionate chrome for the content).

### 5.2 Room Workspace (primary screen)

Three-pane layout, editor-first:

```
┌─ Session Rail (280px) ─┬──────── Editor (flex) ────────┬─ Activity Rail (360px) ─┐
│ Session ABC123  [copy] │ [tab: file.js ●] [+ new tab]  │ [Output] [AI Analysis]  │
│ ● Connected   2/4      │ ────────────────────────────  │ ──────────────────────  │
│ ─────────────────────  │  1  // welcome comment         │  (tab content)          │
│ PLAYERS                │  2                              │                         │
│  ● dev_2  OWNER  ▸     │  3  console.log(...)           │                         │
│  ● dev_1  YOU          │  4 ▍│ ← presence rail ticks     │                         │
│ ─────────────────────  │                                 │                         │
│ CHAT                   │                                 │                         │
│  [messages...]         │                                 │                         │
│  [type a message...]   │                                 │                         │
└─────────────────────────┴────────────────────────────────┴─────────────────────────┘
   Top bar (full width): Session ID · status · language · Run · Analyze · avatar · Leave
```

**Top bar** — single row, all controls at equal height (current UI scatters status pills at different sizes/paddings):
- Left: session code (mono, copy-on-click), connection status dot + label
- Center: language indicator, save status ("Saved" in `--text-dim`, no checkmark icon needed at this size)
- Right: `Run` (`.btn-primary`), `Analyze` (`.btn-ai`), self avatar + name, `Leave` (`.btn-ghost`)

**Session rail** — collapsible. Players list shows: color-coded presence dot (matches their cursor color), name, role badge, and a typing indicator (three-dot pulse, mono-spaced, replaces nothing visual — it's new). Below the fold: chat, restyled — see [§6.4](#64-chat-panel).

**Editor** — full height is the point. File tabs sit directly above the code area, not in a separate "2 PLAYERS" sub-header bar competing with the file tab bar (current UI has two stacked tab-like rows — player tabs *and* a "2 players" label *and* file content — redesign merges player-context into hover/click on the presence rail instead of a permanent second tab row).

**Activity rail** — `Output` and `AI Analysis` become tabs, not two independently-collapsible accordion sections stacked under the editor. This is the single highest-impact structural change: in the current UI, opening AI Analysis pushes Output off-screen and you lose your code's run result while reading feedback. Tabs let both exist without scroll-fighting, and a small unread dot appears on `AI Analysis` when a result lands while you're viewing `Output`.

### 5.3 Share / Invite Modal

Triggered from a new `Invite` icon button in the top bar (not present in current UI — currently the only way to get someone into a room is reading the session code off the corner pill).

- Session code, large, mono, with one-click copy
- Direct join link, same treatment
- QR code optional toggle (small, secondary — useful for in-person pairing sessions)

### 5.4 Empty / Loading States

- **No output yet:** single line, `--text-dim`, "Run your code to see output here." — no icon illustration; the old UI's "▶ run to execute" message is kept in spirit but typography-only, consistent with the rest of the redesign's restraint.
- **AI Analysis idle:** "Run Analyze to get feedback on the current file." Same treatment.
- **Reconnecting:** top bar status dot switches to `--warn`, label changes to `RECONNECTING`, non-blocking — editor stays editable offline and syncs on reconnect.

---

## 6. Component Library

### 6.1 Session Rail — Player Row

```
┌────────────────────────────────┐
│ ● dev_2          OWNER         │   ● = presence dot, cursor-color matched
│   typing…                      │   typing indicator: muted, mono, 11px
└────────────────────────────────┘
```
Your own row gets `--shadow-active` (mint offset) — quiet but findable at a glance, replacing the old UI's `YOU` badge as the *only* self-indicator (badge is kept too, but the shadow does the heavy lifting visually).

### 6.2 Editor Tabs

File tabs sit flush above the code pane. Active tab: `--surface-raised` background, `--line-strong` bottom border in `--accent`. Inactive tabs: `--text-dim`, no border. Unsaved-change state: small mint dot, not an asterisk (matches the dot vocabulary used everywhere else — cursor presence, connection status, unread).

### 6.3 Output / AI Analysis Tab Bar

```
[ Output ● ]  [ AI Analysis ]
```
Selected tab: `--text`, `--line-strong` underline in the tab's own accent (mint for Output/run-state, violet for AI). Unread dot only appears on the *inactive* tab when new content arrives.

### 6.4 Chat Panel

Current UI's chat bubbles are uniform pixel-font system messages and user messages with no visual distinction. Redesign:
- **System messages** (joins/leaves/room events): `--muted`, 12px Inter, no bubble — sits flush left as a log line, de-emphasized since it's not conversation
- **User messages**: bubble in `--surface-raised`, sender name in their cursor color (small, 11px mono, above the bubble), message body in Inter 14px — this is prose people are reading quickly, so it should not be set in the code font
- Input: fixed bottom, `--surface-raised`, character counter only appears within 20 characters of the limit (not permanently visible at `0/200` as in current UI — reduces constant low-priority noise)

### 6.5 AI Analysis Result Card

Structured, scannable — current UI already does section headers well (Issue Detected / Suggested Fix / Explanation / Improvement Suggestions); the redesign keeps that structure and improves the type:
- Section labels: mono 11px uppercase `--accent-2` (ties to the AI/violet meaning established in §3.6)
- Body: Inter 14px `--text`, 1.6 line-height for readability of longer explanations
- Improvement suggestions: real list items with mono'd inline code terms (`` `console.log` ``-style spans get `--surface-raised` background + `--radius-sm`), not bold-as-bullet-label which is harder to scan

### 6.6 Toasts

Single variant family, bottom-right, `--shadow-pop`:
| Variant | Left border | Icon color |
|---|---|---|
| Success | `--accent` | `--accent` |
| Error | `--danger` | `--danger` |
| Info | `--accent-2` | `--accent-2` |

Replaces current UI's full-width top banner (`CODE EXECUTED SUCCESSFULLY!`) which interrupts the top bar layout and shifts content down when it appears — toasts overlay instead of reflowing the page.

---

## 7. Signature Element — Presence Rail

The one thing this redesign should be remembered for.

**Problem it solves:** in the current UI, "who's where" lives only in a static player list in the sidebar. You can't tell where a collaborator's cursor actually is without them saying so in chat. For a product whose entire value proposition is *real-time shared editing*, that's the single biggest missed opportunity in the interface.

**What it is:** a 6px-wide strip running the full height of the editor gutter, just left of the line numbers. Each collaborator gets a short horizontal tick at the line their cursor currently sits on, in their assigned cursor color. Hovering a tick shows their name in a small mono tooltip. If two people are on the same line, ticks stack with a 2px offset rather than overlapping.

```
 │▍  1   // Welcome comment
 │   2
 │▍  3   console.log("hi");
 │   4   ← dev_1 cursor here
```

This turns the abstract "2/4 players" counter in the top bar into something spatial: you glance left, you see exactly where in the file everyone is working, before you've read a single chat message. It's a small amount of UI for a large amount of signal, which is the right trade for a feature that defines the product.

Implementation note: this is purely a rendering layer on top of existing cursor-position data already required for any collaborative editor (CRDT/OT cursor awareness) — no new data model needed, only new pixels.

---

## 8. Motion

Restrained, on purpose — the old UI's glow/scanline aesthetic suggested constant motion; the redesign uses motion only to communicate state change, not atmosphere.

| Interaction | Motion |
|---|---|
| Presence tick appears/moves | 120ms ease-out position transition — feels alive without being distracting |
| Tab switch (Output ↔ AI Analysis) | 100ms crossfade, no slide |
| Toast enter/exit | 160ms translate + fade from bottom-right |
| Run button while executing | Label swaps to "Running…" with a 3-dot mono pulse — no spinner icon, stays in the type system |
| Typing indicator | 3-dot pulse, 900ms loop, `--muted` |
| Reduced motion | All of the above collapse to opacity-only transitions when `prefers-reduced-motion` is set |

---

## 9. Responsive Behavior

| Breakpoint | Behavior |
|---|---|
| `≥1280px` | Full 3-pane layout as specified |
| `960–1279px` | Activity rail narrows to `300px`; session rail stays `280px` |
| `720–959px` | Session rail collapses to a `64px` icon rail (avatars only, click to expand as an overlay); activity rail becomes a bottom sheet, toggled by tab buttons in the top bar |
| `<720px` | Single-column: editor full-screen by default; players, chat, output, and AI analysis become a tabbed bottom sheet reachable via a persistent bottom tab bar (Editor · Players · Chat · Output · AI) |

The landing screen's two-column layout stacks to single column under `840px`, form first, product statement below it (people who land directly on a join link want the form immediately, not a sales pitch first).

---

## 10. Accessibility Floor

- All status communicated by color (connected/owner/warning/danger) is paired with a text label or icon — never color alone
- Visible `:focus-visible` ring (`2px solid --accent`, `2px offset`) on every interactive element, including chat input, tabs, and presence ticks
- Color contrast: body text `--text` on `--ink`/`--surface` exceeds WCAG AA (4.5:1) at all defined sizes; `--muted` is reserved for non-essential metadata only, never for content the user must read
- Presence rail ticks include a text-based fallback in the player list (current line number per player) for screen reader users, since the rail itself is a visual-only enhancement
- `prefers-reduced-motion` respected globally per [§8](#8-motion)
- Keyboard: full room workspace operable without a mouse — tab order follows top bar → session rail → editor → activity rail

---

## 11. Build Notes

- Recommended stack: Next.js 15 (App Router) + Tailwind CSS v4, matching the rest of the portfolio/tooling work already in progress
- Fonts: JetBrains Mono (self-hosted or `next/font`), Inter (`next/font/google`) — avoid pixel/bitmap web fonts entirely, they're the single biggest legibility regression in the current UI at body-text sizes
- Cursor-color assignment: deterministic by join order within a session (slot 1–4 from the palette in [§3.1](#31-color-palette)), not random, so a given player's color stays stable across a reconnect
- All color tokens above should ship as CSS custom properties on `:root` (dark is the only theme initially; the light-mode toggle visible in current screenshots can map onto the same token names with a separate light palette in a follow-up pass — out of scope for this document)
- Component naming should mirror this doc's section numbers in code comments where practical, to keep design and implementation traceable to each other

---

*Document prepared as a UI redesign specification for the Collaborative Platform product — companion to `crackle-extension-system-design.md`, written for an autonomous coding agent or developer handoff.*
