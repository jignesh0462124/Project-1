import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

export function createClient() {
  if (!supabaseUrl || !supabasePublishableKey) return null
  return createBrowserClient(supabaseUrl, supabasePublishableKey)
}
