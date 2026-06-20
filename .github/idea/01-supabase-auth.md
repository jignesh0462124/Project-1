# 🔐 Feature 01 — Supabase Auth + Guest Mode

> **Tier:** 1 — High Impact
> **Effort:** Medium (~2–3 days)
> **Dependencies:** None (first feature to build)
> **Unlocks:** Features 02, 03, 07, 08, 18, 21

---

## What & Why

Right now anyone can type any username and join a room with zero identity verification. There are no profiles, no history, no persistent identity. Adding Supabase Auth gives every user a unique ID — which unlocks every other personalized feature on this list.

**Guest Mode** lets users skip registration and still join rooms anonymously with a temporary Supabase identity. Guests can upgrade to a full account later without losing their session.

---

## Auth Providers

| Provider | Type |
|---|---|
| Email + Password | Full account |
| Magic Link (email) | Passwordless full account |
| GitHub OAuth | Full account (best for developers) |
| Google OAuth | Full account |
| Anonymous Sign-in | Guest (no registration) |

---

## Implementation — Step by Step

### Part 1 — Supabase Project Setup

**Step 1.1** — Create a Supabase project at [supabase.com](https://supabase.com).

**Step 1.2** — In the Supabase dashboard → **Authentication → Providers**, enable:
- Email (turn on "Confirm email" for production)
- GitHub (requires GitHub OAuth App — create at github.com/settings/developers)
- Google (requires Google Cloud Console OAuth credentials)
- Anonymous sign-ins (Settings → Auth → enable "Allow anonymous sign-ins")

**Step 1.3** — Copy your project URL and anon key from **Settings → API**.

---

### Part 2 — Client Setup

**Step 2.1** — Install the Supabase JS client:
```bash
cd client
npm install @supabase/supabase-js
```

**Step 2.2** — Add environment variables to `client/.env`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Step 2.3** — Also update `client/.env.example` with the same keys (no values).

**Step 2.4** — Create `client/src/lib/supabase.js`:
```js
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

---

### Part 3 — AuthContext

**Step 3.1** — Create `client/src/context/AuthContext.jsx`:

```jsx
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  const isGuest = user?.is_anonymous === true;

  const signInWithGitHub = () =>
    supabase.auth.signInWithOAuth({ provider: 'github' });

  const signInWithGoogle = () =>
    supabase.auth.signInWithOAuth({ provider: 'google' });

  const signInWithEmail = (email, password) =>
    supabase.auth.signInWithPassword({ email, password });

  const signUpWithEmail = (email, password) =>
    supabase.auth.signUp({ email, password });

  const signInAsGuest = () =>
    supabase.auth.signInAnonymously();

  const signOut = () => supabase.auth.signOut();

  return (
    <AuthContext.Provider value={{
      user, session, loading, isGuest,
      signInWithGitHub, signInWithGoogle,
      signInWithEmail, signUpWithEmail,
      signInAsGuest, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

**Step 3.2** — Wrap your app in `client/src/main.jsx`:
```jsx
import { AuthProvider } from './context/AuthContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <AuthProvider>
    <App />
  </AuthProvider>
);
```

---

### Part 4 — Login Page

**Step 4.1** — Create `client/src/pages/Login.jsx`:

```jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { signInWithEmail, signInWithGitHub, signInWithGoogle, signInAsGuest } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleEmail = async (e) => {
    e.preventDefault();
    const { error } = await signInWithEmail(email, password);
    if (error) return setError(error.message);
    navigate('/');
  };

  const handleGuest = async () => {
    await signInAsGuest();
    navigate('/');
  };

  return (
    <div className="login-page">
      <h1>Sign In</h1>
      <form onSubmit={handleEmail}>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required />
        {error && <p className="error">{error}</p>}
        <button type="submit">Sign In</button>
      </form>
      <button onClick={signInWithGitHub}>Continue with GitHub</button>
      <button onClick={signInWithGoogle}>Continue with Google</button>
      <hr />
      <button onClick={handleGuest}>Continue as Guest</button>
      <p><a href="/signup">Don't have an account? Sign Up</a></p>
    </div>
  );
}
```

**Step 4.2** — Create `client/src/pages/Signup.jsx` (similar structure, call `signUpWithEmail`).

---

### Part 5 — AuthGuard & Routing

**Step 5.1** — Create `client/src/components/AuthGuard.jsx`:
```jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AuthGuard({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
```

**Step 5.2** — Update `client/src/App.jsx` to add routes:
```jsx
import { Routes, Route } from 'react-router-dom';
import AuthGuard from './components/AuthGuard';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Home from './pages/Home';
import Editor from './pages/Editor';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/" element={<AuthGuard><Home /></AuthGuard>} />
      <Route path="/room/:roomId" element={<AuthGuard><Editor /></AuthGuard>} />
    </Routes>
  );
}
```

---

### Part 6 — Guest Banner

**Step 6.1** — Create `client/src/components/GuestBanner.jsx`:
```jsx
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function GuestBanner() {
  const { isGuest } = useAuth();
  const navigate = useNavigate();
  if (!isGuest) return null;
  return (
    <div className="guest-banner">
      👤 You are in Guest mode. <button onClick={() => navigate('/signup')}>Create an account</button> to save your work.
    </div>
  );
}
```

**Step 6.2** — Render `<GuestBanner />` at the top of `Home.jsx` and `Editor.jsx`.

---

### Part 7 — Server-Side JWT Validation

**Step 7.1** — Add to `server/.env`:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Step 7.2** — Install on server:
```bash
cd server
npm install @supabase/supabase-js
```

**Step 7.3** — Use the middleware from `backend/middleware/auth.js` in Express routes that need protection.

**Step 7.4** — Pass the Supabase session token from the client in Socket.io handshake:
```js
// client/src/socket.js
import { supabase } from './lib/supabase';

async function getSocket() {
  const { data: { session } } = await supabase.auth.getSession();
  return io(SOCKET_URL, {
    auth: { token: session?.access_token }
  });
}
```

---

### Part 8 — Auto-Create Profile Row

**Step 8.1** — Run the SQL trigger from `backend/migrations/001_initial_schema.sql` in the Supabase SQL Editor. This auto-creates a `profiles` row for every new user (including guests).

---

### Part 9 — Testing Checklist

- [ ] Email signup creates a user + profile row in Supabase
- [ ] GitHub/Google OAuth redirect works and creates a profile
- [ ] Guest sign-in creates an anonymous session
- [ ] Guest sees the GuestBanner in Home and Editor
- [ ] Protected routes `/` and `/room/:id` redirect to `/login` when not signed in
- [ ] Sign-out clears the session and redirects to `/login`
- [ ] Socket.io receives the user token and can validate it server-side

---

## Files Changed / Created

| File | Action |
|---|---|
| `client/src/lib/supabase.js` | NEW |
| `client/src/context/AuthContext.jsx` | NEW |
| `client/src/components/AuthGuard.jsx` | NEW |
| `client/src/components/GuestBanner.jsx` | NEW |
| `client/src/pages/Login.jsx` | NEW |
| `client/src/pages/Signup.jsx` | NEW |
| `client/src/App.jsx` | MODIFY (add routes) |
| `client/src/main.jsx` | MODIFY (wrap AuthProvider) |
| `client/src/socket.js` | MODIFY (send token) |
| `client/.env` / `.env.example` | MODIFY |
| `server/.env` / `.env.example` | MODIFY |
| `server/index.js` | MODIFY (Socket.io auth middleware) |
