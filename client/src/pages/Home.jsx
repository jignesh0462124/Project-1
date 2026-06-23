import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Bot, Check, ChevronDown, Code2, Copy, Play, Plus, Terminal, UsersRound } from 'lucide-react'
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
      <header className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 md:px-10 xl:px-16">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-retro-cyan text-white">
            <UsersRound className="h-5 w-5" />
          </div>
          <span className="text-base font-semibold tracking-tight">Collaborative Platform</span>
        </div>
        <nav className="hidden items-center gap-7 text-sm font-medium text-[var(--text-dim)] md:flex">
          <span className="text-retro-text">Rooms</span>
          <span>Compiler</span>
          <span>AI Review</span>
        </nav>
        <ThemeToggle />
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-64px)] w-full max-w-7xl grid-cols-1 items-center gap-10 px-5 pb-12 pt-6 md:px-10 lg:grid-cols-12 lg:gap-8 xl:px-16">
        <div className="lg:col-span-7">
          <div className="max-w-3xl">
            <h1 className="max-w-3xl text-4xl font-normal leading-[1.08] tracking-[-0.04em] text-retro-text sm:text-6xl lg:text-[72px]">
              Collaborative coding, reviews, and execution in one room.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-[var(--text-dim)] sm:text-lg">
              Create a focused coding session where teammates can edit together, run compiler output, discuss the solution, and ask for AI feedback without leaving the workspace.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              ['Live room state', 'Cursors, chat, roles, pause and ownership stay visible.'],
              ['Compiler ready', 'Run JavaScript, Python, Java, C++, Go, Rust and more.'],
              ['AI analysis', 'Review code with compiler output as context.']
            ].map(([title, copy]) => (
              <div key={title} className="rounded-xl border border-retro-border bg-retro-surface p-4">
                <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-dim)] text-retro-cyan">
                  <Check className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-semibold text-retro-text">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--text-dim)]">{copy}</p>
              </div>
            ))}
          </div>

          <ProductPreview />
        </div>

        <div className="lg:col-span-5 lg:justify-self-end">
          <div className="w-full max-w-[520px] space-y-4">
            <SupabaseAuthPanel onDisplayNameResolved={handleDisplayNameResolved} />

            <section className="rounded-xl border border-retro-border bg-retro-surface p-5 sm:p-6">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-normal tracking-[-0.02em] text-retro-text">Start a room</h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-dim)]">Create a new session or join an existing room code.</p>
                </div>
                <div className="hidden h-10 w-10 items-center justify-center rounded-lg bg-[var(--surface-raised)] text-retro-cyan sm:flex">
                  <Code2 className="h-5 w-5" />
                </div>
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
                      <div className="absolute left-0 top-full z-50 mt-2 max-h-60 w-full overflow-y-auto rounded-lg border border-retro-border bg-[var(--surface)] shadow-[var(--shadow-pop)]">
                        {SUPPORTED_LANGUAGES.map((language) => (
                          <button
                            key={language.value}
                            type="button"
                            onClick={() => {
                              setSelectedLanguage(language.value)
                              setIsLangDropdownOpen(false)
                            }}
                            className={`flex w-full items-center justify-between px-3 py-3 text-left text-sm transition-colors ${
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
                    className="pixel-input font-mono-ui uppercase tracking-[0.12em]"
                    disabled={isLoading}
                  />
                </div>

                <div className="grid gap-3 pt-1 sm:grid-cols-2">
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

                <p className="text-sm leading-6 text-[var(--text-dim)]">Rooms support up to 4 people with shared editor, chat, output, and AI analysis.</p>

                {createdRoomId && (
                  <div className="rounded-lg border border-retro-border bg-[var(--surface-raised)] p-4">
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
        </div>
      </section>
    </main>
  )
}

function ProductPreview() {
  const codeLines = [
    'function pairReview(solution) {',
    '  const result = runCompiler(solution)',
    '  return ai.review(solution, result.output)',
    '}'
  ]

  return (
    <section className="professional-preview mt-10">
      <div className="professional-preview__bar flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-retro-text">
          <Terminal className="h-4 w-4 text-retro-cyan" />
          Room workspace preview
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--text-dim)]">
          <span className="h-2 w-2 rounded-full bg-[var(--success)]" />
          Live
        </div>
      </div>
      <div className="grid gap-4 p-4 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="professional-code-pane p-4">
          <div className="mb-4 flex items-center justify-between text-xs text-[var(--text-dim)]">
            <span className="font-mono-ui">solution.js</span>
            <span>4 collaborators</span>
          </div>
          <div className="space-y-2 font-mono-ui text-[13px] leading-6">
            {codeLines.map((line, index) => (
              <div key={line} className="grid grid-cols-[28px_1fr] gap-3">
                <span className="text-right text-[var(--muted)]">{index + 1}</span>
                <span className={index === 1 ? 'text-retro-cyan' : 'text-retro-text'}>{line}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <div className="rounded-xl border border-retro-border bg-[var(--surface-raised)] p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-retro-text">
              <Play className="h-4 w-4 text-retro-cyan" />
              Compiler output
            </div>
            <pre className="font-mono-ui text-xs leading-6 text-[var(--text-dim)]">Accepted\nRuntime 42ms\nMemory 38MB</pre>
          </div>
          <div className="rounded-xl border border-retro-border bg-[var(--surface-raised)] p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-retro-text">
              <Bot className="h-4 w-4 text-retro-accent" />
              AI review timeline
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="ai-stage-pill ai-stage-pill--thinking">Thinking</span>
              <span className="ai-stage-pill ai-stage-pill--read">Reading</span>
              <span className="ai-stage-pill ai-stage-pill--edit">Editing</span>
              <span className="ai-stage-pill ai-stage-pill--done">Done</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Home
