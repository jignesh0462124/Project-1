# 📝 Feature 03 — Code Snippets Save & Load

> **Tier:** 1 — High Impact
> **Effort:** Medium (~1.5 days)
> **Dependencies:** Feature 01 (Auth), Feature 02 (Database)
> **Unlocks:** Feature 07 (Dashboard shows snippet count)

---

## What & Why

Users doing interviews and pair programming often want to save the code they wrote, load a template they prepared, or share a snippet with someone. Right now the editor is ephemeral — code is lost when you leave.

This feature adds:
- **Save** current editor code as a named snippet
- **Load** a saved snippet back into the editor
- **Public snippets** with a shareable link
- **Snippet browser** in a sidebar panel

---

## Implementation — Step by Step

### Part 1 — Database Table

The `saved_snippets` table is already defined in `backend/migrations/001_initial_schema.sql`. Make sure it has been run in Supabase.

```sql
-- Verify it exists:
SELECT * FROM saved_snippets LIMIT 1;
```

---

### Part 2 — Server API Routes

**Step 2.1** — Add snippet routes to `server/index.js` (or a separate `server/routes/snippets.js`):

```js
// GET /api/snippets — get current user's snippets
app.get('/api/snippets', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('saved_snippets')
    .select('id, title, language, is_public, created_at')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ snippets: data });
});

// POST /api/snippets — save a new snippet
app.post('/api/snippets', requireAuth, async (req, res) => {
  const { title, code, language, is_public = false } = req.body;
  if (!title || !code || !language) {
    return res.status(400).json({ error: 'title, code, and language are required' });
  }
  const { data, error } = await supabase
    .from('saved_snippets')
    .insert({ user_id: req.user.id, title, code, language, is_public })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ snippet: data });
});

// GET /api/snippets/:id — load a snippet by ID (public or own)
app.get('/api/snippets/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('saved_snippets')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (error || !data) return res.status(404).json({ error: 'Snippet not found' });
  // Check access: must be public or owned by requester
  if (!data.is_public && data.user_id !== req.user?.id) {
    return res.status(403).json({ error: 'Access denied' });
  }
  res.json({ snippet: data });
});

// DELETE /api/snippets/:id — delete own snippet
app.delete('/api/snippets/:id', requireAuth, async (req, res) => {
  const { error } = await supabase
    .from('saved_snippets')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});
```

---

### Part 3 — Client Snippet Service

**Step 3.1** — Create `client/src/services/snippetService.js`:

```js
const API_URL = import.meta.env.VITE_API_URL;

async function authHeaders() {
  const { supabase } = await import('../lib/supabase');
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token}`,
  };
}

export async function getMySnippets() {
  const res = await fetch(`${API_URL}/api/snippets`, {
    headers: await authHeaders(),
  });
  return res.json();
}

export async function saveSnippet(title, code, language, isPublic = false) {
  const res = await fetch(`${API_URL}/api/snippets`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ title, code, language, is_public: isPublic }),
  });
  return res.json();
}

export async function loadSnippet(id) {
  const res = await fetch(`${API_URL}/api/snippets/${id}`, {
    headers: await authHeaders(),
  });
  return res.json();
}

export async function deleteSnippet(id) {
  const res = await fetch(`${API_URL}/api/snippets/${id}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  return res.json();
}
```

---

### Part 4 — Save Snippet Button

**Step 4.1** — In `client/src/pages/Editor.jsx`, add a **Save Snippet** button to the editor toolbar.

**Step 4.2** — On click, show a small modal asking for:
- Snippet name/title (text input)
- Make public? (checkbox)

**Step 4.3** — Create `client/src/components/SaveSnippetModal.jsx`:

```jsx
import { useState } from 'react';
import { saveSnippet } from '../services/snippetService';
import toast from 'react-hot-toast';

export default function SaveSnippetModal({ code, language, onClose }) {
  const [title, setTitle] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return toast.error('Enter a snippet name');
    setSaving(true);
    const { snippet, error } = await saveSnippet(title, code, language, isPublic);
    setSaving(false);
    if (error) return toast.error(error);
    toast.success('Snippet saved!');
    onClose(snippet);
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Save Snippet</h2>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Snippet name (e.g. Binary Search)"
          autoFocus
        />
        <label>
          <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} />
          Make public (anyone with the link can view)
        </label>
        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

### Part 5 — Snippet Browser Sidebar

**Step 5.1** — Create `client/src/components/SnippetPanel.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { getMySnippets, deleteSnippet } from '../services/snippetService';
import toast from 'react-hot-toast';

export default function SnippetPanel({ onLoad }) {
  const [snippets, setSnippets] = useState([]);

  useEffect(() => {
    getMySnippets().then(({ snippets }) => setSnippets(snippets || []));
  }, []);

  const handleLoad = (snippet) => {
    onLoad(snippet.code, snippet.language);
    toast.success(`Loaded: ${snippet.title}`);
  };

  const handleDelete = async (id) => {
    await deleteSnippet(id);
    setSnippets(prev => prev.filter(s => s.id !== id));
    toast.success('Snippet deleted');
  };

  return (
    <div className="snippet-panel">
      <h3>My Snippets</h3>
      {snippets.length === 0 && <p>No saved snippets yet.</p>}
      {snippets.map(s => (
        <div key={s.id} className="snippet-item">
          <span>{s.title}</span>
          <span className="badge">{s.language}</span>
          {s.is_public && <span className="badge public">public</span>}
          <button onClick={() => handleLoad(s)}>Load</button>
          <button onClick={() => handleDelete(s.id)}>Delete</button>
        </div>
      ))}
    </div>
  );
}
```

**Step 5.2** — In `Editor.jsx`, add a toggle button to show/hide `<SnippetPanel />`. When `onLoad` is called, update the Monaco Editor value and the room language.

---

### Part 6 — Public Share Link

**Step 6.1** — When a snippet is saved as public, generate the share URL:
```js
const shareUrl = `${window.location.origin}/snippet/${snippet.id}`;
```

**Step 6.2** — Add a **Copy Link** button that copies this URL.

**Step 6.3** — Create `client/src/pages/SnippetView.jsx` — a read-only page at `/snippet/:id` that loads and displays a snippet in a Monaco Editor (readOnly mode).

**Step 6.4** — Add the route in `App.jsx`:
```jsx
<Route path="/snippet/:id" element={<SnippetView />} />
```

---

### Part 7 — Testing Checklist

- [ ] Save a snippet — appears in the snippet panel
- [ ] Load a snippet — editor updates with saved code and language
- [ ] Delete a snippet — removed from panel
- [ ] Save as public, copy link, open link in incognito — code is visible
- [ ] Guest user cannot save snippets (show upgrade prompt instead)
- [ ] Snippet panel is hidden for guests or shows empty state with upgrade CTA

---

## Files Changed / Created

| File | Action |
|---|---|
| `server/index.js` | MODIFY (add /api/snippets routes) |
| `client/src/services/snippetService.js` | NEW |
| `client/src/components/SaveSnippetModal.jsx` | NEW |
| `client/src/components/SnippetPanel.jsx` | NEW |
| `client/src/pages/SnippetView.jsx` | NEW |
| `client/src/pages/Editor.jsx` | MODIFY (Save button, SnippetPanel toggle) |
| `client/src/App.jsx` | MODIFY (add /snippet/:id route) |
