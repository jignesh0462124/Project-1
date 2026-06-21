const { validateAccessToken } = require('../config/supabase');

function getBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.replace('Bearer ', '').trim() || null;
}

async function optionalAuth(req, _res, next) {
  try {
    const validation = await validateAccessToken(getBearerToken(req));
    req.user = validation.user;
  } catch (error) {
    console.warn('[auth] optionalAuth failed:', error.message);
    req.user = null;
  }
  next();
}

async function requireAuth(req, res, next) {
  try {
    const validation = await validateAccessToken(getBearerToken(req));

    if (!validation.user) {
      return res.status(validation.status || 401).json({
        error: validation.error || 'Unauthorized',
        message: validation.message || 'A valid Supabase access token is required.',
        code: validation.code || 'AUTH_FAILED',
      });
    }

    req.user = validation.user;
    return next();
  } catch (error) {
    console.error('[auth] requireAuth failed:', error.message);
    return res.status(500).json({ error: 'Auth middleware failed', code: 'AUTH_MIDDLEWARE_FAILED' });
  }
}

module.exports = {
  optionalAuth,
  requireAuth
};
