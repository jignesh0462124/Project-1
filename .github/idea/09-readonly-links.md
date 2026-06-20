# 🔗 Feature 09 — Shareable Read-Only Room Links

> **Tier:** 2 — Great Addition
> **Effort:** Low-Medium (~4–6 hours)
> **Dependencies:** None
> **Unlocks:** Live coding demos, teaching, streaming

---

## What & Why

Teachers and streamers need to share their live coding screen without giving viewers edit access. A read-only link lets anyone watch code evolve in real time — like a live demo — without being counted as a room member or being able to type.

---

## Implementation — Step by Step

### Part 1 — Read-Only URL Scheme

Use a simple query parameter approach:

```
Normal room:    /room/ABC12345
Read-only view: /room/ABC12345?view=readonly
```

No backend changes needed for the URL itself — the query param is handled client-side.

---

### Part 2 — Detect Read-Only Mode in Editor

**Step 2.1** — In `client/src/pages/Editor.jsx`, detect the `view` query param:

```jsx
import { useSearchParams } from 'react-router-dom';

const [searchParams] = useSearchParams();
const isReadOnly = searchParams.get('view') === 'readonly';
```

**Step 2.2** — Pass `isReadOnly` to the Monaco Editor:
```jsx
<MonacoEditor
  value={code}
  options={{
    readOnly: isReadOnly,
    // ... existing options
  }}
/>
```

**Step 2.3** — In read-only mode:
- Hide the Run Code button
- Hide the Submit button
- Hide the Save Snippet button
- Hide the chat input (can still read chat)
- Hide user management controls
- Show a "👁️ Viewing" banner instead of the normal header

---

### Part 3 — Socket.io Viewer Mode

Read-only viewers still need to receive live code and language updates. They should join the room as "viewers" — not counted in the 4-user limit.

**Step 3.1** — In `server/index.js`, update `join-room` handler:

```js
socket.on('join-room', async ({ roomId, username, language, isViewer = false }) => {
  const room = rooms.get(roomId);

  if (isViewer) {
    // Viewers join the socket room but are NOT added to the users list
    socket.join(roomId);
    socket.isViewer = true;
    // Send current state
    socket.emit('room-joined', {
      users: room?.users || [],
      code: room?.code || '',
      language: room?.language || language,
      roomId,
      isViewer: true,
    });
    return; // Skip the rest of join logic
  }

  // ... existing join logic for regular users
});
```

**Step 3.2** — Block viewers from emitting editing events:
```js
// Add a guard at the top of sensitive event handlers
socket.on('code-change', ({ roomId, code }) => {
  if (socket.isViewer) return; // Viewers cannot edit
  // ... rest of handler
});
```

---

### Part 4 — Viewer Join from Client

**Step 4.1** — In `Editor.jsx`, when joining the room, pass `isViewer` if read-only:

```jsx
useEffect(() => {
  socket.emit('join-room', {
    roomId,
    username: isReadOnly ? `viewer-${Math.random().toString(36).slice(2, 6)}` : username,
    language: defaultLanguage,
    isViewer: isReadOnly,
  });
}, []);
```

---

### Part 5 — Read-Only Banner & Share Button

**Step 5.1** — Create `client/src/components/ReadOnlyBanner.jsx`:

```jsx
export default function ReadOnlyBanner({ roomId }) {
  const copyLink = () => {
    const url = `${window.location.origin}/room/${roomId}?view=readonly`;
    navigator.clipboard.writeText(url);
    // Show toast: "Read-only link copied!"
  };

  return (
    <div className="readonly-banner">
      👁️ <strong>View-only mode</strong> — you can watch but not edit
    </div>
  );
}
```

**Step 5.2** — In the room owner's view (`RoomHeader.jsx`), add a **Share View Link** button:

```jsx
const handleShareViewLink = () => {
  const url = `${window.location.origin}/room/${roomId}?view=readonly`;
  navigator.clipboard.writeText(url);
  toast.success('Read-only link copied to clipboard!');
};

// In JSX:
<button onClick={handleShareViewLink} title="Share a read-only view of this room">
  🔗 Share View Link
</button>
```

---

### Part 6 — Viewer Count Display

**Step 6.1** — In `server/index.js`, track viewers separately:
```js
if (isViewer) {
  room.viewers = (room.viewers || 0) + 1;
  io.to(roomId).emit('viewer-count-update', { viewers: room.viewers });
}
```

**Step 6.2** — On disconnect:
```js
socket.on('disconnect', () => {
  if (socket.isViewer && socket.roomId) {
    const room = rooms.get(socket.roomId);
    if (room) room.viewers = Math.max(0, (room.viewers || 1) - 1);
    io.to(socket.roomId).emit('viewer-count-update', { viewers: room?.viewers || 0 });
  }
});
```

**Step 6.3** — In `RoomHeader.jsx`, show viewer count:
```jsx
{viewerCount > 0 && <span className="viewer-count">👁️ {viewerCount} watching</span>}
```

---

### Part 7 — Testing Checklist

- [ ] Open `/room/ABC?view=readonly` — Monaco is read-only
- [ ] Read-only user does NOT appear in the user list
- [ ] Read-only user sees live code updates in real time
- [ ] Read-only user can see chat but cannot send messages
- [ ] Owner sees viewer count increment when a viewer joins
- [ ] "Share View Link" button copies the correct URL
- [ ] Viewer is not counted against the 4-user room limit
- [ ] Viewer disconnecting does not trigger "user left" notification

---

## Files Changed / Created

| File | Action |
|---|---|
| `client/src/pages/Editor.jsx` | MODIFY (detect isReadOnly, pass to socket + Monaco) |
| `client/src/components/ReadOnlyBanner.jsx` | NEW |
| `client/src/components/RoomHeader.jsx` | MODIFY (add Share View Link button, viewer count) |
| `server/index.js` | MODIFY (viewer mode in join-room, viewer count tracking) |
