import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Copy, Users, Gamepad2, ChevronDown, Code } from 'lucide-react'
import ThemeToggle from '../components/ThemeToggle'
import SUPPORTED_LANGUAGES from '../constants/languages'

function Home() {
  const [username, setUsername] = useState('')
  const [roomId, setRoomId] = useState('')
  const [showJoinRoom, setShowJoinRoom] = useState(false)
  const [createdRoomId, setCreatedRoomId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState('javascript')
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false)
  const navigate = useNavigate()

  const handleCreateRoom = async () => {
    if (!username.trim()) {
      toast.error('ENTER YOUR USERNAME FIRST!')
      return
    }

    if (username.trim().length > 20) {
      toast.error('USERNAME TOO LONG! (MAX 20 CHARS)')
      return
    }

    setIsLoading(true)
    
    try {
      const response = await fetch(`${import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001'}/api/create-room`)
      const data = await response.json()
      
      setCreatedRoomId(data.roomId)
      toast.success(`ROOM ${data.roomId} CREATED!`)
      
      // Auto-navigate to the room after a short delay
      setTimeout(() => {
        navigate(`/room/${data.roomId}?username=${encodeURIComponent(username.trim())}&language=${selectedLanguage}`)
      }, 1500)
    } catch (error) {
      console.error('Failed to create room:', error)
      toast.error('FAILED TO CREATE ROOM!')
    } finally {
      setIsLoading(false)
    }
  }

  const handleJoinRoom = () => {
    if (!username.trim()) {
      toast.error('ENTER YOUR USERNAME FIRST!')
      return
    }

    if (!roomId.trim()) {
      toast.error('ENTER ROOM ID!')
      return
    }

    if (username.trim().length > 20) {
      toast.error('USERNAME TOO LONG! (MAX 20 CHARS)')
      return
    }

    const cleanRoomId = roomId.trim().toUpperCase()
    navigate(`/room/${cleanRoomId}?username=${encodeURIComponent(username.trim())}&language=${selectedLanguage}`)
  }

  const copyRoomId = async (roomIdToCopy) => {
    try {
      await navigator.clipboard.writeText(roomIdToCopy)
      toast.success('ROOM ID COPIED!')
    } catch (error) {
      toast.error('FAILED TO COPY!')
    }
  }

  const handleKeyPress = (e, action) => {
    if (e.key === 'Enter') {
      if (action === 'create') handleCreateRoom()
      if (action === 'join') handleJoinRoom()
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-retro-bg font-pixel">
      {/* Background Elements - Professional subtle glow instead of arcade pulses */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-retro-cyan rounded-full mix-blend-screen filter blur-[100px] animate-fade-in"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-retro-accent rounded-full mix-blend-screen filter blur-[100px] animate-fade-in" style={{ animationDelay: '0.2s' }}></div>
      </div>

      {/* Theme Toggle Top Right */}
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* Logo */}
      <div className="text-center mb-10 z-10">
        <div className="flex items-center justify-center mb-3">
          <Gamepad2 className="w-8 h-8 text-retro-cyan mr-4" />
          <h1 className="text-retro-text text-lg md:text-xl font-bold tracking-wider">
            CODE SYNC
          </h1>
          <Gamepad2 className="w-8 h-8 text-retro-accent ml-4" />
        </div>
        <p className="text-retro-text text-xs opacity-60 tracking-widest mt-2">
          COLLABORATIVE DEVELOPMENT ENVIRONMENT
        </p>
        <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-retro-border bg-retro-surface/50 py-2 px-4 rounded-full border border-retro-border/30 backdrop-blur-sm w-max mx-auto">
          <Users className="w-4 h-4" />
          <span>MAX 4 PLAYERS PER ROOM</span>
        </div>
      </div>

      {/* Main Form */}
      <div className="pixel-panel w-full max-w-md z-10 relative">
        <div className="space-y-5">
          {/* Username Input */}
          <div>
            <label className="block text-retro-text text-[10px] mb-2 uppercase opacity-80 pl-1">
              DISPLAY NAME
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => handleKeyPress(e, showJoinRoom ? 'join' : 'create')}
              placeholder="developer_01"
              maxLength={20}
              className="pixel-input w-full"
              disabled={isLoading}
            />
          </div>

          {/* Language Selector */}
          <div>
            <label className="block text-retro-text text-[10px] mb-2 uppercase opacity-80 pl-1 flex items-center gap-2">
              <Code className="w-3.5 h-3.5" />
              CODING LANGUAGE
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
                disabled={isLoading}
                className="pixel-input w-full flex items-center justify-between gap-2 text-left cursor-pointer"
              >
                <span className="text-[10px] tracking-wider font-bold">
                  {SUPPORTED_LANGUAGES.find(l => l.value === selectedLanguage)?.label || 'JavaScript'}
                </span>
                <ChevronDown 
                  className={`w-3.5 h-3.5 opacity-60 transition-transform ${isLangDropdownOpen ? 'rotate-180' : ''}`} 
                />
              </button>

              {isLangDropdownOpen && (
                <div className="absolute top-full left-0 w-full mt-2 bg-retro-surface border border-retro-border/30 z-50 max-h-48 overflow-y-auto rounded-lg shadow-xl shadow-black/20">
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <button
                      key={lang.value}
                      type="button"
                      onClick={() => {
                        setSelectedLanguage(lang.value)
                        setIsLangDropdownOpen(false)
                      }}
                      className={`
                        w-full text-left px-4 py-3 text-[10px] tracking-wider transition-colors
                        ${selectedLanguage === lang.value 
                          ? 'bg-retro-cyan/10 border-l-2 border-retro-cyan text-retro-cyan font-bold' 
                          : 'text-retro-text border-l-2 border-transparent hover:bg-retro-panel'
                        }
                      `}
                    >
                      {lang.label}
                      {selectedLanguage === lang.value && (
                        <span className="float-right bg-retro-cyan text-retro-bg w-3 h-3 flex items-center justify-center rounded-sm text-[8px]">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Click outside to close */}
            {isLangDropdownOpen && (
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsLangDropdownOpen(false)}
              />
            )}
          </div>

          {/* Room ID Input (shown when joining) */}
          {showJoinRoom && (
            <div>
              <label className="block text-retro-text text-[10px] mb-2 uppercase opacity-80 pl-1">
                SESSION ID
              </label>
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                onKeyDown={(e) => handleKeyPress(e, 'join')}
                placeholder="ABC12345"
                maxLength={8}
                className="pixel-input w-full"
                disabled={isLoading}
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-4">
            {!showJoinRoom ? (
              <>
                <button
                  onClick={handleCreateRoom}
                  disabled={isLoading}
                  className="pixel-button w-full"
                >
                  {isLoading ? 'CREATING...' : 'CREATE ROOM'}
                </button>
                <button
                  onClick={() => setShowJoinRoom(true)}
                  disabled={isLoading}
                  className="pixel-button pixel-button--cyan w-full"
                >
                  JOIN ROOM
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleJoinRoom}
                  disabled={isLoading}
                  className="pixel-button pixel-button--cyan w-full"
                >
                  JOIN ROOM
                </button>
                <button
                  onClick={() => {
                    setShowJoinRoom(false)
                    setRoomId('')
                  }}
                  disabled={isLoading}
                  className="pixel-button w-full opacity-70 hover:opacity-100 mt-2"
                >
                  BACK
                </button>
              </>
            )}
          </div>

          {/* Created Room ID Display */}
          {createdRoomId && (
            <div className="bg-retro-surface border border-retro-border/50 rounded-md p-5 mt-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-retro-cyan"></div>
              <p className="text-retro-text text-[10px] mb-3 text-center opacity-70 uppercase tracking-widest">
                SESSION CREATED
              </p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-retro-border font-bold text-sm">
                  {createdRoomId}
                </span>
                <button
                  onClick={() => copyRoomId(createdRoomId)}
                  className="pixel-button pixel-button--small"
                  title="Copy Room ID"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
              <p className="text-retro-cyan text-[10px] text-center mt-4 animate-pulse uppercase">
                CONNECTING...
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-8 text-center max-w-lg z-10 w-full">
        <div className="bg-retro-surface/30 border border-retro-border/20 rounded-lg p-5 backdrop-blur-sm">
          <h3 className="text-retro-text text-[10px] mb-3 uppercase opacity-70 tracking-widest">FEATURES</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
            <div className="flex items-start">
              <div className="w-1.5 h-1.5 rounded-full bg-retro-cyan mt-1.5 mr-2 flex-shrink-0"></div>
              <p className="text-retro-text text-[9px] opacity-80 leading-relaxed">Multiplayer editing with live cursors</p>
            </div>
            <div className="flex items-start">
              <div className="w-1.5 h-1.5 rounded-full bg-retro-cyan mt-1.5 mr-2 flex-shrink-0"></div>
              <p className="text-retro-text text-[9px] opacity-80 leading-relaxed">Support for 8+ programming languages</p>
            </div>
            <div className="flex items-start">
              <div className="w-1.5 h-1.5 rounded-full bg-retro-cyan mt-1.5 mr-2 flex-shrink-0"></div>
              <p className="text-retro-text text-[9px] opacity-80 leading-relaxed">Built-in developer chat channel</p>
            </div>
            <div className="flex items-start">
              <div className="w-1.5 h-1.5 rounded-full bg-retro-cyan mt-1.5 mr-2 flex-shrink-0"></div>
              <p className="text-retro-text text-[9px] opacity-80 leading-relaxed">Up to 4 concurrent users per room</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-retro-text text-[8px] opacity-40 z-10 tracking-widest">
        <p>POWERED BY SOCKET.IO & MONACO EDITOR</p>
        <p className="mt-2">&copy; {new Date().getFullYear()} CODE SYNC. ALL RIGHTS RESERVED.</p>
      </div>
    </div>
  )
}

export default Home