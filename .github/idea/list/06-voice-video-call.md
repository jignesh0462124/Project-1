# 🔊 Feature 06 — Voice / Video Call (WebRTC)

> **Tier:** 1 — High Impact
> **Effort:** High (~4–5 days)
> **Dependencies:** Feature 01 (Auth for user identity)
> **Unlocks:** A fully self-contained collaboration platform

---

## What & Why

Pair programmers and interviewers need to talk. Currently users must open a separate Zoom, Google Meet, or Discord call alongside the editor. Adding voice (and optionally video) directly into the platform removes that friction completely.

**Approach:** Use the `simple-peer` library (WebRTC wrapper) with Socket.io as the signaling server.

---

## Implementation — Step by Step

### Part 1 — How WebRTC Signaling Works

```
User A ──[offer]──▶ Socket.io Server ──[offer]──▶ User B
User B ──[answer]─▶ Socket.io Server ──[answer]─▶ User A
User A ↔ User B ──── Direct P2P audio/video stream ────
```

Socket.io is only used to exchange the initial SDP offer/answer and ICE candidates. Actual media streams go peer-to-peer.

---

### Part 2 — Install Dependencies

**Step 2.1**:
```bash
cd client
npm install simple-peer
```

No server-side dependencies are needed — Socket.io already acts as the signaling server.

---

### Part 3 — Socket.io Signaling Events

**Step 3.1** — In `server/index.js`, add these signaling relay events:

```js
// WebRTC signaling — relay between peers in the same room
socket.on('webrtc-offer', ({ roomId, targetSocketId, offer }) => {
  io.to(targetSocketId).emit('webrtc-offer', {
    offer,
    fromSocketId: socket.id,
    fromUsername: socket.username,
  });
});

socket.on('webrtc-answer', ({ targetSocketId, answer }) => {
  io.to(targetSocketId).emit('webrtc-answer', {
    answer,
    fromSocketId: socket.id,
  });
});

socket.on('webrtc-ice-candidate', ({ targetSocketId, candidate }) => {
  io.to(targetSocketId).emit('webrtc-ice-candidate', {
    candidate,
    fromSocketId: socket.id,
  });
});

// User toggles mute/video — broadcast to room for UI state
socket.on('media-state-change', ({ roomId, audio, video }) => {
  socket.to(roomId).emit('peer-media-state', {
    socketId: socket.id,
    username: socket.username,
    audio,
    video,
  });
});
```

---

### Part 4 — Voice Call Hook

**Step 4.1** — Create `client/src/hooks/useVoiceCall.js`:

```js
import { useRef, useState, useEffect, useCallback } from 'react';
import SimplePeer from 'simple-peer';

export function useVoiceCall(socket, roomId, currentUsername) {
  const [isInCall, setIsInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [peers, setPeers] = useState({}); // socketId -> { peer, stream }
  const localStreamRef = useRef(null);
  const peersRef = useRef({});

  const getLocalStream = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStreamRef.current = stream;
    return stream;
  };

  const joinCall = useCallback(async (existingUsers) => {
    const localStream = await getLocalStream();
    setIsInCall(true);

    // Initiate connections to all existing users in the room
    existingUsers.forEach(({ socketId }) => {
      if (socketId === socket.id) return;
      const peer = new SimplePeer({ initiator: true, trickle: true, stream: localStream });

      peer.on('signal', (offer) => {
        socket.emit('webrtc-offer', { roomId, targetSocketId: socketId, offer });
      });

      peer.on('stream', (remoteStream) => {
        setPeers(prev => ({ ...prev, [socketId]: { peer, stream: remoteStream } }));
      });

      peersRef.current[socketId] = peer;
    });

    socket.emit('media-state-change', { roomId, audio: true, video: false });
  }, [socket, roomId]);

  const leaveCall = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    Object.values(peersRef.current).forEach(p => p.destroy());
    peersRef.current = {};
    setPeers({});
    setIsInCall(false);
  }, []);

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach(t => {
      t.enabled = !t.enabled;
    });
    setIsMuted(m => {
      socket.emit('media-state-change', { roomId, audio: !m, video: false });
      return !m;
    });
  }, [socket, roomId]);

  // Handle incoming WebRTC events
  useEffect(() => {
    socket.on('webrtc-offer', ({ offer, fromSocketId }) => {
      if (!localStreamRef.current) return;
      const peer = new SimplePeer({ initiator: false, trickle: true, stream: localStreamRef.current });

      peer.on('signal', (answer) => {
        socket.emit('webrtc-answer', { targetSocketId: fromSocketId, answer });
      });

      peer.on('stream', (remoteStream) => {
        setPeers(prev => ({ ...prev, [fromSocketId]: { peer, stream: remoteStream } }));
      });

      peer.signal(offer);
      peersRef.current[fromSocketId] = peer;
    });

    socket.on('webrtc-answer', ({ answer, fromSocketId }) => {
      peersRef.current[fromSocketId]?.signal(answer);
    });

    socket.on('webrtc-ice-candidate', ({ candidate, fromSocketId }) => {
      peersRef.current[fromSocketId]?.signal(candidate);
    });

    return () => {
      socket.off('webrtc-offer');
      socket.off('webrtc-answer');
      socket.off('webrtc-ice-candidate');
    };
  }, [socket]);

  return { isInCall, isMuted, peers, joinCall, leaveCall, toggleMute };
}
```

