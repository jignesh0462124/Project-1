const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAuthKeyEntries = [
  ['SUPABASE_SERVICE_ROLE_KEY', supabaseServiceRoleKey],
  ['SUPABASE_PUBLISHABLE_KEY', process.env.SUPABASE_PUBLISHABLE_KEY],
  ['SUPABASE_ANON_KEY', process.env.SUPABASE_ANON_KEY],
  ['VITE_SUPABASE_PUBLISHABLE_KEY', process.env.VITE_SUPABASE_PUBLISHABLE_KEY],
  ['VITE_SUPABASE_ANON_KEY', process.env.VITE_SUPABASE_ANON_KEY],
];
const [supabaseAuthKeySource, supabaseAuthKey] = supabaseAuthKeyEntries.find(([, value]) => Boolean(value)) || [];

const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAuthKey);
const isSupabaseAdminConfigured = Boolean(supabaseUrl && supabaseServiceRoleKey);

let supabase = null;
let supabaseAdmin = null;

const clientOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
};

if (isSupabaseConfigured) {
  supabase = createClient(supabaseUrl, supabaseAuthKey, clientOptions);
}

if (isSupabaseAdminConfigured) {
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, clientOptions);
}

function getSupabaseConfigStatus() {
  return {
    urlConfigured: Boolean(supabaseUrl),
    authKeyConfigured: Boolean(supabaseAuthKey),
    authKeySource: supabaseAuthKeySource || null,
    serviceRoleKeyConfigured: Boolean(supabaseServiceRoleKey),
    persistenceConfigured: isSupabaseAdminConfigured,
  };
}

async function validateAccessToken(token) {
  if (!token) {
    return {
      user: null,
      status: 401,
      code: 'AUTH_REQUIRED',
      error: 'Unauthorized',
      message: 'Sign up or sign in required to use this feature.',
    };
  }

  if (!isSupabaseConfigured) {
    console.warn('[supabase] auth is not configured:', getSupabaseConfigStatus());
    return {
      user: null,
      status: 503,
      code: 'AUTH_NOT_CONFIGURED',
      error: 'Auth provider unavailable',
      message: 'Server auth is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, SUPABASE_PUBLISHABLE_KEY, or SUPABASE_ANON_KEY on the backend.',
    };
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      console.warn('[supabase] auth token rejected:', {
        message: error?.message || 'No user returned',
        tokenLength: token.length,
      });
      return {
        user: null,
        status: 401,
        code: 'AUTH_INVALID_TOKEN',
        error: 'Unauthorized',
        message: 'Your sign-in session could not be verified. Please sign in again.',
      };
    }

    return { user: data.user, status: 200, code: 'AUTH_OK' };
  } catch (error) {
    console.warn('[supabase] auth token validation failed:', error.message || error);
    return {
      user: null,
      status: 503,
      code: 'AUTH_PROVIDER_ERROR',
      error: 'Auth provider unavailable',
      message: 'The auth provider could not verify your session. Please try again.',
    };
  }
}

async function getUserFromAccessToken(token) {
  const { user } = await validateAccessToken(token);
  return user;
}

module.exports = {
  supabase,
  supabaseAdmin,
  isSupabaseConfigured,
  isSupabaseAdminConfigured,
  getSupabaseConfigStatus,
  validateAccessToken,
  getUserFromAccessToken
};