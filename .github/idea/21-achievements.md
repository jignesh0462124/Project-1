# 🏅 Feature 21 — Achievements & Leaderboard

> **Tier:** 3 — Nice to Have
> **Effort:** Medium (~2 days)
> **Dependencies:** Feature 01 (Auth), Feature 02 (Database), Feature 04 (for solve-based badges)
> **Unlocks:** Gamification, retention, competitive motivation

---

## What & Why

Gamification is one of the most effective tools for retention. Achievements give users milestones to work toward, badges to show off, and a reason to come back. A leaderboard creates healthy competition within the community.

---

## Implementation — Step by Step

### Part 1 — Achievement Definitions

**Step 1.1** — Create `server/constants/achievements.js`:

```js
export const ACHIEVEMENTS = [
  {
    id: 'first-solve',
    title: '🎯 First Blood',
    description: 'Solve your first DSA problem',
    icon: '🎯',
    condition: ({ totalSolved }) => totalSolved >= 1,
    xp: 50,
  },
  {
    id: 'ten-solves',
    title: '🔥 On Fire',
    description: 'Solve 10 problems',
    icon: '🔥',
    condition: ({ totalSolved }) => totalSolved >= 10,
    xp: 200,
  },
  {
    id: 'fifty-solves',
    title: '🏆 Problem Slayer',
    description: 'Solve 50 problems',
    icon: '🏆',
    condition: ({ totalSolved }) => totalSolved >= 50,
    xp: 1000,
  },
  {
    id: 'first-room',
    title: '🚪 Welcome',
    description: 'Join your first room',
    icon: '🚪',
    condition: ({ totalRooms }) => totalRooms >= 1,
    xp: 10,
  },
  {
    id: 'social-butterfly',
    title: '🦋 Social Butterfly',
    description: 'Join 20 different rooms',
    icon: '🦋',
    condition: ({ totalRooms }) => totalRooms >= 20,
    xp: 300,
  },
  {
    id: 'polyglot',
    title: '🌍 Polyglot',
    description: 'Solve problems in 5 different languages',
    icon: '🌍',
    condition: ({ uniqueLanguages }) => uniqueLanguages >= 5,
    xp: 500,
  },
  {
    id: 'speed-demon',
    title: '⚡ Speed Demon',
    description: 'Solve a problem in under 5 minutes',
    icon: '⚡',
    condition: ({ fastSolve }) => fastSolve === true,
    xp: 150,
  },
  {
    id: 'snippet-hoarder',
    title: '📚 Snippet Hoarder',
    description: 'Save 10 code snippets',
    icon: '📚',
    condition: ({ totalSnippets }) => totalSnippets >= 10,
    xp: 100,
  },
  {
    id: 'early-adopter',
    title: '🌟 Early Adopter',
    description: 'One of the first 100 users to join the platform',
    icon: '🌟',
    condition: ({ userNumber }) => userNumber <= 100,
    xp: 500,
  },
];
```

---

### Part 2 — Database Tables

**Step 2.1** — Add to Supabase SQL Editor:

```sql
CREATE TABLE user_achievements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  unlocked_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

CREATE TABLE user_xp (
  user_id      UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  total_xp     INT DEFAULT 0,
  level        INT DEFAULT 1,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Index for leaderboard queries
CREATE INDEX idx_xp_total ON user_xp(total_xp DESC);
```

---

### Part 3 — Achievement Checker Service

**Step 3.1** — Create `server/services/achievementService.js`:

```js
import supabase from '../config/supabase.js';
import { ACHIEVEMENTS } from '../constants/achievements.js';

/**
 * Check and award achievements for a user.
 * Returns array of newly unlocked achievements.
 */
export async function checkAndAwardAchievements(userId) {
  // Fetch current stats
  const [solved, rooms, snippets, existingAchievements] = await Promise.all([
    supabase.from('solved_problems').select('problem_id, solved_at').eq('user_id', userId),
    supabase.from('room_members').select('room_id, joined_at').eq('user_id', userId),
    supabase.from('saved_snippets').select('id').eq('user_id', userId),
    supabase.from('user_achievements').select('achievement_id').eq('user_id', userId),
  ]);

  const alreadyUnlocked = new Set((existingAchievements.data || []).map(a => a.achievement_id));

  const stats = {
    totalSolved: solved.data?.length || 0,
    totalRooms: rooms.data?.length || 0,
    totalSnippets: snippets.data?.length || 0,
    uniqueLanguages: 0, // TODO: track languages
    fastSolve: false,   // TODO: track solve time
    userNumber: 0,      // TODO: from profiles rank
  };

  const newlyUnlocked = [];

  for (const achievement of ACHIEVEMENTS) {
    if (alreadyUnlocked.has(achievement.id)) continue;
    if (!achievement.condition(stats)) continue;

    // Award the achievement
    const { error } = await supabase.from('user_achievements').insert({
      user_id: userId,
      achievement_id: achievement.id,
    });

    if (!error) {
      newlyUnlocked.push(achievement);
      // Award XP
      await supabase.rpc('increment_xp', { p_user_id: userId, p_xp: achievement.xp });
    }
  }

  return newlyUnlocked;
}
```

**Step 3.2** — Create the XP increment SQL function in Supabase:

