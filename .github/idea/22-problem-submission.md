# 📖 Feature 22 — User Problem Submission

> **Tier:** 3 — Nice to Have
> **Effort:** Medium (~2 days)
> **Dependencies:** Feature 01 (Auth), Feature 02 (Database)
> **Unlocks:** Community-driven problem set growth

---

## What & Why

The current problem set is hardcoded in `server/problems.js`. It can only grow if a developer manually edits the file. Allowing users to submit their own problems:
- Grows the problem library organically
- Lets instructors add custom interview questions
- Creates community ownership and investment in the platform

---

## Implementation — Step by Step

### Part 1 — Database Table

**Step 1.1** — Add to Supabase SQL Editor:

```sql
CREATE TABLE community_problems (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,     -- URL-safe ID like "valid-parentheses"
  difficulty    TEXT DEFAULT 'Medium' CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  category      TEXT DEFAULT 'Other',
  description   TEXT NOT NULL,
  examples      JSONB DEFAULT '[]',       -- [{input, output, explanation}]
  constraints   TEXT,
  hints         TEXT[],
  boilerplates  JSONB DEFAULT '{}',       -- {javascript: '...', python: '...'}
  test_cases    JSONB DEFAULT '[]',       -- [{input, expectedOutput, isHidden}]
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_notes  TEXT,
  reviewed_by   UUID REFERENCES profiles(id),
  reviewed_at   TIMESTAMPTZ,
  upvotes       INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: anyone can read approved problems
ALTER TABLE community_problems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "approved_problems_public_read"
  ON community_problems FOR SELECT
  USING (status = 'approved');

CREATE POLICY "submitters_see_own"
  ON community_problems FOR SELECT
  USING (auth.uid() = submitted_by);

CREATE POLICY "authenticated_can_submit"
  ON community_problems FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
```

---

### Part 2 — Problem Submission Form

**Step 2.1** — Create `client/src/pages/SubmitProblem.jsx`:

```jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import MonacoEditor from '@monaco-editor/react';

const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const CATEGORIES = ['Arrays', 'Strings', 'Trees', 'Graphs', 'Dynamic Programming', 'Sorting', 'Math', 'Other'];
const LANGUAGES = ['javascript', 'python', 'java', 'cpp', 'go', 'rust'];

export default function SubmitProblem() {
  const navigate = useNavigate();
  const API = import.meta.env.VITE_API_URL;

  const [form, setForm] = useState({
    title: '',
    difficulty: 'Medium',
    category: 'Arrays',
    description: '',
    constraints: '',
    hints: [''],
  });

  const [examples, setExamples] = useState([
    { input: '', output: '', explanation: '' }
  ]);

  const [testCases, setTestCases] = useState([
    { input: '', expectedOutput: '', isHidden: false }
  ]);

  const [boilerplates, setBoilerplates] = useState({
    javascript: '// Write your solution here\nfunction solution() {\n  \n}',
  });

  const [activeBoilerplateLang, setActiveBoilerplateLang] = useState('javascript');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.description) {
      return toast.error('Title and description are required');
    }
    if (testCases.length < 2) {
      return toast.error('Please add at least 2 test cases');
    }

    setSubmitting(true);

    const slug = form.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const payload = {
      ...form,
      slug,
      examples,
      test_cases: testCases,
      boilerplates,
      hints: form.hints.filter(h => h.trim()),
    };

    try {
      const res = await fetch(`${API}/api/problems/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ...`, // use session token
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success('Problem submitted for review! 🎉');
      navigate('/problems/my-submissions');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="submit-problem-page">
      <h1>📖 Submit a Problem</h1>
      <p className="subtitle">Problems are reviewed before being added to the platform.</p>

      <form onSubmit={handleSubmit} className="submit-form">

        {/* Basic Info */}
        <section>
          <h2>Basic Information</h2>
          <label>
            Title *
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Valid Parentheses"
              required
            />
          </label>

          <div className="two-col">
            <label>
              Difficulty
              <select value={form.difficulty} onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))}>
                {DIFFICULTIES.map(d => <option key={d}>{d}</option>)}
              </select>
            </label>
            <label>
              Category
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </label>
          </div>
        </section>

        {/* Problem Description (Markdown) */}
        <section>
          <h2>Problem Description *</h2>
          <p className="hint">Supports Markdown. Include problem statement, what to return, and edge cases.</p>
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={10}
            placeholder="Given an array of integers nums and an integer target, return indices of the two numbers that add up to target..."
            required
          />
        </section>

        {/* Examples */}
        <section>
          <h2>Examples</h2>
          {examples.map((ex, i) => (
            <div key={i} className="example-row">
              <h4>Example {i + 1}</h4>
              <label>Input <input value={ex.input} onChange={e => setExamples(examples.map((x, j) => j === i ? { ...x, input: e.target.value } : x))} /></label>
              <label>Output <input value={ex.output} onChange={e => setExamples(examples.map((x, j) => j === i ? { ...x, output: e.target.value } : x))} /></label>
              <label>Explanation <input value={ex.explanation} onChange={e => setExamples(examples.map((x, j) => j === i ? { ...x, explanation: e.target.value } : x))} /></label>
              {examples.length > 1 && (
                <button type="button" onClick={() => setExamples(examples.filter((_, j) => j !== i))}>Remove</button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => setExamples([...examples, { input: '', output: '', explanation: '' }])}>
            + Add Example
          </button>
        </section>

        {/* Test Cases */}
        <section>
          <h2>Test Cases (min. 2) *</h2>
          <p className="hint">Hidden test cases are not shown to users when they get a wrong answer.</p>
          {testCases.map((tc, i) => (
            <div key={i} className="test-case-row">
              <h4>Test Case {i + 1}</h4>
              <label>Input (stdin) <input value={tc.input} onChange={e => setTestCases(testCases.map((t, j) => j === i ? { ...t, input: e.target.value } : t))} /></label>
              <label>Expected Output (stdout) <input value={tc.expectedOutput} onChange={e => setTestCases(testCases.map((t, j) => j === i ? { ...t, expectedOutput: e.target.value } : t))} /></label>
              <label>
                <input type="checkbox" checked={tc.isHidden} onChange={e => setTestCases(testCases.map((t, j) => j === i ? { ...t, isHidden: e.target.checked } : t))} />
                Hidden test case
              </label>
              {testCases.length > 2 && (
                <button type="button" onClick={() => setTestCases(testCases.filter((_, j) => j !== i))}>Remove</button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => setTestCases([...testCases, { input: '', expectedOutput: '', isHidden: false }])}>
            + Add Test Case
          </button>
        </section>

        {/* Boilerplate Code */}
        <section>
          <h2>Starter Code (Boilerplate)</h2>
          <div className="boilerplate-lang-tabs">
            {LANGUAGES.map(lang => (
              <button
                key={lang}
                type="button"
                className={activeBoilerplateLang === lang ? 'active' : ''}
                onClick={() => setActiveBoilerplateLang(lang)}
              >
                {lang}
              </button>
            ))}
          </div>
          <MonacoEditor
            height="200px"
            language={activeBoilerplateLang}
            theme="vs-dark"
            value={boilerplates[activeBoilerplateLang] || ''}
            onChange={(value) => setBoilerplates(prev => ({ ...prev, [activeBoilerplateLang]: value }))}
          />
        </section>

        {/* Hints */}
        <section>
          <h2>Hints (Optional)</h2>
          {form.hints.map((hint, i) => (
            <div key={i} className="hint-row">
              <input
                value={hint}
                onChange={e => setForm(f => ({ ...f, hints: f.hints.map((h, j) => j === i ? e.target.value : h) }))}
                placeholder={`Hint ${i + 1}`}
              />
              {form.hints.length > 1 && (
                <button type="button" onClick={() => setForm(f => ({ ...f, hints: f.hints.filter((_, j) => j !== i) }))}>✕</button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => setForm(f => ({ ...f, hints: [...f.hints, ''] }))}>+ Add Hint</button>
        </section>

        <button type="submit" disabled={submitting} className="btn-submit-problem">
          {submitting ? 'Submitting…' : '📨 Submit for Review'}
        </button>
      </form>
    </div>
  );
}
```

