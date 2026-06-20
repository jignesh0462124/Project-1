# ⏱️ Feature 10 — Session Timer & Interview Mode

> **Tier:** 2 — Great Addition
> **Effort:** Low (~3–5 hours)
> **Dependencies:** None
> **Unlocks:** Proper interview experience, timed contests

---

## What & Why

Technical interviews and coding contests are time-boxed. A visible countdown timer shared across all room users:
- Creates urgency and realism for mock interviews
- Keeps everyone on the same schedule
- Auto-generates a submission summary when time is up
- Locks editing when the timer expires

---

## Implementation — Step by Step

### Part 1 — Timer State in Server

**Step 1.1** — Add timer fields to the room state in `server/index.js`:

```js
// When a room is created, add these fields to the in-memory room object:
rooms.set(roomId, {
  // ... existing fields
  timer: {
    isActive: false,
    startTime: null,
    durationMs: 0,
    endsAt: null,
  }
});
```

---

### Part 2 — Socket.io Timer Events

**Step 2.1** — Add timer control events to `server/index.js`:

```js
// Owner starts the timer
socket.on('start-timer', ({ roomId, durationMinutes }) => {
  const room = rooms.get(roomId);
  if (!room || room.owner !== socket.username) return;

  const durationMs = durationMinutes * 60 * 1000;
  const endsAt = Date.now() + durationMs;

  room.timer = { isActive: true, durationMs, endsAt, startTime: Date.now() };

  // Broadcast timer start to all room members
  io.to(roomId).emit('timer-started', {
    durationMinutes,
    endsAt,
    startedBy: socket.username,
  });

  // Auto-expire: lock room when timer ends
  setTimeout(() => {
    const r = rooms.get(roomId);
    if (r?.timer?.isActive) {
      r.timer.isActive = false;
      io.to(roomId).emit('timer-expired', {
        message: '⏰ Time is up! Editing is now locked.',
        code: r.code,
        language: r.language,
      });
    }
  }, durationMs);
});

// Owner cancels the timer
socket.on('cancel-timer', ({ roomId }) => {
  const room = rooms.get(roomId);
  if (!room || room.owner !== socket.username) return;
  if (room.timer) room.timer.isActive = false;
  io.to(roomId).emit('timer-cancelled');
});

// Sync timer state for late joiners
socket.on('get-timer-state', ({ roomId }) => {
  const room = rooms.get(roomId);
  if (room?.timer?.isActive) {
    socket.emit('timer-state', {
      endsAt: room.timer.endsAt,
      isActive: true,
    });
  }
});
```

---

### Part 3 — Timer Hook (Client)

**Step 3.1** — Create `client/src/hooks/useSessionTimer.js`:

```js
import { useState, useEffect, useRef } from 'react';

export function useSessionTimer(socket) {
  const [timerState, setTimerState] = useState({
    isActive: false,
    endsAt: null,
    secondsLeft: 0,
  });
  const intervalRef = useRef(null);

  const startCountdown = (endsAt) => {
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      const left = Math.max(0, Math.floor((endsAt - Date.now()) / 1000));
      setTimerState(prev => ({ ...prev, secondsLeft: left, isActive: left > 0 }));
      if (left === 0) clearInterval(intervalRef.current);
    }, 1000);
  };

  useEffect(() => {
    socket.on('timer-started', ({ endsAt, durationMinutes, startedBy }) => {
      setTimerState({ isActive: true, endsAt, secondsLeft: durationMinutes * 60 });
      startCountdown(endsAt);
    });

    socket.on('timer-cancelled', () => {
      clearInterval(intervalRef.current);
      setTimerState({ isActive: false, endsAt: null, secondsLeft: 0 });
    });

    socket.on('timer-state', ({ endsAt }) => {
      const left = Math.max(0, Math.floor((endsAt - Date.now()) / 1000));
      setTimerState({ isActive: true, endsAt, secondsLeft: left });
      startCountdown(endsAt);
    });

    return () => {
      socket.off('timer-started');
      socket.off('timer-cancelled');
      socket.off('timer-state');
      clearInterval(intervalRef.current);
    };
  }, [socket]);

  return timerState;
}
```