```sql
CREATE OR REPLACE FUNCTION increment_xp(p_user_id UUID, p_xp INT)
RETURNS void AS $$
BEGIN
  INSERT INTO user_xp (user_id, total_xp, level)
  VALUES (p_user_id, p_xp, 1)
  ON CONFLICT (user_id) DO UPDATE
  SET
    total_xp = user_xp.total_xp + p_xp,
    level = FLOOR(SQRT((user_xp.total_xp + p_xp) / 100::float)) + 1,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;
```

---

### Part 4 — Trigger Achievement Checks

**Step 4.1** — Call `checkAndAwardAchievements` at key moments in `server/index.js`:

```js
// After a problem is solved:
socket.on('mark-solved', async ({ roomId, problemId }) => {
  // ... existing logic ...

  if (socket.user?.id) {
    const newAchievements = await checkAndAwardAchievements(socket.user.id);
    if (newAchievements.length > 0) {
      socket.emit('achievements-unlocked', { achievements: newAchievements });
    }
  }
});
```

---

### Part 5 — Achievement Unlock Notification

**Step 5.1** — In `Editor.jsx`, handle the achievement event:

```jsx
socket.on('achievements-unlocked', ({ achievements }) => {
  achievements.forEach(achievement => {
    toast(`${achievement.icon} Achievement Unlocked!\n${achievement.title}`, {
      duration: 5000,
      style: {
        background: 'linear-gradient(135deg, #7c3aed, #06b6d4)',
        color: 'white',
        fontWeight: 'bold',
      },
    });
  });
});
```

---

### Part 6 — Leaderboard Page

**Step 6.1** — Add `GET /api/leaderboard` to `server/index.js`:

```js
app.get('/api/leaderboard', async (req, res) => {
  const { limit = 50 } = req.query;

  const { data, error } = await supabase
    .from('user_xp')
    .select(`
      total_xp, level,
      profiles!user_id(username, display_name, avatar_url, problems_solved)
    `)
    .order('total_xp', { ascending: false })
    .limit(+limit);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ leaderboard: data || [] });
});
```

**Step 6.2** — Create `client/src/pages/Leaderboard.jsx`:

```jsx
import { useEffect, useState } from 'react';

const LEVEL_TITLES = ['Newbie', 'Beginner', 'Coder', 'Developer', 'Expert', 'Master', 'Legend'];

export default function Leaderboard() {
  const [entries, setEntries] = useState([]);
  const API = import.meta.env.VITE_API_URL;

  useEffect(() => {
    fetch(`${API}/api/leaderboard`).then(r => r.json()).then(d => setEntries(d.leaderboard || []));
  }, []);

  return (
    <div className="leaderboard-page">
      <h1>🏆 Leaderboard</h1>
      <table className="leaderboard-table">
        <thead>
          <tr>
            <th>#</th>
            <th>User</th>
            <th>Level</th>
            <th>XP</th>
            <th>Problems Solved</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) => (
            <tr key={i} className={i < 3 ? `top-${i + 1}` : ''}>
              <td>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
              </td>
              <td className="user-cell">
                <img src={entry.profiles?.avatar_url || '/default-avatar.png'} alt="" className="avatar-sm" />
                <span>{entry.profiles?.display_name || entry.profiles?.username}</span>
              </td>
              <td>
                <span className="level-badge">Lv.{entry.level}</span>
                <span className="level-title">{LEVEL_TITLES[Math.min(entry.level - 1, LEVEL_TITLES.length - 1)]}</span>
              </td>
              <td className="xp-cell">{entry.total_xp.toLocaleString()} XP</td>
              <td>{entry.profiles?.problems_solved || 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Step 6.3** — Add routes in `App.jsx`:
```jsx
<Route path="/leaderboard" element={<Leaderboard />} />
```

---

### Part 7 — Achievements Display on Dashboard

**Step 7.1** — In `Dashboard.jsx`, fetch and display user achievements:

```jsx
const { data: achievements } = await supabase
  .from('user_achievements')
  .select('achievement_id, unlocked_at')
  .eq('user_id', user.id);

// Map to full achievement objects
const unlockedAchievements = ACHIEVEMENTS.filter(a =>
  achievements.map(ua => ua.achievement_id).includes(a.id)
);
```

---

### Part 8 — Testing Checklist

- [ ] Solve first problem → "First Blood" achievement fires + toast
- [ ] Achievement appears in Dashboard under achievements section
- [ ] XP is added after each achievement
- [ ] Level increases as XP accumulates
- [ ] Leaderboard shows top 50 users ordered by XP
- [ ] Top 3 show gold/silver/bronze styling
- [ ] Already-unlocked achievements are not re-awarded
- [ ] Achievements page shows locked achievements grayed out

---

## Files Changed / Created

| File | Action |
|---|---|
| `server/constants/achievements.js` | NEW |
| `server/services/achievementService.js` | NEW |
| `client/src/pages/Leaderboard.jsx` | NEW |
| `client/src/pages/Dashboard.jsx` | MODIFY (achievements section, XP display) |
| `client/src/App.jsx` | MODIFY (add /leaderboard route) |
| `server/index.js` | MODIFY (trigger achievement checks, /api/leaderboard) |
| Supabase SQL Editor | ADD user_achievements, user_xp tables, increment_xp function |
