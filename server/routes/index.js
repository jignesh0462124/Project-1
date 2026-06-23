const { DSA_PROBLEMS } = require('../problems');
const {
  JDOODLE_LANGUAGES,
  normalizeRoomId,
  isValidCodePayload,
  isSafeExecutableCode,
  normalizeCompilerOutput,
} = require('../validators');
const { verifyExecutionToken } = require('../executionToken');

function registerRoutes(app, {
  rooms,
  roomService,
  requireAuth,
  executeLimiter,
  analyzeLimiter,
  createRoomLimiter,
  generateRoomId,
  executeCode,
  analyzeCode,
  handleOpenRouterError,
}) {
  app.get('/api/create-room', createRoomLimiter, (_req, res) => {
    const roomId = generateRoomId();
    res.json({ roomId });
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/health/details', requireAuth, (_req, res) => {
    res.json({
      status: 'ok',
      rooms: rooms.size,
      supabase: {
        configured: roomService.isSupabaseConfigured,
        persistence: roomService.isSupabaseConfigured ? 'enabled' : 'disabled'
      },
      timestamp: new Date().toISOString()
    });
  });

  app.get('/api/rooms/:roomId', requireAuth, async (req, res) => {
    const roomId = normalizeRoomId(req.params.roomId);
    if (!roomId) return res.status(400).json({ error: 'Invalid room id' });

    const memoryRoom = rooms.get(roomId);

    if (memoryRoom) {
      return res.json({
        source: 'memory',
        room: {
          id: roomId,
          userCount: memoryRoom.users.length,
          language: memoryRoom.language,
          is_active: true,
          current_problem_id: memoryRoom.currentProblem?.id || null
        }
      });
    }

    const { data, error } = await roomService.getRoom(roomId);
    if (error) return res.status(500).json({ error: 'Failed to fetch room' });
    if (!data) return res.status(404).json({ error: 'Room not found' });

    const { code: _code, owner_socket_id: _sid, ...safeRoom } = data;
    return res.json({ source: 'supabase', room: safeRoom });
  });

  app.get('/api/problems', requireAuth, (_req, res) => {
    res.json({ problems: DSA_PROBLEMS });
  });

  app.post('/api/execute', executeLimiter, async (req, res) => {
    const { roomId: rawRoomId, executionToken, code, language } = req.body;
    const roomId = normalizeRoomId(rawRoomId);

    if (!roomId) {
      return res.status(400).json({ error: 'roomId is required' });
    }

    const tokenResult = verifyExecutionToken(executionToken, { roomId });
    if (!tokenResult.valid) {
      return res.status(403).json({
        error: 'Room execution token rejected',
        message: tokenResult.message,
        code: tokenResult.code,
      });
    }

    if (!code || !language) {
      return res.status(400).json({ error: 'code and language are required' });
    }

    if (!isValidCodePayload(code)) {
      return res.status(400).json({ error: 'Code exceeds maximum length of 50,000 characters' });
    }

    if (!isSafeExecutableCode(code)) {
      return res.status(400).json({ error: 'Code contains patterns that may cause long-running execution.' });
    }

    if (!JDOODLE_LANGUAGES[language]) {
      return res.status(400).json({ error: `Unsupported language: ${language}` });
    }

    const result = await executeCode({ code, language });
    return res.status(result.statusCode).json(result.body);
  });

  app.post('/api/analyze', analyzeLimiter, requireAuth, async (req, res) => {
    try {
      const { code, language } = req.body;
      const compilerOutput = normalizeCompilerOutput(req.body.compilerOutput);
      req.normalizedCompilerOutput = compilerOutput;

      if (!code || !language) {
        return res.status(400).json({ error: 'code and language are required' });
      }

      if (!isValidCodePayload(code)) {
        return res.status(400).json({ error: 'Code exceeds maximum length of 50,000 characters' });
      }

      const result = await analyzeCode({ code, language, compilerOutput });
      return res.status(result.statusCode).json(result.body);
    } catch (err) {
      const result = handleOpenRouterError(err, req);
      return res.status(result.statusCode).json(result.body);
    }
  });
}

module.exports = {
  registerRoutes,
};
