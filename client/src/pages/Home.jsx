import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Copy, Users, Gamepad2, ChevronDown, Code, Zap, Shield, UsersRound, Sparkles, Terminal, Globe } from 'lucide-react'
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
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-retro-bg font-pixel overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-retro-cyan/5 via-transparent to-retro-accent/5"></div>
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-retro-cyan/10 rounded-full mix-blend-screen filter blur-[120px] animate-pulse-slow"></div>
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-retro-accent/10 rounded-full mix-blend-screen filter blur-[120px] animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
      </div>

      {/* Theme Toggle Top Right */}
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* Logo */}
      <div className="text-center mb-10 z-10 animate-fade-in">
        <div className="flex items-center justify-center mb-5">
          <div className="relative">
            <Gamepad2 className="w-12 h-12 text-retro-cyan animate-pulse" />
            <div className="absolute inset-0 w-12 h-12 bg-retro-cyan/20 rounded-full blur-xl"></div>
          </div>
          <h1 className="text-retro-text text-2xl md:text-3xl font-bold tracking-wider mx-4">
            CODE SYNC
          </h1>
          <div className="relative">
            <Gamepad2 className="w-12 h-12 text-retro-accent animate-pulse" style={{ animationDelay: '0.5s' }} />
            <div className="absolute inset-0 w-12 h-12 bg-retro-accent/20 rounded-full blur-xl"></div>
          </div>
        </div>
        <p className="text-retro-text/60 text-sm tracking-widest mt-4">
          COLLABORATIVE DEVELOPMENT ENVIRONMENT
        </p>
        <div className="mt-5 inline-flex items-center gap-3 text-xs text-retro-cyan bg-retro-cyan/10 py-3 px-5 rounded-full border border-retro-cyan/30 backdrop-blur-sm">
          <UsersRound className="w-5 h-5" />
          <span>MAX 4 PLAYERS PER ROOM</span>
        </div>
      </div>

      {/* Main Form */}
      <div className="pixel-panel w-full max-w-md z-10 relative animate-scale-in" style={{ animationDelay: '0.1s' }}>
        <div className="space-y-6">
          {/* Username Input */}
          <div>
            <label className="block text-retro-text/80 text-xs mb-3 uppercase tracking-wider pl-1 flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-retro-cyan rounded-full animate-pulse"></span>
              DISPLAY NAME
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => handleKeyPress(e, showJoinRoom ? 'join' : 'create')}
              placeholder="developer_01"
              maxLength={20}
              className="pixel-input w-full text-xs"
              disabled={isLoading}
            />
          </div>

          {/* Language Selector */}
          <div>
            <label className="block text-retro-text/80 text-xs mb-3 uppercase tracking-wider pl-1 flex items-center gap-2">
              <Code className="w-4 h-4" />
              CODING LANGUAGE
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
                disabled={isLoading}
                className="pixel-input w-full flex items-center justify-between gap-2 text-left cursor-pointer"
              >
                <span className="text-xs tracking-wider font-bold text-retro-cyan">
                  {SUPPORTED_LANGUAGES.find(l => l.value === selectedLanguage)?.label || 'JavaScript'}
                </span>
                <ChevronDown 
                  className={`w-4 h-4 opacity-60 transition-transform duration-300 ${isLangDropdownOpen ? 'rotate-180' : ''}`} 
                />
              </button>

              {isLangDropdownOpen && (
                <div className="absolute top-full left-0 w-full mt-2 bg-retro-surface border border-retro-border/50 z-50 max-h-56 overflow-y-auto rounded-lg shadow-xl animate-slide-down">
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <button
                      key={lang.value}
                      type="button"
                      onClick={() => {
                        setSelectedLanguage(lang.value)
                        setIsLangDropdownOpen(false)
                      }}
                      className={`
                        w-full text-left px-4 py-3 text-xs tracking-wider transition-all duration-200
                        ${selectedLanguage === lang.value 
                          ? 'bg-retro-cyan/10 border-l-2 border-retro-cyan text-retro-cyan font-bold' 
                          : 'text-retro-text border-l-2 border-transparent hover:bg-retro-panel hover:text-retro-cyan'
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

            {isLangDropdownOpen && (
              <div className="fixed inset-0 z-40" onClick={() => setIsLangDropdownOpen(false)} />
            )}
          </div>

          {/* Room ID Input */}
          <div className={`overflow-hidden transition-all duration-300 ${showJoinRoom ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="pt-2">
              <label className="block text-retro-text/80 text-xs mb-3 uppercase tracking-wider pl-1">
                SESSION ID
              </label>
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                onKeyDown={(e) => handleKeyPress(e, 'join')}
                placeholder="ABC12345"
                maxLength={8}
                className="pixel-input w-full text-xs font-mono tracking-widest"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 pt-2">
            {!showJoinRoom ? (
              <>
                <button
                  onClick={handleCreateRoom}
                  disabled={isLoading}
                  className="pixel-button w-full py-4 text-xs"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      CREATING...
                    </span>
                  ) : (
                    'CREATE ROOM'
                  )}
                </button>
                <button
                  onClick={() => setShowJoinRoom(true)}
                  disabled={isLoading}
                  className="pixel-button pixel-button--cyan w-full py-4 text-xs"
                >
                  JOIN ROOM
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleJoinRoom}
                  disabled={isLoading}
                  className="pixel-button pixel-button--cyan w-full py-4 text-xs"
                >
                  JOIN ROOM
                </button>
                <button
                  onClick={() => {
                    setShowJoinRoom(false)
                    setRoomId('')
                  }}
                  disabled={isLoading}
                  className="pixel-button w-full py-3 text-xs opacity-70 hover:opacity-100 transition-opacity"
                >
                  BACK TO CREATE
                </button>
              </>
            )}
          </div>

          {/* Created Room ID Display */}
          <div className={`overflow-hidden transition-all duration-500 ${createdRoomId ? 'max-h-48 opacity-100 mt-4' : 'max-h-0 opacity-0 mt-0'}`}>
            <div className="bg-gradient-to-r from-retro-cyan/10 to-retro-accent/10 border border-retro-border/50 rounded-lg p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-retro-cyan to-retro-accent"></div>
              <p className="text-retro-text/70 text-xs mb-3 text-center uppercase tracking-widest">
                SESSION CREATED
              </p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-retro-cyan font-bold text-base tracking-widest">
                  {createdRoomId}
                </span>
                <button
                  onClick={() => copyRoomId(createdRoomId)}
                  className="pixel-button pixel-button--small"
                  title="Copy Room ID"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-retro-cyan/80 text-xs text-center mt-4 animate-pulse uppercase tracking-wider">
                CONNECTING...
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="mt-12 text-center max-w-3xl z-10 w-full px-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <h2 className="text-retro-text text-sm uppercase tracking-widest mb-6 opacity-80">FEATURES</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-retro-surface/50 border border-retro-border/20 rounded-lg p-5 backdrop-blur-sm hover:bg-retro-surface/70 hover:border-retro-cyan/30 hover:-translate-y-1 transition-all duration-300">
            <div className="w-12 h-12 bg-retro-cyan/10 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Users className="w-6 h-6 text-retro-cyan" />
            </div>
            <p className="text-retro-text/80 text-xs uppercase tracking-wider">Real-time Sync</p>
          </div>
          <div className="bg-retro-surface/50 border border-retro-border/20 rounded-lg p-5 backdrop-blur-sm hover:bg-retro-surface/70 hover:border-retro-accent/30 hover:-translate-y-1 transition-all duration-300">
            <div className="w-12 h-12 bg-retro-accent/10 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Code className="w-6 h-6 text-retro-accent" />
            </div>
            <p className="text-retro-text/80 text-xs uppercase tracking-wider">8+ Languages</p>
          </div>
          <div className="bg-retro-surface/50 border border-retro-border/20 rounded-lg p-5 backdrop-blur-sm hover:bg-retro-surface/70 hover:border-emerald-500/30 hover:-translate-y-1 transition-all duration-300">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-6 h-6 text-emerald-500" />
            </div>
            <p className="text-retro-text/80 text-xs uppercase tracking-wider">AI Analysis</p>
          </div>
          <div className="bg-retro-surface/50 border border-retro-border/20 rounded-lg p-5 backdrop-blur-sm hover:bg-retro-surface/70 hover:border-amber-500/30 hover:-translate-y-1 transition-all duration-300">
            <div className="w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Terminal className="w-6 h-6 text-amber-500" />
            </div>
            <p className="text-retro-text/80 text-xs uppercase tracking-wider">Code Execute</p>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="mt-10 text-center max-w-2xl z-10 w-full px-4">
        <h2 className="text-retro-text text-sm uppercase tracking-widest mb-6 opacity-80">HOW IT WORKS</h2>
        <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-retro-cyan/10 rounded-full flex items-center justify-center text-retro-cyan font-bold">1</div>
            <p className="text-retro-text/70 text-xs">CREATE A ROOM</p>
          </div>
          <div className="hidden md:block text-retro-border/50">→</div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-retro-accent/10 rounded-full flex items-center justify-center text-retro-accent font-bold">2</div>
            <p className="text-retro-text/70 text-xs">SHARE ROOM ID</p>
          </div>
          <div className="hidden md:block text-retro-border/50">→</div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 font-bold">3</div>
            <p className="text-retro-text/70 text-xs">START CODING</p>
          </div>
        </div>
      </div>

      {/* Tech Stack */}
      <div className="mt-10 text-center z-10">
        <div className="flex items-center justify-center gap-6 text-retro-text/40">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            <span className="text-[10px] uppercase tracking-wider">Socket.io</span>
          </div>
          <div className="flex items-center gap-2">
            <Code className="w-4 h-4" />
            <span className="text-[10px] uppercase tracking-wider">Monaco Editor</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            <span className="text-[10px] uppercase tracking-wider">React</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-10 text-center text-retro-text/30 text-[9px] z-10 tracking-widest">
        <p>BUILT WITH PASSION FOR COLLABORATION</p>
        <p className="mt-2">&copy; {new Date().getFullYear()} CODE SYNC</p>
      </div>
    </div>
  )
}

export default Home
