# 📊 Feature 07 — User Dashboard & Stats

> **Tier:** 2 — Great Addition
> **Effort:** Medium (~2 days)
> **Dependencies:** Feature 01 (Auth), Feature 02 (Database), Feature 04 (Judge for solve count)
> **Unlocks:** Feature 21 (Achievements use these stats)

---

## What & Why

Users want to track their progress. A personal dashboard shows:
- How many problems they have solved
- Which languages they use most
- How many rooms they've joined
- Their coding activity over time (heatmap)
- Their saved snippets and AI analysis history

---

## Implementation — Step by Step

### Part 1 — Stats API Endpoints

**Step 1.1** — Add to `server/index.js` or a new `server/routes/profile.js`:

```js
// GET /api/profile/stats — get current user's stats
app.get('/api/profile/stats', requireAuth, async (req, res) => {
  const userId = req.user.id;

  const [solved, rooms, snippets] = await Promise.all([
    supabase.from('solved_problems').select('problem_id, solved_at').eq('user_id', userId),
    supabase.from('room_members').select('room_id, joined_at').eq('user_id', userId),
    supabase.from('saved_snippets').select('id, language, created_at').eq('user_id', userId),
  ]);

  // Group snippets by language for chart
  const langCounts = {};
  for (const s of (snippets.data || [])) {
    langCounts[s.language] = (langCounts[s.language] || 0) + 1;
  }

  res.json({
    totalSolved: solved.data?.length || 0,
    totalRooms: rooms.data?.length || 0,
    totalSnippets: snippets.data?.length || 0,
    solvedProblems: solved.data || [],
    languageBreakdown: Object.entries(langCounts).map(([lang, count]) => ({ lang, count })),
    recentActivity: rooms.data?.slice(-10) || [],
  });
});

// GET /api/profile — get current user's profile
app.get('/api/profile', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', req.user.id)
    .single();
  if (error) return res.status(404).json({ error: 'Profile not found' });
  res.json({ profile: data });
});

// PATCH /api/profile — update display name
app.patch('/api/profile', requireAuth, async (req, res) => {
  const { display_name, bio } = req.body;
  const { data, error } = await supabase
    .from('profiles')
    .update({ display_name, bio, updated_at: new Date().toISOString() })
    .eq('id', req.user.id)
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ profile: data });
});
```

---

### Part 2 — Dashboard Page

**Step 2.1** — Create `client/src/pages/Dashboard.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const API = import.meta.env.VITE_API_URL;
    const headers = { Authorization: `Bearer ${user?.access_token}` }; // use session token

    Promise.all([
      fetch(`${API}/api/profile/stats`, { headers }).then(r => r.json()),
      fetch(`${API}/api/profile`, { headers }).then(r => r.json()),
    ]).then(([statsData, profileData]) => {
      setStats(statsData);
      setProfile(profileData.profile);
      setLoading(false);
    });
  }, [user]);

  if (loading) return <div className="loading-screen">Loading dashboard…</div>;

  return (
    <div className="dashboard">
      {/* Profile Header */}
      <section className="profile-header">
        <img src={profile?.avatar_url || '/default-avatar.png'} alt="avatar" className="avatar" />
        <div>
          <h1>{profile?.display_name || profile?.username}</h1>
          <p>{profile?.bio || 'No bio yet'}</p>
          {profile?.is_guest && <span className="badge guest">Guest Account</span>}
        </div>
      </section>

      {/* Stats Cards */}
      <section className="stats-grid">
        <div className="stat-card">
          <span className="stat-value">{stats.totalSolved}</span>
          <span className="stat-label">Problems Solved</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.totalRooms}</span>
          <span className="stat-label">Rooms Joined</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.totalSnippets}</span>
          <span className="stat-label">Saved Snippets</span>
        </div>
      </section>

      {/* Language Breakdown Chart */}
      {stats.languageBreakdown.length > 0 && (
        <section className="chart-section">
          <h2>Languages Used</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stats.languageBreakdown}>
              <XAxis dataKey="lang" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#7c3aed" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* Solved Problems List */}
      <section className="solved-section">
        <h2>Problems Solved ({stats.totalSolved})</h2>
        {stats.solvedProblems.map(p => (
          <div key={p.problem_id} className="solved-item">
            <span>{p.problem_id}</span>
            <span className="solved-date">
              {new Date(p.solved_at).toLocaleDateString()}
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
```

---

### Part 3 — Add Dashboard Route

**Step 3.1** — In `App.jsx`:
```jsx
import Dashboard from './pages/Dashboard';

<Route path="/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
```

**Step 3.2** — In `Home.jsx`, add a **Dashboard** link in the header/nav for logged-in users.

---

### Part 4 — Profile Edit

**Step 4.1** — Add an "Edit Profile" button on the Dashboard that opens a modal:

```jsx
function EditProfileModal({ profile, onSave, onClose }) {
  const [displayName, setDisplayName] = useState(profile.display_name || '');
  const [bio, setBio] = useState(profile.bio || '');

  const handleSave = async () => {
    const res = await fetch(`${API}/api/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ...` },
      body: JSON.stringify({ display_name: displayName, bio }),
    });
    const data = await res.json();
    onSave(data.profile);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Edit Profile</h2>
        <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Display Name" />
        <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Short bio" rows={3} />
        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}
```

---

### Part 5 — Testing Checklist

- [ ] Dashboard loads stats correctly after solving problems
- [ ] Language breakdown chart shows correct counts
- [ ] Edit profile saves display name and bio
- [ ] Dashboard redirects to /login if not authenticated
- [ ] Guest user sees a "Create account" CTA instead of full stats
- [ ] Recharts renders correctly on mobile (responsive container)

---

## Files Changed / Created

| File | Action |
|---|---|
| `client/src/pages/Dashboard.jsx` | NEW |
| `client/src/App.jsx` | MODIFY (add /dashboard route) |
| `client/src/pages/Home.jsx` | MODIFY (add Dashboard nav link) |
| `server/index.js` | MODIFY (add /api/profile and /api/profile/stats) |
