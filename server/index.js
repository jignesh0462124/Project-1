require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { DSA_PROBLEMS } = require('./problems');
const { getUserFromAccessToken } = require('./config/supabase');
const roomService = require('./services/roomService');
const { requireAuth } = require('./middleware/auth');
const {
  normalizeRoomId,
  normalizeUsername,
  normalizeLanguage,
  isValidCodePayload,
  normalizeChatMessage,
  isValidCursorPosition,
  isValidSelectionRange,
  normalizeSelection,
} = require('./validators');
const { createExecutionToken } = require('./executionToken');
const {
  attachCollabDocument,
  getDocumentStatePayload,
  applyDocumentUpdate,
  encodeDocumentUpdate,
  replaceDocumentText,
} = require('./collabDocument');
const { executeCode } = require('./providers/jdoodle');
const { analyzeCode, handleOpenRouterError } = require('./providers/openrouter');
const { registerRoutes } = require('./routes');


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

function scheduleRoomCodePersist(roomId, room) {
  if (room.codePersistTimeout) clearTimeout(room.codePersistTimeout);
  room.codePersistTimeout = setTimeout(() => {
    roomService.updateRoomCode(roomId, room.code, room.language);
    room.codePersistTimeout = null;
  }, 500);
}

function createRoomExecutionToken(roomId, socket) {
  return createExecutionToken({
    roomId,
    socketId: socket.id,
    userId: socket.userId || null,
  });
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
            const initialCode = persistedRoom.data?.code || DEFAULT_ROOM_CODE;
      const roomState = attachCollabDocument({
        users: [],
        code: initialCode,
        language: persistedRoom.data?.language || initialLanguage,
        currentProblem: null,
        solvedProblems: new Set(),
        problemBoilerplates: {}
      }, initialCode);
      rooms.set(roomId, roomState);
      console.log(`🏠 Created new room: ${roomId} with language: ${initialLanguage}`);
    }

    const room = attachCollabDocument(rooms.get(roomId));

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
        currentUserId: socket.id,
        executionToken: createRoomExecutionToken(roomId, socket),
        documentState: getDocumentStatePayload(room)
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
      currentUserId: socket.id,
      executionToken: createRoomExecutionToken(roomId, socket),
      documentState: getDocumentStatePayload(room)
    });
    // Notify other users in the room
    socket.to(roomId).emit('user-joined', {
      username,
      user: { ...newUser },
      users: getRoomUsers(room),
      color: userColor,
      isHost
    });

    console.log(`${username} joined room ${roomId} (${room.users.length}/4 users)`);
  });

  // Handle code changes
  socket.on('code-change', ({ roomId, code }) => {
    roomId = normalizeRoomId(roomId);
    if (!roomId || !isValidCodePayload(code)) {
      socket.emit('action-blocked', { message: 'Invalid code update.' });
      return;
    }

    if (!rooms.has(roomId)) return;

    const room = attachCollabDocument(rooms.get(roomId));

    // Block code changes from paused users
    const sender = room.users.find(u => u.id === socket.id);
    if (sender && sender.isPaused) {
      socket.emit('action-blocked', { message: 'You are paused by the host.' });
      return;
    }

    const documentUpdate = replaceDocumentText(room, code);
    roomService.updateRoomCode(roomId, room.code, room.language);

    // Broadcast code only. Presence is synchronized through cursor-move.
    socket.to(roomId).emit('code-updated', {
      code: room.code,
      documentUpdate,
      userId: sender?.id || socket.id,
      username: sender?.username || socket.username,
      color: sender?.color || 'var(--accent-2)'
    });
    console.log(`ðŸ“ Code updated in room ${roomId} by ${socket.username}`);
  });

  // Handle collaborative document updates
  socket.on('document-update', ({ roomId, update }) => {
    roomId = normalizeRoomId(roomId);
    if (!roomId || !rooms.has(roomId)) return;

    const room = attachCollabDocument(rooms.get(roomId));
    const sender = room.users.find(u => u.id === socket.id);
    if (!sender) return;

    if (sender.isPaused) {
      socket.emit('action-blocked', { message: 'You are paused by the host.' });
      return;
    }

    try {
      const appliedUpdate = applyDocumentUpdate(room, update);
      scheduleRoomCodePersist(roomId, room);
      socket.to(roomId).emit('document-update', {
        update: encodeDocumentUpdate(appliedUpdate),
        userId: sender.id,
        username: sender.username
      });
    } catch {
      socket.emit('action-blocked', { message: 'Invalid document update.' });
    }
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

    const room = attachCollabDocument(rooms.get(roomId));
    room.language = language;
    const documentUpdate = code !== undefined ? replaceDocumentText(room, code) : null;
    roomService.updateRoomLanguage(roomId, room.language, room.code);

    // Broadcast to all users in the room (including sender for consistency)
    io.to(roomId).emit('language-updated', {
      language,
      code: room.code,
      documentUpdate
    });
    console.log(`🔧 Language changed to ${language} in room ${roomId} by ${socket.username}`);
  });

  // Handle cursor movements
  socket.on('cursor-move', ({ roomId, position, selection }) => {
    roomId = normalizeRoomId(roomId);
    if (!roomId || !isValidCursorPosition(position) || !isValidSelectionRange(selection)) return;

    if (!rooms.has(roomId)) return;

    const room = attachCollabDocument(rooms.get(roomId));
    const user = room.users.find(u => u.id === socket.id);
    if (!user) return;

    const presence = updateUserPresence(user, position, selection);
    if (presence) socket.to(roomId).emit('cursor-updated', presence);
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
    const room = attachCollabDocument(rooms.get(roomId));

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
    const room = attachCollabDocument(rooms.get(roomId));

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
    const room = attachCollabDocument(rooms.get(roomId));

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
    const room = attachCollabDocument(rooms.get(roomId));

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
      users: getRoomUsers(room)
    });
  });

  // Problem-related handlers
  socket.on('get-problems', () => {
    socket.emit('problems-list', { problems: DSA_PROBLEMS });
  });

  socket.on('select-problem', ({ roomId, problemId }) => {
    roomId = normalizeRoomId(roomId);
    if (!roomId || !Number.isInteger(problemId)) return;

    if (!rooms.has(roomId)) return;
    const room = attachCollabDocument(rooms.get(roomId));

    const user = room.users.find(u => u.id === socket.id);
    if (!user || user.role !== 'owner') return;

    const problem = DSA_PROBLEMS.find(p => p.id === problemId);
    if (!problem) return;

    room.currentProblem = problem;
    const boilerplate = problem.boilerplate[room.language] || problem.boilerplate.javascript;
    const documentUpdate = replaceDocumentText(room, boilerplate);
    room.problemBoilerplates[problem.id] = room.code;
    roomService.setCurrentProblem(roomId, problem.id, room.code, room.language);

    io.to(roomId).emit('problem-selected', {
      problem,
      code: room.code,
      documentUpdate,
      solvedBy: Array.from(room.solvedProblems)
    });
    console.log(`📋 Problem "${problem.title}" selected in room ${roomId} by ${user.username}`);
  });

  socket.on('select-random-problem', ({ roomId }) => {
    roomId = normalizeRoomId(roomId);
    if (!roomId) return;

    if (!rooms.has(roomId)) return;
    const room = attachCollabDocument(rooms.get(roomId));

    const user = room.users.find(u => u.id === socket.id);
    if (!user || user.role !== 'owner') return;

    const unsolvedProblems = DSA_PROBLEMS.filter(p => !room.solvedProblems.has(p.id));
    const problemPool = unsolvedProblems.length > 0 ? unsolvedProblems : DSA_PROBLEMS;
    const randomProblem = problemPool[Math.floor(Math.random() * problemPool.length)];

    room.currentProblem = randomProblem;
    const boilerplate = randomProblem.boilerplate[room.language] || randomProblem.boilerplate.javascript;
    const documentUpdate = replaceDocumentText(room, boilerplate);
    room.problemBoilerplates[randomProblem.id] = room.code;
    roomService.setCurrentProblem(roomId, randomProblem.id, room.code, room.language);

    io.to(roomId).emit('problem-selected', {
      problem: randomProblem,
      code: room.code,
      documentUpdate,
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
    const room = attachCollabDocument(rooms.get(roomId));

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
    const room = attachCollabDocument(rooms.get(roomId));

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
    const room = attachCollabDocument(rooms.get(roomId));

    const user = room.users.find(u => u.id === socket.id);
    if (!user || user.role !== 'owner') return;

    if (room.currentProblem) {
      const boilerplate = room.currentProblem.boilerplate[room.language] || room.currentProblem.boilerplate.javascript;
      const documentUpdate = replaceDocumentText(room, boilerplate);
      roomService.setCurrentProblem(roomId, room.currentProblem.id, room.code, room.language);
      io.to(roomId).emit('problem-reset', {
        code: room.code,
        documentUpdate,
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

    const room = attachCollabDocument(rooms.get(roomId));
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
      if (room.codePersistTimeout) {
        clearTimeout(room.codePersistTimeout);
        roomService.updateRoomCode(roomId, room.code, room.language);
        room.codePersistTimeout = null;
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
            users: getRoomUsers(room)
          });
          console.log(`${room.users[0].username} is now the owner of room ${roomId}`);
        }

        // Notify remaining users
        io.to(roomId).emit('presence-removed', {
          userId: leavingUser.id,
          username: leavingUser.username
        });

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

registerRoutes(app, {
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
