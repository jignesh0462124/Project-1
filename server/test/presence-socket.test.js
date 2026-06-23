const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const serverSource = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
const clientEditorSource = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'src', 'pages', 'Editor.jsx'), 'utf8');

function getSocketHandler(eventName) {
  const start = serverSource.indexOf(`socket.on('${eventName}'`);
  assert.notEqual(start, -1, `${eventName} handler should exist`);

  const nextHandler = serverSource.indexOf('\n  socket.on(', start + 1);
  assert.notEqual(nextHandler, -1, `${eventName} handler should be followed by another socket handler`);

  return serverSource.slice(start, nextHandler);
}

test('code-change broadcasts code only and never writes presence', () => {
  const handler = getSocketHandler('code-change');

  assert.match(handler, /socket\.on\('code-change', \(\{ roomId, code \}\)/);
  assert.match(handler, /socket\.to\(roomId\)\.emit\('code-updated'/);
  assert.doesNotMatch(handler, /updateUserPresence/);
  assert.doesNotMatch(handler, /presence-updated/);
  assert.doesNotMatch(handler, /cursor-updated/);
  assert.doesNotMatch(handler, /\bposition\b/);
  assert.doesNotMatch(handler, /\bselection\b/);
  assert.doesNotMatch(handler, /\bpresence\b/);
});

test('cursor-move broadcasts one presence delta only to other sockets', () => {
  const handler = getSocketHandler('cursor-move');

  assert.match(handler, /socket\.on\('cursor-move', \(\{ roomId, position, selection \}\)/);
  assert.match(handler, /isValidCursorPosition\(position\)/);
  assert.match(handler, /isValidSelectionRange\(selection\)/);
  assert.match(handler, /updateUserPresence\(user, position, selection\)/);
  assert.match(handler, /socket\.to\(roomId\)\.emit\('cursor-updated', presence\)/);
  assert.doesNotMatch(handler, /io\.to\(roomId\)\.emit\('cursor-updated'/);
  assert.doesNotMatch(handler, /presence-updated/);
});

test('room roster broadcasts do not include full presence snapshots', () => {
  const userJoinedStart = serverSource.indexOf("socket.to(roomId).emit('user-joined'");
  const codeChangeStart = serverSource.indexOf("socket.on('code-change'", userJoinedStart);
  const userJoinedBlock = serverSource.slice(userJoinedStart, codeChangeStart);

  const ownershipStart = serverSource.indexOf("io.to(roomId).emit('ownership-transferred'");
  const ownershipEnd = serverSource.indexOf("socket.on('get-problems'", ownershipStart);
  const ownershipBlock = serverSource.slice(ownershipStart, ownershipEnd);

  const newOwnerStart = serverSource.indexOf("io.to(roomId).emit('new-owner'");
  const newOwnerEnd = serverSource.indexOf("// Notify remaining users", newOwnerStart);
  const newOwnerBlock = serverSource.slice(newOwnerStart, newOwnerEnd);

  assert.doesNotMatch(userJoinedBlock, /presence: getRoomPresence/);
  assert.doesNotMatch(ownershipBlock, /presence: getRoomPresence/);
  assert.doesNotMatch(newOwnerBlock, /presence: getRoomPresence/);
});

test('leaving a room removes the departed user presence before roster update', () => {
  const presenceRemovedIndex = serverSource.indexOf("io.to(roomId).emit('presence-removed'");
  const userLeftIndex = serverSource.indexOf("io.to(roomId).emit('user-left'", presenceRemovedIndex);

  assert.notEqual(presenceRemovedIndex, -1, 'presence-removed event should be emitted');
  assert.notEqual(userLeftIndex, -1, 'user-left event should still be emitted');
  assert.ok(presenceRemovedIndex < userLeftIndex, 'presence removal should happen before the user-left roster event');
});
test('document-update validates membership, pause state, and broadcasts Yjs deltas', () => {
  const handler = getSocketHandler('document-update');

  assert.match(handler, /socket\.on\('document-update', \(\{ roomId, update \}\)/);
  assert.match(handler, /const sender = room\.users\.find\(u => u\.id === socket\.id\)/);
  assert.match(handler, /sender\.isPaused/);
  assert.match(handler, /applyDocumentUpdate\(room, update\)/);
  assert.match(handler, /scheduleRoomCodePersist\(roomId, room\)/);
  assert.match(handler, /socket\.to\(roomId\)\.emit\('document-update'/);
  assert.doesNotMatch(handler, /io\.to\(roomId\)\.emit\('document-update'/);
});

test('client normal typing uses Yjs document-update and not code-change', () => {
  assert.match(clientEditorSource, /new MonacoBinding\(/);
  assert.match(clientEditorSource, /socketRef\.current\.emit\('document-update'/);
  assert.doesNotMatch(clientEditorSource, /socketRef\.current\.emit\('code-change'/);
  assert.doesNotMatch(clientEditorSource, /onChange=\{handleEditorChange\}/);
});