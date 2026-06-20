# 📸 Feature 14 — Code Screenshot / Share

> **Tier:** 2 — Great Addition
> **Effort:** Low (~2–4 hours)
> **Dependencies:** None
> **Unlocks:** Easy code sharing on social media, Discord, Slack

---

## What & Why

Developers love sharing beautiful code screenshots. Tools like carbon.now.sh are hugely popular. Adding a one-click "Export as Image" button lets users share their code on Twitter/X, LinkedIn, Discord, or in documentation — with the platform's styling automatically applied.

---

## Implementation — Step by Step

### Part 1 — Install html-to-image

**Step 1.1**:
```bash
cd client
npm install html-to-image
```

> **Why html-to-image over html2canvas?** It's smaller, works better with modern CSS, and handles monospace fonts more reliably.

---

### Part 2 — Code Screenshot Component

**Step 2.1** — Create `client/src/components/CodeScreenshot.jsx`:

```jsx
import { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import toast from 'react-hot-toast';

// Fake window controls (macOS style dots)
function WindowDots({ theme }) {
  return (
    <div className="window-dots">
      <span style={{ background: '#ff5f57' }} />
      <span style={{ background: '#febc2e' }} />
      <span style={{ background: '#28c840' }} />
    </div>
  );
}

export default function CodeScreenshot({ code, language, isDark, onClose }) {
  const screenshotRef = useRef(null);
  const [capturing, setCapturing] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [padding, setPadding] = useState(32);
  const [showLineNumbers, setShowLineNumbers] = useState(true);

  const handleDownload = async () => {
    if (!screenshotRef.current) return;
    setCapturing(true);
    try {
      const dataUrl = await toPng(screenshotRef.current, {
        quality: 1,
        pixelRatio: 2,   // Retina quality
      });
      const link = document.createElement('a');
      link.download = `code-snippet.png`;
      link.href = dataUrl;
      link.click();
      toast.success('Screenshot saved!');
    } catch (err) {
      toast.error('Screenshot failed: ' + err.message);
    } finally {
      setCapturing(false);
    }
  };

  const handleCopyToClipboard = async () => {
    if (!screenshotRef.current) return;
    setCapturing(true);
    try {
      const dataUrl = await toPng(screenshotRef.current, { pixelRatio: 2 });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      toast.success('Copied to clipboard!');
    } catch {
      toast.error('Copy failed — try the Download button instead.');
    } finally {
      setCapturing(false);
    }
  };

  // Add line numbers to code
  const lines = code.split('\n');
  const numbered = lines.map((line, i) => ({
    number: i + 1,
    code: line,
  }));

  return (
    <div className="screenshot-modal-overlay">
      <div className="screenshot-modal">
        <h2>📸 Export as Image</h2>

        {/* Controls */}
        <div className="screenshot-controls">
          <label>
            Theme:
            <select value={theme} onChange={e => setTheme(e.target.value)}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="monokai">Monokai</option>
            </select>
          </label>
          <label>
            Padding:
            <input type="range" min={16} max={64} value={padding} onChange={e => setPadding(+e.target.value)} />
            {padding}px
          </label>
          <label>
            <input type="checkbox" checked={showLineNumbers} onChange={e => setShowLineNumbers(e.target.checked)} />
            Line numbers
          </label>
        </div>

        {/* Preview */}
        <div className="screenshot-preview">
          <div
            ref={screenshotRef}
            className={`code-card theme-${theme}`}
            style={{ padding: `${padding}px` }}
          >
            <div className="code-card-header">
              <WindowDots />
              <span className="code-card-lang">{language}</span>
            </div>
            <pre className="code-card-body">
              {numbered.map(({ number, code: lineCode }) => (
                <div key={number} className="code-line">
                  {showLineNumbers && <span className="line-number">{number}</span>}
                  <span className="line-code">{lineCode}</span>
                </div>
              ))}
            </pre>
            <div className="code-card-footer">
              <span>Collaborative Platform</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="screenshot-actions">
          <button onClick={onClose}>Cancel</button>
          <button onClick={handleCopyToClipboard} disabled={capturing}>
            📋 Copy to Clipboard
          </button>
          <button onClick={handleDownload} disabled={capturing} className="btn-primary">
            {capturing ? 'Generating…' : '⬇️ Download PNG'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

### Part 3 — CSS for the Code Card

**Step 3.1** — Add to `client/src/styles/pixel.css`:

```css
.code-card {
  border-radius: 12px;
  min-width: 400px;
  max-width: 800px;
  font-family: 'Fira Code', 'Cascadia Code', monospace;
  font-size: 13px;
}

.code-card.theme-dark {
  background: linear-gradient(135deg, #0d1117 0%, #161b22 100%);
  color: #e6edf3;
}

.code-card.theme-light {
  background: linear-gradient(135deg, #f6f8fa 0%, #eaecef 100%);
  color: #24292f;
}

.code-card.theme-monokai {
  background: linear-gradient(135deg, #272822 0%, #1e1e1e 100%);
  color: #f8f8f2;
}

.code-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.window-dots span {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.code-card-lang {
  margin-left: auto;
  font-size: 11px;
  opacity: 0.5;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.code-card-body {
  margin: 0;
  overflow: visible;
}

.code-line {
  display: flex;
  gap: 16px;
  line-height: 1.7;
}

.line-number {
  opacity: 0.3;
  min-width: 2ch;
  text-align: right;
  user-select: none;
}

.code-card-footer {
  margin-top: 16px;
  text-align: right;
  font-size: 10px;
  opacity: 0.3;
  letter-spacing: 1px;
}
```

---

### Part 4 — Wire Up in Editor

**Step 4.1** — In `Editor.jsx`, add state and the button:

```jsx
const [showScreenshot, setShowScreenshot] = useState(false);

// In toolbar JSX:
<button onClick={() => setShowScreenshot(true)} title="Export code as image">
  📸 Export
</button>

{showScreenshot && (
  <CodeScreenshot
    code={code}
    language={language}
    onClose={() => setShowScreenshot(false)}
  />
)}
```

---

### Part 5 — Testing Checklist

- [ ] Click Export — preview modal opens with code rendered
- [ ] Change theme — preview updates live
- [ ] Adjust padding — preview updates live
- [ ] Toggle line numbers — preview updates live
- [ ] Download PNG — file saves at 2x pixel density (crisp on retina)
- [ ] Copy to Clipboard — can paste into Discord/Slack
- [ ] Long code snippets don't get cut off in the image
- [ ] Empty code shows empty state gracefully

---

## Files Changed / Created

| File | Action |
|---|---|
| `client/src/components/CodeScreenshot.jsx` | NEW |
| `client/src/styles/pixel.css` | MODIFY (add .code-card styles) |
| `client/src/pages/Editor.jsx` | MODIFY (add Export button, CodeScreenshot modal) |
| `client/package.json` | MODIFY (add html-to-image) |
