/**
 * backend/middleware/auth.js
 *
 * Express middleware for validating Supabase JWTs.
 *
 * requireAuth   — rejects unauthenticated requests (returns 401)
 * optionalAuth  — attaches user to req if token is present, allows guests
 *
 * Usage in Express routes:
 *   import { requireAuth, optionalAuth } from '../middleware/auth.js';
 *   router.get('/profile', requireAuth, handler);
 *   router.post('/join-room', optionalAuth, handler);
 */

import supabase from '../config/supabase.js';

/**
 * Extracts and validates the Bearer token from the Authorization header.
 * Returns the Supabase user object or null.
 */
async function getUserFromToken(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return null;

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  return user;
}

/**
 * requireAuth — blocks unauthenticated requests.
 * Attaches the Supabase user to `req.user`.
 * Guest (anonymous) users ARE allowed — they have a valid JWT.
 */
export async function requireAuth(req, res, next) {
  try {
    const user = await getUserFromToken(req);
    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'A valid authentication token is required.',
      });
    }
    req.user = user;
    next();
  } catch (err) {
    console.error('[auth] requireAuth error:', err.message);
    res.status(500).json({ error: 'Auth middleware failed' });
  }
}

/**
 * optionalAuth — allows unauthenticated requests.
 * If a valid token is present, attaches user to `req.user`.
 * If no token or invalid, `req.user` is null.
 */
export async function optionalAuth(req, res, next) {
  try {
    req.user = await getUserFromToken(req);
    next();
  } catch (err) {
    console.error('[auth] optionalAuth error:', err.message);
    req.user = null;
    next();
  }
}

/**
 * requireOwner — blocks non-owners from room-owner actions.
 * Must run AFTER requireAuth.
 * Expects req.params.roomId or req.body.roomId.
 */
export async function requireOwner(req, res, next) {
  const roomId = req.params.roomId || req.body?.roomId;
  if (!roomId) return res.status(400).json({ error: 'roomId is required' });

  const { data: room, error } = await supabase
    .from('rooms')
    .select('owner_id')
    .eq('id', roomId)
    .single();

  if (error || !room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  if (room.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'Only the room owner can perform this action' });
  }

  next();
}
