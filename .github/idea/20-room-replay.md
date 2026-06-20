# 📜 Feature 20 — Room Replay / Playback

> **Tier:** 3 — Nice to Have
> **Effort:** High (~3–4 days)
> **Dependencies:** Feature 01 (Auth), Feature 02 (Database — snapshots table)
> **Unlocks:** Post-session review, learning from others, interview replay

---

## What & Why

After an interview or coding session ends, the interviewer and candidate often want to review what happened: how the solution evolved, where the candidate got stuck, and what changed. Recording periodic code snapshots enables a scrubber-style playback — like a time-lapse of the entire coding session.

---

## Implementation — Step by Step

### Part 1 — Recording Snapshots During a Session

The `code_snapshots` table already exists in the database (from Feature 02). Now we need to actually write to it.

**Step 1.1** — In `server/index.js`, record a snapshot every 60 seconds for each active room:

```js
// Snapshot recorder — runs every 60 seconds
const SNAPSHOT_INTERVAL = 60 * 1000;

setInterval(async () => {
  for (const [roomId, room] of rooms.entries()) {
    if (!room.code || !room.isActive) continue;

    // Only save if code changed since last snapshot
    if (room.code === room.lastSnapshotCode) continue;

    try {
      await supabase.from('code_snapshots').insert({
        room_id: roomId,
        code: room.code,
        language: room.language,
        label: null,
      });
      room.lastSnapshotCode = room.code;
    } catch (err) {
      console.error('[snapshot] Failed to save:', err.message);
    }
  }
}, SNAPSHOT_INTERVAL);
```

**Step 1.2** — Also save a snapshot when:
- A problem is selected (mark as "Problem Started: Two Sum")
- A problem is solved (mark as "Problem Solved: Two Sum")
- The session timer expires (mark as "Session Ended")

```js
// In submit-solution / mark-solved handler:
await supabase.from('code_snapshots').insert({
  room_id: roomId,
  code: room.code,
  language: room.language,
  label: `✅ Solved: ${problem.title}`,
  user_id: socket.user?.id,
});
```

---

### Part 2 — Snapshot API

**Step 2.1** — Add endpoint to `server/index.js`:

```js
// GET /api/rooms/:roomId/snapshots — get all snapshots for a room
app.get('/api/rooms/:roomId/snapshots', async (req, res) => {
  const { roomId } = req.params;

  const { data, error } = await supabase
    .from('code_snapshots')
    .select('id, code, language, label, created_at')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ snapshots: data || [] });
});
```

---

### Part 3 — Replay Page

**Step 3.1** — Create `client/src/pages/RoomReplay.jsx`:

