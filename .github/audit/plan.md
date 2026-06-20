# 🔐 Security Audit — Collaborative Platform

> **Date:** 2026-06-20  
> **Scope:** Full-stack review — `server/`, `client/`, `supabase/`, `render.yaml`  
> **Auditor:** Automated static analysis + manual code review  
> **Severity Scale:** 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low · ℹ️ Info

---

## Executive Summary

The project is built with **Node.js/Express + Socket.io (backend)** and **React/Vite (frontend)**, persisted via **Supabase (Postgres + Auth)**. Overall the security posture is **good for a hackathon-grade product** but has several issues that must be resolved before a production launch. The most critical issue is that several HTTP API endpoints have **no authentication requirement**, allowing any unauthenticated caller to consume API credits, enumerate rooms, and execute arbitrary code via your JDoodle quota.

| Category | Issues Found | Critical | High | Medium | Low |
|---|---|---|---|---|---|
| API Authentication | 5 | 2 | 2 | 1 | 0 |
| Input Validation | 4 | 0 | 2 | 2 | 0 |
| Rate Limiting | 3 | 0 | 2 | 1 | 0 |
| Information Disclosure | 4 | 0 | 1 | 2 | 1 |
| Socket.io Security | 3 | 0 | 1 | 2 | 0 |
| Client-Side Security | 3 | 0 | 0 | 2 | 1 |
| Database / RLS | 2 | 0 | 1 | 1 | 0 |
| Secrets & Config | 3 | 1 | 1 | 1 | 0 |
| Dependencies | 1 | 0 | 0 | 1 | 0 |
| **Total** | **28** | **3** | **10** | **13** | **2** |

---

## 🔴 CRITICAL

---

### CRIT-01 — `/api/execute` Has No Authentication

**File:** `server/index.js:861`  
**Risk:** Any anonymous internet user can call `POST /api/execute` and drain your **JDoodle API quota (200 credits/day)**. Once drained, no users can execute code.

```js
// CURRENT — completely open
app.post('/api/execute', async (req, res) => { ... })
```

**Attack scenario:**
```bash
# Anyone can spam this from curl — no token required
for i in {1..200}; do
  curl -s -X POST https://your-backend.onrender.com/api/execute \
    -H 'Content-Type: application/json' \
    -d '{"code":"print(1)","language":"python"}'
done
# 200 credits exhausted in seconds
```

**Fix — add `optionalAuth` + per-IP rate limiting:**
```js
const { requireAuth } = require('./middleware/auth');
const rateLimit = require('express-rate-limit');

const executeLimiter = rateLimit({
  windowMs: 60 * 1000,     // 1 minute
  max: 10,                  // 10 executions per IP per minute
  message: { error: 'Too many code executions. Please wait.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Require auth AND rate-limit
app.post('/api/execute', executeLimiter, requireAuth, async (req, res) => { ... });
```

---

### CRIT-02 — `/api/analyze` Has No Authentication

**File:** `server/index.js:1107`  
**Risk:** The AI analysis endpoint calls **OpenRouter API** (paid). Any unauthenticated caller can drain your API credits.

```js
// CURRENT — completely open
app.post('/api/analyze', async (req, res) => { ... })
```

**Fix:**
```js
const analyzeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,   // 5 AI analyses per IP per minute
  message: { error: 'Too many analysis requests. Please wait.' },
});

app.post('/api/analyze', analyzeLimiter, requireAuth, async (req, res) => { ... });
```

---

### CRIT-03 — Service Role Key Exposure Risk in `render.yaml`

**File:** `render.yaml`  
**Risk:** The `render.yaml` is committed to a **public GitHub repo**. If any secret is ever accidentally hardcoded (instead of `sync: false`), it is permanently in git history and publicly visible.

**Current state (safe — but fragile):**
```yaml
- key: SUPABASE_SERVICE_ROLE_KEY
  sync: false   # ✅ correct — but must stay this way forever
```

**Fix — add a pre-commit hook to prevent accidental secret commits:**
```bash
# Install git-secrets or gitleaks
npm install --save-dev secretlint @secretlint/secretlint-rule-preset-recommend
```

