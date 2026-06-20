# 🧩 Feature 15 — Code Templates Library

> **Tier:** 3 — Nice to Have
> **Effort:** Low (~2–3 hours)
> **Dependencies:** None
> **Unlocks:** Faster start for interviews, less blank-page anxiety

---

## What & Why

Developers waste time writing boilerplate at the start of every session. A templates library provides one-click starter code for common patterns: binary search, graph BFS/DFS, linked list operations, REST API setup, etc.

---

## Implementation — Step by Step

### Part 1 — Templates Data File

**Step 1.1** — Create `client/src/constants/templates.js`:

```js
export const CODE_TEMPLATES = [
  {
    id: 'binary-search',
    title: 'Binary Search',
    category: 'Algorithms',
    language: 'javascript',
    code: `function binarySearch(arr, target) {
  let left = 0, right = arr.length - 1;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) left = mid + 1;
    else right = mid - 1;
  }
  return -1;
}

// Test
console.log(binarySearch([1, 3, 5, 7, 9], 5)); // 2`,
  },
  {
    id: 'bfs-graph',
    title: 'BFS (Graph)',
    category: 'Algorithms',
    language: 'javascript',
    code: `function bfs(graph, start) {
  const visited = new Set();
  const queue = [start];
  const result = [];
  visited.add(start);

  while (queue.length) {
    const node = queue.shift();
    result.push(node);
    for (const neighbor of (graph[node] || [])) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return result;
}

const graph = { A: ['B', 'C'], B: ['D'], C: ['D'], D: [] };
console.log(bfs(graph, 'A'));`,
  },
  {
    id: 'dfs-graph',
    title: 'DFS (Graph)',
    category: 'Algorithms',
    language: 'javascript',
    code: `function dfs(graph, start, visited = new Set()) {
  visited.add(start);
  console.log(start);
  for (const neighbor of (graph[start] || [])) {
    if (!visited.has(neighbor)) dfs(graph, neighbor, visited);
  }
}

const graph = { A: ['B', 'C'], B: ['D'], C: ['D'], D: [] };
dfs(graph, 'A');`,
  },
  {
    id: 'linked-list',
    title: 'Linked List',
    category: 'Data Structures',
    language: 'javascript',
    code: `class ListNode {
  constructor(val = 0, next = null) {
    this.val = val;
    this.next = next;
  }
}

class LinkedList {
  constructor() { this.head = null; }

  append(val) {
    const node = new ListNode(val);
    if (!this.head) { this.head = node; return; }
    let cur = this.head;
    while (cur.next) cur = cur.next;
    cur.next = node;
  }

  toArray() {
    const arr = [];
    let cur = this.head;
    while (cur) { arr.push(cur.val); cur = cur.next; }
    return arr;
  }
}

const list = new LinkedList();
list.append(1); list.append(2); list.append(3);
console.log(list.toArray()); // [1, 2, 3]`,
  },
  {
    id: 'two-pointers',
    title: 'Two Pointers',
    category: 'Algorithms',
    language: 'javascript',
    code: `// Two Sum (sorted array) — O(n) time, O(1) space
function twoSum(arr, target) {
  let left = 0, right = arr.length - 1;
  while (left < right) {
    const sum = arr[left] + arr[right];
    if (sum === target) return [left, right];
    if (sum < target) left++;
    else right--;
  }
  return [-1, -1];
}

console.log(twoSum([1, 2, 3, 4, 6], 6)); // [1, 3]`,
  },
  {
    id: 'sliding-window',
    title: 'Sliding Window',
    category: 'Algorithms',
    language: 'javascript',
    code: `// Max sum subarray of size k
function maxSumSubarray(arr, k) {
  let windowSum = arr.slice(0, k).reduce((a, b) => a + b, 0);
  let maxSum = windowSum;

  for (let i = k; i < arr.length; i++) {
    windowSum += arr[i] - arr[i - k];
    maxSum = Math.max(maxSum, windowSum);
  }
  return maxSum;
}

console.log(maxSumSubarray([2, 1, 5, 1, 3, 2], 3)); // 9`,
  },
  {
    id: 'dynamic-programming',
    title: 'Dynamic Programming (Fibonacci)',
    category: 'Algorithms',
    language: 'javascript',
    code: `// Bottom-up DP — O(n) time, O(1) space
function fibonacci(n) {
  if (n <= 1) return n;
  let prev = 0, curr = 1;
  for (let i = 2; i <= n; i++) {
    [prev, curr] = [curr, prev + curr];
  }
  return curr;
}

for (let i = 0; i <= 10; i++) {
  console.log(\`fib(\${i}) = \${fibonacci(i)}\`);
}`,
  },
  {
    id: 'python-binary-search',
    title: 'Binary Search (Python)',
    category: 'Algorithms',
    language: 'python',
    code: `def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1

arr = [1, 3, 5, 7, 9]
print(binary_search(arr, 5))  # 2`,
  },
  {
    id: 'express-api',
    title: 'Express REST API',
    category: 'Backend',
    language: 'javascript',
    code: `const express = require('express');
const app = express();
app.use(express.json());

const items = [];

app.get('/items', (req, res) => {
  res.json(items);
});

app.post('/items', (req, res) => {
  const item = { id: Date.now(), ...req.body };
  items.push(item);
  res.status(201).json(item);
});

app.delete('/items/:id', (req, res) => {
  const idx = items.findIndex(i => i.id === +req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  items.splice(idx, 1);
  res.json({ success: true });
});

app.listen(3000, () => console.log('Server on :3000'));`,
  },
];

