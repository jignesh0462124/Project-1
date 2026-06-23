const test = require('node:test');
const assert = require('node:assert/strict');
const Y = require('yjs');
const {
  attachCollabDocument,
  applyDocumentUpdate,
  createCollabDocument,
  getDocumentStatePayload,
  normalizeDocumentUpdate,
  replaceDocumentText,
} = require('../collabDocument');

test('initial Yjs document state contains the room code', () => {
  const room = attachCollabDocument({ code: 'console.log("hello")' });
  const remote = new Y.Doc();

  Y.applyUpdate(remote, Uint8Array.from(getDocumentStatePayload(room)));

  assert.equal(remote.getText('code').toString(), 'console.log("hello")');
});

test('independent Yjs updates merge without overwriting each other', () => {
  const serverRoom = attachCollabDocument({ code: '' });
  const alice = new Y.Doc();
  const bob = new Y.Doc();

  Y.applyUpdate(alice, Uint8Array.from(getDocumentStatePayload(serverRoom)));
  Y.applyUpdate(bob, Uint8Array.from(getDocumentStatePayload(serverRoom)));

  alice.getText('code').insert(0, 'alice');
  bob.getText('code').insert(0, 'bob');

  applyDocumentUpdate(serverRoom, Y.encodeStateAsUpdate(alice));
  applyDocumentUpdate(serverRoom, Y.encodeStateAsUpdate(bob));

  const merged = serverRoom.ytext.toString();
  assert.match(merged, /alice/);
  assert.match(merged, /bob/);
});

test('replaceDocumentText returns an update that replaces remote document text', () => {
  const room = attachCollabDocument({ code: 'before' });
  const remote = new Y.Doc();
  Y.applyUpdate(remote, Uint8Array.from(getDocumentStatePayload(room)));

  const update = replaceDocumentText(room, 'after');
  Y.applyUpdate(remote, Uint8Array.from(update));

  assert.equal(room.code, 'after');
  assert.equal(remote.getText('code').toString(), 'after');
});

test('normalizeDocumentUpdate rejects invalid payloads', () => {
  assert.throws(() => normalizeDocumentUpdate('not-an-update'), /Invalid document update/);
});

test('createCollabDocument creates a code text type', () => {
  const { ytext } = createCollabDocument('seed');
  assert.equal(ytext.toString(), 'seed');
});