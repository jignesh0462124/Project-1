# Supabase Authentication & Database Integration Plan

> **Project:** Collaborative Platform — Real-time Code Editor  
> **Status:** 📋 Planning Phase  
> **Last Updated:** June 2026

---

## Overview

This document outlines the plan to integrate **Supabase** into the Collaborative Platform for:

1. **User Authentication** — Email/password, OAuth (GitHub, Google), and Guest Mode
2. **Database Persistence** — Replace in-memory room state with a real database
3. **Real-time Sync** — Leverage Supabase Realtime as a complementary layer
4. **Row-Level Security (RLS)** — Protect user data at the database level

---

## Why Supabase?

| Feature | Benefit |
|---|---|
| Auth (JWT-based) | Drop-in authentication with social logins |
| PostgreSQL | Powerful relational DB for rooms, users, sessions |
| Realtime | WebSocket subscriptions on database changes |
| Row Level Security | Secure data per user without extra backend code |
| Storage | Future file/snippet uploads |
| Free tier | Generous limits for development and small production |
| SDK | Official JS/TS client works directly in Vite + Node.js |

---

## Phase 1 — Authentication

### 1.1 Auth Providers to Enable

| Provider | Mode | Notes |
|---|---|---|
| Email + Password | Registered User | Standard signup/login |
| Magic Link (Email) | Registered User | Passwordless alternative |
| GitHub OAuth | Registered User | Ideal for developer audience |
| Google OAuth | Registered User | Broad accessibility |
| **Guest Mode** | Anonymous | No account required — see below |

---

### 1.2 Guest Mode (Anonymous Authentication)

Supabase supports **anonymous sign-in** natively since 2024.

**How it works:**
- User clicks **"Continue as Guest"** on the Home/Lobby page
- Supabase creates a temporary anonymous session with a unique UUID
- The guest gets a JWT token like any other user
- Guest can join/create rooms without registering
- Guest display name is auto-generated (e.g., `Guest#4821`)
- Guest session lasts for the browser session (or configurable TTL)
- Guest can **upgrade to a full account** later (link email/OAuth) without losing their session

**Guest Limitations:**
- Cannot save code snippets to their profile
- Cannot view their room history
- Room ownership is not persisted across page refreshes
- AI analysis history is not saved

**Guest Flow:**

```
Home Page
  |
  ├── [Sign In / Sign Up]  →  Full Account Flow
  |
  └── [Continue as Guest]
        |
        └── Supabase: signInAnonymously()
              |
              └── Receive JWT → Store in localStorage/session
                    |
                    └── Enter Display Name → Join/Create Room
```

---

### 1.3 Auth Flow — Full Account

```
1. User visits /login or /signup
2. Chooses: Email+Password | GitHub | Google | Guest
3. Supabase handles OAuth redirect or email confirmation
4. On success → Supabase returns session (access_token + refresh_token)
5. Client stores session via @supabase/supabase-js (auto-managed)
6. JWT is sent as Authorization header on API calls
7. Server validates JWT using Supabase JWT secret
8. User is redirected to Home/Lobby
```

---

### 1.4 New Pages / Components Required

| File | Purpose |
|---|---|
| `client/src/pages/Login.jsx` | Login form (email/password + OAuth buttons + Guest) |
| `client/src/pages/Signup.jsx` | Registration form |
| `client/src/pages/Profile.jsx` | View/edit display name, avatar, stats |
| `client/src/components/AuthGuard.jsx` | Route protection wrapper |
| `client/src/components/GuestBanner.jsx` | Banner prompting guests to upgrade |
| `client/src/context/AuthContext.jsx` | Global auth state (user, session, loading) |
| `client/src/lib/supabase.js` | Supabase client initialization |

---

### 1.5 Client Environment Variables (New)

```env
# client/.env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

---

## Phase 2 — Database Schema

### 2.1 Tables

#### `profiles`
Extends Supabase's built-in `auth.users`.

```sql
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url  TEXT,
  is_guest    BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
