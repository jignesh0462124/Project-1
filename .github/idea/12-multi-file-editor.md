# 📁 Feature 12 — Multi-File Editor

> **Tier:** 2 — Great Addition
> **Effort:** High (~3–4 days)
> **Dependencies:** Feature 02 (persist files), Feature 01 (user identity)
> **Unlocks:** Real project collaboration, advanced interview scenarios

---

## What & Why

Real-world programming always involves multiple files. Interviews involving system design often need a `models.py` + `api.py` + `tests.py`. Monaco Editor already supports multiple models — we just need to add a file tree sidebar and sync file state across users.

---

## Implementation — Step by Step

### Part 1 — Data Model for Files

**Step 1.1** — The room state needs to support multiple files. Add to the in-memory room object:

```js
// In server/index.js when creating a room:
rooms.set(roomId, {
  users: [],
  // Replace single `code` with a files map
  files: {
    'main.js': { code: '// Start coding here\n', language: 'javascript' }
  },
  activeFile: 'main.js',
  language: 'javascript',
  // ... rest of existing fields
});
```

**Step 1.2** — Add to the Supabase `rooms` table (optional migration):
```sql
ALTER TABLE rooms ADD COLUMN files JSONB DEFAULT '{}';
ALTER TABLE rooms ADD COLUMN active_file TEXT DEFAULT 'main.js';
```

---

### Part 2 — File Management Socket Events

**Step 2.1** — Add file events to `server/index.js`:

```js
// Create a new file
socket.on('create-file', ({ roomId, filename }) => {
  const room = rooms.get(roomId);
  if (!room || room.owner !== socket.username) return;
  if (room.files[filename]) return socket.emit('file-error', { message: 'File already exists' });

  // Infer language from extension
  const ext = filename.split('.').pop();
  const langMap = { js: 'javascript', ts: 'typescript', py: 'python', java: 'java', cpp: 'cpp', go: 'go', rs: 'rust' };
  const language = langMap[ext] || 'plaintext';

  room.files[filename] = { code: '', language };
  io.to(roomId).emit('file-created', { filename, language });
});

// Delete a file
socket.on('delete-file', ({ roomId, filename }) => {
  const room = rooms.get(roomId);
  if (!room || room.owner !== socket.username) return;
  if (Object.keys(room.files).length <= 1) return socket.emit('file-error', { message: 'Cannot delete the last file' });

  delete room.files[filename];
  const newActive = Object.keys(room.files)[0];
  room.activeFile = newActive;
  io.to(roomId).emit('file-deleted', { filename, newActiveFile: newActive });
});

// Rename a file
socket.on('rename-file', ({ roomId, oldName, newName }) => {
  const room = rooms.get(roomId);
  if (!room || room.owner !== socket.username) return;
  if (!room.files[oldName]) return;

  room.files[newName] = room.files[oldName];
  delete room.files[oldName];
  if (room.activeFile === oldName) room.activeFile = newName;
  io.to(roomId).emit('file-renamed', { oldName, newName });
});

// Switch active file
socket.on('switch-file', ({ roomId, filename }) => {
  const room = rooms.get(roomId);
  if (!room || !room.files[filename]) return;
  room.activeFile = filename;
  io.to(roomId).emit('file-switched', {
    filename,
    code: room.files[filename].code,
    language: room.files[filename].language,
  });
});

// Code change per file
socket.on('code-change', ({ roomId, filename, code }) => {
  const room = rooms.get(roomId);
  if (!room) return;
  const file = room.files[filename || room.activeFile];
  if (file) file.code = code;
  socket.to(roomId).emit('code-updated', { filename: filename || room.activeFile, code });
});
```

---

### Part 3 — File Tree Component

**Step 3.1** — Create `client/src/components/FileTree.jsx`:

