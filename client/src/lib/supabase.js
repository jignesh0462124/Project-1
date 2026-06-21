import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey)

export const supabase = isSupabaseConfigured
  ? createBrowserClient(supabaseUrl, supabasePublishableKey)
  : null

async function getFreshSession() {
  if (!supabase) return null

  const { data, error } = await supabase.auth.getSession()
  if (error) return null

  const session = data.session
  if (!session) return null

  const expiresAtMs = session.expires_at ? session.expires_at * 1000 : 0
  const refreshWindowMs = 60 * 1000
  if (expiresAtMs && expiresAtMs - Date.now() <= refreshWindowMs) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError) return null
    return refreshed.session || null
  }

  return session
}

export async function getSupabaseAccessToken() {
  const session = await getFreshSession()
  return session?.access_token || null
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
