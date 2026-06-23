const crypto = require('crypto');

const DEFAULT_EXECUTION_TOKEN_TTL_MS = 10 * 60 * 1000;

function getExecutionTokenSecret() {
  return process.env.EXECUTION_TOKEN_SECRET
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.JDOODLE_CLIENT_SECRET
    || 'development-execution-token-secret';
}

function base64urlEncode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function base64urlDecode(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

function signPayload(encodedPayload, secret = getExecutionTokenSecret()) {
  return crypto
    .createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url');
}

function createExecutionToken({
  roomId,
  socketId,
  userId = null,
  ttlMs = DEFAULT_EXECUTION_TOKEN_TTL_MS,
  now = Date.now(),
  secret = getExecutionTokenSecret(),
}) {
  if (!roomId || !socketId) {
    throw new Error('roomId and socketId are required to create an execution token');
  }

  const payload = {
    roomId,
    socketId,
    userId,
    exp: now + ttlMs,
  };
  const encodedPayload = base64urlEncode(payload);
  const signature = signPayload(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

function verifyExecutionToken(token, {
  roomId,
  now = Date.now(),
  secret = getExecutionTokenSecret(),
} = {}) {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return { valid: false, code: 'EXECUTION_TOKEN_REQUIRED', message: 'A valid room execution token is required.' };
  }

  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) {
    return { valid: false, code: 'EXECUTION_TOKEN_MALFORMED', message: 'The room execution token is malformed.' };
  }

  const expectedSignature = signPayload(encodedPayload, secret);
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return { valid: false, code: 'EXECUTION_TOKEN_INVALID', message: 'The room execution token signature is invalid.' };
  }

  let payload;
  try {
    payload = base64urlDecode(encodedPayload);
  } catch {
    return { valid: false, code: 'EXECUTION_TOKEN_MALFORMED', message: 'The room execution token payload is invalid.' };
  }

  if (roomId && payload.roomId !== roomId) {
    return { valid: false, code: 'EXECUTION_TOKEN_ROOM_MISMATCH', message: 'The room execution token does not match this room.' };
  }

  if (!payload.exp || payload.exp <= now) {
    return { valid: false, code: 'EXECUTION_TOKEN_EXPIRED', message: 'The room execution token has expired. Rejoin the room and try again.' };
  }

  return { valid: true, payload };
}

module.exports = {
  DEFAULT_EXECUTION_TOKEN_TTL_MS,
  createExecutionToken,
  verifyExecutionToken,
};
