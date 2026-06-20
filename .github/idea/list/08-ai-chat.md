# 🤖 Feature 08 — AI Pair Programmer (Chat Mode)

> **Tier:** 2 — Great Addition
> **Effort:** Medium (~1.5 days)
> **Dependencies:** None (enhances existing AI analysis)
> **Unlocks:** Much more useful AI experience

---

## What & Why

The current "Analyze" button sends code to OpenRouter and gets a one-shot response. Users can't ask follow-up questions. A real AI chat interface lets users:
- Ask "Why is this O(n²)? How can I make it O(n log n)?"
- Say "Refactor line 14 to handle null"
- Request "Add unit tests for this function"
- Get a natural back-and-forth conversation where the AI always knows the current code

---

## Implementation — Step by Step

### Part 1 — Update Server API Endpoint

**Step 1.1** — Modify `POST /api/analyze` in `server/index.js` to support conversation history:

```js
app.post('/api/analyze', async (req, res) => {
  const { code, language, compilerOutput, messages = [] } = req.body;

  // Build the system prompt (injected once, at the start)
  const systemPrompt = `You are an expert programming assistant helping with a real-time collaborative coding session.

Current code (${language}):
\`\`\`${language}
${code}
\`\`\`
${compilerOutput ? `\nCompiler/Runtime Output:\n${compilerOutput}` : ''}

Answer questions concisely. If asked to modify code, show only the changed part.`;

  // Build the messages array for OpenRouter
  const openRouterMessages = [
    { role: 'system', content: systemPrompt },
    ...messages, // previous conversation turns
  ];

  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: process.env.OPENROUTER_MODEL,
        messages: openRouterMessages,
        stream: false,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER,
          'X-Title': process.env.OPENROUTER_APP_TITLE,
        },
      }
    );

    const reply = response.data.choices[0].message;
    res.json({ analysis: reply.content, message: reply });
  } catch (err) {
    const status = err.response?.status;
    if (status === 429) return res.status(429).json({ error: 'OpenRouter rate limit reached' });
    if (status === 401) return res.status(401).json({ error: 'OpenRouter authentication failed' });
    res.status(500).json({ error: 'AI analysis failed: ' + err.message });
  }
});
```

---

### Part 2 — AI Chat Component

**Step 2.1** — Create `client/src/components/AIChatPanel.jsx`:

```jsx
import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

export default function AIChatPanel({ code, language, compilerOutput }) {
  const [messages, setMessages] = useState([]); // { role: 'user'|'assistant', content: string }
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const API = import.meta.env.VITE_API_URL;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const userMessage = input.trim();
    if (!userMessage || loading) return;

    const newMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`${API}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          language,
          compilerOutput,
          messages: newMessages, // send full history
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setMessages(prev => [...prev, { role: 'assistant', content: data.analysis }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => setMessages([]);

  return (
    <div className="ai-chat-panel">
      <div className="ai-chat-header">
        <span>🤖 AI Assistant</span>
        <button onClick={clearChat} title="Clear conversation">🗑️</button>
      </div>

      <div className="ai-chat-messages">
        {messages.length === 0 && (
          <div className="ai-chat-welcome">
            <p>Ask me anything about your code!</p>
            <div className="ai-suggestions">
              <button onClick={() => setInput('Explain what this code does')}>Explain this code</button>
              <button onClick={() => setInput('What is the time complexity?')}>Time complexity?</button>
              <button onClick={() => setInput('How can I optimize this?')}>Optimize it</button>
              <button onClick={() => setInput('Add error handling')}>Add error handling</button>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`ai-message ${msg.role}`}>
            <span className="ai-message-label">
              {msg.role === 'user' ? '👤 You' : '🤖 AI'}
            </span>
            <div className="ai-message-content">
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          </div>
        ))}

        {loading && (
          <div className="ai-message assistant loading">
            <span>🤖 AI</span>
            <div className="typing-indicator">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="ai-chat-input">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your code… (Enter to send, Shift+Enter for new line)"
          rows={2}
          disabled={loading}
        />
        <button onClick={sendMessage} disabled={loading || !input.trim()}>
          {loading ? '⏳' : '➤'}
        </button>
      </div>
    </div>
  );
}
```

---

### Part 3 — Install react-markdown

**Step 3.1**:
```bash
cd client
npm install react-markdown
```

---

### Part 4 — Replace AnalysisPanel with AIChatPanel

**Step 4.1** — In `Editor.jsx`, replace the existing `<AnalysisPanel />` with `<AIChatPanel />`:

```jsx
import AIChatPanel from '../components/AIChatPanel';

// Pass current code, language, and last compiler output
<AIChatPanel
  code={code}
  language={language}
  compilerOutput={lastOutput}
/>
```

**Step 4.2** — The old "Analyze" button can be removed. The AI chat is always available.

---

### Part 5 — Suggested Starter Prompts

Update the welcome state in `AIChatPanel` to show context-aware prompts depending on whether a DSA problem is active:

```jsx
const suggestions = currentProblem
  ? [
      `Explain the ${currentProblem.title} problem`,
      'Give me a hint',
      'Review my approach',
      'What data structure should I use?',
    ]
  : [
      'Explain what this code does',
      'What is the time complexity?',
      'How can I optimize this?',
      'Add unit tests',
    ];
```

---

### Part 6 — Testing Checklist

- [ ] Send a message → AI responds with code-aware answer
- [ ] Ask follow-up → AI remembers previous turns
- [ ] Clear chat → conversation resets
- [ ] AI response renders markdown (code blocks, bold, etc.) correctly
- [ ] Typing indicator shows while waiting for response
- [ ] Enter sends, Shift+Enter adds a new line
- [ ] Quick-suggestion buttons populate the input field correctly
- [ ] Rate limit error is shown as a friendly message

---

## Files Changed / Created

| File | Action |
|---|---|
| `client/src/components/AIChatPanel.jsx` | NEW |
| `client/src/pages/Editor.jsx` | MODIFY (replace AnalysisPanel with AIChatPanel) |
| `server/index.js` | MODIFY (update /api/analyze to accept messages array) |
| `client/package.json` | MODIFY (add react-markdown) |
