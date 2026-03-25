import { Crown, User, Pause, Play } from 'lucide-react'

function UserList({ users, currentUser, isHost, onPauseUser, onUnpauseUser }) {
  if (!users || users.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <h3 className="text-retro-text text-[10px] mb-3 uppercase flex items-center gap-2 opacity-70 tracking-widest pl-1">
          <User className="w-3.5 h-3.5" />
          PLAYERS <span className="opacity-50">(0/4)</span>
        </h3>
        <div className="text-retro-text text-[10px] opacity-40 text-center py-4 border border-dashed border-retro-border/20 rounded">
          NO PLAYERS CONNECTED
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <h3 className="text-retro-text text-[10px] mb-3 uppercase flex items-center gap-2 opacity-70 tracking-widest pl-1">
        <User className="w-3.5 h-3.5" />
        PLAYERS <span className="opacity-50">({users.length}/4)</span>
      </h3>
      
      <div className="space-y-2">
        {users.map((user) => {
          const isCurrentUser = user.username === currentUser
          
          return (
            <div
              key={user.id || user.username}
              className={`
                flex items-center gap-3 p-2.5 rounded border transition-all duration-200
                ${user.isPaused
                  ? 'border-red-500/30 bg-red-500/5 opacity-70'
                  : isCurrentUser 
                    ? 'border-retro-cyan/50 bg-retro-cyan/5' 
                    : 'border-transparent hover:border-retro-border/30 hover:bg-retro-surface/50'
                }
              `}
            >
              {/* User Color Indicator */}
              <div 
                className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm"
                style={{ 
                  backgroundColor: user.isPaused ? '#6b7280' : (user.color || '#3b82f6'),
                  boxShadow: user.isPaused ? 'none' : `0 0 8px ${user.color || '#3b82f6'}40`
                }}
              ></div>

              {/* Username and Status */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span 
                    className={`text-[10px] truncate ${isCurrentUser ? 'font-bold' : ''}`}
                    style={{ color: user.isPaused ? '#6b7280' : (isCurrentUser ? (user.color || '#3b82f6') : '#f8fafc') }}
                  >
                    {user.username}
                  </span>
                  {user.isHost && (
                    <Crown className="w-3 h-3 text-retro-yellow flex-shrink-0 opacity-80" />
                  )}
                </div>
                
                {/* User badges */}
                <div className="flex items-center gap-1.5 mt-1.5 focus:outline-none">
                  {user.isHost && (
                    <span className="text-retro-yellow text-[8px] uppercase tracking-wider bg-retro-yellow/10 px-1.5 py-0.5 rounded">
                      OWNER
                    </span>
                  )}
                  {isCurrentUser && (
                    <span className="text-retro-cyan text-[8px] uppercase tracking-wider bg-retro-cyan/10 px-1.5 py-0.5 rounded">
                      YOU
                    </span>
                  )}
                  {user.isPaused && (
                    <span className="text-red-400 text-[8px] uppercase tracking-wider bg-red-400/10 px-1.5 py-0.5 rounded animate-pulse">
                      PAUSED
                    </span>
                  )}
                </div>
              </div>

              {/* Pause/Unpause Button (host only, not on self) */}
              {isHost && !user.isHost && (
                <div className="flex-shrink-0">
                  {user.isPaused ? (
                    <button
                      onClick={() => onUnpauseUser(user.username)}
                      className="pixel-button pixel-button--small flex items-center gap-1 text-[7px] text-emerald-400 border-emerald-500/30 hover:border-emerald-500 hover:bg-emerald-500/10"
                      title={`Unpause ${user.username}`}
                    >
                      <Play className="w-2.5 h-2.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => onPauseUser(user.username)}
                      className="pixel-button pixel-button--small flex items-center gap-1 text-[7px] text-red-400 border-red-500/30 hover:border-red-500 hover:bg-red-500/10"
                      title={`Pause ${user.username}`}
                    >
                      <Pause className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              )}

              {/* Connection Status */}
              {!isHost || user.isHost ? (
                <div className="flex-shrink-0 flex items-center justify-center opacity-50">
                  <div className={`w-1.5 h-1.5 rounded-full ${user.isPaused ? 'bg-red-400' : 'bg-emerald-400 shadow-[0_0_4px_#10b981]'}`}></div>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      {/* Empty slots */}
      {users.length < 4 && (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 4 - users.length }).map((_, index) => (
            <div
              key={`empty-${index}`}
              className="flex items-center gap-3 p-2.5 rounded border border-dashed border-retro-border/20 bg-retro-surface/30 opacity-60"
            >
              <div className="w-3 h-3 rounded-full border border-dashed border-retro-border/40"></div>
              <span className="text-retro-text text-[9px] tracking-widest uppercase opacity-40">WAITING...</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default UserList