---

### Part 3 — Server API Routes

**Step 3.1** — Add to `server/index.js`:

```js
// POST /api/problems/submit — submit a community problem
app.post('/api/problems/submit', requireAuth, async (req, res) => {
  const { title, slug, difficulty, category, description, examples, constraints, hints, boilerplates, test_cases } = req.body;

  const { data, error } = await supabase.from('community_problems').insert({
    submitted_by: req.user.id,
    title, slug, difficulty, category, description,
    examples, constraints, hints, boilerplates,
    test_cases, status: 'pending',
  }).select().single();

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'A problem with this title already exists' });
    return res.status(500).json({ error: error.message });
  }
  res.status(201).json({ problem: data });
});

// GET /api/problems/community — get approved community problems
app.get('/api/problems/community', async (req, res) => {
  const { data, error } = await supabase
    .from('community_problems')
    .select('id, title, slug, difficulty, category, upvotes, submitted_by, created_at, profiles!submitted_by(username)')
    .eq('status', 'approved')
    .order('upvotes', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ problems: data || [] });
});

// GET /api/problems/my-submissions — get current user's submissions
app.get('/api/problems/my-submissions', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('community_problems')
    .select('id, title, difficulty, status, review_notes, created_at')
    .eq('submitted_by', req.user.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ submissions: data || [] });
});
```

---

### Part 4 — Moderation (Admin Review)

**Step 4.1** — Create a simple admin review endpoint (restricted to admins):

```js
// PATCH /api/problems/review/:id — approve or reject a submission (admin only)
app.patch('/api/problems/review/:id', requireAuth, async (req, res) => {
  // Verify admin (check custom claim or hardcoded admin email)
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', req.user.id).single();
  if (!profile?.is_admin) return res.status(403).json({ error: 'Admin only' });

  const { status, review_notes } = req.body;
  const { data, error } = await supabase
    .from('community_problems')
    .update({ status, review_notes, reviewed_by: req.user.id, reviewed_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ problem: data });
});
```

---

### Part 5 — Add Routes

**Step 5.1** — In `App.jsx`:
```jsx
<Route path="/problems/submit" element={<AuthGuard><SubmitProblem /></AuthGuard>} />
<Route path="/problems/community" element={<CommunityProblems />} />
<Route path="/problems/my-submissions" element={<AuthGuard><MySubmissions /></AuthGuard>} />
```

**Step 5.2** — In the problem panel or nav, add a "Submit a Problem" link.

---

### Part 6 — Testing Checklist

- [ ] Submit a problem → appears in "My Submissions" with "Pending" status
- [ ] Admin approves problem → appears in community problems list
- [ ] Duplicate title → shows "already exists" error
- [ ] At least 2 test cases required → validation error if fewer
- [ ] Boilerplate editor works per language
- [ ] Guest users cannot submit problems (redirect to sign up)
- [ ] Approved community problems appear in the room's problem picker

---

## Files Changed / Created

| File | Action |
|---|---|
| `client/src/pages/SubmitProblem.jsx` | NEW |
| `client/src/pages/CommunityProblems.jsx` | NEW |
| `client/src/pages/MySubmissions.jsx` | NEW |
| `client/src/App.jsx` | MODIFY (add 3 new routes) |
| `server/index.js` | MODIFY (add problem submission API routes) |
| Supabase SQL Editor | ADD community_problems table + RLS |
