# 🎉 Feature 16 — Confetti / Celebrations

> **Tier:** 3 — Nice to Have
> **Effort:** Very Low (~30–60 minutes)
> **Dependencies:** None
> **Unlocks:** Dopamine hit, longer sessions, fun

---

## What & Why

When a problem is solved, the current experience is a plain toast notification. Adding confetti, a sound effect, and emoji reactions makes solving a problem feel like an actual achievement. Small delight features drive retention — users stay longer and come back.

---

## Implementation — Step by Step

### Part 1 — Install canvas-confetti

**Step 1.1**:
```bash
cd client
npm install canvas-confetti
```

---

### Part 2 — Confetti Utility

**Step 2.1** — Create `client/src/utils/celebrate.js`:

```js
import confetti from 'canvas-confetti';

/**
 * Fire a celebration confetti burst.
 * @param {'normal' | 'epic' | 'side'} type
 */
export function celebrate(type = 'normal') {
  switch (type) {
    case 'epic':
      // Full-screen cannon burst
      const duration = 3000;
      const animationEnd = Date.now() + duration;
      const colors = ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors,
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors,
        });
        if (Date.now() < animationEnd) requestAnimationFrame(frame);
      };
      frame();
      break;

    case 'side':
      // Burst from both sides
      confetti({ particleCount: 80, spread: 70, origin: { x: 0.1, y: 0.6 } });
      confetti({ particleCount: 80, spread: 70, origin: { x: 0.9, y: 0.6 } });
      break;

    case 'normal':
    default:
      // Classic center burst
      confetti({
        particleCount: 120,
        spread: 90,
        origin: { x: 0.5, y: 0.5 },
        colors: ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b'],
        startVelocity: 35,
        gravity: 1.2,
        ticks: 200,
      });
  }
}

/**
 * Celebration specifically for solving a DSA problem.
 */
export function celebrateProblemSolved() {
  celebrate('epic');
}

/**
 * Small celebration for running code successfully.
 */
export function celebrateCodeRun() {
  confetti({
    particleCount: 40,
    spread: 50,
    origin: { x: 0.5, y: 0.7 },
    colors: ['#10b981', '#06b6d4'],
    scalar: 0.8,
  });
}
```

---

### Part 3 — Trigger Confetti on Problem Solved

**Step 3.1** — In `Editor.jsx`, import and call celebrate when the `problem-solved` event fires:

```jsx
import { celebrateProblemSolved } from '../utils/celebrate';

// Inside the socket event listener:
socket.on('problem-solved', ({ problemId, problemTitle, solvedBy, solvedProblems }) => {
  // Existing state updates...
  setRoom(prev => ({ ...prev, solvedProblems }));

  // 🎉 Celebration!
  celebrateProblemSolved();
  toast.success(`🎉 ${solvedBy} solved "${problemTitle}"!`, { duration: 4000 });
});
```

---

### Part 4 — Trigger on Successful Code Run (Optional)

**Step 4.1** — When code runs successfully (no errors), fire a small celebration:

```jsx
import { celebrateCodeRun } from '../utils/celebrate';

// After receiving successful execution result:
const handleRunCode = async () => {
  const result = await runCode(code, language);
  setOutput(result.output);
  if (result.isSuccess) {
    celebrateCodeRun(); // small burst
  }
};
```

---

### Part 5 — Emoji Reaction Burst (Optional Enhancement)

**Step 5.1** — Allow users to send emoji reactions that float up on screen:

**Step 5.2** — Add `client/src/components/EmojiReaction.jsx`:

```jsx
import { useState, useEffect } from 'react';

const EMOJIS = ['🎉', '🔥', '💯', '👏', '🚀', '⭐', '💡', '🎯'];

export default function EmojiReaction({ socket, roomId }) {
  const [floating, setFloating] = useState([]);

  // Receive reactions from other users
  useEffect(() => {
    socket.on('emoji-reaction', ({ emoji, fromUser }) => {
      addFloating(emoji);
    });
    return () => socket.off('emoji-reaction');
  }, [socket]);

  const addFloating = (emoji) => {
    const id = Date.now() + Math.random();
    const x = 20 + Math.random() * 60; // % from left
    setFloating(prev => [...prev, { id, emoji, x }]);
    setTimeout(() => {
      setFloating(prev => prev.filter(f => f.id !== id));
    }, 2500);
  };

  const sendReaction = (emoji) => {
    socket.emit('emoji-reaction', { roomId, emoji });
    addFloating(emoji);
  };

  return (
    <>
      {/* Floating emojis layer */}
      <div className="emoji-float-layer" aria-hidden>
        {floating.map(f => (
          <span
            key={f.id}
            className="emoji-float"
            style={{ left: `${f.x}%` }}
          >
            {f.emoji}
          </span>
        ))}
      </div>

      {/* Reaction buttons */}
      <div className="emoji-reaction-bar">
        {EMOJIS.map(e => (
          <button key={e} onClick={() => sendReaction(e)} className="emoji-btn" title={e}>
            {e}
          </button>
        ))}
      </div>
    </>
  );
}
```

**Step 5.3** — Add to `server/index.js`:
```js
socket.on('emoji-reaction', ({ roomId, emoji }) => {
  socket.to(roomId).emit('emoji-reaction', {
    emoji,
    fromUser: socket.username,
  });
});
```

**Step 5.4** — CSS for floating emojis:
```css
.emoji-float-layer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 100vh;
  pointer-events: none;
  z-index: 9999;
  overflow: hidden;
}

.emoji-float {
  position: absolute;
  bottom: 80px;
  font-size: 2rem;
  animation: floatUp 2.5s ease-out forwards;
}

@keyframes floatUp {
  0%   { transform: translateY(0) scale(1); opacity: 1; }
  100% { transform: translateY(-60vh) scale(0.5); opacity: 0; }
}
```

---

### Part 6 — Testing Checklist

- [ ] Solve a DSA problem → epic confetti fires for all room users
- [ ] Run code successfully → small confetti burst
- [ ] Confetti does not appear for failed runs or wrong answers
- [ ] Emoji reaction buttons visible in editor
- [ ] Send emoji → floats up on screen for all users in the room
- [ ] Reactions don't interfere with clicking editor or chat

---

## Files Changed / Created

| File | Action |
|---|---|
| `client/src/utils/celebrate.js` | NEW |
| `client/src/components/EmojiReaction.jsx` | NEW |
| `client/src/pages/Editor.jsx` | MODIFY (call celebrate on problem-solved, run success) |
| `client/src/styles/pixel.css` | MODIFY (add float-up animation CSS) |
| `server/index.js` | MODIFY (relay emoji-reaction event) |
| `client/package.json` | MODIFY (add canvas-confetti) |
