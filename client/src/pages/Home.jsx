import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Check, ChevronDown, Copy, Plus, UsersRound } from 'lucide-react'
import ThemeToggle from '../components/ThemeToggle'
import SupabaseAuthPanel from '../components/SupabaseAuthPanel'
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

  const selectedLanguageLabel = SUPPORTED_LANGUAGES.find((language) => language.value === selectedLanguage)?.label || 'JavaScript'

  const handleDisplayNameResolved = useCallback((resolvedName) => {
    if (!resolvedName) return
    setUsername((currentName) => currentName || resolvedName)
  }, [])

  const validateUsername = () => {
    if (!username.trim()) {
      toast.error('Enter your display name first.')
      return false
    }

    if (username.trim().length > 20) {
      toast.error('Display name must be 20 characters or fewer.')
      return false
    }

    return true
  }

  const handleCreateRoom = async () => {
    if (!validateUsername()) return

    setIsLoading(true)

    try {
      const response = await fetch(`${import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001'}/api/create-room`)
      const data = await response.json()

      setCreatedRoomId(data.roomId)
      toast.success(`Room ${data.roomId} created.`)

      setTimeout(() => {
        navigate(`/room/${data.roomId}?username=${encodeURIComponent(username.trim())}&language=${selectedLanguage}`)
      }, 900)
    } catch (error) {
      console.error('Failed to create room:', error)
      toast.error('Failed to create room.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleJoinRoom = () => {
    if (!validateUsername()) return

    if (!roomId.trim()) {
      toast.error('Enter a session code.')
      return
    }

    const cleanRoomId = roomId.trim().toUpperCase()
    navigate(`/room/${cleanRoomId}?username=${encodeURIComponent(username.trim())}&language=${selectedLanguage}`)
  }

  const copyRoomId = async (roomIdToCopy) => {
    try {
      await navigator.clipboard.writeText(roomIdToCopy)
      toast.success('Session code copied.')
    } catch {
      toast.error('Could not copy session code.')
    }
  }

  const handleKeyPress = (event, action) => {
    if (event.key === 'Enter') {
      if (action === 'create') handleCreateRoom()
      if (action === 'join') handleJoinRoom()
    }
  }

  return (
    <main className="min-h-screen bg-retro-bg text-retro-text">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 md:px-10 xl:px-16">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded bg-retro-cyan text-retro-bg shadow-[2px_2px_0_0_var(--accent)]">
            <UsersRound className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold tracking-tight">Collaborative Platform</span>
        </div>
        <ThemeToggle />
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-80px)] w-full max-w-7xl grid-cols-1 items-center gap-10 px-5 pb-12 pt-4 md:px-10 lg:grid-cols-12 lg:gap-6 xl:px-16">
        <div className="order-2 max-w-2xl lg:order-1 lg:col-span-7">
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-retro-text sm:text-5xl lg:text-[56px]">
            Code together, in real time.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-[var(--text-dim)]">
            Share one file, see your room move around it, run the code, and ask for AI feedback without leaving the workspace.
          </p>

          <ul className="mt-9 space-y-4">
            {[
              'Real-time sync keeps everyone in the same file.',
              'AI analysis sits next to output instead of pushing it away.',
              'Sandboxed execution returns results inside the room.'
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-[var(--text-dim)]">
                <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-retro-cyan/50 bg-[var(--accent-dim)] text-retro-cyan">
                  <Check className="h-3 w-3" />
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="order-1 flex w-full max-w-[536px] flex-col gap-4 lg:order-2 lg:col-span-5 lg:justify-self-end">
          <SupabaseAuthPanel onDisplayNameResolved={handleDisplayNameResolved} />

          <section className="rounded-lg border border-retro-border bg-retro-surface p-5 shadow-none sm:p-6">
            <div className="mb-6">
              <h2 className="text-xl font-bold tracking-tight">Start a room</h2>
              <p className="mt-2 text-sm text-[var(--text-dim)]">Create a session or join one with a code.</p>
            </div>

            <div className="space-y-5">
              <div>
                <label className="ui-label mb-2 block" htmlFor="display-name">
                  Display name
                </label>
                <input
                  id="display-name"
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  onKeyDown={(event) => handleKeyPress(event, showJoinRoom ? 'join' : 'create')}
                  placeholder="developer_01"
                  maxLength={20}
                  className="pixel-input"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label className="ui-label mb-2 block" htmlFor="language-picker">
                  Language
                </label>
                <div className="relative">
                  <button
                    id="language-picker"
                    type="button"
                    onClick={() => setIsLangDropdownOpen((isOpen) => !isOpen)}
                    disabled={isLoading}
                    className="pixel-input flex items-center justify-between gap-3 text-left"
                  >
                    <span className="text-retro-text">{selectedLanguageLabel}</span>
                    <ChevronDown className={`h-4 w-4 text-[var(--text-dim)] transition-transform ${isLangDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isLangDropdownOpen && (
                    <div className="absolute left-0 top-full z-50 mt-2 max-h-60 w-full overflow-y-auto rounded border border-retro-border bg-[var(--surface-raised)] shadow-[var(--shadow-pop)]">
                      {SUPPORTED_LANGUAGES.map((language) => (
                        <button
                          key={language.value}
                          type="button"
                          onClick={() => {
                            setSelectedLanguage(language.value)
                            setIsLangDropdownOpen(false)
                          }}
                          className={`flex w-full items-center justify-between px-3 py-3 text-left font-mono-ui text-xs transition-colors ${
                            selectedLanguage === language.value
                              ? 'bg-[var(--accent-dim)] text-retro-cyan'
                              : 'text-[var(--text-dim)] hover:bg-[var(--surface-hover)] hover:text-retro-text'
                          }`}
                        >
                          {language.label}
                          {selectedLanguage === language.value && <Check className="h-4 w-4" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className={`overflow-hidden transition-all duration-200 ${showJoinRoom ? 'max-h-28 opacity-100' : 'max-h-0 opacity-0'}`}>
                <label className="ui-label mb-2 block" htmlFor="session-code">
                  Session code
                </label>
                <input
                  id="session-code"
                  type="text"
                  value={roomId}
                  onChange={(event) => setRoomId(event.target.value.toUpperCase())}
                  onKeyDown={(event) => handleKeyPress(event, 'join')}
                  placeholder="ABC12345"
                  maxLength={8}
                  className="pixel-input uppercase tracking-[0.12em]"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-3 pt-1">
                {!showJoinRoom ? (
                  <>
                    <button onClick={handleCreateRoom} disabled={isLoading} className="btn btn-primary w-full">
                      <Plus className="h-4 w-4" />
                      {isLoading ? 'Creating...' : 'Create Room'}
                    </button>
                    <button onClick={() => setShowJoinRoom(true)} disabled={isLoading} className="btn w-full">
                      Join Room
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={handleJoinRoom} disabled={isLoading} className="btn btn-primary w-full">
                      Join Room
                    </button>
                    <button
                      onClick={() => {
                        setShowJoinRoom(false)
                        setRoomId('')
                      }}
                      disabled={isLoading}
                      className="btn btn-ghost w-full"
                    >
                      Back to Create
                    </button>
                  </>
                )}
              </div>

              <p className="text-xs leading-5 text-[var(--text-dim)]">Rooms support up to 4 people at a time.</p>

              {createdRoomId && (
                <div className="rounded border border-retro-border bg-[var(--surface-raised)] p-4">
                  <div className="ui-label mb-2">Session created</div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono-ui text-base font-semibold tracking-[0.14em] text-retro-cyan">{createdRoomId}</span>
                    <button onClick={() => copyRoomId(createdRoomId)} className="icon-button" title="Copy session code">
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}

export default Home
