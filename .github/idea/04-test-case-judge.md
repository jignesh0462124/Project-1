# 🎯 Feature 04 — Automated Test Case Judge

> **Tier:** 1 — High Impact
> **Effort:** High (~3–4 days)
> **Dependencies:** Feature 01 (Auth), Feature 02 (Database)
> **Unlocks:** Feature 21 (Achievements — "Solved X problems")

---

## What & Why

Currently the "Submit Solution" button is just a workflow signal — the server sends a generic AI-based response saying whether the code looks correct. There is **no real judging** against test cases.

This feature adds a proper judging system using **Judge0** (open-source, 60+ languages) that:
- Runs user code against hidden test cases defined per problem
- Reports pass/fail for each test case
- Shows memory and time usage
- Updates the problem as "solved" only when all tests pass

---

## Implementation — Step by Step

### Part 1 — Choose Execution Backend

**Option A — Judge0 Cloud (Recommended for getting started)**
- Sign up at [judge0.com](https://judge0.com) or use RapidAPI
- Free tier: ~50 submissions/day
- No server setup required

**Option B — Self-hosted Judge0**
- Run Judge0 on Railway/Render/VPS with Docker
- Unlimited submissions
- Requires Docker setup

**Step 1.1** — Sign up for Judge0 API and get your API key and base URL.

**Step 1.2** — Add to `server/.env`:
```env
JUDGE0_API_URL=https://judge0-ce.p.rapidapi.com
JUDGE0_API_KEY=your-rapidapi-key-here
JUDGE0_HOST=judge0-ce.p.rapidapi.com
```

---

### Part 2 — Problem Test Cases Schema

**Step 2.1** — Add test cases to each problem in `server/problems.js`:

```js
// server/problems.js — updated structure
{
  id: 'two-sum',
  title: 'Two Sum',
  difficulty: 'Easy',
  description: '...',
  boilerplates: { javascript: '...', python: '...' },
  testCases: [
    {
      id: 'tc1',
      input: '[2,7,11,15]\n9',          // stdin
      expectedOutput: '[0,1]',           // stdout (trimmed)
      isHidden: false,                   // visible to user
      label: 'Example 1',
    },
    {
      id: 'tc2',
      input: '[3,2,4]\n6',
      expectedOutput: '[1,2]',
      isHidden: true,                    // hidden test case
      label: 'Hidden Test 2',
    },
    // ...
  ],
}
```

---

### Part 3 — Judge0 Execution Service

**Step 3.1** — Create `server/services/judgeService.js`:

```js
import axios from 'axios';

// Judge0 language IDs
const LANGUAGE_IDS = {
  javascript: 63,
  python: 71,
  java: 62,
  cpp: 54,
  go: 60,
  rust: 73,
  typescript: 74,
};

const JUDGE0_URL = process.env.JUDGE0_API_URL;
const JUDGE0_HEADERS = {
  'x-rapidapi-key': process.env.JUDGE0_API_KEY,
  'x-rapidapi-host': process.env.JUDGE0_HOST,
  'content-type': 'application/json',
};

/**
 * Submit a single test case to Judge0 and wait for result.
 */
export async function runTestCase(code, language, stdin) {
  const languageId = LANGUAGE_IDS[language];
  if (!languageId) throw new Error(`Language "${language}" not supported by Judge0`);

  // Step 1: Submit
  const submitRes = await axios.post(
    `${JUDGE0_URL}/submissions?base64_encoded=false&wait=true`,
    {
      source_code: code,
      language_id: languageId,
      stdin,
    },
    { headers: JUDGE0_HEADERS }
  );

  return submitRes.data;
  // Returns: { stdout, stderr, compile_output, status, time, memory }
}

/**
 * Run code against all test cases for a problem.
 */
export async function judgeSubmission(code, language, testCases) {
  const results = [];

  for (const tc of testCases) {
    try {
      const result = await runTestCase(code, language, tc.input);
      const actual = (result.stdout || '').trim();
      const expected = tc.expectedOutput.trim();
      const passed = actual === expected;

      results.push({
        id: tc.id,
        label: tc.isHidden ? `Hidden Test ${tc.id}` : tc.label,
        passed,
        status: result.status?.description || 'Unknown',
        actual: tc.isHidden && !passed ? '(hidden)' : actual,
        expected: tc.isHidden && !passed ? '(hidden)' : expected,
        time: result.time,
        memory: result.memory,
        stderr: result.stderr,
        compileOutput: result.compile_output,
      });
    } catch (err) {
      results.push({
        id: tc.id,
        label: tc.label,
        passed: false,
        status: 'Error',
        error: err.message,
      });
    }
  }

  const allPassed = results.every(r => r.passed);
  return { allPassed, results };
}
```

---

### Part 4 — Update Submit Endpoint

**Step 4.1** — In `server/index.js`, replace the existing `submit-solution` Socket.io handler:

```js
socket.on('submit-solution', async ({ roomId, code, language }) => {
  const room = rooms.get(roomId);
  if (!room || !room.currentProblem) {
    return socket.emit('submission-result', { success: false, message: 'No active problem' });
  }

  // Find the problem's test cases
  const problem = problems.find(p => p.id === room.currentProblem);
  if (!problem?.testCases?.length) {
    return socket.emit('submission-result', { success: false, message: 'No test cases defined for this problem' });
  }

  // Emit "running" status
  socket.emit('submission-running', { message: `Running ${problem.testCases.length} test cases…` });

  try {
    const { allPassed, results } = await judgeSubmission(code, language, problem.testCases);

    // Emit results to submitter
    socket.emit('submission-result', {
      success: allPassed,
      results,
      message: allPassed
        ? `✅ All ${results.length} tests passed!`
        : `❌ ${results.filter(r => !r.passed).length} test(s) failed`,
    });

    // If all passed, broadcast to room
    if (allPassed) {
      room.solvedProblems.add(problem.id);
      io.to(roomId).emit('problem-solved', {
        problemId: problem.id,
        problemTitle: problem.title,
        solvedBy: socket.user?.username || 'A user',
        solvedProblems: [...room.solvedProblems],
      });
    }
  } catch (err) {
    socket.emit('submission-result', { success: false, message: 'Execution service error: ' + err.message });
  }
});
```

---

### Part 5 — Client: Test Results UI

**Step 5.1** — Create `client/src/components/TestResultsPanel.jsx`:

```jsx
export default function TestResultsPanel({ results, isRunning, message }) {
  if (isRunning) return <div className="test-panel loading">⏳ Running test cases…</div>;
  if (!results) return null;

  return (
    <div className="test-panel">
      <h3>{message}</h3>
      {results.map((r, i) => (
        <div key={r.id} className={`test-case ${r.passed ? 'passed' : 'failed'}`}>
          <span>{r.passed ? '✅' : '❌'} {r.label}</span>
          {!r.passed && (
            <div className="test-details">
              <p><strong>Expected:</strong> {r.expected}</p>
              <p><strong>Got:</strong> {r.actual}</p>
              {r.stderr && <p><strong>Error:</strong> {r.stderr}</p>}
            </div>
          )}
          <span className="test-meta">{r.time}s | {r.memory}KB</span>
        </div>
      ))}
    </div>
  );
}
```

**Step 5.2** — In `Editor.jsx`, add state for test results and listen for `submission-result` and `submission-running` events.

**Step 5.3** — Render `<TestResultsPanel />` below the `<OutputPanel />`.

---

### Part 6 — Testing Checklist

- [ ] Submit correct solution — all tests pass, confetti fires (Feature 16)
- [ ] Submit wrong solution — failed test cases are shown with expected vs actual
- [ ] Submit code with compile error — error is shown per test case
- [ ] Hidden test cases show "(hidden)" for wrong answers
- [ ] Language is mapped correctly to Judge0 language ID
- [ ] "Running…" spinner shows during execution
- [ ] API rate limit error is handled gracefully

---

## Files Changed / Created

| File | Action |
|---|---|
| `server/services/judgeService.js` | NEW |
| `server/problems.js` | MODIFY (add testCases array to each problem) |
| `server/index.js` | MODIFY (replace submit-solution handler) |
| `server/.env` / `.env.example` | MODIFY (add Judge0 keys) |
| `client/src/components/TestResultsPanel.jsx` | NEW |
| `client/src/pages/Editor.jsx` | MODIFY (add test results state + panel) |