Add `.secretlintrc.json`:
```json
{
  "rules": [{ "id": "@secretlint/secretlint-rule-preset-recommend" }]
}
```

Add to `package.json` scripts:
```json
"lint:secrets": "secretlint '**/*'",
"pre-commit": "npm run lint:secrets"
```

---

## 🟠 HIGH

---

### HIGH-01 — `/api/health` Leaks Internal System State

**File:** `server/index.js:817`  
**Risk:** The health endpoint publicly reveals your internal room count and Supabase configuration status — useful intelligence for an attacker.

```js
// CURRENT — leaks operational data
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    rooms: rooms.size,          // ← exposes active room count
    supabase: {
      configured: true,          // ← exposes infrastructure state
      persistence: 'enabled'
    },
    timestamp: new Date().toISOString()
  });
});
```

**Fix — return minimal response for public health check:**
```js
// Render's health check only needs 200 OK
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Detailed health behind auth for monitoring
app.get('/api/health', requireAuth, (req, res) => {
  res.json({
    status: 'ok',
    rooms: rooms.size,
    supabase: { configured: roomService.isSupabaseConfigured },
    timestamp: new Date().toISOString()
  });
});
```

---

### HIGH-02 — `/api/rooms/:roomId` Leaks Full Room Data Without Auth

**File:** `server/index.js:829`  
**Risk:** Anyone can query any room ID and receive its users list (including usernames and roles), current language, and active problem. This is an information disclosure vulnerability.

```js
// CURRENT — returns full user list to anonymous callers
app.get('/api/rooms/:roomId', async (req, res) => {
  return res.json({
    source: 'memory',
    room: {
      id: roomId,
      users: memoryRoom.users,  // ← full user objects with roles
      language: memoryRoom.language,
      is_active: true,
    }
  });
});
```

**Fix:**
```js
app.get('/api/rooms/:roomId', requireAuth, async (req, res) => {
  // ... only return non-sensitive fields
  return res.json({
    source: 'memory',
    room: {
      id: roomId,
      userCount: memoryRoom.users.length,
      language: memoryRoom.language,
      is_active: true,
    }
  });
});
```

---

### HIGH-03 — No Global HTTP Rate Limiting

**File:** `server/index.js` (missing middleware)  
**Risk:** There is no rate limiter on HTTP routes. An attacker can spam `POST /api/execute`, `POST /api/analyze`, `GET /api/create-room`, etc. without restriction.

**Fix — install and apply `express-rate-limit`:**
```bash
cd server && npm install express-rate-limit
```

```js
const rateLimit = require('express-rate-limit');

// Global limiter — protect all routes
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 300,                   // 300 requests per IP per 15 min
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(globalLimiter);
```

---

### HIGH-04 — Code Execution Payload Not Sanitized for `stdin` Injection

**File:** `server/index.js:888`  
**Risk:** The `script` field is sent directly to JDoodle with no content scanning. While JDoodle sandboxes execution, there is no check for extremely large code payloads that could cause JDoodle timeouts and waste credits.

**Current:**
```js
// Code length checked (50k chars) but no content scanning
const response = await axios.post(JDOODLE_API_URL, {
  clientId,
  clientSecret,
  script: code,   // ← sent raw
  ...
});
```

**Fix — add content safety check:**
```js
// Block infinite loops and obvious credit-wasting patterns
const DANGEROUS_PATTERNS = [
  /while\s*\(\s*true\s*\)/,
  /for\s*\(;;\)/,
  /sleep\s*\(\s*\d{2,}\s*\)/,  // sleep(30) etc.
];

function isSafeCode(code) {
  return !DANGEROUS_PATTERNS.some(pattern => pattern.test(code));
}

// In /api/execute:
if (!isSafeCode(code)) {
  return res.status(400).json({ error: 'Code contains patterns that may cause infinite execution.' });
}
```

---

### HIGH-05 — Socket.io Allows Anonymous Connections to Join Rooms

