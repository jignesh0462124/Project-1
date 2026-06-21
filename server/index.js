require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { DSA_PROBLEMS } = require('./problems');
const { getUserFromAccessToken } = require('./config/supabase');
const roomService = require('./services/roomService');
const { requireAuth } = require('./middleware/auth');

// JDoodle API language mapping (free: 200 credits/day, email signup only)
const JDOODLE_LANGUAGES = {
  javascript: { language: 'nodejs', versionIndex: '4' },
  typescript: { language: 'typescript', versionIndex: '0' },
  python:     { language: 'python3', versionIndex: '4' },
  java:       { language: 'java', versionIndex: '4' },
  cpp:        { language: 'cpp17', versionIndex: '1' },
  go:         { language: 'go', versionIndex: '4' },
  rust:       { language: 'rust', versionIndex: '4' },
};

const JDOODLE_API_URL = 'https://api.jdoodle.com/v1/execute';
const SUPPORTED_ROOM_LANGUAGES = new Set([...Object.keys(JDOODLE_LANGUAGES), 'html']);
const MAX_CODE_LENGTH = 50000;
const MAX_CHAT_MESSAGE_LENGTH = 200;
const MAX_USERNAME_LENGTH = 20;
const MAX_COMPILER_OUTPUT_LENGTH = 2000;
const DANGEROUS_CODE_PATTERNS = [
  /while\s*\(\s*true\s*\)/i,
  /for\s*\(\s*;\s*;\s*\)/i,
  /\bThread\.sleep\s*\(\s*\d{5,}\s*\)/,
  /\bsleep\s*\(\s*\d{2,}\s*\)/i,
  /\bsetInterval\s*\([^,]+,\s*0\s*\)/i
];

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

app.disable('x-powered-by');

// Parse CORS origins from env or use defaults
const CORS_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : ["http://localhost:5173", "http://127.0.0.1:5173"];

// Enable CORS
app.use(cors({
  origin: CORS_ORIGINS,
  credentials: true
}));

// Security headers with CSP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));

// ── Rate Limiters ────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const executeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many code execution requests. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const analyzeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many AI analysis requests. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const createRoomLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many rooms created. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply global rate limiter to all routes
app.use(globalLimiter);

// Parse JSON request bodies with size limits
app.use(express.json({ limit: '1mb' }));

// Health check endpoint for Render
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

const io = socketIo(server, {
  cors: {
    origin: CORS_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true
  }
});

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    socket.supabaseUser = await getUserFromAccessToken(token);
    next();
  } catch (error) {
    next(new Error('Authentication failed'));
  }
});

// Room storage: rooms[roomId] = { users: [], code: "", language: "javascript", cleanupTimeout: null }
const rooms = new Map();
const DEFAULT_ROOM_CODE = '// Welcome to Collaborative Platform!\n// Start collaborating by typing here...\n\nconsole.log("Hello, world!");';

// User colors for cursor identification
const userColors = ["#6FF0BD", "#B79CFF", "#FFB454", "#7BB8FF"];

function getUserColor(userIndex) {
  return userColors[userIndex % userColors.length];
}

function getRoomUsers(room) {
  return room.users.map((user) => ({ ...user }));
}

function generateRoomId() {
  return uuidv4().substring(0, 8).toUpperCase();
}

function normalizeRoomId(roomId) {
  const normalized = String(roomId || '').trim().toUpperCase();
  return /^[A-Z0-9]{8}$/.test(normalized) ? normalized : null;
}

function normalizeUsername(username) {
  const normalized = String(username || '').trim();
  if (!normalized || normalized.length > MAX_USERNAME_LENGTH) return null;
  return normalized;
}

function normalizeLanguage(language) {
  const normalized = String(language || 'javascript').trim().toLowerCase();
  return SUPPORTED_ROOM_LANGUAGES.has(normalized) ? normalized : 'javascript';
}

function isValidCodePayload(code) {
  return typeof code === 'string' && code.length <= MAX_CODE_LENGTH;
}

function isSafeExecutableCode(code) {
  return typeof code === 'string' && !DANGEROUS_CODE_PATTERNS.some((pattern) => pattern.test(code));
}

function normalizeCompilerOutput(compilerOutput) {
  return typeof compilerOutput === 'string'
    ? compilerOutput.slice(0, MAX_COMPILER_OUTPUT_LENGTH)
    : null;
}

function normalizeChatMessage(message) {
  const normalized = String(message || '').trim();
  if (!normalized || normalized.length > MAX_CHAT_MESSAGE_LENGTH) return null;
  return normalized;
}

function isValidCursorPosition(position) {
  return Number.isInteger(position?.lineNumber)
    && Number.isInteger(position?.column)
    && position.lineNumber > 0
    && position.column > 0
    && position.lineNumber < 1000000
    && position.column < 100000;
}

function isValidSelectionRange(selection) {
  if (!selection) return true;

  return Number.isInteger(selection.startLineNumber)
    && Number.isInteger(selection.startColumn)
    && Number.isInteger(selection.endLineNumber)
    && Number.isInteger(selection.endColumn)
    && selection.startLineNumber > 0
    && selection.startColumn > 0
    && selection.endLineNumber > 0
    && selection.endColumn > 0
    && selection.startLineNumber < 1000000
    && selection.endLineNumber < 1000000
    && selection.startColumn < 100000
    && selection.endColumn < 100000;
}

