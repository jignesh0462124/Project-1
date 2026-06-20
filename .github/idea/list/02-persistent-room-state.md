# 💾 Feature 02 — Persistent Room State (Database)

> **Tier:** 1 — High Impact
> **Effort:** Medium (~2 days)
> **Dependencies:** Feature 01 (Supabase Auth)
> **Unlocks:** Features 03, 07, 20

---

## What & Why

Currently all room state (code, language, users, chat, solved problems) lives in the Node.js server's memory as a JavaScript `Map`. When the server restarts, **everything is lost**. Users who disconnect and reconnect lose their progress.

Persisting room state to Supabase means:
- Rooms survive server restarts
- Users can reconnect to an ongoing session
- Chat history is visible to late joiners
- Code is saved automatically

---

## Implementation — Step by Step

### Part 1 — Database Tables

**Step 1.1** — Run `backend/migrations/001_initial_schema.sql` in the Supabase SQL Editor if not already done. This creates the `rooms`, `room_members`, `chat_messages`, and `code_snapshots` tables.

**Step 1.2** — Verify tables exist in Supabase dashboard → Table Editor.

---

### Part 2 — Server-Side Room Service

**Step 2.1** — Create `server/services/roomService.js` (copy from `backend/services/roomService.js` and adjust import paths to work with the existing server setup):

```js
// server/services/roomService.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function createRoom(roomId, ownerId, language = 'javascript') {
  const { data, error } = await supabase.from('rooms').insert({
    id: roomId,
    owner_id: ownerId,
    language,
    code: '',
    is_active: true,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  }).select().single();
  return { data, error };
}

export async function getRoom(roomId) {
  return supabase.from('rooms').select('*').eq('id', roomId).single();
}

export async function updateRoomCode(roomId, code, language) {
  return supabase.from('rooms')
    .update({ code, language, updated_at: new Date().toISOString() })
    .eq('id', roomId);
}

export async function saveChatMessage(roomId, userId, username, message) {
  return supabase.from('chat_messages').insert({
    room_id: roomId,
    user_id: userId,
    username,
    message,
  });
}

export async function getChatHistory(roomId, limit = 50) {
  return supabase.from('chat_messages')
    .select('username, message, created_at')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true })
    .limit(limit);
}

export async function closeRoom(roomId) {
  return supabase.from('rooms')
    .update({ is_active: false })
    .eq('id', roomId);
}
```

---

### Part 3 — Integrate with Socket.io Events

**Step 3.1** — In `server/index.js`, import the room service:
```js
import {
  createRoom, getRoom, updateRoomCode,
  saveChatMessage, getChatHistory, closeRoom
} from './services/roomService.js';
```

**Step 3.2** — On `join-room` socket event, load existing state from DB if the room already exists:
```js
socket.on('join-room', async ({ roomId, username, language }) => {
  // Check if room exists in DB
  const { data: existingRoom } = await getRoom(roomId);

  if (!existingRoom) {
    // Create new room in DB
    await createRoom(roomId, socket.user?.id, language);
  } else {
    // Send existing code/language to the joining user
    socket.emit('room-joined', {
      code: existingRoom.code,
      language: existingRoom.language,
      roomId,
      // ...existing users from in-memory store
    });
  }
  // ... rest of existing join-room logic
});
```

**Step 3.3** — On `code-change`, debounce and save to DB:
```js
// Debounce helper (add at top of server file)
const debounceTimers = new Map();
function debounce(key, fn, delay = 2000) {
  clearTimeout(debounceTimers.get(key));
  debounceTimers.set(key, setTimeout(fn, delay));
}

socket.on('code-change', async ({ roomId, code }) => {
  // Existing broadcast logic
  socket.to(roomId).emit('code-updated', { code });

  // Persist to DB with debounce (save max once every 2s per room)
  debounce(`code-${roomId}`, () => {
    const room = rooms.get(roomId);
    updateRoomCode(roomId, code, room?.language || 'javascript');
  }, 2000);
});
```

**Step 3.4** — On `chat-message`, save to DB:
```js
socket.on('chat-message', async ({ roomId, username, message }) => {
  // Existing broadcast
  io.to(roomId).emit('chat-received', { username, message, timestamp: Date.now() });

  // Persist message
  await saveChatMessage(roomId, socket.user?.id, username, message);
});
```

**Step 3.5** — On new user joining, send them the last 50 chat messages:
```js
// After join-room, inside the join handler
const { data: history } = await getChatHistory(roomId, 50);
if (history?.length) {
  socket.emit('chat-history', { messages: history });
}
```

**Step 3.6** — When the last user leaves a room, mark it inactive in the DB instead of immediately deleting it.

---

### Part 4 — Client: Receive Chat History

**Step 4.1** — In `client/src/pages/Editor.jsx`, listen for `chat-history`:
```js
socket.on('chat-history', ({ messages }) => {
  // Prepend historical messages to the chat state array
  setMessages(prev => [...messages.map(m => ({
    username: m.username,
    message: m.message,
    timestamp: new Date(m.created_at).getTime(),
    isHistory: true,
  })), ...prev]);
});
```

**Step 4.2** — In `ChatPanel.jsx`, display a "--- chat history ---" divider above historical messages.

---

### Part 5 — Periodic Code Snapshots (Optional Enhancement)

**Step 5.1** — On the server, save a snapshot every 5 minutes for active rooms:
```js
setInterval(async () => {
  for (const [roomId, roomState] of rooms.entries()) {
    if (roomState.code) {
      await supabase.from('code_snapshots').insert({
        room_id: roomId,
        code: roomState.code,
        language: roomState.language,
      });
    }
  }
}, 5 * 60 * 1000);
```

---

### Part 6 — Environment Variables

**Step 6.1** — Add to `server/.env`:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

### Part 7 — Testing Checklist

- [ ] Create a room, type code, then restart the server
- [ ] Re-join the same room — code is restored from DB
- [ ] Send chat messages, have a new user join — they see chat history
- [ ] Leave a room and re-join — language is preserved
- [ ] Room is marked `is_active: false` when empty for >5 min

---

## Files Changed / Created

| File | Action |
|---|---|
| `server/services/roomService.js` | NEW |
| `server/index.js` | MODIFY (use roomService in Socket events) |
| `server/.env` / `.env.example` | MODIFY (add Supabase keys) |
| Supabase SQL Editor | RUN migrations 001 + 002 |
