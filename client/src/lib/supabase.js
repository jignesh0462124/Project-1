import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey)

export const supabase = isSupabaseConfigured
  ? createBrowserClient(supabaseUrl, supabasePublishableKey)
  : null

export async function getSupabaseAccessToken() {
  if (!supabase) return null

  const { data, error } = await supabase.auth.getSession()
  if (error) return null

  return data.session?.access_token || null
}

export function getDisplayNameFromUser(user) {
  if (!user) return ''

  return (
    user.user_metadata?.display_name ||
    user.user_metadata?.username ||
    user.email?.split('@')[0] ||
    ''
  )
}