function normalizeSelection(selection) {
  if (!selection || !isValidSelectionRange(selection)) return null;

  return {
    startLineNumber: selection.startLineNumber,
    startColumn: selection.startColumn,
    endLineNumber: selection.endLineNumber,
    endColumn: selection.endColumn
  };
}

function getUserPresence(user) {
  return {
    userId: user.id,
    username: user.username,
    color: user.color,
    position: user.cursor || null,
    selection: user.selection || null,
    lastActiveAt: user.lastActiveAt || null
  };
}

function getRoomPresence(room) {
  return room.users.map(getUserPresence);
}

function updateUserPresence(user, position, selection) {
  if (!user || !isValidCursorPosition(position) || !isValidSelectionRange(selection)) return null;

  user.cursor = position;
  user.selection = normalizeSelection(selection);
  user.lastActiveAt = Date.now();

  return getUserPresence(user);
}

function getProviderErrorDetails(error) {
  if (!error) return 'Unknown provider error.';

  const responseDetails = error.response?.data?.error || error.response?.data;
  if (responseDetails) {
    return typeof responseDetails === 'string'
      ? responseDetails
      : JSON.stringify(responseDetails);
  }

  if (error.code) return `${error.code}${error.message ? `: ${error.message}` : ''}`;
  if (error.message) return error.message;
  if (error.cause?.message) return error.cause.message;

  return 'The external provider could not be reached. Check the backend terminal, network access, and provider credentials.';
}


function getSafeProviderMessage(data, fallback) {
  if (!data) return fallback;
  if (typeof data === 'string') return data.slice(0, 500);
  if (typeof data.error === 'string') return data.error;
  if (typeof data.message === 'string') return data.message;
  if (typeof data.error?.message === 'string') return data.error.message;
  return fallback;
}

function getJdoodleCredentialStatus() {
  const clientId = process.env.JDOODLE_CLIENT_ID || '';
  const clientSecret = process.env.JDOODLE_CLIENT_SECRET || '';

  return {
    clientIdExists: Boolean(clientId),
    clientIdLength: clientId.length,
    clientSecretExists: Boolean(clientSecret),
    clientSecretLength: clientSecret.length,
  };
}

function logJdoodleCredentialStatus() {
  console.info('[jdoodle] credential status:', getJdoodleCredentialStatus());
}

function createProviderError({ message, provider, status, details }) {
  return {
    success: false,
    error: {
      message,
      provider,
      status,
      ...(details ? { details } : {}),
    },
  };
}