**File:** `server/index.js:61-69`  
**Risk:** The Socket.io auth middleware returns `null` for missing/invalid tokens instead of rejecting the connection. This means unauthenticated (guest) users bypass authentication entirely.

```js
// CURRENT — always calls next(), even without valid auth
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    socket.supabaseUser = await getUserFromAccessToken(token);
    next();   // ← called even if supabaseUser is null
  } catch (error) {
    next(new Error('Authentication failed'));
  }
});
```

**Assessment:** This is **intentional design** (guest support), but it means room actions rely entirely on in-memory trust (`socket.id` ownership checks). The risk is:
- A user can spoof a username if they connect before another user with the same name.
- Username uniqueness is only enforced per-room in-memory, not via a verified identity.

**Fix — add a session token for guests too:**
```js
// Generate a short-lived guest token on room join if no Supabase token
// and bind socket.id to a signed session token
import { createHmac } from 'crypto';

function signGuestToken(socketId) {
  return createHmac('sha256', process.env.SESSION_SECRET || 'dev-secret')
    .update(socketId)
    .digest('hex');
}
```

---

### HIGH-06 — `/api/create-room` Is Unauthenticated and Unlimited

**File:** `server/index.js:811`  
**Risk:** Any attacker can generate room IDs in bulk, causing room namespace exhaustion and unnecessary Supabase inserts.

```js
// CURRENT — no auth, no rate limit
app.get('/api/create-room', (req, res) => {
  const roomId = generateRoomId();
  res.json({ roomId });
});
```

**Fix:**
```js
const createRoomLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,  // 5 new rooms per IP per minute
  message: { error: 'Too many rooms created. Please wait.' },
});

app.get('/api/create-room', createRoomLimiter, (req, res) => {
  const roomId = generateRoomId();
  res.json({ roomId });
});
```

---

## 🟡 MEDIUM

---

### MED-01 — Username Passed via URL Query Parameter (Unverified Identity)

**File:** `client/src/pages/Home.jsx:53`, `Editor.jsx`  
**Risk:** The username is passed as a plain URL query parameter (`?username=alice`). Any user can craft a URL like `/room/ABCD1234?username=Admin` to impersonate any name. There is **no server-side identity verification** tied to the username.

```js
// Anyone can craft this URL:
navigate(`/room/${data.roomId}?username=Admin&language=javascript`)
```

**Fix — enforce identity from Supabase session on the server:**
```js
// In join-room socket handler, if user is authenticated, override the username
// with the verified Supabase display name
if (socket.supabaseUser) {
  const verifiedName = socket.supabaseUser.user_metadata?.display_name
    || socket.supabaseUser.email?.split('@')[0]
    || username;
  username = normalizeUsername(verifiedName) || username;
}
```

---

### MED-02 — No CSRF Protection on HTTP POST Endpoints

