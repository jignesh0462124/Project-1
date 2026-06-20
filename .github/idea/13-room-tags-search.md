# 🏷️ Feature 13 — Room Tags & Public Lobby

> **Tier:** 2 — Great Addition
> **Effort:** Medium (~1.5 days)
> **Dependencies:** Feature 01 (Auth), Feature 02 (Database)
> **Unlocks:** Community discovery, open practice sessions

---

## What & Why

Right now there's no way to discover rooms. You need to know the room code to join. A public lobby lets room owners tag their rooms as open and allows strangers to browse and join — like a matchmaking system for coding practice.

---

## Implementation — Step by Step

### Part 1 — Add Tags to Database

**Step 1.1** — Add columns to the `rooms` table:
```sql
ALTER TABLE rooms ADD COLUMN tags TEXT[] DEFAULT '{}';
ALTER TABLE rooms ADD COLUMN is_public BOOLEAN DEFAULT FALSE;
ALTER TABLE rooms ADD COLUMN title TEXT;
ALTER TABLE rooms ADD COLUMN description TEXT;
```

---

### Part 2 — Room Tags During Creation

**Step 2.1** — In `Home.jsx`, add a "Make room public" option with tag selection when creating a room:

```jsx
const [isPublic, setIsPublic] = useState(false);
const [selectedTags, setSelectedTags] = useState([]);
const [roomTitle, setRoomTitle] = useState('');

const AVAILABLE_TAGS = [
  'interview', 'practice', 'teaching', 'pair-programming',
  'javascript', 'python', 'java', 'cpp', 'go', 'rust',
  'algorithms', 'data-structures', 'open-join', 'beginner',
];

// In JSX:
<label>
  <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} />
  Make this room public (visible in lobby)
</label>
{isPublic && (
  <div className="room-setup">
    <input value={roomTitle} onChange={e => setRoomTitle(e.target.value)} placeholder="Room title (e.g. LeetCode Hard Practice)" />
    <div className="tag-picker">
      {AVAILABLE_TAGS.map(tag => (
        <button
          key={tag}
          className={`tag ${selectedTags.includes(tag) ? 'selected' : ''}`}
          onClick={() => setSelectedTags(prev =>
            prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
          )}
        >
          {tag}
        </button>
      ))}
    </div>
  </div>
)}
```

**Step 2.2** — When creating the room, include the metadata in the API call and in the `join-room` Socket.io event payload.

---

### Part 3 — Server: Save Room Metadata

**Step 3.1** — Update `GET /api/create-room` to accept and save metadata:

```js
app.get('/api/create-room', requireAuth, async (req, res) => {
  const { title, description, tags, isPublic } = req.query;
  const roomId = generateRoomId();

  // Save to DB if public
  if (isPublic === 'true') {
    await supabase.from('rooms').insert({
      id: roomId,
      owner_id: req.user.id,
      title: title || `${req.user.email}'s Room`,
      description: description || '',
      tags: tags ? tags.split(',') : [],
      is_public: true,
    });
  }

  res.json({ roomId });
});
```

---

### Part 4 — Lobby API Endpoint

**Step 4.1** — Add `GET /api/lobby` to `server/index.js`:

```js
app.get('/api/lobby', async (req, res) => {
  const { tag, search, limit = 20, offset = 0 } = req.query;

  let query = supabase
    .from('rooms')
    .select(`
      id, title, description, tags, language, created_at,
      profiles!owner_id(display_name, username)
    `)
    .eq('is_active', true)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .range(+offset, +offset + +limit - 1);

  if (tag) query = query.contains('tags', [tag]);
  if (search) query = query.ilike('title', `%${search}%`);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  // Enrich with current active member count from in-memory rooms
  const enriched = (data || []).map(room => ({
    ...room,
    currentMembers: rooms.get(room.id)?.users?.length || 0,
    maxMembers: 4,
  }));

  res.json({ rooms: enriched });
});
```

---

### Part 5 — Lobby Page

**Step 5.1** — Create `client/src/pages/Lobby.jsx`:

```jsx
import { useEffect, useState } from 'react';

export default function Lobby() {
  const [rooms, setRooms] = useState([]);
  const [searchTag, setSearchTag] = useState('');
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(true);
  const API = import.meta.env.VITE_API_URL;

  const fetchRooms = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (searchTag) params.set('tag', searchTag);
    if (searchText) params.set('search', searchText);

    const res = await fetch(`${API}/api/lobby?${params}`);
    const data = await res.json();
    setRooms(data.rooms || []);
    setLoading(false);
  };

  useEffect(() => { fetchRooms(); }, [searchTag]);

  return (
    <div className="lobby-page">
      <h1>🌐 Public Rooms</h1>

      {/* Filter Bar */}
      <div className="lobby-filters">
        <input
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && fetchRooms()}
          placeholder="Search rooms…"
        />
        <div className="tag-filters">
          {['all', 'interview', 'practice', 'teaching', 'open-join', 'algorithms'].map(tag => (
            <button
              key={tag}
              className={`tag-filter ${(searchTag === tag || (tag === 'all' && !searchTag)) ? 'active' : ''}`}
              onClick={() => setSearchTag(tag === 'all' ? '' : tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Room Cards */}
      {loading ? (
        <div className="loading">Loading rooms…</div>
      ) : rooms.length === 0 ? (
        <div className="empty-state">No public rooms found. Create one!</div>
      ) : (
        <div className="room-grid">
          {rooms.map(room => (
            <div key={room.id} className="room-card">
              <div className="room-card-header">
                <h3>{room.title || room.id}</h3>
                <span className="room-members">
                  {room.currentMembers}/{room.maxMembers} 👥
                </span>
              </div>
              <p className="room-description">{room.description}</p>
              <div className="room-tags">
                {(room.tags || []).map(tag => (
                  <span key={tag} className="tag">{tag}</span>
                ))}
              </div>
              <div className="room-footer">
                <span className="room-owner">by {room.profiles?.display_name || 'Anonymous'}</span>
                <a href={`/room/${room.id}`} className="btn-join">
                  {room.currentMembers >= room.maxMembers ? '🔒 Full' : '🚀 Join'}
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 5.2** — Add route in `App.jsx`:
```jsx
<Route path="/lobby" element={<AuthGuard><Lobby /></AuthGuard>} />
```

**Step 5.3** — Add a "Browse Public Rooms" link on the Home page.

---

### Part 6 — Testing Checklist

- [ ] Create a public room with tags → appears in /lobby
- [ ] Filter by tag → only matching rooms shown
- [ ] Search by title → results filter correctly
- [ ] Room shows correct member count
- [ ] Full room (4/4) shows "Full" badge and disabled join button
- [ ] Private rooms do not appear in lobby
- [ ] Room disappears from lobby when marked inactive

---

## Files Changed / Created

| File | Action |
|---|---|
| `client/src/pages/Lobby.jsx` | NEW |
| `client/src/pages/Home.jsx` | MODIFY (public room options, lobby link) |
| `client/src/App.jsx` | MODIFY (add /lobby route) |
| `server/index.js` | MODIFY (add /api/lobby, update /api/create-room) |
| Supabase SQL Editor | ADD tags, is_public, title, description columns to rooms |
