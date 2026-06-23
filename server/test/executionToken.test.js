const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createExecutionToken,
  verifyExecutionToken,
} = require('../executionToken');

const secret = 'test-secret';
const now = 1_700_000_000_000;

test('execution token verifies for the matching room before expiry', () => {
  const token = createExecutionToken({ roomId: 'ROOM1234', socketId: 'socket-1', userId: 'user-1', now, ttlMs: 1000, secret });
  const result = verifyExecutionToken(token, { roomId: 'ROOM1234', now: now + 500, secret });

  assert.equal(result.valid, true);
  assert.equal(result.payload.roomId, 'ROOM1234');
  assert.equal(result.payload.socketId, 'socket-1');
  assert.equal(result.payload.userId, 'user-1');
});

test('execution token rejects expired tokens', () => {
  const token = createExecutionToken({ roomId: 'ROOM1234', socketId: 'socket-1', now, ttlMs: 1000, secret });
  const result = verifyExecutionToken(token, { roomId: 'ROOM1234', now: now + 1001, secret });

  assert.equal(result.valid, false);
  assert.equal(result.code, 'EXECUTION_TOKEN_EXPIRED');
});

test('execution token rejects room mismatch', () => {
  const token = createExecutionToken({ roomId: 'ROOM1234', socketId: 'socket-1', now, ttlMs: 1000, secret });
  const result = verifyExecutionToken(token, { roomId: 'OTHER123', now: now + 500, secret });

  assert.equal(result.valid, false);
  assert.equal(result.code, 'EXECUTION_TOKEN_ROOM_MISMATCH');
});

test('execution token rejects tampered signatures', () => {
  const token = createExecutionToken({ roomId: 'ROOM1234', socketId: 'socket-1', now, ttlMs: 1000, secret });
  const tampered = token.replace(/.$/, token.endsWith('a') ? 'b' : 'a');
  const result = verifyExecutionToken(tampered, { roomId: 'ROOM1234', now: now + 500, secret });

  assert.equal(result.valid, false);
  assert.equal(result.code, 'EXECUTION_TOKEN_INVALID');
});
