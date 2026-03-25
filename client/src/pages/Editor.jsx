import { useState, useEffect, useRef, useCallback } from 'react'
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
import { useTheme } from '../components/useTheme'
import { 
  Copy, Download, Maximize2, Minimize2, Settings, 
  Keyboard, Save, Check, Wifi, WifiOff
} from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// Languages that support execution via Judge0
const EXECUTABLE_LANGUAGES = ['javascript', 'typescript', 'python', 'java', 'cpp', 'go', 'rust']

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
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const [editorFontSize, setEditorFontSize] = useState(14)
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 })
  const { theme } = useTheme()
  
  // Refs
  const editorRef = useRef(null)
  const socketRef = useRef(null)
  const isCodeSyncingRef = useRef(false)
  const codeUpdateTimeoutRef = useRef(null)
  const cursorUpdateTimeoutRef = useRef(null)
  const decorationsRef = useRef([])

  // Watch for cursor updates and render them in Monaco
  useEffect(() => {
    if (!editorRef.current || !window.monaco) return

    const editor = editorRef.current
    const newDecorations = []

    // Map each remote cursor to a Monaco decoration
    Object.entries(cursors).forEach(([user, cursorData]) => {
      // Don't render our own cursor
      if (user === username) return
      
      const { position, color } = cursorData
      if (position && position.lineNumber && position.column) {
        // Create a unique class name for this user's cursor
        const cursorClassName = `cursor-${user.replace(/[^a-zA-Z0-9]/g, '-')}`
        
        // Add dynamic style for this specific cursor color
        let styleEl = document.getElementById(`style-${cursorClassName}`)
        if (!styleEl) {
          styleEl = document.createElement('style')
          styleEl.id = `style-${cursorClassName}`
          // We define a block cursor that takes the height of the line, and a ::before pseudo-element for the nametag
          styleEl.innerHTML = `
            .${cursorClassName} {
              border-left: 2px solid ${color} !important;
              position: relative;
              z-index: 10;
            }
            .${cursorClassName}::before {
              content: '${user}';
              position: absolute;
              top: -16px;
              left: -2px;
              background-color: ${color};
              color: white;
              font-family: 'Press Start 2P', cursive;
              font-size: 8px;
              padding: 2px 6px;
              border-radius: 4px;
              white-space: nowrap;
              z-index: 10;
              pointer-events: none;
            }
          `
          document.head.appendChild(styleEl)
        }

        newDecorations.push({
          range: new window.monaco.Range(
            position.lineNumber,
            position.column,
            position.lineNumber,
            position.column
          ),
          options: {
            className: cursorClassName,
            stickiness: window.monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
          }
        })
      }
    })

    // Apply decorations and save their IDs so we can remove/update them later
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations)
  }, [cursors, username])

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

      // Clean up cursor style element
      const cursorClassName = `cursor-${data.username.replace(/[^a-zA-Z0-9]/g, '-')}`
      const styleEl = document.getElementById(`style-${cursorClassName}`)
      if (styleEl) {
        styleEl.remove()
      }

      setChatMessages(prev => [...prev, {
        username: 'SYSTEM', 
        message: `${data.username} left the room.`,
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
        isSystem: true
      }])
    }

    const handleCodeUpdated = (data) => {
      if (isCodeSyncingRef.current) return
      console.log('Code updated from server')
      isCodeSyncingRef.current = true
      setCode(data.code || '')
      setTimeout(() => {
        isCodeSyncingRef.current = false
      }, 100)
    }

    const handleLanguageUpdated = (data) => {
      if (isCodeSyncingRef.current) return
      console.log('Language updated:', data.language)
      setLanguage(data.language || 'javascript')
      if (data.code) {
        isCodeSyncingRef.current = true
        setCode(data.code)
        setTimeout(() => {
          isCodeSyncingRef.current = false
        }, 100)
      }
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
  }, [roomId, username, initialLanguage, navigate])

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
      // Broadcast the language change with the new boilerplate code
      socketRef.current.emit('language-change', { roomId, language: newLanguage, code: boilerplate })
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
    
    // Define custom dark theme (retro gaming)
    monaco.editor.defineTheme('retro-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '10b981', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'c084fc', fontStyle: 'bold' },
        { token: 'string', foreground: 'fbbf24' },
        { token: 'number', foreground: 'f472b6' },
        { token: 'type', foreground: '22d3ee' },
        { token: 'function', foreground: '60a5fa' },
        { token: 'variable', foreground: 'e2e8f0' },
        { token: 'constant', foreground: 'fb923c' },
      ],
      colors: {
        'editor.background': '#0f172a',
        'editor.foreground': '#e2e8f0',
        'editor.lineHighlightBackground': '#1e293b',
        'editorCursor.foreground': '#22d3ee',
        'editor.selectionBackground': '#3b82f680',
        'editorLineNumber.foreground': '#64748b',
        'editorLineNumber.activeForeground': '#22d3ee',
        'editor.selectionHighlightBackground': '#3b82f640',
        'editorIndentGuide.background': '#334155',
        'editorIndentGuide.activeBackground': '#475569',
        'editorBracketMatch.background': '#3b82f640',
        'editorBracketMatch.border': '#22d3ee',
        'editorGutter.background': '#0f172a',
        'minimap.background': '#0f172a',
      }
    });

    // Define custom light theme - Clear & Visible
    monaco.editor.defineTheme('retro-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '059669', fontStyle: 'italic' },
        { token: 'keyword', foreground: '7c3aed', fontStyle: 'bold' },
        { token: 'string', foreground: 'b45309' },
        { token: 'number', foreground: 'c026d3' },
        { token: 'type', foreground: '0891b2' },
        { token: 'function', foreground: '2563eb' },
        { token: 'variable', foreground: '1e293b' },
        { token: 'constant', foreground: 'dc2626' },
        { token: 'operator', foreground: '4f46e5' },
        { token: 'delimiter', foreground: '64748b' },
        { token: 'delimiter.bracket', foreground: '475569' },
      ],
      colors: {
        'editor.background': '#ffffff',
        'editor.foreground': '#1e293b',
        'editor.lineHighlightBackground': '#f1f5f9',
        'editorCursor.foreground': '#2563eb',
        'editor.selectionBackground': '#bfdbfe',
        'editorLineNumber.foreground': '#94a3b8',
        'editorLineNumber.activeForeground': '#2563eb',
        'editor.selectionHighlightBackground': '#dbeafe',
        'editorIndentGuide.background': '#e2e8f0',
        'editorIndentGuide.activeBackground': '#cbd5e1',
        'editorBracketMatch.background': '#bfdbfe80',
        'editorBracketMatch.border': '#2563eb',
        'editorGutter.background': '#f8fafc',
        'minimap.background': '#ffffff',
        'editor.findMatchBackground': '#fde04780',
        'editor.findMatchHighlightBackground': '#fde04740',
        'editorWidget.background': '#f8fafc',
        'editorWidget.border': '#cbd5e1',
        'input.background': '#ffffff',
        'input.border': '#cbd5e1',
        'input.foreground': '#1e293b',
        'dropdown.background': '#ffffff',
        'dropdown.border': '#cbd5e1',
        'list.activeSelectionBackground': '#dbeafe',
        'list.hoverBackground': '#f1f5f9',
        'scrollbar.shadow': '#00000010',
        'scrollbarSlider.background': '#cbd5e180',
        'scrollbarSlider.hoverBackground': '#94a3b880',
        'scrollbarSlider.activeBackground': '#64748b80',
      }
    });
    
    // Set up cursor position change listener
    editor.onDidChangeCursorPosition((e) => {
      setCursorPosition({ line: e.position.lineNumber, column: e.position.column })
      handleCursorPositionChange(e)
    })
    
    // Configure editor with smooth animations
    editor.updateOptions({
      fontSize: editorFontSize,
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", "Courier New", monospace',
      fontLigatures: true,
      minimap: { enabled: true, scale: 1 },
      wordWrap: 'on',
      automaticLayout: true,
      scrollBeyondLastLine: false,
      renderWhitespace: 'selection',
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      smoothScrolling: true,
      mouseWheelZoom: true,
      padding: { top: 16, bottom: 16 },
      lineHeight: 1.6,
      letterSpacing: 0.5,
      cursorStyle: 'line',
      cursorWidth: 2,
      tabSize: 2,
      insertSpaces: true,
      detectIndentation: true,
      trimAutoWhitespace: true,
      formatOnPaste: true,
      formatOnType: true,
      folding: true,
      foldingHighlight: true,
      showFoldingControls: 'mouseover',
      lineDecorationsWidth: 0,
      lineNumbersMinChars: 3,
      renderLineHighlight: 'all',
      selectOnLineNumbers: true,
      roundedSelection: true,
      readOnly: isPaused,
      quickSuggestions: true,
      suggestOnTriggerCharacters: true,
      acceptSuggestionOnEnter: 'on',
      snippetSuggestions: 'top',
    })

    // Set initial theme
    monaco.editor.setTheme(theme === 'dark' ? 'retro-dark' : 'retro-light')
  }

  // Update editor font size
  const updateEditorFontSize = useCallback((size) => {
    setEditorFontSize(size)
    if (editorRef.current) {
      editorRef.current.updateOptions({ fontSize: size })
    }
  }, [])

  // Update monaco theme when context theme changes
  useEffect(() => {
    if (editorRef.current && window.monaco) {
      window.monaco.editor.setTheme(theme === 'dark' ? 'retro-dark' : 'retro-light')
    }
  }, [theme])

  // Fullscreen toggle
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.layout()
      }
    }, 100)
  }

  // Copy code to clipboard
  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code)
      toast.success('CODE COPIED!')
    } catch {
      toast.error('FAILED TO COPY!')
    }
  }

  // Download code as file
  const handleDownloadCode = () => {
    const lang = SUPPORTED_LANGUAGES.find(l => l.value === language)
    const extension = lang?.extension || 'txt'
    const blob = new Blob([code], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `code.${extension}`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CODE DOWNLOADED!')
  }

  // Auto-save indicator
  useEffect(() => {
    if (code && !isCodeSyncingRef.current) {
      setIsSaving(true)
      const timer = setTimeout(() => {
        setIsSaving(false)
        setLastSaved(new Date())
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [code])

  const getCurrentLanguageLabel = () => {
    const lang = SUPPORTED_LANGUAGES.find(l => l.value === language)
    return lang ? lang.label : 'JavaScript'
  }

  const getCurrentMonacoLanguage = () => {
    const lang = SUPPORTED_LANGUAGES.find(l => l.value === language)
    return lang ? lang.monacoId : 'javascript'
  }

  const formatLastSaved = () => {
    if (!lastSaved) return ''
    const now = new Date()
    const diff = Math.floor((now - lastSaved) / 1000)
    if (diff < 60) return 'Saved'
    if (diff < 3600) return `Saved ${Math.floor(diff / 60)}m ago`
    return `Saved ${Math.floor(diff / 3600)}h ago`
  }

  if (isJoining) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-retro-bg">
        <div className="pixel-panel text-center px-8 py-6 animate-pulse-slow">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="w-12 h-12 border-4 border-retro-cyan border-t-transparent rounded-full animate-spin"></div>
              <div className="absolute inset-0 w-12 h-12 border-4 border-retro-accent/30 rounded-full"></div>
            </div>
          </div>
          <div className="text-retro-cyan text-sm mb-2 font-bold tracking-wider">
            JOINING SESSION {roomId}
          </div>
          <div className="text-retro-text/60 text-[10px] tracking-widest uppercase">
            AUTHENTICATING AS {username}...
          </div>
          <div className="mt-4 flex justify-center gap-1">
            <span className="w-2 h-2 bg-retro-cyan rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
            <span className="w-2 h-2 bg-retro-cyan rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
            <span className="w-2 h-2 bg-retro-cyan rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`h-screen flex flex-col bg-retro-bg transition-all duration-300 ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Header */}
      {!isFullscreen && (
        <RoomHeader
          roomId={roomId}
          users={users}
          currentUser={username}
          isConnected={isConnected}
          onLeaveRoom={handleLeaveRoom}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Sidebar Overlay */}
        {!isSidebarCollapsed && (
          <div 
            className="md:hidden absolute inset-0 bg-black/50 z-10 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setIsSidebarCollapsed(true)}
          />
        )}

        {/* Sidebar */}
        <div className={`
          bg-retro-surface border-r-2 border-retro-border transition-all duration-300 ease-out flex flex-col overflow-hidden
          absolute md:relative z-20 h-full md:h-auto shadow-2xl md:shadow-none
          ${isSidebarCollapsed ? 'w-0 border-r-0 opacity-0' : 'w-[280px] md:w-80 opacity-100'}
        `}>
          {!isSidebarCollapsed && (
            <>
              {/* Language Selector */}
              <div className="p-3 md:p-4 border-b-2 border-retro-border">
                <LanguageSelector
                  currentLanguage={language}
                  onLanguageChange={handleLanguageChange}
                  languages={SUPPORTED_LANGUAGES}
                />
              </div>

              {/* User List */}
              <div className="p-3 md:p-4 border-b-2 border-retro-border">
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

        {/* Toggle Sidebar Button */}
        <div className="hidden md:flex flex-col items-center justify-center bg-retro-surface border-r border-retro-border relative z-10 transition-all duration-300">
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="pixel-button pixel-button--small hover:bg-retro-cyan/10 hover:border-retro-cyan transition-all duration-200"
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <span className="transition-transform duration-300" style={{ transform: isSidebarCollapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}>
              ←
            </span>
          </button>
        </div>

        {/* Mobile Toggle Button */}
        <div className="md:hidden absolute left-0 top-1/2 -translate-y-1/2 z-0 transition-all duration-300">
           {isSidebarCollapsed && (
             <button
              onClick={() => setIsSidebarCollapsed(false)}
              className="pixel-button pixel-button--small py-4 px-1 rounded-l-none border-l-0 shadow-lg bg-retro-surface hover:bg-retro-cyan/10 transition-all duration-200"
              title="Expand sidebar"
             >
               →
             </button>
           )}
        </div>

        {/* Editor Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Editor Header */}
          <div className="bg-retro-panel border-b border-retro-border p-2 md:p-3 flex flex-wrap items-center justify-between gap-y-2 gap-x-4 text-[9px] md:text-[10px] tracking-wider uppercase">
            <div className="text-retro-text flex flex-wrap items-center gap-2 md:gap-4">
              <span className="opacity-80 flex items-center gap-1">
                <span className="hidden sm:inline">LANGUAGE:</span> 
                <span className="text-retro-cyan font-bold opacity-100">{getCurrentLanguageLabel()}</span>
              </span>
              
              {/* Connection Status */}
              <span className={`flex items-center gap-1.5 px-2 py-1 rounded transition-all duration-300 ${
                isConnected 
                  ? 'text-emerald-400 bg-emerald-400/10' 
                  : 'text-red-400 bg-red-400/10'
              }`}>
                {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
              </span>

              {/* Save Status */}
              {isSaving ? (
                <span className="text-amber-400 flex items-center gap-1">
                  <Save className="w-3 h-3 animate-pulse" />
                  SAVING...
                </span>
              ) : lastSaved && (
                <span className="text-emerald-400/60 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  {formatLastSaved()}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 md:gap-4">
              {/* Status Bar */}
              <div className="text-retro-text/60 flex gap-3">
                <span>Ln {cursorPosition.line}, Col {cursorPosition.column}</span>
                <span className="hidden sm:inline">|</span>
                <span className="hidden sm:inline">Ln {code.split('\n').length}</span>
                <span className="hidden md:inline">|</span>
                <span className="hidden md:inline">{code.length} chars</span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {/* Settings */}
                <div className="relative">
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="pixel-button pixel-button--small hover:bg-retro-cyan/10 transition-all duration-200"
                    title="Editor Settings"
                  >
                    <Settings className="w-3 h-3" />
                  </button>
                  {showSettings && (
                    <div className="absolute right-0 top-full mt-2 bg-retro-surface border border-retro-border rounded-lg p-3 shadow-xl z-30 min-w-[200px] animate-fade-in">
                      <div className="text-retro-text text-[9px] mb-2 uppercase tracking-wider">Font Size</div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateEditorFontSize(Math.max(10, editorFontSize - 2))}
                          className="pixel-button pixel-button--small"
                        >
                          -
                        </button>
                        <span className="text-retro-cyan font-bold px-2">{editorFontSize}px</span>
                        <button
                          onClick={() => updateEditorFontSize(Math.min(24, editorFontSize + 2))}
                          className="pixel-button pixel-button--small"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Copy */}
                <button
                  onClick={handleCopyCode}
                  className="pixel-button pixel-button--small hover:bg-retro-cyan/10 transition-all duration-200"
                  title="Copy Code"
                >
                  <Copy className="w-3 h-3" />
                </button>

                {/* Download */}
                <button
                  onClick={handleDownloadCode}
                  className="pixel-button pixel-button--small hover:bg-retro-cyan/10 transition-all duration-200"
                  title="Download Code"
                >
                  <Download className="w-3 h-3" />
                </button>

                {/* Shortcuts */}
                <button
                  onClick={() => setShowShortcuts(!showShortcuts)}
                  className="pixel-button pixel-button--small hover:bg-retro-cyan/10 transition-all duration-200"
                  title="Keyboard Shortcuts"
                >
                  <Keyboard className="w-3 h-3" />
                </button>

                {/* Fullscreen */}
                <button
                  onClick={toggleFullscreen}
                  className="pixel-button pixel-button--small hover:bg-retro-cyan/10 transition-all duration-200"
                  title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                >
                  {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                </button>

                {/* Divider */}
                <div className="w-px h-4 bg-retro-border/30"></div>

                {/* Run */}
                <button
                  id="run-code-button"
                  onClick={handleRunCode}
                  disabled={isRunning || !EXECUTABLE_LANGUAGES.includes(language)}
                  className={`pixel-button pixel-button--small flex items-center gap-1.5 transition-all duration-200 ${
                    EXECUTABLE_LANGUAGES.includes(language)
                      ? 'bg-emerald-500 hover:bg-emerald-400 border-emerald-500 hover:border-emerald-400 text-white'
                      : 'opacity-40 cursor-not-allowed'
                  }`}
                  title={!EXECUTABLE_LANGUAGES.includes(language) ? `${getCurrentLanguageLabel()} is not executable` : 'Run code'}
                >
                  {isRunning ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      RUNNING
                    </>
                  ) : (
                    <>
                      <span className="text-xs">▶</span> RUN
                    </>
                  )}
                </button>

                {/* Analyze */}
                <button
                  id="analyze-code-button"
                  onClick={handleAnalyzeCode}
                  disabled={isAnalyzing || !code.trim()}
                  className={`pixel-button pixel-button--small flex items-center gap-1.5 transition-all duration-200 ${
                    code.trim()
                      ? 'bg-violet-500 hover:bg-violet-400 border-violet-500 hover:border-violet-400 text-white'
                      : 'opacity-40 cursor-not-allowed'
                  }`}
                  title="Analyze code with AI"
                >
                  {isAnalyzing ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ANALYZING
                    </>
                  ) : (
                    <>
                      <span className="text-xs">🔍</span> ANALYZE
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Keyboard Shortcuts Panel */}
          {showShortcuts && (
            <div className="bg-retro-panel border-b border-retro-border p-4 animate-slide-down">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[9px]">
                <div><kbd className="px-2 py-1 bg-retro-bg rounded border border-retro-border">Ctrl</kbd> + <kbd className="px-2 py-1 bg-retro-bg rounded border border-retro-border">S</kbd> Save</div>
                <div><kbd className="px-2 py-1 bg-retro-bg rounded border border-retro-border">Ctrl</kbd> + <kbd className="px-2 py-1 bg-retro-bg rounded border border-retro-border">C</kbd> Copy</div>
                <div><kbd className="px-2 py-1 bg-retro-bg rounded border border-retro-border">Ctrl</kbd> + <kbd className="px-2 py-1 bg-retro-bg rounded border border-retro-border">Z</kbd> Undo</div>
                <div><kbd className="px-2 py-1 bg-retro-bg rounded border border-retro-border">Ctrl</kbd> + <kbd className="px-2 py-1 bg-retro-bg rounded border border-retro-border">D</kbd> Duplicate Line</div>
                <div><kbd className="px-2 py-1 bg-retro-bg rounded border border-retro-border">Ctrl</kbd> + <kbd className="px-2 py-1 bg-retro-bg rounded border border-retro-border">/</kbd> Toggle Comment</div>
                <div><kbd className="px-2 py-1 bg-retro-bg rounded border border-retro-border">Alt</kbd> + <kbd className="px-2 py-1 bg-retro-bg rounded border-retro-border">↑/↓</kbd> Move Line</div>
                <div><kbd className="px-2 py-1 bg-retro-bg rounded border border-retro-border">Ctrl</kbd> + <kbd className="px-2 py-1 bg-retro-bg rounded border border-retro-border">Space</kbd> Suggestions</div>
                <div><kbd className="px-2 py-1 bg-retro-bg rounded border border-retro-border">F11</kbd> Fullscreen</div>
              </div>
            </div>
          )}

          {/* Monaco Editor */}
          <div className="flex-1 monaco-editor-container relative transition-all duration-300">
            <Editor
              height="100%"
              language={getCurrentMonacoLanguage()}
              value={code}
              onChange={handleEditorChange}
              onMount={handleEditorDidMount}
              theme={theme === 'dark' ? 'retro-dark' : 'retro-light'}
              options={{
                fontSize: editorFontSize,
                fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
                fontLigatures: true,
                minimap: { enabled: true, scale: 1 },
                wordWrap: 'on',
                automaticLayout: true,
                scrollBeyondLastLine: false,
                renderWhitespace: 'selection',
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                smoothScrolling: true,
                mouseWheelZoom: true,
                padding: { top: 16, bottom: 16 },
                lineHeight: 1.6,
                letterSpacing: 0.5,
                cursorStyle: 'line',
                cursorWidth: 2,
                tabSize: 2,
                insertSpaces: true,
                detectIndentation: true,
                trimAutoWhitespace: true,
                formatOnPaste: true,
                formatOnType: true,
                folding: true,
                foldingHighlight: true,
                showFoldingControls: 'mouseover',
                lineDecorationsWidth: 0,
                lineNumbersMinChars: 3,
                renderLineHighlight: 'all',
                selectOnLineNumbers: true,
                roundedSelection: true,
                readOnly: isPaused,
                quickSuggestions: true,
                suggestOnTriggerCharacters: true,
                acceptSuggestionOnEnter: 'on',
                snippetSuggestions: 'top',
              }}
            />
            {/* Paused Overlay */}
            {isPaused && (
              <div className="absolute inset-0 bg-retro-bg/80 backdrop-blur-md flex items-center justify-center z-10 pointer-events-none animate-fade-in">
                <div className="bg-retro-surface border-2 border-red-500/50 rounded-lg px-8 py-6 text-center shadow-2xl animate-pulse-slow">
                  <div className="text-red-400 text-sm font-bold tracking-wider mb-2">⛔ YOU ARE PAUSED</div>
                  <div className="text-retro-text/60 text-[10px] tracking-wider uppercase">The host has paused your editing</div>
                </div>
              </div>
            )}
          </div>

          {/* Output Panel */}
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

      {/* Click outside to close settings */}
      {showSettings && (
        <div className="fixed inset-0 z-20" onClick={() => setShowSettings(false)} />
      )}
    </div>
  )
}

export default EditorPage