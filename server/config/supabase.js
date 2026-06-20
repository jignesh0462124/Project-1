const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const isSupabaseConfigured = Boolean(supabaseUrl && supabaseServiceRoleKey);

let supabase = null;

if (isSupabaseConfigured) {
  supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

async function getUserFromAccessToken(token) {
  if (!isSupabaseConfigured || !token) return null;

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return null;

    return data.user;
  } catch (error) {
    console.warn('[supabase] auth token validation failed:', error.message || error);
    return null;
  }
}

module.exports = {
  supabase,
  isSupabaseConfigured,
  getUserFromAccessToken
};