```

#### `rooms`
Persists room metadata so rooms survive server restarts.

```sql
CREATE TABLE rooms (
  id           TEXT PRIMARY KEY,         -- 8-char room code
  owner_id     UUID REFERENCES profiles(id),
  language     TEXT DEFAULT 'javascript',
  code         TEXT DEFAULT '',
  is_active    BOOLEAN DEFAULT TRUE,
  max_users    INT DEFAULT 4,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  expires_at   TIMESTAMPTZ               -- auto-cleanup after inactivity
);
```

#### `room_members`
Tracks who is/was in each room.

```sql
CREATE TABLE room_members (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id   TEXT REFERENCES rooms(id) ON DELETE CASCADE,
  user_id   UUID REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at   TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(room_id, user_id)
);
```

#### `code_snapshots`
Saves periodic snapshots of room code (for history/playback).

```sql
CREATE TABLE code_snapshots (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id   TEXT REFERENCES rooms(id) ON DELETE CASCADE,
  code      TEXT NOT NULL,
  language  TEXT NOT NULL,
  saved_by  UUID REFERENCES profiles(id),
  saved_at  TIMESTAMPTZ DEFAULT NOW()
);
```

#### `chat_messages`
Persists chat so new joiners can see recent history.

```sql
CREATE TABLE chat_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    TEXT REFERENCES rooms(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES profiles(id),
  username   TEXT NOT NULL,
  message    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `solved_problems`
Tracks which DSA problems a user has solved.

```sql
CREATE TABLE solved_problems (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
  problem_id  TEXT NOT NULL,
  room_id     TEXT,
  solved_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, problem_id)
);
```

---

### 2.2 Row Level Security (RLS) Policies

```sql
-- Profiles: users can only read/update their own profile
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- Rooms: any authenticated user (including guests) can read active rooms
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active rooms"
  ON rooms FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Owner can update their room"
  ON rooms FOR UPDATE USING (auth.uid() = owner_id);

-- Chat: members of a room can insert and read messages
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Room members can read chat"
  ON chat_messages FOR SELECT USING (TRUE);  -- or restrict to room members

CREATE POLICY "Authenticated users can send chat"
  ON chat_messages FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
```

---

## Phase 3 — Backend Changes

### 3.1 Server-Side JWT Validation

The existing Express server (`server/index.js`) needs middleware to validate Supabase JWTs.

```js
// server/middleware/auth.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // service role for server-side
);

export async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid token' });

  req.user = user;
  next();
}

export async function optionalAuth(req, res, next) {
  // Allows both guests and authenticated users
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    const { data: { user } } = await supabase.auth.getUser(token);
    req.user = user || null;
  }
  next();
}
```

### 3.2 New Server Environment Variables

```env
# server/.env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
SUPABASE_JWT_SECRET=your-jwt-secret-here
```

### 3.3 Socket.io Auth Middleware

```js
// In server/index.js — Socket.io middleware
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    // Allow guest connections
    socket.user = { id: socket.id, isGuest: true };
    return next();
  }
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error) return next(new Error('Authentication failed'));
  socket.user = user;
  next();
});
```

---

## Phase 4 — New `backend/` Folder Structure

```
backend/
  config/
    supabase.js          -- Supabase client (service role)
  middleware/
    auth.js              -- JWT validation middleware
    rateLimit.js         -- Per-user rate limiting
  routes/
    auth.js              -- /api/auth/* endpoints (if needed)
    rooms.js             -- /api/rooms CRUD
    profile.js           -- /api/profile endpoints
    snapshots.js         -- /api/snapshots save/load
  services/
    roomService.js       -- Room CRUD logic using Supabase
    profileService.js    -- Profile management
    chatService.js       -- Persist chat messages
  migrations/
    001_initial_schema.sql
    002_rls_policies.sql
  README.md
```

---

## Phase 5 — Migration Plan

| Step | Task | Priority |
|---|---|---|
| 1 | Create Supabase project | 🔴 High |
| 2 | Run SQL migrations for all tables | 🔴 High |
| 3 | Enable Auth providers in Supabase dashboard | 🔴 High |
| 4 | Add `client/src/lib/supabase.js` | 🔴 High |
| 5 | Build `AuthContext.jsx` with guest support | 🔴 High |
| 6 | Build Login/Signup pages | 🔴 High |
| 7 | Add `AuthGuard` route protection | 🟡 Medium |
| 8 | Add server-side JWT middleware | 🟡 Medium |
| 9 | Persist rooms to Supabase DB | 🟡 Medium |
| 10 | Persist chat messages | 🟡 Medium |
| 11 | Add `GuestBanner` upgrade prompt | 🟢 Low |
| 12 | Add Profile page | 🟢 Low |
| 13 | Add code snapshot save/load | 🟢 Low |
| 14 | Set up RLS policies | 🟡 Medium |

---

## Dependencies to Install

### Client
```bash
npm install @supabase/supabase-js
```

### Server
```bash
npm install @supabase/supabase-js jsonwebtoken
```

---

## Security Checklist

- [ ] Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client
- [ ] Only expose `SUPABASE_ANON_KEY` on the client (safe by design)
- [ ] Enable RLS on all tables before going to production
- [ ] Validate JWT on every protected server route
- [ ] Rate-limit anonymous/guest signups to prevent abuse
- [ ] Set short TTL for anonymous sessions
- [ ] Enable email confirmation for new accounts
- [ ] Disable "Sign up" if running a private invite-only instance

---

## References

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Anonymous Sign-in](https://supabase.com/docs/guides/auth/anonymous-sign-ins)
- [Supabase JS Client](https://supabase.com/docs/reference/javascript)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Socket.io + Supabase Auth Pattern](https://supabase.com/docs/guides/realtime)
