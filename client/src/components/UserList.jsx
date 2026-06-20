import { Crown, Pause, Play, UserPlus, X } from 'lucide-react'

function UserList({ users, currentUser, currentUserId, isHost, onPauseUser, onUnpauseUser, onKickUser, onTransferOwnership, compact = false }) {
  if (!users || users.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <div className="ui-label mb-3 flex items-center justify-between">
          <span>Players</span>
          <span>0/4</span>
        </div>
        <div className="rounded border border-dashed border-retro-border bg-[var(--surface-raised)] px-3 py-4 text-center text-xs text-[var(--text-dim)]">
          No players connected.
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="ui-label mb-3 flex items-center justify-between">
        <span>Players</span>
        <span>{users.length}/4</span>
      </div>

      <div className="space-y-2">
        {users.map((user) => {
          const isCurrentUser = currentUserId ? user.id === currentUserId : user.username === currentUser
          const isOwner = user.role === 'owner' || user.isHost
          const color = user.isPaused ? 'var(--muted)' : user.color || 'var(--accent)'

          return (
            <div
              key={user.id || user.username}
              className={`rounded border bg-[var(--surface-raised)] p-3 transition-colors ${
                isCurrentUser
                  ? 'border-retro-cyan shadow-[2px_2px_0_0_var(--accent)]'
                  : 'border-retro-border hover:border-[var(--line-strong)]'
              } ${user.isPaused ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start gap-3">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-mono-ui text-xs font-semibold text-retro-text">{user.username}</span>
                    {isOwner && <Crown className="h-3.5 w-3.5 text-retro-accent" />}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {isOwner ? (
                      <span className="rounded bg-[var(--accent-2-dim)] px-1.5 py-0.5 font-mono-ui text-[10px] font-semibold uppercase tracking-[0.06em] text-retro-accent">
                        Owner
                      </span>
                    ) : (
                      <span className="rounded border border-retro-border px-1.5 py-0.5 font-mono-ui text-[10px] uppercase tracking-[0.06em] text-[var(--text-dim)]">
                        Member
                      </span>
                    )}
                    {isCurrentUser && (
                      <span className="rounded bg-[var(--surface-hover)] px-1.5 py-0.5 font-mono-ui text-[10px] uppercase tracking-[0.06em] text-retro-text">
                        You
                      </span>
                    )}
                    {user.isPaused && (
                      <span className="rounded border border-[var(--danger)] px-1.5 py-0.5 font-mono-ui text-[10px] uppercase tracking-[0.06em] text-[var(--danger)]">
                        Paused
                      </span>
                    )}
                  </div>

                  <div className="mt-2 flex items-center gap-1.5 font-mono-ui text-[11px] text-[var(--muted)]">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                    <span>In room</span>
                  </div>
                </div>

                {!isOwner && isHost && !isCurrentUser && (
                  <button
                    onClick={() => (user.isPaused ? onUnpauseUser(user.username) : onPauseUser(user.username))}
                    className="icon-button h-8 min-h-8 w-8 min-w-8"
                    title={user.isPaused ? `Unpause ${user.username}` : `Pause ${user.username}`}
                  >
                    {user.isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                  </button>
                )}

                {isHost && !isCurrentUser && (
                  <div className="flex shrink-0 gap-1">
                    {!compact && (
                      <button
                        onClick={() => onTransferOwnership(user.username)}
                        className="icon-button h-8 min-h-8 w-8 min-w-8"
                        title={`Transfer ownership to ${user.username}`}
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => onKickUser(user.username)}
                      className="icon-button h-8 min-h-8 w-8 min-w-8 text-[var(--danger)]"
                      title={`Remove ${user.username}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default UserList