export const TEMPLATE_CATEGORIES = [...new Set(CODE_TEMPLATES.map(t => t.category))];
```

---

### Part 2 — Templates Panel Component

**Step 2.1** — Create `client/src/components/TemplatesPanel.jsx`:

```jsx
import { useState } from 'react';
import { CODE_TEMPLATES, TEMPLATE_CATEGORIES } from '../constants/templates';

export default function TemplatesPanel({ onLoad }) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');

  const filtered = CODE_TEMPLATES.filter(t => {
    const matchesCategory = activeCategory === 'All' || t.category === activeCategory;
    const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="templates-panel">
      <h3>📚 Code Templates</h3>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search templates…"
        className="template-search"
      />

      <div className="template-categories">
        {['All', ...TEMPLATE_CATEGORIES].map(cat => (
          <button
            key={cat}
            className={`cat-btn ${activeCategory === cat ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="template-list">
        {filtered.map(template => (
          <div key={template.id} className="template-item">
            <div className="template-info">
              <span className="template-title">{template.title}</span>
              <span className="template-lang badge">{template.language}</span>
            </div>
            <button
              className="btn-load-template"
              onClick={() => onLoad(template.code, template.language)}
            >
              Load
            </button>
          </div>
        ))}
        {filtered.length === 0 && <p className="empty">No templates found.</p>}
      </div>
    </div>
  );
}
```

---

### Part 3 — Wire Up in Editor

**Step 3.1** — In `Editor.jsx`:

```jsx
import TemplatesPanel from '../components/TemplatesPanel';

const [showTemplates, setShowTemplates] = useState(false);

// Toolbar button:
<button onClick={() => setShowTemplates(s => !s)}>🧩 Templates</button>

// Render panel (in sidebar or as a modal):
{showTemplates && (
  <TemplatesPanel
    onLoad={(code, lang) => {
      setCode(code);
      setLanguage(lang);
      socket.emit('code-change', { roomId, code });
      socket.emit('language-change', { roomId, language: lang, code });
      setShowTemplates(false);
    }}
  />
)}
```

---

### Part 4 — Testing Checklist

- [ ] Open templates panel → templates load grouped by category
- [ ] Search for "binary" → only Binary Search templates show
- [ ] Click "Load" → editor updates with template code and language
- [ ] Template language change syncs to all room members
- [ ] Template panel can be closed after loading

---

## Files Changed / Created

| File | Action |
|---|---|
| `client/src/constants/templates.js` | NEW |
| `client/src/components/TemplatesPanel.jsx` | NEW |
| `client/src/pages/Editor.jsx` | MODIFY (add Templates button and panel) |