```jsx
import { useState } from 'react';

export default function FileTree({ files, activeFile, isOwner, onSwitch, onCreate, onDelete, onRename }) {
  const [showNewInput, setShowNewInput] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [renamingFile, setRenamingFile] = useState(null);

  const handleCreate = () => {
    if (!newFileName.trim()) return;
    onCreate(newFileName.trim());
    setNewFileName('');
    setShowNewInput(false);
  };

  const handleRename = (oldName) => {
    if (!renamingFile || !renamingFile.newName.trim()) return;
    onRename(oldName, renamingFile.newName);
    setRenamingFile(null);
  };

  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop();
    const icons = { js: '🟨', ts: '🔷', py: '🐍', java: '☕', cpp: '⚙️', go: '🐹', rs: '🦀', md: '📝', json: '📋' };
    return icons[ext] || '📄';
  };

  return (
    <div className="file-tree">
      <div className="file-tree-header">
        <span>FILES</span>
        {isOwner && (
          <button onClick={() => setShowNewInput(s => !s)} title="New file">+</button>
        )}
      </div>

      {showNewInput && (
        <div className="new-file-input">
          <input
            value={newFileName}
            onChange={e => setNewFileName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="filename.js"
            autoFocus
          />
          <button onClick={handleCreate}>✓</button>
          <button onClick={() => setShowNewInput(false)}>✕</button>
        </div>
      )}

      {Object.keys(files).map(filename => (
        <div
          key={filename}
          className={`file-item ${filename === activeFile ? 'active' : ''}`}
          onClick={() => onSwitch(filename)}
        >
          <span className="file-icon">{getFileIcon(filename)}</span>
          {renamingFile?.name === filename ? (
            <input
              value={renamingFile.newName}
              onChange={e => setRenamingFile({ name: filename, newName: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') handleRename(filename); }}
              onBlur={() => setRenamingFile(null)}
              autoFocus
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span className="file-name">{filename}</span>
          )}
          {isOwner && (
            <div className="file-actions">
              <button onClick={e => { e.stopPropagation(); setRenamingFile({ name: filename, newName: filename }); }} title="Rename">✏️</button>
              <button onClick={e => { e.stopPropagation(); onDelete(filename); }} title="Delete">🗑️</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

---

### Part 4 — Monaco Multi-Model Integration

**Step 4.1** — In `Editor.jsx`, manage multiple Monaco models:

```jsx
import { useRef, useEffect } from 'react';

const editorRef = useRef(null);
const monacoRef = useRef(null);

// Create a Monaco model per file
const getOrCreateModel = (filename, code, language) => {
  const monaco = monacoRef.current;
  const uri = monaco.Uri.parse(`file:///${filename}`);
  let model = monaco.editor.getModel(uri);
  if (!model) {
    model = monaco.editor.createModel(code, language, uri);
  }
  return model;
};

// When user switches files
const handleFileSwitch = (filename) => {
  const file = files[filename];
  const model = getOrCreateModel(filename, file.code, file.language);
  editorRef.current?.setModel(model);
  setActiveFile(filename);
  socket.emit('switch-file', { roomId, filename });
};

// Initialize models for all files on mount
const handleEditorMount = (editor, monaco) => {
  editorRef.current = editor;
  monacoRef.current = monaco;
  // Create models for each file
  Object.entries(files).forEach(([name, f]) => {
    getOrCreateModel(name, f.code, f.language);
  });
  // Set initial model
  const initialModel = getOrCreateModel(activeFile, files[activeFile].code, files[activeFile].language);
  editor.setModel(initialModel);
};
```

---

### Part 5 — Layout with File Tree

**Step 5.1** — Update `Editor.jsx` layout to include the file tree sidebar:

```jsx
<div className="editor-layout">
  <div className="sidebar">
    <FileTree
      files={files}
      activeFile={activeFile}
      isOwner={isOwner}
      onSwitch={handleFileSwitch}
      onCreate={(name) => socket.emit('create-file', { roomId, filename: name })}
      onDelete={(name) => socket.emit('delete-file', { roomId, filename: name })}
      onRename={(old, next) => socket.emit('rename-file', { roomId, oldName: old, newName: next })}
    />
    <UserList ... />
  </div>
  <div className="main-area">
    <MonacoEditor onMount={handleEditorMount} ... />
  </div>
</div>
```

---

### Part 6 — Testing Checklist

- [ ] Create a new file → appears in file tree for all users
- [ ] Switch files → Monaco switches to that file's content and language
- [ ] Edit in file A, switch to B, come back to A — A's content preserved
- [ ] Rename a file → all users see the new name
- [ ] Delete a file → all users' file trees update, editor switches to another file
- [ ] Cannot delete the last file — error toast shows
- [ ] Code changes in one file don't affect another file's content
- [ ] Late joiner receives all files and the currently active file

---

## Files Changed / Created

| File | Action |
|---|---|
| `client/src/components/FileTree.jsx` | NEW |
| `client/src/pages/Editor.jsx` | MODIFY (multi-model Monaco, socket file events, layout) |
| `server/index.js` | MODIFY (create/delete/rename/switch-file events, multi-file code-change) |
