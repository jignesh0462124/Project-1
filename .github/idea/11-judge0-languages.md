# 🌍 Feature 11 — Judge0 Integration + More Languages

> **Tier:** 2 — Great Addition
> **Effort:** Medium (~1–2 days)
> **Dependencies:** Feature 04 (replaces/extends JDoodle)
> **Unlocks:** 60+ languages, better rate limits, self-hosting option

---

## What & Why

JDoodle has very tight free-tier limits (200 credits/day) and supports fewer languages. **Judge0** is an open-source judge that supports 60+ languages, has a free RapidAPI tier, and can be self-hosted on a $5/month VPS. Switching to Judge0 also enables real test case judging (Feature 04).

---

## Implementation — Step by Step

### Part 1 — Sign Up for Judge0

**Step 1.1 — Cloud (Easy Start)**
1. Go to [rapidapi.com/judge0-official](https://rapidapi.com/judge0-official/api/judge0-ce)
2. Subscribe to the free tier (50 requests/day)
3. Copy your API key and host header

**Step 1.2 — Self-hosted (Unlimited, Requires Docker)**
```bash
# On a VPS with Docker installed:
git clone https://github.com/judge0/judge0.git
cd judge0
cp judge0.conf.example judge0.conf
docker compose up -d db redis
sleep 10
docker compose up -d
# Judge0 runs on port 2358
```

**Step 1.3** — Add to `server/.env`:
```env
# Cloud:
JUDGE0_API_URL=https://judge0-ce.p.rapidapi.com
JUDGE0_API_KEY=your-rapidapi-key
JUDGE0_HOST=judge0-ce.p.rapidapi.com

# OR Self-hosted:
# JUDGE0_API_URL=http://your-vps-ip:2358
# JUDGE0_API_KEY=   (leave empty for self-hosted)
```

---

### Part 2 — Language ID Map

**Step 2.1** — Create `server/constants/judge0Languages.js`:

```js
// Judge0 language IDs — https://ce.judge0.com/languages/
export const JUDGE0_LANGUAGE_IDS = {
  javascript:  63,  // Node.js 12.14.0
  typescript:  74,  // TypeScript 3.7.4
  python:      71,  // Python 3.8.1
  java:        62,  // Java 13.0.1
  cpp:         54,  // C++ (GCC 9.2.0)
  c:           50,  // C (GCC 9.2.0)
  go:          60,  // Go 1.13.5
  rust:        73,  // Rust 1.40.0
  ruby:        72,  // Ruby 2.7.0
  php:         68,  // PHP 7.4.1
  kotlin:      78,  // Kotlin 1.3.70
  swift:       83,  // Swift 5.2.3
  csharp:      51,  // C# Mono 6.6.0
  bash:        46,  // Bash 5.0.0
  sql:         82,  // SQLite 3.31.1
  r:           80,  // R 4.0.0
  scala:       81,  // Scala 2.13.2
  perl:        85,  // Perl 5.28.1
  haskell:     61,  // Haskell GHC 8.8.1
};

export const SUPPORTED_LANGUAGES = Object.keys(JUDGE0_LANGUAGE_IDS);
```

---

### Part 3 — Judge0 Execution Service

**Step 3.1** — Create `server/services/judge0Service.js`:

```js
import axios from 'axios';
import { JUDGE0_LANGUAGE_IDS } from '../constants/judge0Languages.js';

const BASE_URL = process.env.JUDGE0_API_URL;
const IS_RAPIDAPI = !!process.env.JUDGE0_HOST;

function getHeaders() {
  const headers = { 'content-type': 'application/json' };
  if (IS_RAPIDAPI) {
    headers['x-rapidapi-key'] = process.env.JUDGE0_API_KEY;
    headers['x-rapidapi-host'] = process.env.JUDGE0_HOST;
  }
  return headers;
}

/**
 * Execute code and wait for result (synchronous submission).
 */
export async function executeCode(code, language, stdin = '') {
  const languageId = JUDGE0_LANGUAGE_IDS[language];
  if (!languageId) {
    throw new Error(`Language "${language}" is not supported.`);
  }

  const response = await axios.post(
    `${BASE_URL}/submissions?base64_encoded=false&wait=true`,
    {
      source_code: code,
      language_id: languageId,
      stdin,
    },
    { headers: getHeaders(), timeout: 15000 }
  );

  const result = response.data;
  return formatResult(result);
}

function formatResult(result) {
  const status = result.status?.description || 'Unknown';
  const isSuccess = result.status?.id === 3; // 3 = Accepted

  let output = '';
  if (result.compile_output) output += `Compile Error:\n${result.compile_output}\n`;
  if (result.stderr) output += `Runtime Error:\n${result.stderr}\n`;
  if (result.stdout) output += result.stdout;

  return {
    output: output.trim() || '(no output)',
    status,
    isSuccess,
    time: result.time,
    memory: result.memory,
    raw: result,
  };
}
```

---

### Part 4 — Update `/api/execute` Endpoint

**Step 4.1** — Replace the JDoodle call in `server/index.js`:

```js
import { executeCode } from './services/judge0Service.js';

app.post('/api/execute', async (req, res) => {
  const { code, language } = req.body;
  if (!code || !language) {
    return res.status(400).json({ error: 'code and language are required' });
  }

  try {
    const result = await executeCode(code, language);
    res.json({
      output: result.output,
      status: result.status,
      time: result.time,
      memory: result.memory,
    });
  } catch (err) {
    if (err.response?.status === 429) {
      return res.status(429).json({ error: 'Execution rate limit reached. Please wait and try again.' });
    }
    res.status(500).json({ error: 'Code execution failed: ' + err.message });
  }
});
```

---

### Part 5 — Add New Languages to Client

**Step 5.1** — Update `client/src/constants/languages.js` to include new languages:

```js
export const LANGUAGES = [
  { id: 'javascript', label: 'JavaScript', icon: '🟨' },
  { id: 'typescript', label: 'TypeScript', icon: '🔷' },
  { id: 'python',     label: 'Python',     icon: '🐍' },
  { id: 'java',       label: 'Java',       icon: '☕' },
  { id: 'cpp',        label: 'C++',        icon: '⚙️' },
  { id: 'c',          label: 'C',          icon: '🔧' },
  { id: 'go',         label: 'Go',         icon: '🐹' },
  { id: 'rust',       label: 'Rust',       icon: '🦀' },
  { id: 'ruby',       label: 'Ruby',       icon: '💎' },
  { id: 'php',        label: 'PHP',        icon: '🐘' },
  { id: 'kotlin',     label: 'Kotlin',     icon: '🎯' },
  { id: 'swift',      label: 'Swift',      icon: '🦅' },
  { id: 'csharp',     label: 'C#',         icon: '🔵' },
  { id: 'bash',       label: 'Bash',       icon: '🐚' },
  { id: 'sql',        label: 'SQL',        icon: '🗄️' },
  { id: 'html',       label: 'HTML',       icon: '🌐', noExecution: true },
];
```

**Step 5.2** — Update `client/src/constants/boilerplates.js` to add starter code for each new language.

---

### Part 6 — Output Panel Improvements

**Step 6.1** — In `OutputPanel.jsx`, display the execution metadata returned by Judge0:

```jsx
export default function OutputPanel({ output, status, time, memory }) {
  return (
    <div className="output-panel">
      <div className="output-header">
        <span>Output</span>
        {status && (
          <span className={`status-badge ${status === 'Accepted' ? 'success' : 'error'}`}>
            {status}
          </span>
        )}
        {time && <span className="meta">⏱ {time}s</span>}
        {memory && <span className="meta">💾 {Math.round(memory / 1024)}KB</span>}
      </div>
      <pre className="output-content">{output || 'Run your code to see output here.'}</pre>
    </div>
  );
}
```

---

### Part 7 — Testing Checklist

- [ ] Execute JavaScript code → output appears
- [ ] Execute Python code → output appears
- [ ] Execute code with a compile error → error is shown clearly
- [ ] Execute code with a runtime error → stderr is shown
- [ ] Time and memory stats are displayed in the output panel
- [ ] Unsupported language shows a friendly error (not a crash)
- [ ] Rate limit error (429) shows user-friendly message
- [ ] HTML language still opens preview, not execution
- [ ] All new languages appear in the language selector dropdown

---

## Files Changed / Created

| File | Action |
|---|---|
| `server/services/judge0Service.js` | NEW |
| `server/constants/judge0Languages.js` | NEW |
| `server/index.js` | MODIFY (replace JDoodle with Judge0 in /api/execute) |
| `server/.env` / `.env.example` | MODIFY (add Judge0 keys) |
| `client/src/constants/languages.js` | MODIFY (add Ruby, PHP, Kotlin, Swift, C#, Bash, SQL, etc.) |
| `client/src/constants/boilerplates.js` | MODIFY (add boilerplates for new languages) |
| `client/src/components/OutputPanel.jsx` | MODIFY (show time + memory stats) |