io.on('connection', (socket) => {
  console.log(`🔗 User connected: ${socket.id}`);

  const eventTimes = [];
  socket.use(([_event, data], next) => {
    // Payload size guard (200 KB max per event)
    try {
      const payloadSize = JSON.stringify(data).length;
      if (payloadSize > 200 * 1024) {
        return next(new Error('Payload too large'));
      }
    } catch {
      return next(new Error('Invalid payload'));
    }

    // Event rate limit (120 events per 10 seconds)
    const now = Date.now();
    while (eventTimes.length && now - eventTimes[0] > 10000) eventTimes.shift();
    eventTimes.push(now);

    if (eventTimes.length > 120) {
      return next(new Error('Rate limit exceeded'));
    }

    return next();
  });

  // Handle room joining
  socket.on('join-room', async ({ roomId, username, language }) => {
    roomId = normalizeRoomId(roomId);
    username = normalizeUsername(username);
    language = normalizeLanguage(language);

    if (!roomId || !username) {
      socket.emit('action-blocked', { message: 'Invalid room or display name.' });
      return;
    }

    console.log(`👤 ${username} attempting to join room: ${roomId}`);

      // Create room if it doesn't exist
    if (!rooms.has(roomId)) {
      const persistedRoom = await roomService.getRoom(roomId);
      const initialLanguage = language || 'javascript';
      rooms.set(roomId, {
        users: [],
        code: persistedRoom.data?.code || DEFAULT_ROOM_CODE,
        language: persistedRoom.data?.language || initialLanguage,
        currentProblem: null,
        solvedProblems: new Set(),
        problemBoilerplates: {}
      });
      console.log(`🏠 Created new room: ${roomId} with language: ${initialLanguage}`);
    }

    const room = rooms.get(roomId);

    const existingSocketUser = room.users.find(u => u.id === socket.id);
    if (existingSocketUser) {
      socket.join(roomId);
      socket.roomId = roomId;
      socket.username = existingSocketUser.username;
      socket.userId = existingSocketUser.userId;
      socket.emit('room-joined', {
        users: getRoomUsers(room),
        presence: getRoomPresence(room),
        code: room.code,
        language: room.language,
        roomId,
        currentUserId: socket.id
      });
      return;
    }

    // Check if room is full (max 4 users)
    if (room.users.length >= 4) {
      socket.emit('room-full', {
        message: 'Room is full! Maximum 4 players allowed.'
      });
      console.log(`❌ Room ${roomId} is full, rejected ${username}`);
      return;
    }

    // Check if username already exists in room
    const existingUser = room.users.find(u => u.username === username);
    if (existingUser) {
      socket.emit('username-taken', {
        message: 'Username already taken in this room!'
      });
      console.log(`❌ Username ${username} already taken in room ${roomId}`);
      return;
    }

    // Add user to room
    const isHost = room.users.length === 0;
    const userColor = getUserColor(room.users.length);

    const newUser = {
      id: socket.id,
      userId: socket.supabaseUser?.id || null,
      username,
      color: userColor,
      role: isHost ? 'owner' : 'member',
      isHost,
      isPaused: false,
      cursor: null,
      selection: null,
      lastActiveAt: Date.now()
    };

    room.users.push(newUser);
    socket.join(roomId);
    socket.roomId = roomId;
    socket.username = username;
    socket.userId = newUser.userId;

    if (isHost) {
      roomService.upsertRoom({
        roomId,
        ownerId: newUser.userId,
        ownerSocketId: socket.id,
        language: room.language,
        code: room.code
      });
    }

    roomService.joinRoomMember({
      roomId,
      userId: newUser.userId,
      socketId: socket.id,
      username,
      role: newUser.role,
      isPaused: newUser.isPaused
    });

    // Send current room state to the joining user
    socket.emit('room-joined', {
      users: getRoomUsers(room),
      presence: getRoomPresence(room),
      code: room.code,
      language: room.language,
      roomId,
      currentUserId: socket.id
    });

    // Notify other users in the room
    socket.to(roomId).emit('user-joined', {
      username,
      user: { ...newUser },
      users: getRoomUsers(room),
      presence: getRoomPresence(room),
      color: userColor,
      isHost
    });

    console.log(`✅ ${username} joined room ${roomId} (${room.users.length}/4 users)`);
  });

  // Handle code changes
  socket.on('code-change', ({ roomId, code, position, selection }) => {
    roomId = normalizeRoomId(roomId);
    if (!roomId || !isValidCodePayload(code) || (position && !isValidCursorPosition(position)) || !isValidSelectionRange(selection)) {
      socket.emit('action-blocked', { message: 'Invalid code update.' });
      return;
    }

    if (!rooms.has(roomId)) return;

    const room = rooms.get(roomId);

    // Block code changes from paused users
    const sender = room.users.find(u => u.id === socket.id);
    if (sender && sender.isPaused) {
      socket.emit('action-blocked', { message: 'You are paused by the host.' });
      return;
    }

    room.code = code;
    const presence = position ? updateUserPresence(sender, position, selection) : null;
    roomService.updateRoomCode(roomId, code, room.language);

    // Broadcast to all other users in the room (not the sender)
    socket.to(roomId).emit('code-updated', {
      code,
      userId: sender?.id || socket.id,
      username: sender?.username || socket.username,
      color: sender?.color || 'var(--accent-2)',
      cursor: sender?.cursor || null,
      selection: sender?.selection || null,
      presence
    });
    if (presence) {
      socket.to(roomId).emit('presence-updated', presence);
    }
    console.log(`📝 Code updated in room ${roomId} by ${socket.username}`);
  });

  // Handle language changes
  socket.on('language-change', ({ roomId, language, code }) => {
    roomId = normalizeRoomId(roomId);
    language = normalizeLanguage(language);
    if (!roomId || (code !== undefined && !isValidCodePayload(code))) {
      socket.emit('action-blocked', { message: 'Invalid language update.' });
      return;
    }

    if (!rooms.has(roomId)) return;

    const room = rooms.get(roomId);
    room.language = language;
    if (code !== undefined) {
      room.code = code;
    }
    roomService.updateRoomLanguage(roomId, room.language, room.code);

    // Broadcast to all users in the room (including sender for consistency)
    io.to(roomId).emit('language-updated', {
      language,
      code: code !== undefined ? code : room.code
    });
    console.log(`🔧 Language changed to ${language} in room ${roomId} by ${socket.username}`);
  });

  // Handle cursor movements
  socket.on('cursor-move', ({ roomId, username, position, selection }) => {
    roomId = normalizeRoomId(roomId);
    username = normalizeUsername(username);
    if (!roomId || !username || !isValidCursorPosition(position) || !isValidSelectionRange(selection)) return;

    if (!rooms.has(roomId)) return;

    const room = rooms.get(roomId);
    const user = room.users.find(u => u.id === socket.id);

    if (user) {
      const presence = updateUserPresence(user, position, selection);
      // Broadcast cursor position to other users only
      socket.to(roomId).emit('cursor-updated', {
        userId: user.id,
        username: user.username,
        position,
        selection: user.selection,
        color: user.color
      });
      socket.to(roomId).emit('presence-updated', presence);
    }
  });

  // Handle chat messages
  socket.on('chat-message', ({ roomId, username, message }) => {
    roomId = normalizeRoomId(roomId);
    username = normalizeUsername(username);
    message = normalizeChatMessage(message);
    if (!roomId || !username || !message || !rooms.has(roomId)) return;

    const timestamp = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    roomService.saveChatMessage({
      roomId,
      userId: socket.userId,
      socketId: socket.id,
      username,
      message
    });

    // Broadcast to all users in the room (including sender)
    io.to(roomId).emit('chat-received', {
      username,
      message,
      timestamp
    });

    console.log(`💬 Chat message in room ${roomId} from ${username}: ${message}`);
  });

  // Handle pause user (host only)
  socket.on('pause-user', ({ roomId, targetUsername }) => {
    roomId = normalizeRoomId(roomId);
    targetUsername = normalizeUsername(targetUsername);
    if (!roomId || !targetUsername) return;

    if (!rooms.has(roomId)) return;
    const room = rooms.get(roomId);

    // Only the host can pause users
    const host = room.users.find(u => u.id === socket.id);
    if (!host || !host.isHost) return;

    const target = room.users.find(u => u.username === targetUsername);
    if (!target || target.isHost) return; // Can't pause the host

    target.isPaused = true;
    roomService.updateMemberPaused(roomId, targetUsername, true);
    io.to(roomId).emit('user-paused', { targetUsername, users: room.users });
    console.log(`⏸️ ${targetUsername} paused by ${host.username} in room ${roomId}`);
  });

  // Handle unpause user (host only)
  socket.on('unpause-user', ({ roomId, targetUsername }) => {
    roomId = normalizeRoomId(roomId);
    targetUsername = normalizeUsername(targetUsername);
    if (!roomId || !targetUsername) return;

    if (!rooms.has(roomId)) return;
    const room = rooms.get(roomId);

    const host = room.users.find(u => u.id === socket.id);
    if (!host || !host.isHost) return;

    const target = room.users.find(u => u.username === targetUsername);
    if (!target) return;

    target.isPaused = false;
    roomService.updateMemberPaused(roomId, targetUsername, false);
    io.to(roomId).emit('user-unpaused', { targetUsername, users: room.users });
    console.log(`▶️ ${targetUsername} unpaused by ${host.username} in room ${roomId}`);
  });

  // Handle kick user (owner only)
  socket.on('kick-user', ({ roomId, targetUsername }) => {
    roomId = normalizeRoomId(roomId);
    targetUsername = normalizeUsername(targetUsername);
    if (!roomId || !targetUsername) return;

    if (!rooms.has(roomId)) return;
    const room = rooms.get(roomId);

    const owner = room.users.find(u => u.id === socket.id);
    if (!owner || owner.role !== 'owner') return;

    const target = room.users.find(u => u.username === targetUsername);
    if (!target || target.role === 'owner') return;

    io.to(roomId).emit('user-kicked', { targetUsername, users: room.users, kickedBy: owner.username });
    handleUserLeave(socket, roomId, targetUsername, true, target.id);
    console.log(`👢 ${targetUsername} kicked by ${owner.username} from room ${roomId}`);
  });

  // Handle transfer ownership (owner only)
  socket.on('transfer-ownership', ({ roomId, targetUsername }) => {
    roomId = normalizeRoomId(roomId);
    targetUsername = normalizeUsername(targetUsername);
    if (!roomId || !targetUsername) return;

    if (!rooms.has(roomId)) return;
    const room = rooms.get(roomId);

    const currentOwner = room.users.find(u => u.id === socket.id);
    if (!currentOwner || currentOwner.role !== 'owner') return;

    const target = room.users.find(u => u.username === targetUsername);
    if (!target || target.role === 'owner') return;

    currentOwner.role = 'member';
    currentOwner.isHost = false;
    target.role = 'owner';
    target.isHost = true;
    roomService.transferOwnership({
      roomId,
      newOwnerUserId: target.userId,
      newOwnerSocketId: target.id,
      previousOwnerUserId: currentOwner.userId,
      previousOwnerSocketId: currentOwner.id
    });

    io.to(roomId).emit('ownership-transferred', {
      newOwner: targetUsername,
      previousOwner: currentOwner.username,
      users: getRoomUsers(room),
      presence: getRoomPresence(room)
    });
    console.log(`👑 Ownership transferred from ${currentOwner.username} to ${targetUsername} in room ${roomId}`);
  });

  // Problem-related handlers
  socket.on('get-problems', () => {
    socket.emit('problems-list', { problems: DSA_PROBLEMS });
  });

  socket.on('select-problem', ({ roomId, problemId }) => {
    roomId = normalizeRoomId(roomId);
    if (!roomId || !Number.isInteger(problemId)) return;

    if (!rooms.has(roomId)) return;
    const room = rooms.get(roomId);

    const user = room.users.find(u => u.id === socket.id);
    if (!user || user.role !== 'owner') return;

    const problem = DSA_PROBLEMS.find(p => p.id === problemId);
    if (!problem) return;

    room.currentProblem = problem;
    const boilerplate = problem.boilerplate[room.language] || problem.boilerplate.javascript;
    room.code = boilerplate;
    room.problemBoilerplates[problem.id] = boilerplate;
    roomService.setCurrentProblem(roomId, problem.id, boilerplate, room.language);

    io.to(roomId).emit('problem-selected', {
      problem,
      code: boilerplate,
      solvedBy: Array.from(room.solvedProblems)
    });
    console.log(`📋 Problem "${problem.title}" selected in room ${roomId} by ${user.username}`);
  });

  socket.on('select-random-problem', ({ roomId }) => {
    roomId = normalizeRoomId(roomId);
    if (!roomId) return;

    if (!rooms.has(roomId)) return;
    const room = rooms.get(roomId);

    const user = room.users.find(u => u.id === socket.id);
    if (!user || user.role !== 'owner') return;

    const unsolvedProblems = DSA_PROBLEMS.filter(p => !room.solvedProblems.has(p.id));
    const problemPool = unsolvedProblems.length > 0 ? unsolvedProblems : DSA_PROBLEMS;
    const randomProblem = problemPool[Math.floor(Math.random() * problemPool.length)];

    room.currentProblem = randomProblem;
    const boilerplate = randomProblem.boilerplate[room.language] || randomProblem.boilerplate.javascript;
    room.code = boilerplate;
    room.problemBoilerplates[randomProblem.id] = boilerplate;
    roomService.setCurrentProblem(roomId, randomProblem.id, boilerplate, room.language);

    io.to(roomId).emit('problem-selected', {
      problem: randomProblem,
      code: boilerplate,
      solvedBy: Array.from(room.solvedProblems)
    });
    console.log(`🎲 Random problem "${randomProblem.title}" selected in room ${roomId} by ${user.username}`);
  });

  socket.on('submit-solution', ({ roomId, code, language }) => {
    roomId = normalizeRoomId(roomId);
    language = normalizeLanguage(language);
    if (!roomId || !isValidCodePayload(code)) {
      socket.emit('submission-result', { success: false, message: 'Invalid submission.' });
      return;
    }

    if (!rooms.has(roomId)) return;
    const room = rooms.get(roomId);

    if (!room.currentProblem) {
      socket.emit('submission-result', { success: false, message: 'No problem selected!' });
      return;
    }

    const user = room.users.find(u => u.id === socket.id);
    if (!user) return;

    socket.emit('submission-result', {
      success: true,
      problemId: room.currentProblem.id,
      problemTitle: room.currentProblem.title,
      message: 'Solution submitted for verification!'
    });
    console.log(`✅ Solution submitted by ${user.username} for problem "${room.currentProblem.title}"`);
  });

  socket.on('mark-solved', ({ roomId, problemId }) => {
    roomId = normalizeRoomId(roomId);
    if (!roomId || !Number.isInteger(problemId)) return;

    if (!rooms.has(roomId)) return;
    const room = rooms.get(roomId);

    const user = room.users.find(u => u.id === socket.id);
    if (!user || user.role !== 'owner') return;

    const problem = DSA_PROBLEMS.find(p => p.id === problemId);
    if (!problem) return;

    room.solvedProblems.add(problemId);
    roomService.markProblemSolved({
      roomId,
      userId: user.userId,
      socketId: user.id,
      username: user.username,
      problemId
    });

    io.to(roomId).emit('problem-solved', {
      problemId,
      problemTitle: problem.title,
      solvedBy: user.username,
      solvedProblems: Array.from(room.solvedProblems)
    });
    console.log(`🏆 Problem "${problem.title}" marked as solved by ${user.username}`);
  });

  socket.on('reset-problem', ({ roomId }) => {
    roomId = normalizeRoomId(roomId);
    if (!roomId) return;

    if (!rooms.has(roomId)) return;
    const room = rooms.get(roomId);

    const user = room.users.find(u => u.id === socket.id);
    if (!user || user.role !== 'owner') return;

    if (room.currentProblem) {
      const boilerplate = room.currentProblem.boilerplate[room.language] || room.currentProblem.boilerplate.javascript;
      room.code = boilerplate;
      roomService.setCurrentProblem(roomId, room.currentProblem.id, boilerplate, room.language);
      io.to(roomId).emit('problem-reset', {
        code: boilerplate,
        problem: room.currentProblem
      });
      console.log(`🔄 Problem "${room.currentProblem.title}" reset by ${user.username}`);
    }
  });

  // Handle leaving room
  socket.on('leave-room', ({ roomId, username }) => {
    roomId = normalizeRoomId(roomId);
    username = normalizeUsername(username);
    if (!roomId || !username) return;

    handleUserLeave(socket, roomId, username);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`🔌 User disconnected: ${socket.id}`);

    if (socket.roomId && socket.username) {
      handleUserLeave(socket, socket.roomId, socket.username);
    }
  });

  function handleUserLeave(socket, roomId, username, isKicked = false, kickedSocketId = null) {
    if (!rooms.has(roomId)) return;

    const room = rooms.get(roomId);
    const targetSocketId = isKicked && kickedSocketId ? kickedSocketId : socket.id;
    const userIndex = room.users.findIndex(u => u.id === targetSocketId);

    if (userIndex !== -1) {
      const leavingUser = room.users[userIndex];
      const wasOwner = leavingUser.role === 'owner' || leavingUser.isHost;
      const leavingSocket = isKicked && kickedSocketId
        ? io.sockets.sockets.get(kickedSocketId)
        : socket;

      room.users.splice(userIndex, 1);
      leavingSocket?.leave(roomId);
      if (!isKicked || socket.id === leavingUser.id) {
        socket.roomId = null;
        socket.username = null;
      }
      roomService.leaveRoomMember({
        roomId,
        userId: leavingUser.userId,
        socketId: leavingUser.id
      });

      // If kicked, disconnect the kicked user's socket
      if (isKicked && kickedSocketId) {
        if (leavingSocket) {
          leavingSocket.emit('kicked-from-room', { roomId });
          leavingSocket.leave(roomId);
        }
      }

      // Clear any pending cleanup timeout
      if (room.cleanupTimeout) {
        clearTimeout(room.cleanupTimeout);
        room.cleanupTimeout = null;
      }

      // If room is empty, schedule deletion after timeout (allows quick rejoin)
      if (room.users.length === 0) {
        socket.roomId = null;
        socket.username = null;
        room.cleanupTimeout = setTimeout(() => {
          if (rooms.has(roomId)) {
            const currentRoom = rooms.get(roomId);
            if (currentRoom.users.length === 0) {
              rooms.delete(roomId);
              roomService.closeRoom(roomId);
              console.log(`🗑️ Deleted empty room: ${roomId} after timeout`);
            }
          }
        }, 60000); // 1 minute timeout before room cleanup
      } else {
        // If the owner left, make the first remaining user the new owner
        if (wasOwner && room.users.length > 0) {
          room.users[0].isHost = true;
          room.users[0].role = 'owner';
          roomService.transferOwnership({
            roomId,
            newOwnerUserId: room.users[0].userId,
            newOwnerSocketId: room.users[0].id,
            previousOwnerUserId: leavingUser.userId,
            previousOwnerSocketId: leavingUser.id
          });
          io.to(roomId).emit('new-owner', {
            newOwner: room.users[0].username,
            users: getRoomUsers(room),
            presence: getRoomPresence(room)
          });
          console.log(`👑 ${room.users[0].username} is now the owner of room ${roomId}`);
        }

        // Notify remaining users
        io.to(roomId).emit('user-left', {
          username: leavingUser.username,
          userId: leavingUser.id,
          users: getRoomUsers(room),
          isKicked
        });
      }

      console.log(`👋 ${username} ${isKicked ? 'kicked from' : 'left'} room ${roomId} (${room.users.length}/4 users remaining)`);
    }
  }
});

