const { getUserFromAccessToken } = require('../config/supabase');

function getBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.replace('Bearer ', '').trim() || null;
}

async function optionalAuth(req, _res, next) {
  try {
    req.user = await getUserFromAccessToken(getBearerToken(req));
  } catch (error) {
    console.warn('[auth] optionalAuth failed:', error.message);
    req.user = null;
  }
  next();
}

async function requireAuth(req, res, next) {
  try {
    const user = await getUserFromAccessToken(getBearerToken(req));

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'A valid Supabase access token is required.'
      });
    }

    req.user = user;
    return next();
  } catch (error) {
    console.error('[auth] requireAuth failed:', error.message);
    return res.status(500).json({ error: 'Auth middleware failed' });
  }
}

module.exports = {
  optionalAuth,
  requireAuth
};
