# 🎨 Feature 05 — Whiteboard / Drawing Mode

> **Tier:** 1 — High Impact
> **Effort:** Medium (~1.5 days)
> **Dependencies:** None (standalone panel)
> **Unlocks:** Better teaching and interview sessions

---

## What & Why

Code editors alone can't express everything. Interviewers and teachers constantly need to draw:
- Binary trees, linked lists, graphs
- System architecture diagrams
- Algorithm flowcharts
- Data structure visualizations

This feature embeds a **collaborative whiteboard** using [Excalidraw](https://github.com/excalidraw/excalidraw) — an open-source, collaborative drawing tool with a React component.

---

## Implementation — Step by Step

### Part 1 — Install Excalidraw

**Step 1.1** — Install in the client:
```bash
cd client
npm install @excalidraw/excalidraw
```

> **Note:** Excalidraw has a large bundle size (~2MB). Use dynamic import to lazy-load it.

---

### Part 2 — Create Whiteboard Component

**Step 2.1** — Create `client/src/components/Whiteboard.jsx`:

```jsx
import { lazy, Suspense, useState, useCallback, useEffect } from 'react';

// Lazy load to avoid blocking initial page render
const Excalidraw = lazy(() =>
  import('@excalidraw/excalidraw').then(mod => ({ default: mod.Excalidraw }))
);

export default function Whiteboard({ socket, roomId, username }) {
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);

  // Receive whiteboard updates from other users
  useEffect(() => {
    if (!socket) return;

    socket.on('whiteboard-update', ({ elements, appState }) => {
      if (excalidrawAPI) {
        excalidrawAPI.updateScene({ elements });
      }
    });

    return () => socket.off('whiteboard-update');
  }, [socket, excalidrawAPI]);

  // Broadcast whiteboard changes to other users (debounced)
  const handleChange = useCallback((elements, appState) => {
    if (!socket) return;
    socket.emit('whiteboard-change', {
      roomId,
      elements,
      // Don't send full appState — only elements needed for sync
    });
  }, [socket, roomId]);

  return (
    <div className="whiteboard-container" style={{ width: '100%', height: '100%' }}>
      <Suspense fallback={<div className="loading">Loading whiteboard…</div>}>
        <Excalidraw
          ref={setExcalidrawAPI}
          onChange={handleChange}
          UIOptions={{
            canvasActions: {
              changeViewBackgroundColor: false,
            },
          }}
          theme="dark"
        />
      </Suspense>
    </div>
  );
}
```

---

### Part 3 — Add Whiteboard Socket Events

**Step 3.1** — In `server/index.js`, add whiteboard sync events:

```js
// Whiteboard sync — broadcast to room (exclude sender)
socket.on('whiteboard-change', ({ roomId, elements }) => {
  // Throttle: only broadcast if enough time passed (avoid flooding)
  socket.to(roomId).emit('whiteboard-update', { elements });

  // Store latest whiteboard state in room memory for late joiners
  const room = rooms.get(roomId);
  if (room) room.whiteboardElements = elements;
});
```

**Step 3.2** — When a user joins, send them the current whiteboard state:
```js
socket.on('join-room', ({ roomId, ... }) => {
  // ... existing join logic ...
  const room = rooms.get(roomId);
  if (room?.whiteboardElements) {
    socket.emit('whiteboard-sync', { elements: room.whiteboardElements });
  }
});
```

**Step 3.3** — In the client `Whiteboard.jsx`, listen for `whiteboard-sync`:
```js
socket.on('whiteboard-sync', ({ elements }) => {
  if (excalidrawAPI) excalidrawAPI.updateScene({ elements });
});
```

---

### Part 4 — Add Whiteboard Tab to Editor Layout

**Step 4.1** — In `Editor.jsx`, add a tab switcher between "Code" and "Whiteboard" view:

```jsx
const [activeView, setActiveView] = useState('code'); // 'code' | 'whiteboard'

// In JSX:
<div className="view-tabs">
  <button
    className={activeView === 'code' ? 'active' : ''}
    onClick={() => setActiveView('code')}
  >
    💻 Code
  </button>
  <button
    className={activeView === 'whiteboard' ? 'active' : ''}
    onClick={() => setActiveView('whiteboard')}
  >
    🎨 Whiteboard
  </button>
</div>

{activeView === 'code' && <MonacoEditor ... />}
{activeView === 'whiteboard' && (
  <Whiteboard socket={socket} roomId={roomId} username={username} />
)}
```

**Step 4.2** — Alternatively, show both side-by-side on large screens using a splitter panel.

---

### Part 5 — Export Whiteboard as Image

**Step 5.1** — Add an "Export" button that calls Excalidraw's export utility:

```jsx
import { exportToBlob } from '@excalidraw/excalidraw';

const handleExport = async () => {
  const elements = excalidrawAPI.getSceneElements();
  const appState = excalidrawAPI.getAppState();
  const blob = await exportToBlob({
    elements,
    appState,
    mimeType: 'image/png',
  });
  // Download the image
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `whiteboard-${roomId}.png`;
  a.click();
};
```

---

### Part 6 — Throttle Broadcast (Performance)

**Step 6.1** — Whiteboard changes fire very frequently. Throttle the socket emit to at most once per 100ms:

```js
import { useRef } from 'react';

const broadcastTimer = useRef(null);

const handleChange = useCallback((elements) => {
  clearTimeout(broadcastTimer.current);
  broadcastTimer.current = setTimeout(() => {
    socket.emit('whiteboard-change', { roomId, elements });
  }, 100);
}, [socket, roomId]);
```

---

### Part 7 — Testing Checklist

- [ ] Open whiteboard in two browser tabs in the same room
- [ ] Draw on one tab — shapes appear on the other within 200ms
- [ ] Join a room that already has whiteboard content — content syncs immediately
- [ ] Whiteboard is in dark theme matching the editor
- [ ] Export button downloads a PNG of the current whiteboard
- [ ] Switching tabs (Code ↔ Whiteboard) does not clear the canvas
- [ ] Whiteboard loads lazily — no performance hit on initial page load

---

## Files Changed / Created

| File | Action |
|---|---|
| `client/src/components/Whiteboard.jsx` | NEW |
| `client/src/pages/Editor.jsx` | MODIFY (add view tabs, render Whiteboard) |
| `server/index.js` | MODIFY (whiteboard-change, whiteboard-sync events) |
| `client/package.json` | MODIFY (`@excalidraw/excalidraw` dependency) |