// API endpoint to create a new room (rate-limited)
app.get('/api/create-room', createRoomLimiter, (req, res) => {
  const roomId = generateRoomId();
  res.json({ roomId });
});

// Public health check — minimal info only
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Detailed health check — requires auth
app.get('/api/health/details', requireAuth, (req, res) => {
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

// Room info endpoint — requires authentication
app.get('/api/rooms/:roomId', requireAuth, async (req, res) => {
  const roomId = normalizeRoomId(req.params.roomId);
  if (!roomId) return res.status(400).json({ error: 'Invalid room id' });

  const memoryRoom = rooms.get(roomId);

  if (memoryRoom) {
    // Return non-sensitive summary only
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

  // Strip sensitive fields before returning Supabase data
  const { code: _code, owner_socket_id: _sid, ...safeRoom } = data;
  return res.json({ source: 'supabase', room: safeRoom });
});

// API endpoint to get problems list (auth required to prevent scraping)
app.get('/api/problems', requireAuth, (req, res) => {
  res.json({ problems: DSA_PROBLEMS });
});

// Code execution endpoint via JDoodle - public room users may compile, rate limited to protect API quota
app.post('/api/execute', executeLimiter, async (req, res) => {
  try {
    const { code, language } = req.body;

    if (!code || !language) {
      return res.status(400).json({ error: 'code and language are required' });
    }

    if (!isValidCodePayload(code)) {
      return res.status(400).json({ error: 'Code exceeds maximum length of 50,000 characters' });
    }

    if (!isSafeExecutableCode(code)) {
      return res.status(400).json({ error: 'Code contains patterns that may cause long-running execution.' });
    }

    const jdoodleLang = JDOODLE_LANGUAGES[language];
    if (!jdoodleLang) {
      return res.status(400).json({ error: `Unsupported language: ${language}` });
    }

    const clientId = process.env.JDOODLE_CLIENT_ID;
    const clientSecret = process.env.JDOODLE_CLIENT_SECRET;
    logJdoodleCredentialStatus();

    if (!clientId || !clientSecret) {
      return res.status(500).json(createProviderError({
        message: 'JDoodle API is not configured.',
        provider: 'jdoodle',
        status: 500,
        details: 'Set JDOODLE_CLIENT_ID and JDOODLE_CLIENT_SECRET on the server.',
      }));
    }

    // Send to JDoodle API
    const response = await axios.post(
      JDOODLE_API_URL,
      {
        clientId,
        clientSecret,
        script: code,
        language: jdoodleLang.language,
        versionIndex: jdoodleLang.versionIndex,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
        validateStatus: () => true,
      }
    );

    if (response.status < 200 || response.status >= 300) {
      const message = getSafeProviderMessage(response.data, response.status === 401 ? 'Unauthorized' : 'JDoodle API error');
      console.warn('[jdoodle] non-2xx response:', { status: response.status, message });
      return res.status(response.status).json(createProviderError({
        message,
        provider: 'jdoodle',
        status: response.status,
      }));
    }

    const result = response.data;

    // JDoodle returns { output, statusCode, memory, cpuTime, error }
    // Map to our standard format
    const isError = result.statusCode !== 200;
    const isTimeLimit = result.statusCode === 139 || result.cpuTime > 15;
    const isMemoryLimit = result.memory && result.memory > 256000;

    let status;
    if (isTimeLimit) {
      status = { id: 5, description: 'Time Limit Exceeded (>15s)' };
    } else if (isMemoryLimit) {
      status = { id: 8, description: 'Memory Limit Exceeded' };
    } else if (isError) {
      status = { id: 11, description: 'Runtime Error' };
    } else {
      status = { id: 3, description: 'Accepted' };
    }

    res.json({
      stdout: isError || isTimeLimit || isMemoryLimit ? null : (result.output || null),
      stderr: (isError && !isTimeLimit && !isMemoryLimit) ? (result.output || result.error || null) : null,
      compile_output: null,
      status,
      memory: result.memory,
      cpuTime: result.cpuTime,
      error: result.error || (isTimeLimit ? 'Execution time exceeded 15 seconds limit' : null),
    });
  } catch (err) {
    const details = getProviderErrorDetails(err);
    console.error('❌ Code execution error:', err.message);

    if (err.code === 'ECONNABORTED') {
      return res.status(408).json({
        error: 'Request Timeout',
        details: 'Code execution took too long (>30s). Try optimizing your code.',
        status: { id: 5, description: 'Time Limit Exceeded' },
      });
    }

    if (err.response) {
      const status = err.response.status;
      const data = err.response.data;

      const message = getSafeProviderMessage(data, status === 401 ? 'Unauthorized' : 'JDoodle API error');
      return res.status(status).json(createProviderError({
        message,
        provider: 'jdoodle',
        status,
        details: typeof details === 'string' ? details : undefined,
      }));
    }

    res.status(502).json({
      error: 'Code execution provider unavailable',
      details,
      status: { id: 11, description: 'Execution Provider Error' }
    });
  }
});

function buildAnalysisPrompts(code, language, compilerOutput) {
  const systemPrompt = `You are an AI programming assistant embedded inside a real-time collaborative coding platform called Collaborative Platform.
Analyze the provided code and compiler output carefully.

Your responsibilities:
1. Identify syntax errors, logical errors, runtime problems, or bad coding practices.
2. Provide a clear explanation of each detected issue.
3. Suggest a corrected or improved version of the code.
4. Recommend improvements for readability, structure, performance, or best practices.
5. If the code has no errors, suggest optimizations or cleaner design.

Keep explanations short and developer-friendly. Assume users may be beginners.
Format your response in markdown with these sections:
## Issue Detected
## Suggested Fix
## Explanation
## Improvement Suggestions`;

  const userPrompt = `Language: ${language}

User Code:
\`\`\`${language}
${code}
\`\`\`

Compiler Output:
${compilerOutput || 'No compiler output available (code not yet executed).'}`;

  return { systemPrompt, userPrompt };
}

function getOpenRouterModels() {
  const primaryModel = process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v4-flash';
  const fallbackModels = (process.env.OPENROUTER_FALLBACK_MODELS || '')
    .split(',')
    .map(model => model.trim())
    .filter(Boolean);

  return [...new Set([primaryModel, ...fallbackModels])];
}

async function requestOpenRouterAnalysis({ code, language, compilerOutput, model }) {
  const { systemPrompt, userPrompt } = buildAnalysisPrompts(code, language, compilerOutput);

  const response = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 2048,
    },
    {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'http://localhost:5173',
        'X-OpenRouter-Title': process.env.OPENROUTER_APP_TITLE || 'Collaborative Platform',
      },
      timeout: 30000,
    }
  );

  return response.data?.choices?.[0]?.message?.content || 'No analysis generated.';
}

