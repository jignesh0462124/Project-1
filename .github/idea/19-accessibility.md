# ♿ Feature 19 — Accessibility (A11y) Improvements

> **Tier:** 3 — Nice to Have
> **Effort:** Medium (~2 days, mostly audit + fix)
> **Dependencies:** None
> **Unlocks:** WCAG compliance, screen reader users, keyboard-only users

---

## What & Why

Accessibility is a requirement for professional tools. Users with visual impairments, motor limitations, or who prefer keyboard navigation are excluded from the platform as-is. Fixing this also improves SEO and makes the codebase more maintainable.

---

## Implementation — Step by Step

### Part 1 — Audit Current State

**Step 1.1** — Install the Axe accessibility browser extension (Chrome/Firefox) and run it on every page.

**Step 1.2** — Run automated audit:
```bash
cd client
npm install -D @axe-core/react
```

Add to `main.jsx` (development only):
```js
if (import.meta.env.DEV) {
  const axe = await import('@axe-core/react');
  const React = await import('react');
  const ReactDOM = await import('react-dom');
  axe.default(React.default, ReactDOM.default, 1000);
}
```

**Step 1.3** — Common issues to look for:
- Missing `alt` text on images
- Buttons with no accessible text (icon-only)
- Form inputs with no labels
- Color contrast below 4.5:1 ratio
- Focus not visible when tabbing
- Modals not trapping focus

---

### Part 2 — Semantic HTML

**Step 2.1** — Use proper semantic elements throughout:

```jsx
// Before (bad)
<div onClick={handleRun} className="btn">Run</div>

// After (good)
<button type="button" onClick={handleRun}>Run</button>
```

**Step 2.2** — Use `<nav>`, `<main>`, `<header>`, `<aside>`, `<section>`, `<article>` where appropriate.

**Step 2.3** — Use a single `<h1>` per page with correct heading hierarchy (`h1 → h2 → h3`).

---

### Part 3 — ARIA Labels for Icon Buttons

Every icon-only button must have an accessible name:

```jsx
// Before
<button onClick={handleClose}>✕</button>

// After — Option A: aria-label
<button onClick={handleClose} aria-label="Close panel">✕</button>

// After — Option B: visually hidden text
<button onClick={handleClose}>
  <span aria-hidden="true">✕</span>
  <span className="sr-only">Close panel</span>
</button>
```

Add the screen-reader-only utility class to `pixel.css`:
```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

---

### Part 4 — Keyboard Navigation

**Step 4.1** — Ensure all interactive elements are reachable by Tab key.

**Step 4.2** — Add visible focus ring (the platform likely removes the default one):
```css
/* In pixel.css — ensure visible focus for keyboard users */
*:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  border-radius: 4px;
}

/* Remove outline only for mouse clicks, not keyboard */
*:focus:not(:focus-visible) {
  outline: none;
}
```

**Step 4.3** — Keyboard shortcuts for common actions:

```jsx
// In Editor.jsx — global keyboard shortcuts
useEffect(() => {
  const handleKey = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRunCode(); // Ctrl/Cmd+Enter = Run
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(); // Ctrl/Cmd+Shift+Enter = Submit
    }
    if (e.key === 'Escape') {
      setShowScreenshot(false);
      setShowTemplates(false);
      setShowSnippets(false);
    }
  };
  window.addEventListener('keydown', handleKey);
  return () => window.removeEventListener('keydown', handleKey);
}, []);
```

---

### Part 5 — Modal Focus Trap

When a modal opens, focus must be trapped inside it. Users shouldn't be able to Tab to elements behind the modal.

**Step 5.1** — Create `client/src/hooks/useFocusTrap.js`:
```js
import { useEffect, useRef } from 'react';

export function useFocusTrap(isActive) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const focusable = containerRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    const handleTabKey = (e) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    containerRef.current.addEventListener('keydown', handleTabKey);
    first?.focus();

    return () => containerRef.current?.removeEventListener('keydown', handleTabKey);
  }, [isActive]);

  return containerRef;
}
```

**Step 5.2** — Use in every modal:
```jsx
const modalRef = useFocusTrap(isOpen);
<div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="modal-title">
  <h2 id="modal-title">Save Snippet</h2>
  ...
</div>
```

---

### Part 6 — Color Contrast

**Step 6.1** — Check contrast ratios using [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/).

**Step 6.2** — Minimum ratios:
- Normal text: 4.5:1
- Large text (18px+ bold): 3:1
- UI components and icons: 3:1

**Step 6.3** — Fix low-contrast CSS variables in `pixel.css` as needed (e.g., muted text colors on dark backgrounds).

---

### Part 7 — Live Regions for Real-Time Updates

When code is updated by another user or a new chat message arrives, screen readers need to be informed:

```jsx
// Announce real-time updates to screen readers
<div
  aria-live="polite"
  aria-atomic="false"
  className="sr-only"
  id="live-announcer"
/>

// In event handlers:
const announce = (msg) => {
  const el = document.getElementById('live-announcer');
  if (el) el.textContent = msg;
  setTimeout(() => { if (el) el.textContent = ''; }, 1000);
};

socket.on('user-joined', ({ username }) => {
  announce(`${username} joined the room`);
});

socket.on('chat-received', ({ username, message }) => {
  announce(`${username}: ${message}`);
});
```

---

### Part 8 — Reduced Motion

Some users have vestibular disorders — animations can cause nausea. Respect `prefers-reduced-motion`:

```css
/* In pixel.css — at the top */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Also disable confetti for reduced motion users:
```js
import { celebrate } from '../utils/celebrate';

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!prefersReducedMotion) celebrate();
```

---

### Part 9 — Testing Checklist

- [ ] Tab through entire Home page without mouse — all controls reachable
- [ ] Tab through entire Editor — all toolbar buttons reachable
- [ ] Focus ring visible on all interactive elements when using keyboard
- [ ] Modals trap focus correctly (Tab doesn't escape to background)
- [ ] Escape key closes modals
- [ ] All icon-only buttons have `aria-label`
- [ ] Screen reader (NVDA/VoiceOver) announces new chat messages
- [ ] Screen reader announces when a user joins or leaves
- [ ] Ctrl+Enter triggers Run Code
- [ ] Axe browser extension shows zero critical violations on each page
- [ ] Color contrast passes WCAG AA on all text

---

## Files Changed / Created

| File | Action |
|---|---|
| `client/src/hooks/useFocusTrap.js` | NEW |
| `client/src/styles/pixel.css` | MODIFY (focus-visible, sr-only, reduced-motion) |
| `client/src/pages/Editor.jsx` | MODIFY (keyboard shortcuts, live region, ARIA) |
| `client/src/pages/Home.jsx` | MODIFY (semantic HTML, ARIA) |
| `client/src/pages/Login.jsx` | MODIFY (form labels, ARIA) |
| `client/src/components/*.jsx` | MODIFY (aria-label on icon buttons, focus traps) |
