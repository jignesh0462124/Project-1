/**
 * backend/config/supabase.js
 *
 * Server-side Supabase client using the SERVICE ROLE key.
 * This client bypasses RLS — only use it server-side, never expose to the browser.
 *
 * Usage:
 *   import supabase from '../config/supabase.js';
 *   const { data, error } = await supabase.from('rooms').select('*');
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables. ' +
    'Copy server/.env.example to server/.env and fill in your Supabase credentials.'
  );
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    // Service role client does not need to persist sessions
    autoRefreshToken: false,
    persistSession: false,
  },
});

export default supabase;
