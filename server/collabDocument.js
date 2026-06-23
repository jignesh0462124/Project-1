const Y = require('yjs');

function createCollabDocument(initialCode = '') {
  const ydoc = new Y.Doc();
  const ytext = ydoc.getText('code');
  if (initialCode) ytext.insert(0, initialCode);
  return { ydoc, ytext };
}

function attachCollabDocument(room, initialCode = '') {
  if (room.ydoc && room.ytext) return room;
  const { ydoc, ytext } = createCollabDocument(initialCode || room.code || '');
  room.ydoc = ydoc;
  room.ytext = ytext;
  room.code = ytext.toString();
  return room;
}

function normalizeDocumentUpdate(update) {
  if (update instanceof Uint8Array) return update;
  if (Buffer.isBuffer(update)) return new Uint8Array(update);
  if (Array.isArray(update)) return Uint8Array.from(update);
  if (update instanceof ArrayBuffer) return new Uint8Array(update);
  if (update?.data && Array.isArray(update.data)) return Uint8Array.from(update.data);
  throw new Error('Invalid document update');
}

function encodeDocumentUpdate(update) {
  return Array.from(normalizeDocumentUpdate(update));
}

function getDocumentStatePayload(room) {
  attachCollabDocument(room);
  return Array.from(Y.encodeStateAsUpdate(room.ydoc));
}

function applyDocumentUpdate(room, update) {
  attachCollabDocument(room);
  const normalizedUpdate = normalizeDocumentUpdate(update);
  Y.applyUpdate(room.ydoc, normalizedUpdate, 'remote-client');
  room.code = room.ytext.toString();
  return normalizedUpdate;
}

function replaceDocumentText(room, nextCode = '') {
  attachCollabDocument(room);
  const updates = [];
  const captureUpdate = (update) => updates.push(update);
  room.ydoc.on('update', captureUpdate);
  room.ydoc.transact(() => {
    if (room.ytext.length) room.ytext.delete(0, room.ytext.length);
    if (nextCode) room.ytext.insert(0, nextCode);
  }, 'server-replace');
  room.ydoc.off('update', captureUpdate);
  room.code = room.ytext.toString();
  if (updates.length === 0) return Array.from(Y.encodeStateAsUpdate(room.ydoc));
  return Array.from(updates.length === 1 ? updates[0] : Y.mergeUpdates(updates));
}

module.exports = {
  createCollabDocument,
  attachCollabDocument,
  normalizeDocumentUpdate,
  encodeDocumentUpdate,
  getDocumentStatePayload,
  applyDocumentUpdate,
  replaceDocumentText,
};