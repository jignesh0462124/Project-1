import { Copy, Users, LogOut, Crown } from 'lucide-react'
import toast from 'react-hot-toast'
import ThemeToggle from './ThemeToggle'

function RoomHeader({ roomId, users, currentUser, isConnected, onLeaveRoom }) {
  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId)
      toast.success('ROOM ID COPIED!')
    } catch (error) {
      toast.error('FAILED TO COPY!')
    }
  }

  const currentUserData = users.find(user => user.username === currentUser)
  const isHost = currentUserData?.isHost

  return (
    <header className="bg-retro-surface border-b border-retro-border/50 p-3 md:p-4 flex flex-wrap items-center justify-between gap-y-3 gap-x-4 shadow-sm">
      {/* Left Section */}
      <div className="flex flex-wrap items-center gap-2 md:gap-6">
        {/* Room ID */}
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-retro-text text-[10px] uppercase opacity-70 tracking-widest mt-0.5">SESSION:</span>
          <div className="flex items-center gap-2 bg-retro-bg rounded border border-retro-border/30 px-2 md:px-3 py-1.5">
            <span className="text-retro-cyan font-bold text-[10px] md:text-xs">{roomId}</span>
            <button
              onClick={copyRoomId}
              className="text-retro-text hover:text-retro-border transition-colors"
              title="Copy Room ID"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* User Count */}
        <div className="flex items-center gap-2 bg-retro-bg px-2 md:px-3 py-1.5 rounded border border-retro-border/30">
          <Users className="w-3.5 h-3.5 text-retro-cyan opacity-80" />
          <span className="text-retro-text text-[9px] md:text-[10px] tracking-wider mt-0.5">
            {users.length}/4 <span className="hidden sm:inline opacity-60">PLAYERS</span>
          </span>
        </div>

        {/* Connection Status */}
        <div className="flex items-center gap-2 px-2 md:px-3 py-1.5 rounded border border-retro-border/30 bg-retro-bg">
          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
            isConnected 
              ? 'bg-emerald-400 shadow-[0_0_5px_#10b981]' 
              : 'bg-red-400 animate-pulse'
          }`}></div>
          <span className={`text-[8px] md:text-[9px] tracking-wider mt-0.5 whitespace-nowrap ${
            isConnected ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
          }`}>
            {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
          </span>
        </div>
      </div>

      {/* Right Section */}
      <div className="flex flex-wrap items-center gap-2 md:gap-4 ml-auto">
        {/* Current User Info */}
        <div className="flex items-center gap-1.5 md:gap-2">
          {isHost && <Crown className="w-3.5 h-3.5 md:w-4 md:h-4 text-retro-yellow flex-shrink-0" />}
          <div 
            className="w-3 h-3 border"
            style={{ 
              backgroundColor: currentUserData?.color || '#00ff88',
              borderColor: currentUserData?.color || '#00ff88'
            }}
          ></div>
          <span className="text-retro-text text-xs uppercase">
            {currentUser}
            {isHost && <span className="text-retro-yellow ml-1">(HOST)</span>}
          </span>
        </div>

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Leave Room Button */}
        <button
          onClick={onLeaveRoom}
          className="pixel-button pixel-button--small flex items-center gap-2 opacity-80 hover:opacity-100 border-red-500/50 hover:border-red-500 hover:bg-red-500/10 hover:text-red-400 transition-all"
          title="Leave Session"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="text-[9px] tracking-wider">LEAVE</span>
        </button>
      </div>
    </header>
  )
}

export default RoomHeader