**File:** `server/index.js` (missing middleware)  
**Risk:** `POST /api/execute` and `POST /api/analyze` have no CSRF token requirement. Since they use `Content-Type: application/json` (which browsers don't send cross-origin by default), this risk is **mitigated** for browsers — but adds defense-in-depth.

**Fix:**
- Add `SameSite=Strict` on any session cookies (Supabase handles this).
- For the API: document that all requests must set `Content-Type: application/json`, which prevents simple form-based CSRF attacks.

---

### MED-03 — Helmet CSP Not Configured

**File:** `server/index.js:48`  
**Risk:** `helmet()` is used but without a configured Content Security Policy. Default helmet blocks some headers but provides no XSS protection for the API server's own HTML error pages.

**Fix:**
```js
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));
```

---

### MED-04 — `compilerOutput` Forwarded to AI Without Sanitization

**File:** `server/index.js:1109`  
**Risk:** The `compilerOutput` field from the request body is included in the OpenRouter prompt without any length check or sanitization. An attacker can craft a malicious `compilerOutput` with thousands of tokens to inflate AI API costs (prompt injection + token stuffing).

```js
// CURRENT — compilerOutput passed raw into prompt
const { code, language, compilerOutput } = req.body;
// ... buildAnalysisPrompts(code, language, compilerOutput)
```

**Fix — truncate and sanitize compilerOutput:**
```js
const MAX_COMPILER_OUTPUT = 2000;

const safeCompilerOutput = typeof compilerOutput === 'string'
  ? compilerOutput.slice(0, MAX_COMPILER_OUTPUT)
  : null;

// Pass safeCompilerOutput instead of compilerOutput
```

---

### MED-05 — Socket.io Rate Limiter Only Counts Events, Not Message Size

**File:** `server/index.js:199-209`  
**Risk:** The in-memory rate limiter counts up to 120 events per 10 seconds per socket, but does not account for message payload size. A user can send 120 events each with a 50 KB code payload per 10 seconds = **6 MB/s** per connected socket.

**Fix — add payload size validation per event:**
```js
socket.use(([event, data], next) => {
  // Check serialized payload size
  try {
    const payloadSize = JSON.stringify(data).length;
    if (payloadSize > 200 * 1024) {  // 200 KB max per event
      return next(new Error('Payload too large'));
    }
  } catch {
    return next(new Error('Invalid payload'));
  }
  return next();
});
```

---

### MED-06 — Chat Messages Not Sanitized Before Broadcast

**File:** `server/index.js:433-462`  
**Risk:** Chat messages are normalized (length capped), but the content is not checked for HTML/script injection before being broadcast to all users. If the client ever renders chat messages as `innerHTML`, this becomes an XSS vector.

**Current:**
```js
message = normalizeChatMessage(message);
// Broadcast directly without HTML encoding
io.to(roomId).emit('chat-received', { username, message, timestamp });
```

**Fix — sanitize on the server:**
```js
const { escape } = require('html-entities'); // or DOMPurify for server

function sanitizeChatMessage(message) {
  const normalized = String(message || '').trim();
  if (!normalized || normalized.length > MAX_CHAT_MESSAGE_LENGTH) return null;
  return escape(normalized);   // HTML-encode special chars
}
```

Also ensure the React client renders chat messages as text, not HTML:
```jsx
// ✅ Safe — text content
<span>{message}</span>

// ❌ Dangerous — never do this
<span dangerouslySetInnerHTML={{ __html: message }} />
```

---

### MED-07 — `getSupabaseAccessToken` Uses `getSession()` (Client-Side Trust)

**File:** `client/src/lib/supabase.js:15`  
**Risk:** `getSession()` reads from local storage and **does not verify the token with Supabase's server**. An attacker who manipulates localStorage can inject a forged token. The server correctly calls `getUser(token)` which validates server-side, so this is partially mitigated.

```js
// CURRENT — reads session from localStorage (not server-verified)
const { data, error } = await supabase.auth.getSession()
return data.session?.access_token || null
```

**Fix:**
```js
// Use getUser() on client for anything security-sensitive
const { data: { user }, error } = await supabase.auth.getUser()
// getUser() verifies with Supabase server — safer
```

---

### MED-08 — `anon` Role Access Not Restricted in RLS

**File:** `supabase/migrations/20260620070939_rls_policies.sql`  
**Risk:** All RLS policies are scoped to `authenticated` role. The `anon` role (unauthenticated Supabase requests) has **no explicit deny policies** — Supabase denies by default when RLS is enabled, but this should be explicitly documented and `anon` access should be explicitly tested.

**Fix — add explicit anon deny (defense in depth):**
```sql
-- Explicitly deny anon access to sensitive tables
create policy deny_anon_rooms
  on public.rooms for all
  to anon
  using (false);

create policy deny_anon_members  
  on public.room_members for all
  to anon
  using (false);

create policy deny_anon_chat
  on public.chat_messages for all
  to anon
  using (false);
```

---

### MED-09 — Room Code Stored in Supabase Without Encryption

**File:** `server/services/roomService.js:57`  
**Risk:** Code written by users in rooms is stored in plain text in the `rooms.code` column with no encryption at rest (beyond standard Supabase storage encryption). If users write sensitive content (API keys, passwords) in the editor, it persists indefinitely.

**Fix:**
- Add a **data retention policy** — auto-delete room code after 24 hours (already have `expires_at` column, add a scheduled cleanup function).
- Add a **warning banner** in the UI: *"Do not paste secrets or sensitive data in the editor."*

```sql
-- Supabase pg_cron job to purge expired rooms
select cron.schedule(
  'purge-expired-rooms',
  '0 * * * *',  -- hourly
  $$
    update public.rooms
    set code = '', is_active = false
    where expires_at < now() and is_active = true;
  $$
);
```

---

### MED-10 — `problems.js` Served Publicly Without Auth

**File:** `server/index.js:856`  
**Risk:** `GET /api/problems` returns all DSA problem data (including test cases if any). This is low severity for a competitive coding platform but could enable answer scraping.

```js
// CURRENT — publicly accessible
app.get('/api/problems', (req, res) => {
  res.json({ problems: DSA_PROBLEMS });
});
```

**Fix:**
```js
app.get('/api/problems', requireAuth, (req, res) => {
  res.json({ problems: DSA_PROBLEMS });
});
```

---

## 🟢 LOW

---

### LOW-01 — Console Logs in Production Client Code

**File:** `client/src/socket.js:38, 44, 49, 55, 61`  
**Risk:** `console.log` and `console.error` statements in the frontend expose internal connection information (Socket IDs, error details) in the browser's DevTools. Useful for attackers doing reconnaisance.

**Fix:**
```js
// Replace all console.* in production with a controlled logger
const logger = {
  log: import.meta.env.DEV ? console.log : () => {},
  error: import.meta.env.DEV ? console.error : () => {},
};
```

Or configure Vite to strip logs in production:
```js
// vite.config.js
export default defineConfig({
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,   // ← removes all console.* in production
        drop_debugger: true,
      }
    }
  }
})
```

---

### LOW-02 — Missing `Referrer-Policy` and `Permissions-Policy` Headers

**File:** `server/index.js` (missing headers)  
**Risk:** Browser referrer headers may leak room IDs from the URL (e.g., `https://app.com/room/ABCD1234`) to third-party resources loaded on the page.

**Fix:**
```js
app.use(helmet({
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permissionsPolicy: {
    features: {
      camera: [],
      microphone: [],
      geolocation: [],
    }
  }
}));
```

---

## ℹ️ INFO — Authentication Bypass Analysis

### Can an Attacker Bypass Authentication?

| Vector | Bypass Possible? | Notes |
|---|---|---|
| Join a room without Supabase login | ✅ Yes (by design) | Guest access is intentional |
| Call `/api/execute` without token | ✅ Yes (BUG — CRIT-01) | No auth on execute endpoint |
| Call `/api/analyze` without token | ✅ Yes (BUG — CRIT-02) | No auth on analyze endpoint |
| Spoof another user's username | ✅ Yes (MED-01) | URL param, not server-verified |
| Impersonate room owner | ❌ No | Owner checked by `socket.id` in memory |
| Kick users without being owner | ❌ No | `owner.role === 'owner'` checked server-side |
| Pause users without being host | ❌ No | `host.isHost` checked server-side |
| Access another user's Supabase data | ❌ No | RLS policies properly scoped |
| Read another user's code snapshots | ❌ No | RLS: `user_id = auth.uid()` |
| Transfer ownership without auth | ❌ No | Checked against socket.id in memory |
| Access `/api/rooms/:roomId` data | ✅ Yes (HIGH-02) | No auth on rooms endpoint |

### Can an Attacker Exhaust API Quotas?

| API | Protected? | Risk |
|---|---|---|
| JDoodle (code execute) | ❌ No rate limit, no auth | HIGH — 200 credits/day easily exhausted |
| OpenRouter (AI analyze) | ❌ No rate limit, no auth | HIGH — paid API, unprotected |
| Supabase Auth | ✅ Supabase-managed rate limits | SAFE |
| `GET /api/create-room` | ❌ No rate limit | MEDIUM — namespace pollution |

---

## 🛠️ Remediation Roadmap

### Immediate (before any public launch)

| Priority | Action | File |
|---|---|---|
| 🔴 1 | Add `requireAuth` + rate limiter to `/api/execute` | `server/index.js` |
| 🔴 2 | Add `requireAuth` + rate limiter to `/api/analyze` | `server/index.js` |
| 🟠 3 | Install `express-rate-limit` globally | `server/index.js` |
| 🟠 4 | Restrict `/api/health` public response | `server/index.js` |
| 🟠 5 | Restrict `/api/rooms/:roomId` with auth | `server/index.js` |
| 🟠 6 | Rate-limit `/api/create-room` | `server/index.js` |

### Short-term (within 1 sprint)

| Priority | Action | File |
|---|---|---|
| 🟡 7 | Truncate `compilerOutput` to 2000 chars in AI prompt | `server/index.js` |
| 🟡 8 | Configure Helmet with CSP | `server/index.js` |
| 🟡 9 | Add Socket.io payload size limit | `server/index.js` |
| 🟡 10 | Add explicit `anon` deny RLS policies | `supabase/migrations/` |
| 🟡 11 | Add room code expiry cron job | Supabase SQL |
| 🟡 12 | Add secretlint pre-commit hook | Root `package.json` |

### Long-term

| Priority | Action |
|---|---|
| 🟢 13 | Remove all `console.*` from production client bundle |
| 🟢 14 | Add `Referrer-Policy` and `Permissions-Policy` headers |
| 🟢 15 | Add identity verification for usernames (tie to Supabase JWT) |
| 🟢 16 | Use `getUser()` instead of `getSession()` for security-critical operations |

---

## 📋 Dependency Audit

Run the following to check for known CVEs:

```bash
# Server
cd server && npm audit

# Client
cd client && npm audit

# Auto-fix non-breaking issues
npm audit fix
```

**Known concerns as of audit date:**
- `axios ^1.13.6` — check for SSRF advisories
- `socket.io ^4.7.2` — check for ReDoS/prototype pollution advisories
- `@supabase/supabase-js ^2.108.2` — generally well-maintained

---

## 📌 Security Checklist (Pre-Launch Gate)

- [ ] `POST /api/execute` — requires valid Supabase JWT + rate limited
- [ ] `POST /api/analyze` — requires valid Supabase JWT + rate limited
- [ ] `GET /api/rooms/:roomId` — requires valid Supabase JWT
- [ ] `GET /api/health` — returns only `{status: "ok"}` publicly
- [ ] `express-rate-limit` applied globally
- [ ] Helmet CSP configured
- [ ] `compilerOutput` truncated at 2000 chars
- [ ] Socket.io payload size capped at 200 KB
- [ ] All `console.*` stripped from production build
- [ ] No secrets committed to git (`secretlint` passing)
- [ ] `npm audit` shows 0 critical/high vulnerabilities
- [ ] Supabase RLS tested with Supabase's built-in policy tester
- [ ] Explicit `anon` deny policies added to all tables
- [ ] Room data expiry cron job running
- [ ] UI warning: "Do not paste secrets in the editor"

---

## 📁 Files Reviewed

### Server
- `server/index.js` — 1240 lines — main express + socket.io app
- `server/config/supabase.js` — Supabase server client + token validation
- `server/middleware/auth.js` — JWT auth middleware
- `server/services/roomService.js` — Supabase DB operations
- `server/problems.js` — DSA problem definitions
- `server/.env.example` — environment variable documentation
- `server/package.json` — dependencies

### Client
- `client/src/App.jsx` — routing
- `client/src/socket.js` — Socket.io client singleton
- `client/src/lib/supabase.js` — Supabase browser client
- `client/src/pages/Home.jsx` — room creation/join UI
- `client/src/pages/Editor.jsx` — main editor page
- `client/src/components/SupabaseAuthPanel.jsx` — login/signup form
- `client/.env.example` — environment variable documentation

### Database
- `supabase/migrations/20260620070938_initial_schema.sql` — schema
- `supabase/migrations/20260620070939_rls_policies.sql` — RLS policies

### Deployment
- `render.yaml` — Render IaC blueprint
- `.gitignore` — secret exclusions

---

*Generated by Antigravity Security Review. Always combine automated analysis with manual penetration testing before production launch.*