---

### Part 5 — Audio Players Component

**Step 5.1** — Create `client/src/components/VoiceCall.jsx`:

```jsx
import { useEffect, useRef } from 'react';

function RemoteAudio({ stream }) {
  const audioRef = useRef(null);
  useEffect(() => {
    if (audioRef.current) audioRef.current.srcObject = stream;
  }, [stream]);
  return <audio ref={audioRef} autoPlay />;
}

export default function VoiceCall({ peers, isInCall, isMuted, onJoin, onLeave, onToggleMute }) {
  return (
    <div className="voice-call-panel">
      {/* Hidden audio elements — one per remote peer */}
      {Object.entries(peers).map(([socketId, { stream }]) => (
        <RemoteAudio key={socketId} stream={stream} />
      ))}

      <div className="call-controls">
        {!isInCall ? (
          <button className="btn-join-call" onClick={onJoin}>
            🎙️ Join Voice Call
          </button>
        ) : (
          <>
            <button className="btn-mute" onClick={onToggleMute}>
              {isMuted ? '🔇 Unmute' : '🎙️ Mute'}
            </button>
            <button className="btn-leave-call" onClick={onLeave}>
              📵 Leave Call
            </button>
          </>
        )}
      </div>

      {isInCall && (
        <div className="call-participants">
          <span className="badge call-active">🔴 In Call ({Object.keys(peers).length + 1} users)</span>
        </div>
      )}
    </div>
  );
}
```

---

### Part 6 — Integrate in Editor

**Step 6.1** — In `Editor.jsx`:
```jsx
import { useVoiceCall } from '../hooks/useVoiceCall';
import VoiceCall from '../components/VoiceCall';

// Inside the component
const { isInCall, isMuted, peers, joinCall, leaveCall, toggleMute } = useVoiceCall(socket, roomId, username);

// In JSX (add to the header or sidebar)
<VoiceCall
  peers={peers}
  isInCall={isInCall}
  isMuted={isMuted}
  onJoin={() => joinCall(users)}   // pass current users list
  onLeave={leaveCall}
  onToggleMute={toggleMute}
/>
```

---

### Part 7 — STUN/TURN Servers

For production deployments behind NAT (most users), you need STUN/TURN servers.

**Step 7.1** — Add STUN servers (free) to SimplePeer config:
```js
const peer = new SimplePeer({
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  },
  // ...
});
```

**Step 7.2** — For production, set up a TURN server (needed for ~15% of users behind strict firewalls):
- [Twilio TURN Service](https://www.twilio.com/docs/stun-turn) (free trial)
- [Open Relay Project](https://www.metered.ca/tools/openrelay/) (free)

---

### Part 8 — Testing Checklist

- [ ] Join voice call in two browser tabs — audio is audible
- [ ] Mute/unmute toggles correctly
- [ ] Leave call stops audio stream
- [ ] Third user joins mid-call — they connect to existing peers
- [ ] User is kicked — their audio stream is cleaned up
- [ ] Browser requests microphone permission and shows clear UI if denied
- [ ] Works over HTTPS (required for browser microphone access)

---

## Files Changed / Created

| File | Action |
|---|---|
| `client/src/hooks/useVoiceCall.js` | NEW |
| `client/src/components/VoiceCall.jsx` | NEW |
| `client/src/pages/Editor.jsx` | MODIFY (integrate VoiceCall) |
| `server/index.js` | MODIFY (add WebRTC signaling events) |
| `client/package.json` | MODIFY (`simple-peer` dependency) |
