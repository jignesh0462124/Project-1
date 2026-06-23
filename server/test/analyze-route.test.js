const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const { registerRoutes } = require('../routes');
const { analyzeCode, parseAnalysisResponse } = require('../providers/openrouter');

function noopLimiter(_req, _res, next) {
  next();
}

function createTestApp({
  requireAuth = (_req, _res, next) => next(),
  routeAnalyzeCode,
  handleOpenRouterError,
} = {}) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  registerRoutes(app, {
    rooms: new Map(),
    roomService: {
      isSupabaseConfigured: false,
      getRoom: async () => ({ data: null, error: null }),
    },
    requireAuth,
    executeLimiter: noopLimiter,
    analyzeLimiter: noopLimiter,
    createRoomLimiter: noopLimiter,
    generateRoomId: () => 'ROOM1234',
    executeCode: async () => ({ statusCode: 200, body: { status: { id: 3, description: 'Accepted' } } }),
    analyzeCode: routeAnalyzeCode || (async () => ({ statusCode: 200, body: { fixes: [], quality: { score: 90, grade: 'A', items: [] }, complexity: { time: 'O(1)', space: 'O(1)', explanation: 'constant' } } })),
    handleOpenRouterError: handleOpenRouterError || (() => ({ statusCode: 500, body: { error: 'analysis failed' } })),
  });
  return app;
}

test('POST /api/analyze requires authentication middleware', async () => {
  const response = await request(createTestApp({
    requireAuth: (_req, res) => res.status(401).json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }),
  }))
    .post('/api/analyze')
    .send({ code: 'console.log(1)', language: 'javascript' });

  assert.equal(response.status, 401);
  assert.equal(response.body.code, 'AUTH_REQUIRED');
});

test('POST /api/analyze rejects missing code or language', async () => {
  const response = await request(createTestApp())
    .post('/api/analyze')
    .send({ code: 'console.log(1)' });

  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'code and language are required');
});

test('POST /api/analyze normalizes compiler output and calls analyzer', async () => {
  const calls = [];
  const response = await request(createTestApp({
    routeAnalyzeCode: async (payload) => {
      calls.push(payload);
      return { statusCode: 200, body: { fixes: [], quality: { score: 88, grade: 'B', items: [] }, complexity: { time: 'O(1)', space: 'O(1)', explanation: 'constant work' } } };
    },
  }))
    .post('/api/analyze')
    .send({
      code: 'console.log(1)',
      language: 'javascript',
      compilerOutput: 'x'.repeat(2500),
    });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.fixes, []);
  assert.equal(response.body.quality.score, 88);
  assert.equal(response.body.complexity.time, 'O(1)');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].compilerOutput.length, 2000);
});

test('POST /api/analyze maps analyzer errors through error handler', async () => {
  const response = await request(createTestApp({
    routeAnalyzeCode: async () => {
      throw new Error('provider failed');
    },
    handleOpenRouterError: (err) => ({
      statusCode: 200,
      body: { analysis: `fallback: ${err.message}`, provider: 'local-fallback' },
    }),
  }))
    .post('/api/analyze')
    .send({ code: 'console.log(1)', language: 'javascript' });

  assert.equal(response.status, 200);
  assert.equal(response.body.provider, 'local-fallback');
  assert.equal(response.body.analysis, 'fallback: provider failed');
});

test('analyzeCode uses local fallback when OpenRouter key is absent', async () => {
  const previousKey = process.env.OPENROUTER_API_KEY;
  const previousFallback = process.env.ANALYSIS_FALLBACK_ON_ERROR;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.ANALYSIS_FALLBACK_ON_ERROR;

  try {
    const result = await analyzeCode({
      code: 'var value = 1;\nconsole.log(value == "1")',
      language: 'javascript',
      compilerOutput: 'No error',
    });

    assert.equal(result.statusCode, 200);
    assert.ok(Array.isArray(result.body.fixes));
    assert.equal(result.body.quality.items[0].category, 'Analyzer');
    assert.match(result.body.quality.items[0].comment, /OpenRouter API key is not configured/);
    assert.match(result.body.fixes.map(item => item.title).join(' '), /strict equality/i);
  } finally {
    if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previousKey;

    if (previousFallback === undefined) delete process.env.ANALYSIS_FALLBACK_ON_ERROR;
    else process.env.ANALYSIS_FALLBACK_ON_ERROR = previousFallback;
  }
});

test('parseAnalysisResponse returns safe structured fallback for invalid JSON', () => {
  const result = parseAnalysisResponse('not-json');

  assert.ok(Array.isArray(result.fixes));
  assert.equal(result.quality.grade, 'F');
  assert.equal(result.complexity.time, 'O(?)');
});