```jsx
import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import MonacoEditor from '@monaco-editor/react';

export default function RoomReplay() {
  const { roomId } = useParams();
  const [snapshots, setSnapshots] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1);
  const intervalRef = useRef(null);

  const API = import.meta.env.VITE_API_URL;

  useEffect(() => {
    fetch(`${API}/api/rooms/${roomId}/snapshots`)
      .then(r => r.json())
      .then(({ snapshots }) => setSnapshots(snapshots || []));
  }, [roomId]);

  const currentSnapshot = snapshots[currentIndex];

  const play = () => {
    setIsPlaying(true);
    intervalRef.current = setInterval(() => {
      setCurrentIndex(prev => {
        if (prev >= snapshots.length - 1) {
          setIsPlaying(false);
          clearInterval(intervalRef.current);
          return prev;
        }
        return prev + 1;
      });
    }, 2000 / playSpeed);
  };

  const pause = () => {
    setIsPlaying(false);
    clearInterval(intervalRef.current);
  };

  const reset = () => {
    pause();
    setCurrentIndex(0);
  };

  useEffect(() => {
    return () => clearInterval(intervalRef.current);
  }, []);

  if (!snapshots.length) {
    return (
      <div className="replay-empty">
        <h2>No replay available</h2>
        <p>This room has no recorded snapshots.</p>
      </div>
    );
  }

  const progress = ((currentIndex / (snapshots.length - 1)) * 100).toFixed(1);

  return (
    <div className="replay-page">
      <div className="replay-header">
        <h1>📜 Room Replay — {roomId}</h1>
        <p>
          Snapshot {currentIndex + 1} of {snapshots.length} •
          {currentSnapshot?.created_at && (
            <> {new Date(currentSnapshot.created_at).toLocaleString()}</>
          )}
          {currentSnapshot?.label && (
            <span className="snapshot-label"> — {currentSnapshot.label}</span>
          )}
        </p>
      </div>

      {/* Monaco Editor — Read Only */}
      <div className="replay-editor">
        <MonacoEditor
          value={currentSnapshot?.code || ''}
          language={currentSnapshot?.language || 'javascript'}
          theme="vs-dark"
          options={{
            readOnly: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 14,
          }}
        />
      </div>

      {/* Playback Controls */}
      <div className="replay-controls">
        <button onClick={reset} title="Back to start">⏮</button>
        <button onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}>⏪</button>
        {isPlaying ? (
          <button onClick={pause} className="btn-pause">⏸ Pause</button>
        ) : (
          <button onClick={play} className="btn-play">▶ Play</button>
        )}
        <button onClick={() => setCurrentIndex(i => Math.min(snapshots.length - 1, i + 1))}>⏩</button>
        <button onClick={() => setCurrentIndex(snapshots.length - 1)} title="Jump to end">⏭</button>

        <select value={playSpeed} onChange={e => setPlaySpeed(+e.target.value)}>
          <option value={0.5}>0.5×</option>
          <option value={1}>1×</option>
          <option value={2}>2×</option>
          <option value={4}>4×</option>
        </select>
      </div>

      {/* Scrubber */}
      <div className="replay-scrubber">
        <input
          type="range"
          min={0}
          max={snapshots.length - 1}
          value={currentIndex}
          onChange={e => {
            pause();
            setCurrentIndex(+e.target.value);
          }}
        />
        <div className="scrubber-labels">
          {snapshots
            .filter(s => s.label)
            .map((s, i) => {
              const idx = snapshots.indexOf(s);
              return (
                <button
                  key={i}
                  className="scrubber-marker"
                  style={{ left: `${(idx / (snapshots.length - 1)) * 100}%` }}
                  onClick={() => setCurrentIndex(idx)}
                  title={s.label}
                >
                  📌
                </button>
              );
            })}
        </div>
        <span>{progress}%</span>
      </div>
    </div>
  );
}
```

---

### Part 4 — Add Replay Route

**Step 4.1** — In `App.jsx`:
```jsx
<Route path="/room/:roomId/replay" element={<AuthGuard><RoomReplay /></AuthGuard>} />
```

**Step 4.2** — In `RoomHeader.jsx`, add a "View Replay" button (visible to room owner):
```jsx
<a href={`/room/${roomId}/replay`} target="_blank" rel="noreferrer">📜 View Replay</a>
```

---

### Part 5 — Optional: Diff View

Instead of showing full code at each snapshot, show a diff from the previous snapshot:

```jsx
import { diffLines } from 'diff';

function SnapshotDiff({ prev, curr }) {
  const changes = diffLines(prev?.code || '', curr?.code || '');
  return (
    <pre className="diff-view">
      {changes.map((part, i) => (
        <span
          key={i}
          style={{
            color: part.added ? '#10b981' : part.removed ? '#ef4444' : 'inherit',
            backgroundColor: part.added ? '#10b98120' : part.removed ? '#ef444420' : 'transparent',
          }}
        >
          {part.added ? '+' : part.removed ? '-' : ' '}{part.value}
        </span>
      ))}
    </pre>
  );
}
```

---

### Part 6 — Testing Checklist

- [ ] Create a room, type code for several minutes — snapshots are recorded every 60 seconds
- [ ] Visit `/room/:id/replay` — all snapshots load
- [ ] Click Play — snapshots auto-advance
- [ ] Pause — stops at current snapshot
- [ ] Scrubber — drag to any point in the session
- [ ] Speed control — 0.5×, 1×, 2×, 4× work correctly
- [ ] Milestone markers (📌) appear on the scrubber where labels exist
- [ ] Click milestone marker — jumps to that snapshot
- [ ] Room with no snapshots shows friendly empty state

---

## Files Changed / Created

| File | Action |
|---|---|
| `client/src/pages/RoomReplay.jsx` | NEW |
| `client/src/App.jsx` | MODIFY (add /room/:roomId/replay route) |
| `client/src/components/RoomHeader.jsx` | MODIFY (add View Replay link for owner) |
| `server/index.js` | MODIFY (snapshot recorder interval, snapshot-on-solve) |
| `server/index.js` | MODIFY (GET /api/rooms/:roomId/snapshots endpoint) |
