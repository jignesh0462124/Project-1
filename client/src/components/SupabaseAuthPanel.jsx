import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { LockKeyhole, LogIn, LogOut, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { getDisplayNameFromUser, isSupabaseConfigured, supabase } from '../lib/supabase'

function SupabaseAuthPanel({ onDisplayNameResolved }) {
  const [session, setSession] = useState(null)
  const [mode, setMode] = useState('signin')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!supabase) return undefined

    let isMounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return
      setSession(data.session || null)
      const resolvedName = getDisplayNameFromUser(data.session?.user)
      if (resolvedName) onDisplayNameResolved(resolvedName.slice(0, 20))
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      const resolvedName = getDisplayNameFromUser(nextSession?.user)
      if (resolvedName) onDisplayNameResolved(resolvedName.slice(0, 20))
    })

    return () => {
      isMounted = false
      subscription.subscription.unsubscribe()
    }
  }, [onDisplayNameResolved])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!supabase || isSubmitting) return

    const cleanEmail = email.trim()
    const cleanName = displayName.trim()

    if (!cleanEmail || !password) {
      toast.error('Email and password are required.')
      return
    }

    if (mode === 'signup' && (!cleanName || cleanName.length > 20)) {
      toast.error('Display name must be 1-20 characters.')
      return
    }

    setIsSubmitting(true)

    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password
        })
        if (error) throw error
        toast.success('Signed in.')
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              username: cleanName,
              display_name: cleanName
            }
          }
        })
        if (error) throw error
        if (data.session) toast.success('Account created.')
        else toast.success('Check your email to confirm the account.')
        onDisplayNameResolved(cleanName)
      }
    } catch (error) {
      toast.error(error.message || 'Supabase auth failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSignOut = async () => {
    if (!supabase || isSubmitting) return
    setIsSubmitting(true)

    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      toast.success('Signed out.')
    } catch (error) {
      toast.error(error.message || 'Could not sign out.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <section className="rounded-lg border border-retro-border bg-retro-surface p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded border border-retro-border bg-[var(--surface-raised)] text-[var(--text-dim)]">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-bold tracking-tight">Supabase account</h2>
            <p className="mt-1 text-sm text-[var(--text-dim)]">Environment variables are not configured.</p>
          </div>
        </div>
      </section>
    )
  }

  if (session?.user) {
    const resolvedName = getDisplayNameFromUser(session.user) || 'Signed in'

    return (
      <section className="rounded-lg border border-retro-border bg-retro-surface p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[var(--accent-dim)] text-retro-cyan">
              <UserRound className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-retro-text">{resolvedName}</div>
              <div className="truncate text-xs text-[var(--text-dim)]">{session.user.email}</div>
            </div>
          </div>
          <button type="button" onClick={handleSignOut} disabled={isSubmitting} className="btn btn-ghost shrink-0">
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-lg border border-retro-border bg-retro-surface p-5 sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-bold tracking-tight">Supabase account</h2>
          <p className="mt-1 text-sm text-[var(--text-dim)]">Room history saves when signed in.</p>
        </div>
        <div className="flex rounded border border-retro-border bg-[var(--surface-raised)] p-1">
          {['signin', 'signup'].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMode(item)}
              className={`rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
                mode === item ? 'bg-retro-cyan text-retro-bg' : 'text-[var(--text-dim)] hover:text-retro-text'
              }`}
            >
              {item === 'signin' ? 'Sign in' : 'Sign up'}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {mode === 'signup' && (
          <label className="block">
            <span className="ui-label mb-2 block">Display name</span>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-dim)]" />
              <input
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                maxLength={20}
                placeholder="developer_01"
                className="pixel-input auth-input-with-icon"
                autoComplete="name"
                disabled={isSubmitting}
              />
            </div>
          </label>
        )}

        <label className="block">
          <span className="ui-label mb-2 block">Email</span>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-dim)]" />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="pixel-input auth-input-with-icon"
              autoComplete="email"
              disabled={isSubmitting}
            />
          </div>
        </label>

        <label className="block">
          <span className="ui-label mb-2 block">Password</span>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-dim)]" />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              placeholder="password"
              className="pixel-input auth-input-with-icon"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              disabled={isSubmitting}
            />
          </div>
        </label>

        <button type="submit" disabled={isSubmitting} className="btn btn-primary w-full">
          <LogIn className="h-4 w-4" />
          {isSubmitting ? 'Working...' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>
    </section>
  )
}

export default SupabaseAuthPanel