---

### Part 4 — Timer Display Component

**Step 4.1** — Create `client/src/components/SessionTimer.jsx`:

```jsx
import { useState } from 'react';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function SessionTimer({ timerState, isOwner, socket, roomId }) {
  const [showSetup, setShowSetup] = useState(false);
  const [duration, setDuration] = useState(45);
  const { isActive, secondsLeft } = timerState;

  const isWarning = secondsLeft > 0 && secondsLeft <= 300;   // 5 min warning
  const isCritical = secondsLeft > 0 && secondsLeft <= 60;   // 1 min warning

  const startTimer = () => {
    socket.emit('start-timer', { roomId, durationMinutes: duration });
    setShowSetup(false);
  };

  const cancelTimer = () => {
    socket.emit('cancel-timer', { roomId });
  };

  return (
    <div className="session-timer">
      {isActive ? (
        <div className={`timer-display ${isCritical ? 'critical' : isWarning ? 'warning' : ''}`}>
          <span className="timer-icon">⏱️</span>
          <span className="timer-value">{formatTime(secondsLeft)}</span>
          {isOwner && (
            <button onClick={cancelTimer} className="btn-cancel-timer" title="Cancel timer">✕</button>
          )}
        </div>
      ) : (
        isOwner && (
          <>
            <button onClick={() => setShowSetup(s => !s)} className="btn-start-timer">
              ⏱️ Start Timer
            </button>
            {showSetup && (
              <div className="timer-setup">
                <label>Duration (minutes):</label>
                <select value={duration} onChange={e => setDuration(+e.target.value)}>
                  {[15, 20, 30, 45, 60, 90, 120].map(d => (
                    <option key={d} value={d}>{d} min</option>
                  ))}
                </select>
                <button onClick={startTimer}>▶ Start</button>
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}
```

---

### Part 5 — Lock Editor on Timer Expiry

**Step 5.1** — In `Editor.jsx`, listen for `timer-expired` and lock the Monaco Editor:

```jsx
socket.on('timer-expired', ({ message, code, language }) => {
  setIsTimerExpired(true);
  toast(message, { icon: '⏰', duration: 5000 });
  // Monaco will be read-only because isTimerExpired is passed to options
});

// Monaco options:
<MonacoEditor
  options={{
    readOnly: isTimerExpired,
    // ...
  }}
/>
```

---

### Part 6 — Summary Report on Expiry

**Step 6.1** — When `timer-expired` fires, auto-send the current code for AI analysis:

```jsx
socket.on('timer-expired', async ({ code, language }) => {
  setIsTimerExpired(true);
  // Auto-request AI summary
  const res = await fetch(`${API}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      language,
      messages: [{ role: 'user', content: 'The interview/session just ended. Please provide a brief summary of what this code does, its correctness, time/space complexity, and key areas for improvement.' }],
    }),
  });
  const { analysis } = await res.json();
  setTimerSummary(analysis);
});
```

---

### Part 7 — Testing Checklist

- [ ] Owner starts a 1-minute timer — all users see the countdown
- [ ] Timer turns orange at 5 minutes remaining
- [ ] Timer turns red and pulses at 1 minute remaining
- [ ] Timer expires — editor locks for all users
- [ ] AI summary is auto-generated on expiry
- [ ] Owner can cancel the timer mid-way
- [ ] Late joiner gets current timer state (from `get-timer-state` event)
- [ ] Non-owners cannot start or cancel the timer

---

## Files Changed / Created

| File | Action |
|---|---|
| `client/src/hooks/useSessionTimer.js` | NEW |
| `client/src/components/SessionTimer.jsx` | NEW |
| `client/src/pages/Editor.jsx` | MODIFY (integrate timer, lock on expiry) |
| `client/src/components/RoomHeader.jsx` | MODIFY (render SessionTimer) |
| `server/index.js` | MODIFY (timer socket events) |
