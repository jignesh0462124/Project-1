const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const { registerRoutes } = require('../routes');
const { createExecutionToken } = require('../executionToken');

function noopLimiter(_req, _res, next) {
  next();
}

function createTestApp({ executeCode } = {}) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  registerRoutes(app, {
    rooms: new Map(),
    roomService: {
      isSupabaseConfigured: false,
      getRoom: async () => ({ data: null, error: null }),
    },
    requireAuth: (_req, _res, next) => next(),
    executeLimiter: noopLimiter,
    analyzeLimiter: noopLimiter,
    createRoomLimiter: noopLimiter,
    generateRoomId: () => 'ROOM1234',
    executeCode: executeCode || (async () => ({ statusCode: 200, body: { status: { id: 3, description: 'Accepted' } } })),
    analyzeCode: async () => ({ statusCode: 200, body: { analysis: 'ok' } }),
    handleOpenRouterError: () => ({ statusCode: 500, body: { error: 'analysis failed' } }),
  });
  return app;
}

function validToken(roomId = 'ROOM1234') {
  return createExecutionToken({ roomId, socketId: 'socket-1', secret: process.env.EXECUTION_TOKEN_SECRET });
}

test('POST /api/execute rejects missing roomId', async () => {
  const response = await request(createTestApp())
    .post('/api/execute')
    .send({ executionToken: 'token', code: 'console.log(1)', language: 'javascript' });

  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'roomId is required');
});

test('POST /api/execute rejects missing executionToken', async () => {
  const response = await request(createTestApp())
    .post('/api/execute')
    .send({ roomId: 'ROOM1234', code: 'console.log(1)', language: 'javascript' });

  assert.equal(response.status, 403);
  assert.equal(response.body.code, 'EXECUTION_TOKEN_REQUIRED');
});

test('POST /api/execute rejects expired executionToken', async () => {
  const token = createExecutionToken({ roomId: 'ROOM1234', socketId: 'socket-1', ttlMs: -1, secret: process.env.EXECUTION_TOKEN_SECRET });
  const response = await request(createTestApp())
    .post('/api/execute')
    .send({ roomId: 'ROOM1234', executionToken: token, code: 'console.log(1)', language: 'javascript' });

  assert.equal(response.status, 403);
  assert.equal(response.body.code, 'EXECUTION_TOKEN_EXPIRED');
});

test('POST /api/execute rejects unsupported language', async () => {
  const response = await request(createTestApp())
    .post('/api/execute')
    .send({ roomId: 'ROOM1234', executionToken: validToken(), code: 'print(1)', language: 'brainfuck' });

  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'Unsupported language: brainfuck');
});

test('POST /api/execute rejects oversized code', async () => {
  const response = await request(createTestApp())
    .post('/api/execute')
    .send({ roomId: 'ROOM1234', executionToken: validToken(), code: 'x'.repeat(50001), language: 'javascript' });

  assert.equal(response.status, 400);
  assert.match(response.body.error, /maximum length/);
});

test('POST /api/execute rejects unsafe code', async () => {
  const response = await request(createTestApp())
    .post('/api/execute')
    .send({ roomId: 'ROOM1234', executionToken: validToken(), code: 'while (true) {}', language: 'javascript' });

  assert.equal(response.status, 400);
  assert.match(response.body.error, /long-running/);
});

test('POST /api/execute accepts a valid room token and calls provider', async () => {
  const calls = [];
  const app = createTestApp({
    executeCode: async (payload) => {
      calls.push(payload);
      return { statusCode: 200, body: { stdout: 'ok', status: { id: 3, description: 'Accepted' } } };
    },
  });

  const response = await request(app)
    .post('/api/execute')
    .send({ roomId: 'ROOM1234', executionToken: validToken(), code: 'console.log(1)', language: 'javascript' });

  assert.equal(response.status, 200);
  assert.equal(response.body.stdout, 'ok');
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], { code: 'console.log(1)', language: 'javascript' });
});