function createLocalAnalysis({ code, language, compilerOutput, reason }) {
  const findings = [];
  const trimmedCode = code.trim();

  if (!trimmedCode) {
    findings.push('The file is empty, so there is nothing to analyze yet.');
  }

  if (compilerOutput && /error|exception|traceback|failed|undefined|cannot|syntax/i.test(compilerOutput)) {
    findings.push('The latest compiler output appears to contain an error. Start by reading the first error line and the line number it references.');
  }

  if (/\beval\s*\(/.test(code)) {
    findings.push('Avoid `eval(...)`; it can execute unsafe input and makes debugging harder.');
  }

  if (language === 'javascript' || language === 'typescript') {
    if (/\bvar\s+/.test(code)) {
      findings.push('Use `const` or `let` instead of `var` so variable scope is easier to reason about.');
    }
    if (/[^=!]==[^=]|!=[^=]/.test(code)) {
      findings.push('Prefer strict equality (`===` / `!==`) to avoid implicit type coercion bugs.');
    }
  }

  if (/console\.log\s*\(/.test(code)) {
    findings.push('Remove temporary `console.log` calls or keep them behind a debug flag before sharing final code.');
  }

  if (code.split('\n').some(line => line.length > 120)) {
    findings.push('Some lines are longer than 120 characters; wrapping them will make collaboration and review easier.');
  }

  if (!findings.length) {
    findings.push('No obvious issue was found by the local fallback analyzer.');
  }

  const providerReason = reason ? `\n\nProvider note: ${reason}` : '';

  return `## Issue Detected
${findings.map(item => `- ${item}`).join('\n')}${providerReason}

## Suggested Fix
- Fix any compiler/runtime error shown in Output first.
- Keep functions small, name intermediate values clearly, and rerun the code after each change.
- When the API quota resets, run AI Analysis again for a deeper review.

## Explanation
The external AI provider is unavailable or out of quota, so this is a local fallback review. It checks common issues and uses compiler output when available, but it is intentionally simpler than the hosted model.

## Improvement Suggestions
- Add focused test cases for expected input, edge cases, and failure paths.
- Prefer readable control flow over clever one-liners during collaborative editing.
- Keep comments for intent, not for restating what the code already says.`;
}

function shouldUseLocalAnalysisFallback() {
  return process.env.ANALYSIS_FALLBACK_ON_ERROR !== 'false';
}

// AI Code Analysis endpoint — auth + rate limited to protect API quota
app.post('/api/analyze', analyzeLimiter, requireAuth, async (req, res) => {
  try {
    const { code, language } = req.body;
    const compilerOutput = normalizeCompilerOutput(req.body.compilerOutput);

    if (!code || !language) {
      return res.status(400).json({ error: 'code and language are required' });
    }

    if (!isValidCodePayload(code)) {
      return res.status(400).json({ error: 'Code exceeds maximum length of 50,000 characters' });
    }

    if (!process.env.OPENROUTER_API_KEY) {
      if (shouldUseLocalAnalysisFallback()) {
        return res.json({
          analysis: createLocalAnalysis({
            code,
            language,
            compilerOutput,
            reason: 'OpenRouter API key is not configured.',
          }),
          provider: 'local-fallback',
        });
      }

      return res.status(500).json({
        error: 'OpenRouter API is not configured. Add OPENROUTER_API_KEY to server/.env or enable ANALYSIS_FALLBACK_ON_ERROR.',
      });
    }

    const providerErrors = [];

    for (const model of getOpenRouterModels()) {
      try {
        const analysisText = await requestOpenRouterAnalysis({ code, language, compilerOutput, model });
        return res.json({ analysis: analysisText, provider: 'openrouter', model });
      } catch (err) {
        const status = err.response?.status;
        const details = err.response?.data?.error?.message || err.response?.data || getProviderErrorDetails(err);
        providerErrors.push({ model, status, details });

        if (![402, 408, 429, 500, 502, 503, 504].includes(status)) {
          throw err;
        }
      }
    }

    if (shouldUseLocalAnalysisFallback()) {
      const exhaustedModels = providerErrors
        .map(item => `${item.model}${item.status ? ` (${item.status})` : ''}`)
        .join(', ');

      return res.json({
        analysis: createLocalAnalysis({
          code,
          language,
          compilerOutput,
          reason: `OpenRouter model quota/rate limit was reached or unavailable for: ${exhaustedModels}.`,
        }),
        provider: 'local-fallback',
        providerErrors,
      });
    }

    return res.status(429).json({
      error: 'OpenRouter rate limit reached',
      details: 'All configured OpenRouter models are rate-limited, out of quota, or unavailable.',
      providerErrors,
    });
  } catch (err) {
    console.error('\u274c AI analysis error:', err.message);
    if (err.response) {
      const status = err.response.status;
      const details = err.response.data?.error?.message || err.response.data || getProviderErrorDetails(err);

      if (shouldUseLocalAnalysisFallback()) {
        return res.json({
          analysis: createLocalAnalysis({
            code: req.body.code,
            language: req.body.language,
            compilerOutput: normalizeCompilerOutput(req.body.compilerOutput),
            reason: `OpenRouter returned ${status || 'an error'}: ${typeof details === 'string' ? details : JSON.stringify(details)}`,
          }),
          provider: 'local-fallback',
        });
      }

      if (status === 429) {
        return res.status(429).json({
          error: 'OpenRouter rate limit reached',
          details: 'The selected OpenRouter model is currently rate-limited or out of quota. Try again later, add credits, or switch OPENROUTER_MODEL to another available model.',
        });
      }

      if (status === 401 || status === 403) {
        return res.status(status).json({
          error: 'OpenRouter authentication failed',
          details: 'Check OPENROUTER_API_KEY in server/.env and restart the server.',
        });
      }

      return res.status(err.response.status).json({
        error: 'OpenRouter API error',
        details,
      });
    }
    if (shouldUseLocalAnalysisFallback()) {
      return res.json({
        analysis: createLocalAnalysis({
          code: req.body.code,
          language: req.body.language,
          compilerOutput: normalizeCompilerOutput(req.body.compilerOutput),
          reason: `OpenRouter request failed: ${getProviderErrorDetails(err)}`,
        }),
        provider: 'local-fallback',
      });
    }
    res.status(500).json({ error: 'AI analysis failed', details: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Collaborative Platform server running on port ${PORT}`);
  console.log(`🌐 Socket.io enabled with CORS for localhost:5173`);
});

process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('💤 Server closed');
    process.exit(0);
  });
});
