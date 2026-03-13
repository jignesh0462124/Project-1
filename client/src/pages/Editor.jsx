import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import Editor from '@monaco-editor/react'
import toast from 'react-hot-toast'
import socketService from '../socket'
import RoomHeader from '../components/RoomHeader'
import UserList from '../components/UserList'
import ChatPanel from '../components/ChatPanel'
import LanguageSelector from '../components/LanguageSelector'
import OutputPanel from '../components/OutputPanel'
import AnalysisPanel from '../components/AnalysisPanel'
import SUPPORTED_LANGUAGES from '../constants/languages'
import { getBoilerplate } from '../constants/boilerplates'
import { useTheme } from '../components/ThemeContext'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// Languages that support execution via Judge0
const EXECUTABLE_LANGUAGES = ['javascript', 'typescript', 'python', 'java', 'cpp', 'go', 'rust']

// SUPPORTED_LANGUAGES imported from '../constants/languages'

function EditorPage() {
  const { roomId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const username = searchParams.get('username')
  const initialLanguage = searchParams.get('language') || 'javascript'
  
  // State
  const [code, setCode] = useState('')
  const [language, setLanguage] = useState(initialLanguage)
  const [users, setUsers] = useState([])
  const [isConnected, setIsConnected] = useState(false)
  const [isJoining, setIsJoining] = useState(true)
  const [cursors, setCursors] = useState({})
  const [chatMessages, setChatMessages] = useState([])
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [executionResult, setExecutionResult] = useState(null)
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const { theme } = useTheme()
  
  // Refs
  const editorRef = useRef(null)
  const socketRef = useRef(null)
  const codeUpdateTimeoutRef = useRef(null)
  const cursorUpdateTimeoutRef = useRef(null)

  // Initialize socket connection
  useEffect(() => {
    if (!username || !roomId) {
      toast.error('MISSING USERNAME OR ROOM ID!')
      navigate('/')
      return
    }

    const socket = socketService.connect()
    socketRef.current = socket

    // Socket event handlers
    const handleConnect = () => {
      console.log('Connected to server')
      setIsConnected(true)
      socket.emit('join-room', { roomId, username, language: initialLanguage })
    }

    const handleDisconnect = () => {
      console.log('Disconnected from server')
      setIsConnected(false)
      toast.error('DISCONNECTED FROM SERVER!')
    }

    const handleRoomJoined = (data) => {
      console.log('Room joined:', data)
      setUsers(data.users || [])
      setCode(data.code || '')
      setLanguage(data.language || 'javascript')
      setIsJoining(false)
      toast.success(`JOINED ROOM ${roomId}!`)
      
      // Add welcome message
      setChatMessages(prev => [...prev, {
        username: 'SYSTEM',
        message: `Welcome to room ${roomId}! You are ${data.users?.find(u => u.username === username)?.isHost ? 'the HOST' : 'a PLAYER'}.`,
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
        isSystem: true
      }])
    }

    const handleRoomFull = (data) => {
      console.log('Room full:', data)
      toast.error(data.message || 'ROOM IS FULL!')
      setTimeout(() => navigate('/'), 2000)
    }

    const handleUsernameTaken = (data) => {
      console.log('Username taken:', data)
      toast.error(data.message || 'USERNAME ALREADY TAKEN!')
      setTimeout(() => navigate('/'), 2000)
    }

    const handleUserJoined = (data) => {
      console.log('User joined:', data)
      setUsers(data.users || [])
      toast.success(`${data.username} JOINED THE ROOM!`)
      
      setChatMessages(prev => [...prev, {
        username: 'SYSTEM',
        message: `${data.username} joined the room! ${data.isHost ? '(HOST)' : ''}`,
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
        isSystem: true
      }])
    }

    const handleUserLeft = (data) => {
      console.log('User left:', data)
      setUsers(data.users || [])
      toast(`${data.username} LEFT THE ROOM`, { icon: '👋' })
      
      // Remove user's cursor
      setCursors(prev => {
        const newCursors = { ...prev }
        delete newCursors[data.username]
        return newCursors
      })

      setChatMessages(prev => [...prev, {
        username: 'SYSTEM', 
        message: `${data.username} left the room.`,
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
        isSystem: true
      }])
    }

    const handleCodeUpdated = (data) => {
      console.log('Code updated from server')
      setCode(data.code || '')
    }

    const handleLanguageUpdated = (data) => {
      console.log('Language updated:', data.language)
      setLanguage(data.language || 'javascript')
      toast(`LANGUAGE CHANGED TO ${data.language.toUpperCase()}!`)
    }

    const handleCursorUpdated = (data) => {
      setCursors(prev => ({
        ...prev,
        [data.username]: {
          position: data.position,
          color: data.color
        }
      }))
    }

    const handleChatReceived = (data) => {
      setChatMessages(prev => [...prev, {
        username: data.username,
        message: data.message,
        timestamp: data.timestamp,
        isSystem: false
      }])
    }

    const handleUserPaused = (data) => {
      setUsers(data.users || [])
      if (data.targetUsername === username) {
        setIsPaused(true)
        toast('⛔ YOU HAVE BEEN PAUSED BY THE HOST', { icon: '⏸️' })
      } else {
        toast(`${data.targetUsername} HAS BEEN PAUSED`, { icon: '⏸️' })
      }
    }

    const handleUserUnpaused = (data) => {
      setUsers(data.users || [])
      if (data.targetUsername === username) {
        setIsPaused(false)
        toast.success('YOU HAVE BEEN UNPAUSED!')
      } else {
        toast(`${data.targetUsername} HAS BEEN UNPAUSED`, { icon: '▶️' })
      }
    }

    const handleActionBlocked = (data) => {
      toast.error(data.message || 'ACTION BLOCKED!')
    }

    // Register event listeners
    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('room-joined', handleRoomJoined)
    socket.on('room-full', handleRoomFull)
    socket.on('username-taken', handleUsernameTaken)
    socket.on('user-joined', handleUserJoined)
    socket.on('user-left', handleUserLeft)
    socket.on('code-updated', handleCodeUpdated)
    socket.on('language-updated', handleLanguageUpdated)
    socket.on('cursor-updated', handleCursorUpdated)
    socket.on('chat-received', handleChatReceived)
    socket.on('user-paused', handleUserPaused)
    socket.on('user-unpaused', handleUserUnpaused)
    socket.on('action-blocked', handleActionBlocked)

    // Connect if already connected
    if (socket.connected) {
      handleConnect()
    }

    // Cleanup
    return () => {
      if (codeUpdateTimeoutRef.current) {
        clearTimeout(codeUpdateTimeoutRef.current)
      }
      if (cursorUpdateTimeoutRef.current) {
        clearTimeout(cursorUpdateTimeoutRef.current)
      }
      
      // Leave room before disconnecting
      if (socket.connected) {
        socket.emit('leave-room', { roomId, username })
      }
      
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('room-joined', handleRoomJoined)
      socket.off('room-full', handleRoomFull)
      socket.off('username-taken', handleUsernameTaken)
      socket.off('user-joined', handleUserJoined)
      socket.off('user-left', handleUserLeft)
      socket.off('code-updated', handleCodeUpdated)
      socket.off('language-updated', handleLanguageUpdated)
      socket.off('cursor-updated', handleCursorUpdated)
      socket.off('chat-received', handleChatReceived)
      socket.off('user-paused', handleUserPaused)
      socket.off('user-unpaused', handleUserUnpaused)
      socket.off('action-blocked', handleActionBlocked)
      
      socketService.disconnect()
    }
  }, [roomId, username, navigate])

  // Handle editor changes
  const handleEditorChange = (value) => {
    setCode(value || '')
    
    // Debounce code updates to avoid spamming the server
    if (codeUpdateTimeoutRef.current) {
      clearTimeout(codeUpdateTimeoutRef.current)
    }
    
    codeUpdateTimeoutRef.current = setTimeout(() => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('code-change', { roomId, code: value || '' })
      }
    }, 300)
  }

  // Handle cursor position changes
  const handleCursorPositionChange = (e) => {
    if (!editorRef.current || !socketRef.current?.connected) return

    const position = e.position
    if (position) {
      // Debounce cursor updates
      if (cursorUpdateTimeoutRef.current) {
        clearTimeout(cursorUpdateTimeoutRef.current)
      }
      
      cursorUpdateTimeoutRef.current = setTimeout(() => {
        socketRef.current.emit('cursor-move', { 
          roomId, 
          username, 
          position: {
            lineNumber: position.lineNumber,
            column: position.column
          }
        })
      }, 150)
    }
  }

  // Handle language change — inject boilerplate code for the selected language
  const handleLanguageChange = (newLanguage) => {
    setLanguage(newLanguage)

    // Set the boilerplate code for the new language
    const boilerplate = getBoilerplate(newLanguage)
    setCode(boilerplate)

    if (socketRef.current?.connected) {
      // Broadcast the language change
      socketRef.current.emit('language-change', { roomId, language: newLanguage })
      // Broadcast the new boilerplate code so all collaborators see it
      socketRef.current.emit('code-change', { roomId, code: boilerplate })
    }
  }

  // Handle code execution via Judge0
  const handleRunCode = async () => {
    if (isRunning || !EXECUTABLE_LANGUAGES.includes(language)) return

    setIsRunning(true)
    setExecutionResult(null)

    try {
      const response = await fetch(`${API_URL}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language }),
      })

      const data = await response.json()

      if (!response.ok) {
        setExecutionResult({ error: data.error, details: data.details })
        toast.error('EXECUTION FAILED!')
      } else {
        setExecutionResult(data)
        if (data.status?.id === 3) {
          toast.success('CODE EXECUTED SUCCESSFULLY!')
        } else {
          toast(`EXECUTION: ${data.status?.description?.toUpperCase() || 'DONE'}`, { icon: '⚠️' })
        }
      }
    } catch (err) {
      setExecutionResult({ error: 'Network error', details: err.message })
      toast.error('FAILED TO REACH SERVER!')
    } finally {
      setIsRunning(false)
    }
  }

  // Clear execution output
  const handleClearOutput = () => {
    setExecutionResult(null)
  }

  // Handle AI code analysis
  const handleAnalyzeCode = async () => {
    if (isAnalyzing) return

    setIsAnalyzing(true)
    setAnalysisResult(null)

    try {
      const compilerOutput = executionResult
        ? [executionResult.stdout, executionResult.stderr, executionResult.compile_output].filter(Boolean).join('\n')
        : null

      const response = await fetch(`${API_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language, compilerOutput }),
      })

      const data = await response.json()

      if (!response.ok) {
        setAnalysisResult(`Error: ${data.error || 'Analysis failed'}`)
        toast.error('ANALYSIS FAILED!')
      } else {
        setAnalysisResult(data.analysis)
        toast.success('ANALYSIS COMPLETE!')
      }
    } catch (err) {
      setAnalysisResult(`Error: ${err.message}`)
      toast.error('FAILED TO REACH SERVER!')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleClearAnalysis = () => {
    setAnalysisResult(null)
  }

  // Handle pause/unpause
  const handlePauseUser = (targetUsername) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('pause-user', { roomId, targetUsername })
    }
  }

  const handleUnpauseUser = (targetUsername) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('unpause-user', { roomId, targetUsername })
    }
  }

  // Handle sending chat messages
  const handleSendMessage = (message) => {
    if (socketRef.current?.connected && message.trim()) {
      socketRef.current.emit('chat-message', { 
        roomId, 
        username, 
        message: message.trim() 
      })
    }
  }

  // Handle leaving the room
  const handleLeaveRoom = () => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('leave-room', { roomId, username })
    }
    navigate('/')
  }

  // Handle editor mount
  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor
    
    // Define custom light theme for better contrast
    monaco.editor.defineTheme('retro-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: '', foreground: '0f172a', background: 'f8fafc' }, // slate-900 on slate-50
        { token: 'comment', foreground: '10b981', fontStyle: 'italic' }, // emerald-500
        { token: 'keyword', foreground: '2563eb', fontStyle: 'bold' }, // blue-600
        { token: 'string', foreground: 'd97706' }, // amber-600
        { token: 'number', foreground: '7c3aed' }, // violet-600
        { token: 'identifier', foreground: '0f172a' },
      ],
      colors: {
        'editor.background': '#f8fafc', // match --color-bg
        'editor.foreground': '#0f172a',
        'editor.lineHighlightBackground': '#f1f5f9', // slate-100
        'editorCursor.foreground': '#3b82f6',
        'editor.selectionBackground': '#bfdbfe', // blue-200
        'editorLineNumber.foreground': '#94a3b8',
      }
    });
    
    // Set up cursor position change listener
    editor.onDidChangeCursorPosition(handleCursorPositionChange)
    
    // Configure editor
    editor.updateOptions({
      fontSize: 14,
      fontFamily: '"JetBrains Mono", "Fira Code", "Courier New", monospace',
      minimap: { enabled: true },
      wordWrap: 'on',
      automaticLayout: true,
      scrollBeyondLastLine: false,
      renderWhitespace: 'selection',
      cursorBlinking: 'blink',
    })

    // Set initial theme
    monaco.editor.setTheme(theme === 'dark' ? 'vs-dark' : 'retro-light')
  }

  // Update monaco theme when context theme changes
  useEffect(() => {
    if (editorRef.current && window.monaco) {
      window.monaco.editor.setTheme(theme === 'dark' ? 'vs-dark' : 'retro-light')
    }
  }, [theme])

  const getCurrentLanguageLabel = () => {
    const lang = SUPPORTED_LANGUAGES.find(l => l.value === language)
    return lang ? lang.label : 'JavaScript'
  }

  const getCurrentMonacoLanguage = () => {
    const lang = SUPPORTED_LANGUAGES.find(l => l.value === language)
    return lang ? lang.monacoId : 'javascript'
  }

  if (isJoining) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="pixel-panel text-center px-8 py-6">
          <div className="flex justify-center mb-4">
            <div className="w-8 h-8 border-4 border-retro-cyan border-t-transparent rounded-full animate-spin"></div>
          </div>
          <div className="text-retro-text text-sm mb-2 font-bold tracking-wider">
            JOINING SESSION {roomId}
          </div>
          <div className="text-retro-text text-[10px] opacity-60 tracking-widest uppercase">
            AUTHENTICATING AS {username}...
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-retro-bg">
      {/* Header */}
      <RoomHeader
        roomId={roomId}
        users={users}
        currentUser={username}
        isConnected={isConnected}
        onLeaveRoom={handleLeaveRoom}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className={`
          bg-retro-surface border-r-2 border-retro-border transition-all duration-300 flex flex-col overflow-hidden
          ${isSidebarCollapsed ? 'w-0 border-r-0' : 'w-80'}
        `}>
          {!isSidebarCollapsed && (
            <>
              {/* Language Selector */}
              <div className="p-4 border-b-2 border-retro-border">
                <LanguageSelector
                  currentLanguage={language}
                  onLanguageChange={handleLanguageChange}
                  languages={SUPPORTED_LANGUAGES}
                />
              </div>

              {/* User List */}
              <div className="p-4 border-b-2 border-retro-border">
                <UserList
                users={users}
                currentUser={username}
                isHost={users.find(u => u.username === username)?.isHost}
                onPauseUser={handlePauseUser}
                onUnpauseUser={handleUnpauseUser}
              />
              </div>

              {/* Chat Panel */}
              <div className="flex-1 flex flex-col min-h-0">
                <ChatPanel
                  messages={chatMessages}
                  onSendMessage={handleSendMessage}
                  currentUser={username}
                />
              </div>
            </>
          )}
        </div>

        {/* Toggle Sidebar Button — sits between sidebar and editor */}
        <div className="flex flex-col items-center justify-center bg-retro-surface border-r border-retro-border">
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="pixel-button pixel-button--small"
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed ? '→' : '←'}
          </button>
        </div>

        {/* Editor Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Editor Header */}
          <div className="bg-retro-panel border-b border-retro-border p-3 flex items-center justify-between text-[10px] tracking-wider uppercase">
            <div className="text-retro-text flex items-center gap-4">
              <span className="opacity-80">LANGUAGE: <span className="text-retro-cyan font-bold opacity-100">{getCurrentLanguageLabel()}</span></span>
              {!isConnected && (
                <span className="text-red-400 flex items-center gap-1.5 bg-red-400/10 px-2 py-1 rounded">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"></div>
                  DISCONNECTED
                </span>
              )}
              {isConnected && (
                <span className="text-emerald-400 flex items-center gap-1.5 bg-emerald-400/10 px-2 py-1 rounded">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_#10b981]"></div>
                  CONNECTED
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="text-retro-text opacity-60 flex gap-4">
                <span>LN <span className="text-retro-text opacity-100">{code.split('\n').length}</span></span>
                <span>CH <span className="text-retro-text opacity-100">{code.length}</span></span>
              </div>
              <button
                id="run-code-button"
                onClick={handleRunCode}
                disabled={isRunning || !EXECUTABLE_LANGUAGES.includes(language)}
                className={`pixel-button pixel-button--small flex items-center gap-1.5 ${
                  EXECUTABLE_LANGUAGES.includes(language)
                    ? 'pixel-button--cyan'
                    : 'opacity-40 cursor-not-allowed'
                }`}
                title={!EXECUTABLE_LANGUAGES.includes(language) ? `${getCurrentLanguageLabel()} is not executable` : 'Run code'}
              >
                {isRunning ? (
                  <>
                    <div className="w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    RUNNING
                  </>
                ) : (
                  <>
                    ▶ RUN
                  </>
                )}
              </button>
              <button
                id="analyze-code-button"
                onClick={handleAnalyzeCode}
                disabled={isAnalyzing || !code.trim()}
                className={`pixel-button pixel-button--small flex items-center gap-1.5 ${
                  code.trim()
                    ? 'pixel-button--magenta'
                    : 'opacity-40 cursor-not-allowed'
                }`}
                title="Analyze code with AI"
              >
                {isAnalyzing ? (
                  <>
                    <div className="w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ANALYZING
                  </>
                ) : (
                  <>
                    🔍 ANALYZE
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Monaco Editor */}
          <div className="flex-1 monaco-editor-container relative">
            <Editor
              height="100%"
              language={getCurrentMonacoLanguage()}
              value={code}
              onChange={handleEditorChange}
              onMount={handleEditorDidMount}
              theme={theme === 'dark' ? 'vs-dark' : 'vs'}
              options={{
                fontSize: 14,
                fontFamily: '"JetBrains Mono", "Fira Code", "Courier New", monospace',
                minimap: { enabled: true },
                wordWrap: 'on',
                automaticLayout: true,
                scrollBeyondLastLine: false,
              renderWhitespace: 'selection',
              cursorBlinking: 'blink',
              lineNumbers: 'on',
              glyphMargin: true,
              folding: true,
              lineDecorationsWidth: 0,
              lineNumbersMinChars: 3,
              renderLineHighlight: 'all',
              selectOnLineNumbers: true,
              roundedSelection: false,
              readOnly: isPaused,
              cursorStyle: 'line',
              cursorWidth: 2,
              tabSize: 2,
              insertSpaces: true,
              detectIndentation: true,
              trimAutoWhitespace: true,
              quickSuggestions: true,
              suggestOnTriggerCharacters: true,
            }}
          />
          {/* Paused Overlay */}
          {isPaused && (
            <div className="absolute inset-0 bg-retro-bg/60 backdrop-blur-[1px] flex items-center justify-center z-10 pointer-events-none">
              <div className="bg-retro-surface border-2 border-red-500/50 rounded-lg px-6 py-4 text-center shadow-lg">
                <div className="text-red-400 text-sm font-bold tracking-wider mb-1">⛔ YOU ARE PAUSED</div>
                <div className="text-retro-text text-[9px] opacity-60 tracking-wider uppercase">The host has paused your editing</div>
              </div>
            </div>
          )}
        </div>

          <OutputPanel
            result={executionResult}
            isRunning={isRunning}
            onClear={handleClearOutput}
          />

          {/* AI Analysis Panel */}
          <AnalysisPanel
            analysis={analysisResult}
            isAnalyzing={isAnalyzing}
            onClear={handleClearAnalysis}
          />
        </div>
      </div>
    </div>
  )
}

export default EditorPage