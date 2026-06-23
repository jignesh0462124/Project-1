import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Editor, { loader } from '@monaco-editor/react'
import * as Y from 'yjs'
import { MonacoBinding } from 'y-monaco'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution'
import 'monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution'
import 'monaco-editor/esm/vs/basic-languages/python/python.contribution'
import 'monaco-editor/esm/vs/basic-languages/java/java.contribution'
import 'monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution'
import 'monaco-editor/esm/vs/basic-languages/go/go.contribution'
import 'monaco-editor/esm/vs/basic-languages/rust/rust.contribution'
import 'monaco-editor/esm/vs/language/html/monaco.contribution'
import 'monaco-editor/esm/vs/language/css/monaco.contribution'
import 'monaco-editor/esm/vs/language/json/monaco.contribution'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
import toast from 'react-hot-toast'
import socketService from '../socket'
import UserList from '../components/UserList'
import ChatPanel from '../components/ChatPanel'
import LanguageSelector from '../components/LanguageSelector'
import OutputPanel from '../components/OutputPanel'
import AnalysisPanel from '../components/AnalysisPanel'
import ProblemPanel from '../components/ProblemPanel'
import { useTheme } from '../components/useTheme'
import { getSupabaseAccessToken } from '../lib/supabase'
import SUPPORTED_LANGUAGES from '../constants/languages'
import { getBoilerplate } from '../constants/boilerplates'
import {
  Bot,
  Check,
  Copy,
  Crown,
  Download,
  FileCode2,
  Keyboard,
  Link,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Save,
  Settings,
  Share2,
  Terminal,
  Users,
  Wifi,
  WifiOff,
  X
} from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const CURSOR_EMIT_INTERVAL_MS = 75
const REMOTE_DOCUMENT_ORIGIN = 'remote-document-update'
globalThis.MonacoEnvironment = {
  getWorker(_workerId, label) {
    if (label === 'json') return new jsonWorker()
    if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker()
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker()
    if (label === 'typescript' || label === 'javascript') return new tsWorker()
    return new editorWorker()
  }
}
loader.config({ monaco })

const EXECUTABLE_LANGUAGES = ['javascript', 'typescript', 'python', 'java', 'cpp', 'go', 'rust']
const RAIL_SIZES = {
  session: { key: 'collab-session-rail-width', defaultValue: 280, min: 240, max: 420 },
  activity: { key: 'collab-activity-rail-width', defaultValue: 360, min: 300, max: 480 }
}
const DENSITY_KEY = 'collab-density'

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function getStoredNumber(key, fallback, min, max) {
  if (typeof window === 'undefined') return fallback
  const parsed = Number(window.localStorage.getItem(key))
  return Number.isFinite(parsed) ? clamp(parsed, min, max) : fallback
}

function getStoredDensity() {
  if (typeof window === 'undefined') return 'comfortable'
  return window.localStorage.getItem(DENSITY_KEY) === 'compact' ? 'compact' : 'comfortable'
}

function isOwnerUser(user) {
  return Boolean(user?.role === 'owner' || user?.isHost)
}

function getPresenceKey(item) {
  return item?.userId || item?.id || item?.username
}

function createPresenceMap(items = []) {
  return items.reduce((presenceMap, item) => {
    const key = getPresenceKey(item)
    if (!key) return presenceMap

    presenceMap[key] = {
      username: item.username,
      position: item.position || item.cursor || null,
      selection: item.selection || null,
      color: item.color,
      lastActiveAt: item.lastActiveAt || Date.now()
    }

    return presenceMap
  }, {})
}

function isRangeSelected(selection) {
  if (!selection) return false
  return selection.startLineNumber !== selection.endLineNumber || selection.startColumn !== selection.endColumn
}

function getSelectionPayload(selection) {
  if (!selection) return null

  return {
    startLineNumber: selection.startLineNumber,
    startColumn: selection.startColumn,
    endLineNumber: selection.endLineNumber,
    endColumn: selection.endColumn
  }
}

function getEditorPresencePayload(editor) {
  const position = editor?.getPosition()
  if (!position) return null

  return {
    position: {
      lineNumber: position.lineNumber,
      column: position.column
    },
    selection: getSelectionPayload(editor.getSelection())
  }
}

function toDocumentUpdate(update) {
  if (update instanceof Uint8Array) return update
  if (Array.isArray(update)) return Uint8Array.from(update)
  if (update instanceof ArrayBuffer) return new Uint8Array(update)
  if (update?.data && Array.isArray(update.data)) return Uint8Array.from(update.data)
  return null
}

function hexToRgba(color, alpha) {
  if (!/^#[0-9a-f]{6}$/i.test(color || '')) return `rgba(111, 240, 189, ${alpha})`

  const value = color.slice(1)
  const red = parseInt(value.slice(0, 2), 16)
  const green = parseInt(value.slice(2, 4), 16)
  const blue = parseInt(value.slice(4, 6), 16)

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function EditorPage() {
  const { roomId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const username = searchParams.get('username')
  const initialLanguage = searchParams.get('language') || 'javascript'
  const { theme } = useTheme()

  const [code, setCode] = useState('')
  const [language, setLanguage] = useState(initialLanguage)
  const [users, setUsers] = useState([])
  const [currentUserId, setCurrentUserId] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isJoining, setIsJoining] = useState(true)
  const [cursors, setCursors] = useState({})
  const [chatMessages, setChatMessages] = useState([])
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [executionResult, setExecutionResult] = useState(null)
  const [isRunning, setIsRunning] = useState(false)
  const [executionToken, setExecutionToken] = useState(null)
  const [isPaused, setIsPaused] = useState(false)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const [editorFontSize, setEditorFontSize] = useState(14)
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 })
  const [currentProblem, setCurrentProblem] = useState(null)
  const [solvedProblems, setSolvedProblems] = useState([])
  const [showProblemPanel, setShowProblemPanel] = useState(true)
  const [chatFullscreen, setChatFullscreen] = useState(false)
  const [mobileBottomSheet, setMobileBottomSheet] = useState(null)
  const [activeActivityTab, setActiveActivityTab] = useState('output')
  const [hasUnreadAnalysis, setHasUnreadAnalysis] = useState(false)
  const [sessionRailWidth, setSessionRailWidth] = useState(() =>
    getStoredNumber(RAIL_SIZES.session.key, RAIL_SIZES.session.defaultValue, RAIL_SIZES.session.min, RAIL_SIZES.session.max)
  )
  const [activityRailWidth, setActivityRailWidth] = useState(() =>
    getStoredNumber(RAIL_SIZES.activity.key, RAIL_SIZES.activity.defaultValue, RAIL_SIZES.activity.min, RAIL_SIZES.activity.max)
  )
  const [density, setDensity] = useState(getStoredDensity)

  const shellRef = useRef(null)
  const editorRef = useRef(null)
  const monacoRef = useRef(null)
  const socketRef = useRef(null)
  const codeRef = useRef('')
  const cursorUpdateTimeoutRef = useRef(null)
  const lastCursorEmitAtRef = useRef(0)
  const pendingCursorPresenceRef = useRef(null)
  const presenceDecorationsRef = useRef(new Map())
  const cursorsRef = useRef({})
  const ydocRef = useRef(null)
  const ytextRef = useRef(null)
  const yBindingRef = useRef(null)
  const pendingDocumentStateRef = useRef(null)

  const currentUser = users.find((user) => user.id === currentUserId) || users.find((user) => user.username === username)
  const isHost = isOwnerUser(currentUser)
  const activeEditorUsers = users
    .filter((user) => user.id !== currentUserId)
    .sort((firstUser, secondUser) => Number(isOwnerUser(secondUser)) - Number(isOwnerUser(firstUser)))
  const currentLanguageLabel = SUPPORTED_LANGUAGES.find((item) => item.value === language)?.label || 'JavaScript'
  const lineCount = Math.max(code.split('\n').length, 1)
  const editorLineHeight = density === 'compact' ? 20 : 22

  const removePresenceDecoration = (presenceKey) => {
    if (!presenceKey || !editorRef.current) return

    const safeCursorId = String(presenceKey).replace(/[^a-zA-Z0-9_-]/g, '-')
    const previousDecorations = presenceDecorationsRef.current.get(presenceKey) || []
    if (previousDecorations.length) editorRef.current.deltaDecorations(previousDecorations, [])
    presenceDecorationsRef.current.delete(presenceKey)
    document.getElementById(`style-cursor-${safeCursorId}`)?.remove()
  }

  const upsertPresenceDecoration = (presenceKey, cursorData, userList = users, ownUserId = currentUserId) => {
    if (!presenceKey || presenceKey === ownUserId || !editorRef.current || !monacoRef.current) return

    const { position, selection, color, username: cursorUsername } = cursorData || {}
    if (!position?.lineNumber || !position?.column) {
      removePresenceDecoration(presenceKey)
      return
    }

    const editor = editorRef.current
    const monacoInstance = monacoRef.current
    const safeCursorId = String(presenceKey).replace(/[^a-zA-Z0-9_-]/g, '-')
    const user = userList.find((item) => item.id === presenceKey || item.username === cursorUsername)
    const displayName = cursorUsername || user?.username || 'Collaborator'
    const cursorLabel = isOwnerUser(user) ? `${displayName} - Owner` : displayName
    const cursorClassName = `cursor-${safeCursorId}`
    const selectionClassName = `selection-${safeCursorId}`
    let styleEl = document.getElementById(`style-${cursorClassName}`)
    const styleContent = `
      .${cursorClassName} {
        border-left: 2px solid ${color || 'var(--accent)'} !important;
        position: relative;
        z-index: 10;
      }
      .${cursorClassName}::before {
        content: ${JSON.stringify(cursorLabel)};
        position: absolute;
        top: -20px;
        left: -2px;
        background: ${color || 'var(--accent)'};
        color: var(--on-accent);
        font-family: "JetBrains Mono", monospace;
        font-size: 10px;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 4px;
        white-space: nowrap;
        pointer-events: none;
        box-shadow: var(--shadow-pop);
      }
      .${selectionClassName} {
        background: ${hexToRgba(color || '#6FF0BD', 0.24)} !important;
        border-bottom: 1px solid ${hexToRgba(color || '#6FF0BD', 0.72)};
      }
    `

    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = `style-${cursorClassName}`
      styleEl.dataset.remotePresence = 'true'
      document.head.appendChild(styleEl)
    }
    styleEl.innerHTML = styleContent

    const nextDecorations = [
      {
        range: new monacoInstance.Range(position.lineNumber, position.column, position.lineNumber, position.column),
        options: {
          className: cursorClassName,
          hoverMessage: { value: `${cursorLabel} is editing here` },
          stickiness: monacoInstance.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
        }
      }
    ]

    if (isRangeSelected(selection)) {
      nextDecorations.push({
        range: new monacoInstance.Range(
          selection.startLineNumber,
          selection.startColumn,
          selection.endLineNumber,
          selection.endColumn
        ),
        options: {
          inlineClassName: selectionClassName,
          hoverMessage: { value: `${cursorLabel}'s selection` },
          stickiness: monacoInstance.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
        }
      })
    }

    const previousDecorations = presenceDecorationsRef.current.get(presenceKey) || []
    const nextDecorationIds = editor.deltaDecorations(previousDecorations, nextDecorations)
    presenceDecorationsRef.current.set(presenceKey, nextDecorationIds)
  }

  const syncPresenceSnapshot = (presenceMap, userList = users, ownUserId = currentUserId) => {
    const activeKeys = new Set(Object.keys(presenceMap || {}))

    presenceDecorationsRef.current.forEach((_decorations, presenceKey) => {
      if (!activeKeys.has(presenceKey) || presenceKey === ownUserId) removePresenceDecoration(presenceKey)
    })

    Object.entries(presenceMap || {}).forEach(([presenceKey, cursorData]) => {
      upsertPresenceDecoration(presenceKey, cursorData, userList, ownUserId)
    })
  }

  useEffect(() => {
    cursorsRef.current = cursors
  }, [cursors])

  const bindMonacoToYText = (editor = editorRef.current) => {
    if (!editor || !ytextRef.current) return

    yBindingRef.current?.destroy()
    yBindingRef.current = new MonacoBinding(ytextRef.current, editor.getModel(), new Set([editor]), null)
  }

  const applyRemoteDocumentUpdate = (update) => {
    const normalizedUpdate = toDocumentUpdate(update)
    if (!normalizedUpdate) return

    if (!ydocRef.current) {
      pendingDocumentStateRef.current = normalizedUpdate
      return
    }

    Y.applyUpdate(ydocRef.current, normalizedUpdate, REMOTE_DOCUMENT_ORIGIN)
  }

  const replaceLocalDocument = (nextCode = '') => {
    if (!ydocRef.current || !ytextRef.current) {
      codeRef.current = nextCode
      setCode(nextCode)
      return
    }

    ydocRef.current.transact(() => {
      if (ytextRef.current.length) ytextRef.current.delete(0, ytextRef.current.length)
      if (nextCode) ytextRef.current.insert(0, nextCode)
    }, REMOTE_DOCUMENT_ORIGIN)
  }

  useEffect(() => {
    const ydoc = new Y.Doc()
    const ytext = ydoc.getText('code')

    ydocRef.current = ydoc
    ytextRef.current = ytext
    codeRef.current = ''
    setCode('')

    const syncCodeFromYText = () => {
      const nextCode = ytext.toString()
      codeRef.current = nextCode
      setCode(nextCode)
    }

    const emitLocalDocumentUpdate = (update, origin) => {
      if (origin === REMOTE_DOCUMENT_ORIGIN) return
      if (!socketRef.current?.connected) return

      socketRef.current.emit('document-update', {
        roomId,
        update: Array.from(update)
      })
    }

    ytext.observe(syncCodeFromYText)
    ydoc.on('update', emitLocalDocumentUpdate)
    bindMonacoToYText()

    if (pendingDocumentStateRef.current) {
      Y.applyUpdate(ydoc, pendingDocumentStateRef.current, REMOTE_DOCUMENT_ORIGIN)
      pendingDocumentStateRef.current = null
    }

    return () => {
      yBindingRef.current?.destroy()
      yBindingRef.current = null
      ytext.unobserve(syncCodeFromYText)
      ydoc.off('update', emitLocalDocumentUpdate)
      ydoc.destroy()
      ydocRef.current = null
      ytextRef.current = null
    }
  }, [roomId])

  useEffect(() => {
    if (!username || !roomId) {
      toast.error('Missing display name or session code.')
      navigate('/')
      return
    }

    let socket = null
    let isEffectActive = true
    const presenceDecorations = presenceDecorationsRef.current

    const handleConnect = () => {
      setIsConnected(true)
      socket.emit('join-room', { roomId, username, language: initialLanguage })
    }

    const handleDisconnect = () => {
      setIsConnected(false)
      setExecutionToken(null)
      toast.error('Disconnected from server.')
    }

    const handleRoomJoined = (data) => {
      const nextUsers = data.users || []
      const ownUserId = data.currentUserId || socket.id || null
      const nextPresence = createPresenceMap(data.presence || nextUsers)
      setUsers(nextUsers)
      setCurrentUserId(ownUserId)
      cursorsRef.current = nextPresence
      setCursors(nextPresence)
      syncPresenceSnapshot(nextPresence, nextUsers, ownUserId)
      if (data.documentState) applyRemoteDocumentUpdate(data.documentState)
      else replaceLocalDocument(data.code || '')
      setLanguage(data.language || 'javascript')
      setExecutionToken(data.executionToken || null)
      setIsJoining(false)
      toast.success(`Joined room ${roomId}.`)

      const currentUserData = data.users?.find((user) => user.id === (data.currentUserId || socket.id)) || data.users?.find((user) => user.username === username)
      const roleMessage = currentUserData?.role === 'owner' || currentUserData?.isHost ? 'the room owner' : 'a member'
      setChatMessages((previous) => [
        ...previous,
        {
          username: 'SYSTEM',
          message: `Welcome to room ${roomId}. You are ${roleMessage}.`,
          timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
          isSystem: true
        }
      ])
    }

    const handleRoomFull = (data) => {
      toast.error(data.message || 'Room is full.')
      setTimeout(() => navigate('/'), 2000)
    }

    const handleUsernameTaken = (data) => {
      toast.error(data.message || 'Display name is already taken.')
      setTimeout(() => navigate('/'), 2000)
    }

    const handleUserJoined = (data) => {
      const nextUsers = data.users || []
      setUsers(nextUsers)
      syncPresenceSnapshot(cursorsRef.current, nextUsers)
      toast.success(`${data.username} joined.`)
      setChatMessages((previous) => [
        ...previous,
        {
          username: 'SYSTEM',
          message: `${data.username} joined the room${data.isHost ? ' as owner' : ''}.`,
          timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
          isSystem: true
        }
      ])
    }

    const handleUserLeft = (data) => {
      setUsers(data.users || [])
      toast(`${data.username} left the room.`)
      const cursorKey = data.userId || data.username
      const nextPresence = { ...cursorsRef.current }
      delete nextPresence[cursorKey]
      if (data.username) delete nextPresence[data.username]
      cursorsRef.current = nextPresence
      setCursors(nextPresence)
      removePresenceDecoration(cursorKey)
      if (data.username) removePresenceDecoration(data.username)

      setChatMessages((previous) => [
        ...previous,
        {
          username: 'SYSTEM',
          message: `${data.username} left the room.`,
          timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
          isSystem: true
        }
      ])
    }

    const handleCodeUpdated = (data) => {
      if (data.documentUpdate) applyRemoteDocumentUpdate(data.documentUpdate)
      else replaceLocalDocument(data.code || '')
    }

    const handleLanguageUpdated = (data) => {
      setLanguage(data.language || 'javascript')
      if (data.documentUpdate) applyRemoteDocumentUpdate(data.documentUpdate)
      else if (data.code !== undefined) replaceLocalDocument(data.code)
      toast(`Language changed to ${data.language}.`)
    }

    const handleCursorUpdated = (data) => {
      const cursorKey = data.userId || data.username
      if (!cursorKey) return

      const nextPresence = {
        username: data.username,
        position: data.position,
        selection: data.selection,
        color: data.color,
        lastActiveAt: Date.now()
      }

      cursorsRef.current = {
        ...cursorsRef.current,
        [cursorKey]: nextPresence
      }
      setCursors(cursorsRef.current)
      upsertPresenceDecoration(cursorKey, nextPresence)
    }

    const handlePresenceRemoved = (data) => {
      const cursorKey = data.userId || data.username
      if (!cursorKey) return

      const nextPresence = { ...cursorsRef.current }
      delete nextPresence[cursorKey]
      if (data.username) delete nextPresence[data.username]
      cursorsRef.current = nextPresence
      setCursors(nextPresence)
      removePresenceDecoration(cursorKey)
      if (data.username) removePresenceDecoration(data.username)
    }

    const handleChatReceived = (data) => {
      setChatMessages((previous) => [
        ...previous,
        {
          username: data.username,
          message: data.message,
          timestamp: data.timestamp,
          isSystem: false
        }
      ])
    }

    const handleUserPaused = (data) => {
      setUsers(data.users || [])
      if (data.targetUsername === username) {
        setIsPaused(true)
        toast('You have been paused by the owner.')
      } else {
        toast(`${data.targetUsername} has been paused.`)
      }
    }

    const handleUserUnpaused = (data) => {
      setUsers(data.users || [])
      if (data.targetUsername === username) {
        setIsPaused(false)
        toast.success('You have been unpaused.')
      } else {
        toast(`${data.targetUsername} has been unpaused.`)
      }
    }

    const handleUserKicked = (data) => {
      setUsers(data.users || [])
      toast.error(`${data.targetUsername} was removed by ${data.kickedBy}.`)
      setChatMessages((previous) => [
        ...previous,
        {
          username: 'SYSTEM',
          message: `${data.targetUsername} was removed by ${data.kickedBy}.`,
          timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
          isSystem: true
        }
      ])
    }

    const handleKickedFromRoom = () => {
      setCurrentUserId(null)
      toast.error('You were removed from the room.')
      setTimeout(() => navigate('/'), 2000)
    }

    const handleOwnershipTransferred = (data) => {
      const nextUsers = data.users || []
      setUsers(nextUsers)
      syncPresenceSnapshot(cursorsRef.current, nextUsers)
      toast(data.newOwner === username ? 'You are now the room owner.' : `${data.newOwner} is now the room owner.`)
      setChatMessages((previous) => [
        ...previous,
        {
          username: 'SYSTEM',
          message: `Ownership transferred from ${data.previousOwner} to ${data.newOwner}.`,
          timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
          isSystem: true
        }
      ])
    }

    const handleNewOwner = (data) => {
      const nextUsers = data.users || []
      setUsers(nextUsers)
      syncPresenceSnapshot(cursorsRef.current, nextUsers)
      toast(`${data.newOwner} is now the room owner.`)
      setChatMessages((previous) => [
        ...previous,
        {
          username: 'SYSTEM',
          message: `${data.newOwner} is now the room owner.`,
          timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
          isSystem: true
        }
      ])
    }

    const handleActionBlocked = (data) => {
      toast.error(data.message || 'Action blocked.')
    }

    const handleProblemSelected = (data) => {
      setCurrentProblem(data.problem)
      setShowProblemPanel(true)
      if (data.solvedBy) setSolvedProblems(data.solvedBy)
      if (data.documentUpdate) applyRemoteDocumentUpdate(data.documentUpdate)
      else if (data.code !== undefined) replaceLocalDocument(data.code)
      toast(`Problem selected: ${data.problem.title}`)
      setChatMessages((previous) => [
        ...previous,
        {
          username: 'SYSTEM',
          message: `Problem selected: ${data.problem.title} (${data.problem.difficulty}).`,
          timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
          isSystem: true
        }
      ])
    }

    const handleProblemSolved = (data) => {
      setSolvedProblems(data.solvedProblems)
      toast.success(`${data.problemTitle} solved by ${data.solvedBy}.`)
      setChatMessages((previous) => [
        ...previous,
        {
          username: 'SYSTEM',
          message: `${data.problemTitle} solved by ${data.solvedBy}.`,
          timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
          isSystem: true
        }
      ])
    }

    const handleProblemReset = (data) => {
      if (data.documentUpdate) applyRemoteDocumentUpdate(data.documentUpdate)
      else if (data.code !== undefined) replaceLocalDocument(data.code)
      toast('Problem reset to boilerplate.')
    }

    const handleSubmissionResult = (data) => {
      if (data.success) toast.success(data.message)
      else toast.error(data.message)
    }

    const attachSocket = async () => {
      const accessToken = await getSupabaseAccessToken()
      if (!isEffectActive) return

      socket = socketService.connect(accessToken)
      socketRef.current = socket

      socket.on('connect', handleConnect)
      socket.on('disconnect', handleDisconnect)
      socket.on('room-joined', handleRoomJoined)
      socket.on('room-full', handleRoomFull)
      socket.on('username-taken', handleUsernameTaken)
      socket.on('user-joined', handleUserJoined)
      socket.on('user-left', handleUserLeft)
      socket.on('code-updated', handleCodeUpdated)
      socket.on('language-updated', handleLanguageUpdated)
      socket.on('document-update', handleDocumentUpdated)
      socket.on('cursor-updated', handleCursorUpdated)
      socket.on('presence-removed', handlePresenceRemoved)
      socket.on('chat-received', handleChatReceived)
      socket.on('user-paused', handleUserPaused)
      socket.on('user-unpaused', handleUserUnpaused)
      socket.on('user-kicked', handleUserKicked)
      socket.on('kicked-from-room', handleKickedFromRoom)
      socket.on('ownership-transferred', handleOwnershipTransferred)
      socket.on('new-owner', handleNewOwner)
      socket.on('action-blocked', handleActionBlocked)
      socket.on('problem-selected', handleProblemSelected)
      socket.on('problem-solved', handleProblemSolved)
      socket.on('problem-reset', handleProblemReset)
      socket.on('submission-result', handleSubmissionResult)

      if (socket.connected) handleConnect()
    }

    attachSocket()

    return () => {
      isEffectActive = false
      clearTimeout(cursorUpdateTimeoutRef.current)

      if (!socket) return

      if (socket.connected) socket.emit('leave-room', { roomId, username })

      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('room-joined', handleRoomJoined)
      socket.off('room-full', handleRoomFull)
      socket.off('username-taken', handleUsernameTaken)
      socket.off('user-joined', handleUserJoined)
      socket.off('user-left', handleUserLeft)
      socket.off('code-updated', handleCodeUpdated)
      socket.off('language-updated', handleLanguageUpdated)
      socket.off('document-update', handleDocumentUpdated)
      socket.off('cursor-updated', handleCursorUpdated)
      socket.off('presence-removed', handlePresenceRemoved)
      socket.off('chat-received', handleChatReceived)
      socket.off('user-paused', handleUserPaused)
      socket.off('user-unpaused', handleUserUnpaused)
      socket.off('user-kicked', handleUserKicked)
      socket.off('kicked-from-room', handleKickedFromRoom)
      socket.off('ownership-transferred', handleOwnershipTransferred)
      socket.off('new-owner', handleNewOwner)
      socket.off('action-blocked', handleActionBlocked)
      socket.off('problem-selected', handleProblemSelected)
      socket.off('problem-solved', handleProblemSolved)
      socket.off('problem-reset', handleProblemReset)
      socket.off('submission-result', handleSubmissionResult)

      presenceDecorations.forEach((_decorations, presenceKey) => removePresenceDecoration(presenceKey))
      document.querySelectorAll('style[data-remote-presence="true"]').forEach((styleEl) => styleEl.remove())

      socketService.disconnect()
    }
    // Socket subscriptions are intentionally scoped to the room session lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, username, initialLanguage, navigate])

  useEffect(() => {
    if (activeActivityTab === 'analysis') setHasUnreadAnalysis(false)
  }, [activeActivityTab])

  useEffect(() => {
    monacoRef.current?.editor.setTheme(theme === 'light' ? 'collab-light' : 'collab-dark')
  }, [theme])

  useEffect(() => {
    if (analysisResult && activeActivityTab !== 'analysis') setHasUnreadAnalysis(true)
  }, [analysisResult, activeActivityTab])

  useEffect(() => {
    localStorage.setItem(DENSITY_KEY, density)
  }, [density])

  useEffect(() => {
    if (code) {
      setIsSaving(true)
      const timer = setTimeout(() => {
        setIsSaving(false)
        setLastSaved(new Date())
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [code])

  const handleEditorPresenceChange = () => {
    if (!editorRef.current || !socketRef.current?.connected) return

    const presence = getEditorPresencePayload(editorRef.current)
    if (!presence?.position) return

    pendingCursorPresenceRef.current = presence
    const now = Date.now()
    const elapsed = now - lastCursorEmitAtRef.current

    const emitLatestPresence = () => {
      const latestPresence = pendingCursorPresenceRef.current
      if (!latestPresence || !socketRef.current?.connected) return

      pendingCursorPresenceRef.current = null
      lastCursorEmitAtRef.current = Date.now()
      socketRef.current.emit('cursor-move', {
        roomId,
        position: latestPresence.position,
        selection: latestPresence.selection
      })
    }

    clearTimeout(cursorUpdateTimeoutRef.current)
    if (elapsed >= CURSOR_EMIT_INTERVAL_MS) {
      emitLatestPresence()
    } else {
      cursorUpdateTimeoutRef.current = setTimeout(emitLatestPresence, CURSOR_EMIT_INTERVAL_MS - elapsed)
    }
  }

  const handleLanguageChange = (newLanguage) => {
    setLanguage(newLanguage)

    const boilerplate = currentProblem?.boilerplate?.[newLanguage]
      || currentProblem?.boilerplate?.javascript
      || getBoilerplate(newLanguage)

    if (socketRef.current?.connected) {
      socketRef.current.emit('language-change', { roomId, language: newLanguage, code: boilerplate })
    }
  }

  const handleRunCode = async () => {
    const latestCode = codeRef.current
    if (isRunning || !EXECUTABLE_LANGUAGES.includes(language)) return

    setActiveActivityTab('output')
    setIsRunning(true)
    setExecutionResult(null)

    if (!executionToken) {
      setExecutionResult({ error: 'Execution unavailable', details: 'Rejoin the room to refresh execution access.' })
      toast.error('Rejoin the room to run code.')
      setIsRunning(false)
      return
    }

    try {
      const accessToken = await getSupabaseAccessToken()
      const headers = { 'Content-Type': 'application/json' }
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`

      const response = await fetch(`${API_URL}/api/execute`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ roomId, executionToken, code: latestCode, language })
      })

      const data = await response.json()

      if (!response.ok) {
        const providerError = data.error && typeof data.error === 'object' ? data.error : null
        const tokenRejected = typeof data.code === 'string' && data.code.startsWith('EXECUTION_TOKEN_')
        if (tokenRejected) setExecutionToken(null)
        setExecutionResult({
          error: providerError?.message || data.message || data.error || 'Execution failed',
          details: providerError?.details || data.details || data.code || (providerError?.status ? `${providerError.provider || 'provider'} returned HTTP ${providerError.status}` : null)
        })
        toast.error(tokenRejected ? 'Rejoin the room to refresh compiler access.' : 'Execution failed.')
      } else {
        setExecutionResult(data)
        if (data.status?.id === 3) toast.success('Code executed successfully.')
        else toast(`Execution: ${data.status?.description || 'done'}`)
      }
    } catch (error) {
      setExecutionResult({ error: 'Network error', details: error.message })
      toast.error('Failed to reach server.')
    } finally {
      setIsRunning(false)
    }
  }

  const handleAnalyzeCode = async () => {
    const latestCode = codeRef.current
    if (isAnalyzing || !latestCode.trim()) return

    setActiveActivityTab('analysis')
    setHasUnreadAnalysis(false)
    setIsAnalyzing(true)
    setAnalysisResult(null)

    try {
      const compilerOutput = executionResult
        ? [executionResult.stdout, executionResult.stderr, executionResult.compile_output].filter(Boolean).join('\n')
        : null

      const accessToken = await getSupabaseAccessToken()
      if (!accessToken) {
        setAnalysisResult({ error: 'Sign up or sign in required for AI analysis.' })
        toast.error('Sign up or sign in to use AI analysis.')
        return
      }

      const response = await fetch(`${API_URL}/api/analyze`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code: latestCode, language, compilerOutput })
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        const providerError = data.error && typeof data.error === 'object' ? data.error : null
        const authMessage = response.status === 401 && data.code === 'AUTH_REQUIRED' ? 'Sign up or sign in required for AI analysis.' : null
        const message = authMessage || data.message || providerError?.message || data.error || 'Analysis failed'
        setAnalysisResult(`Error: ${message}`)
        toast.error(message)
      } else {
        setAnalysisResult(data)
        toast.success('Analysis complete.')
      }
    } catch (error) {
      setAnalysisResult(`Error: ${error.message}`)
      toast.error('Failed to reach server.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleDocumentUpdated = (data) => {
    applyRemoteDocumentUpdate(data.update)
  }

  const handleSendMessage = (message) => {
    if (socketRef.current?.connected && message.trim()) {
      socketRef.current.emit('chat-message', { roomId, username, message: message.trim() })
    }
  }

  const handleLeaveRoom = () => {
    if (socketRef.current?.connected) socketRef.current.emit('leave-room', { roomId, username })
    navigate('/')
  }

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco

    monaco.editor.defineTheme('collab-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '766f66', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'c0a8dd', fontStyle: 'bold' },
        { token: 'string', foreground: 'dfa88f' },
        { token: 'number', foreground: '9fbbe0' },
        { token: 'type', foreground: '9fc9a2' },
        { token: 'function', foreground: '9fbbe0' },
        { token: 'variable', foreground: 'f4f1ea' },
        { token: 'constant', foreground: 'd59b3d' }
      ],
      colors: {
        'editor.background': '#0f1117',
        'editor.foreground': '#f4f1ea',
        'editor.lineHighlightBackground': '#151922',
        'editorCursor.foreground': '#f54e00',
        'editor.selectionBackground': '#3a1c0f',
        'editorLineNumber.foreground': '#766f66',
        'editorLineNumber.activeForeground': '#f54e00',
        'editor.selectionHighlightBackground': '#2c2438',
        'editorIndentGuide.background': '#2a3040',
        'editorIndentGuide.activeBackground': '#3a4254',
        'editorBracketMatch.background': '#3a1c0f',
        'editorBracketMatch.border': '#f54e00',
        'editorGutter.background': '#0f1117',
        'minimap.background': '#0f1117',
        'scrollbarSlider.background': '#3a425480',
        'scrollbarSlider.hoverBackground': '#766f6680',
        'scrollbarSlider.activeBackground': '#b5afa580'
      }
    })

    monaco.editor.defineTheme('collab-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '807d72', fontStyle: 'italic' },
        { token: 'keyword', foreground: '7457b6', fontStyle: 'bold' },
        { token: 'string', foreground: '9a650e' },
        { token: 'number', foreground: '406fa9' },
        { token: 'type', foreground: '1f8a65' },
        { token: 'function', foreground: '406fa9' },
        { token: 'variable', foreground: '26251e' },
        { token: 'constant', foreground: '9a650e' }
      ],
      colors: {
        'editor.background': '#fafaf7',
        'editor.foreground': '#26251e',
        'editor.lineHighlightBackground': '#ffffff',
        'editorCursor.foreground': '#f54e00',
        'editor.selectionBackground': '#fff0e8',
        'editorLineNumber.foreground': '#807d72',
        'editorLineNumber.activeForeground': '#f54e00',
        'editor.selectionHighlightBackground': '#f0eaf8',
        'editorIndentGuide.background': '#e6e5e0',
        'editorIndentGuide.activeBackground': '#cfcdc4',
        'editorBracketMatch.background': '#fff0e8',
        'editorBracketMatch.border': '#f54e00',
        'editorGutter.background': '#fafaf7',
        'minimap.background': '#fafaf7',
        'scrollbarSlider.background': '#cfcdc480',
        'scrollbarSlider.hoverBackground': '#807d7280',
        'scrollbarSlider.activeBackground': '#5a585280'
      }
    })
    monaco.editor.setTheme(theme === 'light' ? 'collab-light' : 'collab-dark')
    bindMonacoToYText(editor)

    const syncCursorPosition = () => {
      const position = editor.getPosition()
      if (!position?.lineNumber || !position?.column) return

      setCursorPosition({ line: position.lineNumber, column: position.column })
      handleEditorPresenceChange()
    }

    editor.onDidChangeCursorPosition(syncCursorPosition)
    editor.onDidChangeCursorSelection(syncCursorPosition)
  }

  const updateEditorFontSize = useCallback((size) => {
    setEditorFontSize(size)
    editorRef.current?.updateOptions({ fontSize: size })
  }, [])

  const startPaneResize = useCallback((pane, event) => {
    event.preventDefault()

    const config = RAIL_SIZES[pane]
    const startX = event.clientX
    const startWidth = pane === 'session' ? sessionRailWidth : activityRailWidth

    document.body.classList.add('is-resizing-pane')

    const handlePointerMove = (moveEvent) => {
      const delta = moveEvent.clientX - startX
      const nextWidth = pane === 'session'
        ? clamp(startWidth + delta, config.min, config.max)
        : clamp(startWidth - delta, config.min, config.max)

      if (pane === 'session') {
        setSessionRailWidth(nextWidth)
      } else {
        setActivityRailWidth(nextWidth)
      }
    }

    const handlePointerUp = (upEvent) => {
      const delta = upEvent.clientX - startX
      const nextWidth = pane === 'session'
        ? clamp(startWidth + delta, config.min, config.max)
        : clamp(startWidth - delta, config.min, config.max)

      localStorage.setItem(config.key, String(nextWidth))
      document.body.classList.remove('is-resizing-pane')
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp, { once: true })
  }, [activityRailWidth, sessionRailWidth])

  const resetPaneWidth = useCallback((pane) => {
    const config = RAIL_SIZES[pane]

    if (pane === 'session') {
      setSessionRailWidth(config.defaultValue)
    } else {
      setActivityRailWidth(config.defaultValue)
    }

    localStorage.setItem(config.key, String(config.defaultValue))
    setTimeout(() => editorRef.current?.layout(), 0)
  }, [])

  const toggleFullscreen = () => {
    setIsFullscreen((value) => !value)
    setTimeout(() => editorRef.current?.layout(), 100)
  }

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(codeRef.current)
      toast.success('Code copied.')
    } catch {
      toast.error('Could not copy code.')
    }
  }

  const handleDownloadCode = () => {
    const extension = SUPPORTED_LANGUAGES.find((item) => item.value === language)?.extension || 'txt'
    const blob = new Blob([codeRef.current], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `code.${extension}`
    anchor.click()
    URL.revokeObjectURL(url)
    toast.success('Code downloaded.')
  }

  const copyText = async (value, message) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(message)
    } catch {
      toast.error('Could not copy.')
    }
  }

  const getCurrentMonacoLanguage = () => {
    return SUPPORTED_LANGUAGES.find((item) => item.value === language)?.monacoId || 'javascript'
  }

  const formatLastSaved = () => {
    if (!lastSaved) return 'Saved'
    const diff = Math.floor((new Date() - lastSaved) / 1000)
    if (diff < 60) return 'Saved'
    if (diff < 3600) return `Saved ${Math.floor(diff / 60)}m ago`
    return `Saved ${Math.floor(diff / 3600)}h ago`
  }

  const handlePauseUser = (targetUsername) => {
    socketRef.current?.emit('pause-user', { roomId, targetUsername })
  }

  const handleUnpauseUser = (targetUsername) => {
    socketRef.current?.emit('unpause-user', { roomId, targetUsername })
  }

  const handleKickUser = (targetUsername) => {
    socketRef.current?.emit('kick-user', { roomId, targetUsername })
  }

  const handleTransferOwnership = (targetUsername) => {
    socketRef.current?.emit('transfer-ownership', { roomId, targetUsername })
  }

  const handleSelectProblem = (problemId) => {
    socketRef.current?.emit('select-problem', { roomId, problemId })
  }

  const handleSelectRandomProblem = () => {
    socketRef.current?.emit('select-random-problem', { roomId })
  }

  const handleResetProblem = () => {
    socketRef.current?.emit('reset-problem', { roomId })
  }

  const handleMarkSolved = (problemId) => {
    socketRef.current?.emit('mark-solved', { roomId, problemId })
  }

  const handleSubmitSolution = () => {
    if (currentProblem) socketRef.current?.emit('submit-solution', { roomId, code: codeRef.current, language })
  }

  if (isJoining) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-retro-bg px-4">
        <div className="rounded-lg border border-retro-border bg-retro-surface p-8 text-center">
          <div className="mx-auto mb-5 h-10 w-10 rounded-full border-2 border-retro-cyan border-t-transparent animate-spin" />
          <div className="font-mono-ui text-sm font-semibold uppercase tracking-[0.08em] text-retro-cyan">Joining session {roomId}</div>
          <div className="mt-2 text-sm text-[var(--text-dim)]">Authenticating as {username}.</div>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={shellRef}
      data-density={density}
      className={`workspace-shell flex h-screen flex-col bg-retro-bg text-retro-text ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}
      style={{
        '--rail-session-w': `${sessionRailWidth}px`,
        '--rail-activity-w': `${activityRailWidth}px`
      }}
    >
      <TopBar
        roomId={roomId}
        isConnected={isConnected}
        language={language}
        currentLanguageLabel={currentLanguageLabel}
        onLanguageChange={handleLanguageChange}
        isSaving={isSaving}
        savedLabel={formatLastSaved()}
        cursorPosition={cursorPosition}
        lineCount={lineCount}
        users={users}
        username={currentUser?.username || username}
        currentUserId={currentUserId}
        onRun={handleRunCode}
        onAnalyze={handleAnalyzeCode}
        isRunning={isRunning}
        isAnalyzing={isAnalyzing}
        canRun={EXECUTABLE_LANGUAGES.includes(language)}
        canAnalyze={Boolean(code.trim())}
        onCopyRoom={() => copyText(roomId, 'Session code copied.')}
        onInvite={() => setShowInviteModal(true)}
        onLeave={handleLeaveRoom}
        onToggleSettings={() => setShowSettings((value) => !value)}
        onCopyCode={handleCopyCode}
        onDownloadCode={handleDownloadCode}
        onToggleShortcuts={() => setShowShortcuts((value) => !value)}
        onToggleFullscreen={toggleFullscreen}
        isFullscreen={isFullscreen}
      />

      {showShortcuts && <ShortcutsBar />}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {!isFullscreen && (
          <>
            <SessionRail
              users={users}
              username={currentUser?.username || username}
              currentUserId={currentUserId}
              roomId={roomId}
              isConnected={isConnected}
              isHost={isHost}
              chatMessages={chatMessages}
              onSendMessage={handleSendMessage}
              onPauseUser={handlePauseUser}
              onUnpauseUser={handleUnpauseUser}
              onKickUser={handleKickUser}
              onTransferOwnership={handleTransferOwnership}
              isCollapsed={isSidebarCollapsed}
              onToggleCollapse={() => setIsSidebarCollapsed((value) => !value)}
              onChatFullscreen={() => setChatFullscreen(true)}
            />
            {!isSidebarCollapsed && (
              <ResizeHandle
                side="session"
                label="Resize session rail"
                onPointerDown={(event) => startPaneResize('session', event)}
                onDoubleClick={() => resetPaneWidth('session')}
              />
            )}
          </>
        )}

        <main className="workspace-editor flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex h-11 items-center justify-between border-b border-retro-border bg-retro-surface px-3">
            <div className="flex h-full items-end">
              <button className="flex h-10 items-center gap-2 border-b-2 border-retro-cyan bg-[var(--surface-raised)] px-4 font-mono-ui text-xs font-semibold text-retro-text">
                <FileCode2 className="h-4 w-4 text-retro-cyan" />
                file.{SUPPORTED_LANGUAGES.find((item) => item.value === language)?.extension || 'js'}
                <span className="h-1.5 w-1.5 rounded-full bg-retro-cyan" />
              </button>
            </div>
            {currentProblem && (
              <button
                onClick={() => {
                  setShowProblemPanel((value) => !value)
                  setActiveActivityTab('problem')
                }}
                className="btn btn-ghost hidden md:inline-flex"
              >
                {currentProblem.title}
              </button>
            )}
          </div>

          <div className="relative flex min-h-0 flex-1 overflow-hidden bg-retro-bg">
            <PresenceRail cursors={cursors} username={username} users={users} cursorPosition={cursorPosition} lineCount={lineCount} />
            <div className="min-w-0 flex-1">
              {activeEditorUsers.length > 0 && (
                <div className="pointer-events-none absolute right-4 top-4 z-20 flex max-w-[min(70%,420px)] flex-wrap justify-end gap-2">
                  {activeEditorUsers.map((user) => {
                    const cursorData = cursors[user.id]
                    const lineLabel = cursorData?.position?.lineNumber ? `Line ${cursorData.position.lineNumber}` : 'In room'
                    const isOwner = isOwnerUser(user)
                    return (
                      <span
                        key={user.id || user.username}
                        className="inline-flex items-center gap-2 rounded border border-retro-border bg-retro-surface/95 px-2.5 py-1.5 font-mono-ui text-[10px] font-semibold text-retro-text shadow-[var(--shadow-pop)]"
                        style={isOwner ? { borderColor: user.color || 'var(--accent-2)' } : undefined}
                      >
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: user.color || 'var(--accent-2)' }} />
                        {isOwner && <Crown className="h-3 w-3 text-retro-accent" />}
                        <span className="max-w-28 truncate">{user.username}</span>
                        {isOwner && <span className="rounded bg-[var(--accent-2-dim)] px-1 py-0.5 text-retro-accent">Owner</span>}
                        <span className="text-[var(--text-dim)]">{lineLabel}</span>
                      </span>
                    )
                  })}
                </div>
              )}
              <Editor
                height="100%"
                language={getCurrentMonacoLanguage()}
                defaultValue=""
                onMount={handleEditorDidMount}
                theme={theme === 'light' ? 'collab-light' : 'collab-dark'}
                options={{
                  fontSize: editorFontSize,
                  fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
                  fontLigatures: true,
                  minimap: { enabled: window.innerWidth >= 1024, scale: 1 },
                  wordWrap: 'on',
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                  renderWhitespace: 'selection',
                  cursorBlinking: 'smooth',
                  cursorSmoothCaretAnimation: 'on',
                  smoothScrolling: true,
                  mouseWheelZoom: true,
                  padding: { top: 14, bottom: 14 },
                  lineHeight: editorLineHeight,
                  letterSpacing: 0,
                  cursorStyle: 'line',
                  cursorWidth: 2,
                  tabSize: 2,
                  insertSpaces: true,
                  detectIndentation: true,
                  formatOnPaste: true,
                  formatOnType: true,
                  folding: true,
                  showFoldingControls: 'mouseover',
                  lineNumbersMinChars: 3,
                  renderLineHighlight: 'all',
                  roundedSelection: true,
                  readOnly: isPaused,
                  quickSuggestions: true,
                  suggestOnTriggerCharacters: true
                }}
              />
            </div>

            {isPaused && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-retro-bg/80 backdrop-blur-sm">
                <div className="rounded-lg border border-[var(--danger)] bg-retro-surface px-8 py-5 text-center shadow-[var(--shadow-pop)]">
                  <div className="font-mono-ui text-sm font-semibold uppercase text-[var(--danger)]">You are paused</div>
                  <div className="mt-1 text-sm text-[var(--text-dim)]">The room owner has paused your editing.</div>
                </div>
              </div>
            )}
          </div>
        </main>

        {!isFullscreen && (
          <>
            <ResizeHandle
              side="activity"
              label="Resize activity rail"
              onPointerDown={(event) => startPaneResize('activity', event)}
              onDoubleClick={() => resetPaneWidth('activity')}
            />
            <ActivityRail
              activeTab={activeActivityTab}
              onTabChange={setActiveActivityTab}
              hasUnreadAnalysis={hasUnreadAnalysis}
              executionResult={executionResult}
              isRunning={isRunning}
              onClearOutput={() => setExecutionResult(null)}
              analysisResult={analysisResult}
              isAnalyzing={isAnalyzing}
              onClearAnalysis={() => setAnalysisResult(null)}
              currentProblem={showProblemPanel ? currentProblem : null}
              solvedProblems={solvedProblems}
              onSelectProblem={handleSelectProblem}
              onSelectRandom={handleSelectRandomProblem}
              onResetProblem={handleResetProblem}
              isOwner={isHost}
              onMarkSolved={handleMarkSolved}
              onSubmitSolution={handleSubmitSolution}
            />
          </>
        )}
      </div>

      {!isFullscreen && (
        <MobileTabs
          users={users}
          chatMessages={chatMessages}
          active={mobileBottomSheet}
          onOpen={setMobileBottomSheet}
          hasUnreadAnalysis={hasUnreadAnalysis}
        />
      )}

      {mobileBottomSheet && (
        <MobileSheet title={mobileBottomSheet} onClose={() => setMobileBottomSheet(null)}>
          {mobileBottomSheet === 'players' && (
            <UserList
              users={users}
              currentUser={currentUser?.username || username}
              currentUserId={currentUserId}
              isHost={isHost}
              onPauseUser={handlePauseUser}
              onUnpauseUser={handleUnpauseUser}
              onKickUser={handleKickUser}
              onTransferOwnership={handleTransferOwnership}
              compact
            />
          )}
          {mobileBottomSheet === 'chat' && (
            <ChatPanel messages={chatMessages} onSendMessage={handleSendMessage} currentUser={username} />
          )}
          {mobileBottomSheet === 'output' && (
            <OutputPanel result={executionResult} isRunning={isRunning} onClear={() => setExecutionResult(null)} />
          )}
          {mobileBottomSheet === 'analysis' && (
            <AnalysisPanel analysis={analysisResult} isAnalyzing={isAnalyzing} onClear={() => setAnalysisResult(null)} />
          )}
        </MobileSheet>
      )}

      {showSettings && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setShowSettings(false)} />
          <div className="absolute right-4 top-16 z-40 w-[min(92vw,320px)] rounded-lg border border-retro-border bg-retro-surface p-4 shadow-[var(--shadow-pop)] md:right-40 md:top-14">
            <div className="space-y-5">
              <div>
                <div className="ui-label mb-3">Density</div>
                <div className="grid grid-cols-2 gap-2">
                  {['comfortable', 'compact'].map((option) => (
                    <button
                      key={option}
                      onClick={() => setDensity(option)}
                      className={`btn btn-ghost capitalize ${density === option ? 'border-retro-cyan bg-[var(--accent-dim)] text-retro-cyan' : ''}`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="ui-label mb-3">Font size</div>
                <div className="flex items-center gap-3">
                  <button onClick={() => updateEditorFontSize(Math.max(10, editorFontSize - 1))} className="icon-button">-</button>
                  <span className="w-14 text-center font-mono-ui text-sm text-retro-cyan">{editorFontSize}px</span>
                  <button onClick={() => updateEditorFontSize(Math.min(24, editorFontSize + 1))} className="icon-button">+</button>
                </div>
              </div>

              <div>
                <div className="ui-label mb-3">Pane widths</div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => resetPaneWidth('session')} className="btn btn-ghost">Session</button>
                  <button onClick={() => resetPaneWidth('activity')} className="btn btn-ghost">Activity</button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {showInviteModal && (
        <InviteModal
          roomId={roomId}
          onClose={() => setShowInviteModal(false)}
          onCopyCode={() => copyText(roomId, 'Session code copied.')}
          onCopyLink={() => copyText(window.location.href, 'Invite link copied.')}
        />
      )}

      {chatFullscreen && (
        <div className="fixed inset-0 z-50 bg-retro-bg/90 backdrop-blur-sm">
          <ChatPanel
            messages={chatMessages}
            onSendMessage={handleSendMessage}
            currentUser={username}
            onFullscreen={() => setChatFullscreen(false)}
            isFullscreen
          />
        </div>
      )}
    </div>
  )
}

function TopBar({
  roomId,
  isConnected,
  language,
  currentLanguageLabel,
  onLanguageChange,
  isSaving,
  savedLabel,
  cursorPosition,
  lineCount,
  users,
  username,
  currentUserId,
  onRun,
  onAnalyze,
  isRunning,
  isAnalyzing,
  canRun,
  canAnalyze,
  onCopyRoom,
  onInvite,
  onLeave,
  onToggleSettings,
  onCopyCode,
  onDownloadCode,
  onToggleShortcuts,
  onToggleFullscreen,
  isFullscreen
}) {
  const currentUser = users.find((user) => user.id === currentUserId) || users.find((user) => user.username === username)

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-retro-border bg-retro-surface px-3 py-2 lg:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <button onClick={onCopyRoom} className="btn btn-ghost hidden sm:inline-flex" title="Copy session code">
          <Copy className="h-4 w-4" />
          <span className="font-mono-ui">{roomId}</span>
        </button>
        <div className={`app-chip gap-2 px-2.5 py-1.5 ${isConnected ? 'text-retro-cyan' : 'text-[var(--danger)]'}`}>
          {isConnected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {isConnected ? 'Connected' : 'Disconnected'}
        </div>
        <div className="hidden md:block">
          <LanguageSelector currentLanguage={language} onLanguageChange={onLanguageChange} languages={SUPPORTED_LANGUAGES} compact />
        </div>
        <div className="hidden items-center gap-2 text-xs text-[var(--text-dim)] lg:flex">
          {isSaving ? <Save className="h-4 w-4 text-[var(--warn)]" /> : <Check className="h-4 w-4 text-retro-cyan" />}
          {isSaving ? 'Saving...' : savedLabel}
        </div>
      </div>

      <div className="hidden items-center gap-3 text-xs text-[var(--text-dim)] xl:flex">
        <span className="font-mono-ui">{currentLanguageLabel}</span>
        <span>Ln {cursorPosition.line}, Col {cursorPosition.column}</span>
        <span>{lineCount} lines</span>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={onInvite} className="icon-button hidden md:inline-flex" title="Invite">
          <Share2 className="h-4 w-4" />
        </button>
        <button onClick={onToggleSettings} className="icon-button hidden md:inline-flex" title="Settings">
          <Settings className="h-4 w-4" />
        </button>
        <button onClick={onCopyCode} className="icon-button hidden lg:inline-flex" title="Copy code">
          <Copy className="h-4 w-4" />
        </button>
        <button onClick={onDownloadCode} className="icon-button hidden lg:inline-flex" title="Download code">
          <Download className="h-4 w-4" />
        </button>
        <button onClick={onToggleShortcuts} className="icon-button hidden lg:inline-flex" title="Keyboard shortcuts">
          <Keyboard className="h-4 w-4" />
        </button>
        <button onClick={onToggleFullscreen} className="icon-button hidden md:inline-flex" title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
        <button onClick={onRun} disabled={isRunning || !canRun} className="btn btn-primary">
          <Play className="h-4 w-4" />
          <span className="hidden sm:inline">{isRunning ? 'Running...' : 'Run'}</span>
        </button>
        <button onClick={onAnalyze} disabled={isAnalyzing || !canAnalyze} className="btn btn-ai">
          <Bot className="h-4 w-4" />
          <span className="hidden sm:inline">{isAnalyzing ? 'Analyzing...' : 'Analyze'}</span>
        </button>
        <div className="hidden items-center gap-2 border-l border-retro-border pl-3 md:flex">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-[var(--surface-raised)] font-mono-ui text-xs font-semibold text-retro-cyan">
            {(username || 'U').slice(0, 2).toUpperCase()}
          </div>
          <span className="max-w-24 truncate text-sm text-[var(--text-dim)]">{currentUser?.username || username}</span>
        </div>
        <button onClick={onLeave} className="btn btn-danger hidden sm:inline-flex">
          Leave
        </button>
      </div>
    </header>
  )
}

function ResizeHandle({ side, label, onPointerDown, onDoubleClick }) {
  return (
    <button
      type="button"
      className={`pane-resize-handle pane-resize-handle--${side}`}
      aria-label={label}
      aria-orientation="vertical"
      role="separator"
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      title={`${label}. Double-click to reset.`}
    />
  )
}

function SessionRail({
  users,
  username,
  currentUserId,
  roomId,
  isConnected,
  isHost,
  chatMessages,
  onSendMessage,
  onPauseUser,
  onUnpauseUser,
  onKickUser,
  onTransferOwnership,
  isCollapsed,
  onToggleCollapse,
  onChatFullscreen
}) {
  return (
    <aside className={`session-rail hidden shrink-0 border-r border-retro-border bg-retro-surface transition-all lg:flex ${isCollapsed ? 'w-16' : ''} flex-col`}>
      <div className="flex items-center justify-between border-b border-retro-border px-3 py-3">
        {!isCollapsed && (
          <div className="min-w-0">
            <div className="font-mono-ui text-sm font-semibold text-retro-text">Session {roomId}</div>
            <div className={`mt-1 flex items-center gap-2 text-xs ${isConnected ? 'text-retro-cyan' : 'text-[var(--danger)]'}`}>
              <span className="h-2 w-2 rounded-full bg-current" />
              {isConnected ? 'Connected' : 'Offline'} · {users.length}/4
            </div>
          </div>
        )}
        <button onClick={onToggleCollapse} className="icon-button" title={isCollapsed ? 'Expand session rail' : 'Collapse session rail'}>
          {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {isCollapsed ? (
        <div className="flex flex-col items-center gap-3 p-3">
          {users.map((user) => (
            <div
              key={user.id || user.username}
              className="flex h-9 w-9 items-center justify-center rounded border border-retro-border bg-[var(--surface-raised)] font-mono-ui text-[11px] font-semibold"
              style={{ color: user.color || 'var(--accent)' }}
              title={user.username}
            >
              {user.username.slice(0, 2).toUpperCase()}
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="max-h-[42vh] overflow-y-auto border-b border-retro-border p-[var(--panel-padding)] custom-scrollbar">
            <UserList
              users={users}
              currentUser={username}
              currentUserId={currentUserId}
              isHost={isHost}
              onPauseUser={onPauseUser}
              onUnpauseUser={onUnpauseUser}
              onKickUser={onKickUser}
              onTransferOwnership={onTransferOwnership}
            />
          </div>
          <div className="min-h-0 flex-1">
            <ChatPanel messages={chatMessages} onSendMessage={onSendMessage} currentUser={username} onFullscreen={onChatFullscreen} />
          </div>
        </>
      )}
    </aside>
  )
}

function PresenceRail({ cursors, username, users, cursorPosition, lineCount }) {
  const remoteTicks = Object.entries(cursors)
    .filter(([, cursorData]) => cursorData?.username !== username && cursorData?.position?.lineNumber)
    .map(([userId, cursorData]) => ({
      user: cursorData.username || users.find((item) => item.id === userId)?.username || 'Collaborator',
      line: cursorData.position.lineNumber,
      color: cursorData.color || users.find((item) => item.id === userId)?.color || 'var(--accent-2)'
    }))

  const ownColor = users.find((user) => user.username === username)?.color || 'var(--accent)'
  const ticks = [{ user: username || 'You', line: cursorPosition.line, color: ownColor }, ...remoteTicks]

  return (
    <div className="relative hidden w-4 shrink-0 border-r border-retro-border bg-retro-bg md:block" aria-hidden="true">
      {ticks.map((tick, index) => {
        const top = `${Math.min(96, Math.max(2, ((tick.line - 0.5) / lineCount) * 100))}%`
        return (
          <div
            key={`${tick.user}-${index}`}
            className="group absolute left-1 h-3 w-2 rounded-sm transition-all duration-150"
            style={{ top, backgroundColor: tick.color, transform: `translateY(-50%) translateX(${index % 3}px)` }}
          >
            <span className="pointer-events-none absolute left-3 top-1/2 z-20 hidden -translate-y-1/2 whitespace-nowrap rounded bg-[var(--surface-raised)] px-2 py-1 font-mono-ui text-[10px] text-retro-text shadow-[var(--shadow-pop)] group-hover:block">
              {tick.user} · line {tick.line}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function ActivityRail({
  activeTab,
  onTabChange,
  hasUnreadAnalysis,
  executionResult,
  isRunning,
  onClearOutput,
  analysisResult,
  isAnalyzing,
  onClearAnalysis,
  currentProblem,
  solvedProblems,
  onSelectProblem,
  onSelectRandom,
  onResetProblem,
  isOwner,
  onMarkSolved,
  onSubmitSolution
}) {
  const tabs = [
    { id: 'output', label: 'Output', icon: Terminal, dot: false },
    { id: 'analysis', label: 'AI Analysis', icon: Bot, dot: hasUnreadAnalysis }
  ]

  if (currentProblem) tabs.push({ id: 'problem', label: 'Problem', icon: FileCode2, dot: false })

  return (
    <aside className="activity-rail hidden shrink-0 flex-col border-l border-retro-border bg-retro-surface lg:flex">
      <div className="flex border-b border-retro-border px-3 pt-3">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex items-center gap-2 border-b-2 px-3 pb-3 font-mono-ui text-xs font-semibold ${
                isActive
                  ? tab.id === 'analysis'
                    ? 'border-retro-accent text-retro-text'
                    : 'border-retro-cyan text-retro-text'
                  : 'border-transparent text-[var(--text-dim)] hover:text-retro-text'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {tab.dot && <span className="h-1.5 w-1.5 rounded-full bg-retro-accent" />}
            </button>
          )
        })}
      </div>

      <div className="min-h-0 flex-1">
        {activeTab === 'output' && <OutputPanel result={executionResult} isRunning={isRunning} onClear={onClearOutput} />}
        {activeTab === 'analysis' && <AnalysisPanel analysis={analysisResult} isAnalyzing={isAnalyzing} onClear={onClearAnalysis} />}
        {activeTab === 'problem' && currentProblem && (
          <ProblemPanel
            problem={currentProblem}
            solvedProblems={solvedProblems}
            onSelectProblem={onSelectProblem}
            onSelectRandom={onSelectRandom}
            onResetProblem={onResetProblem}
            isOwner={isOwner}
            onMarkSolved={onMarkSolved}
            onSubmitSolution={onSubmitSolution}
          />
        )}
      </div>
    </aside>
  )
}

function ShortcutsBar() {
  return (
    <div className="border-b border-retro-border bg-retro-surface px-4 py-2">
      <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-[var(--text-dim)]">
        <span className="ui-label">Shortcuts</span>
        <kbd>Ctrl+S</kbd>
        <kbd>Ctrl+Z</kbd>
        <kbd>Ctrl+/</kbd>
        <kbd>Ctrl+D</kbd>
        <kbd>F11</kbd>
      </div>
    </div>
  )
}

function MobileTabs({ users, chatMessages, onOpen, hasUnreadAnalysis }) {
  const items = [
    { id: 'players', label: 'Players', count: users.length, icon: Users },
    { id: 'chat', label: 'Chat', count: chatMessages.length, icon: Share2 },
    { id: 'output', label: 'Output', icon: Terminal },
    { id: 'analysis', label: 'AI', icon: Bot, dot: hasUnreadAnalysis }
  ]

  return (
    <nav className="flex items-center justify-around border-t border-retro-border bg-retro-surface py-2 lg:hidden safe-area-bottom">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <button key={item.id} onClick={() => onOpen(item.id)} className="relative flex min-w-16 flex-col items-center gap-1 rounded px-3 py-1.5 text-[var(--text-dim)] hover:bg-[var(--surface-hover)] hover:text-retro-text">
            <Icon className="h-5 w-5" />
            <span className="font-mono-ui text-[10px]">{item.label}</span>
            {typeof item.count === 'number' && <span className="font-mono-ui text-[9px]">{item.count}</span>}
            {item.dot && <span className="absolute right-3 top-2 h-1.5 w-1.5 rounded-full bg-retro-accent" />}
          </button>
        )
      })}
    </nav>
  )
}

function MobileSheet({ title, onClose, children }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-[var(--overlay)] lg:hidden" onClick={onClose} />
      <section className="fixed bottom-0 left-0 right-0 z-50 flex h-[68vh] flex-col rounded-t-lg border-t border-retro-border bg-retro-surface shadow-[var(--shadow-pop)] lg:hidden">
        <div className="flex items-center justify-between border-b border-retro-border px-4 py-3">
          <h2 className="ui-label text-retro-text">{title}</h2>
          <button onClick={onClose} className="icon-button">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
      </section>
    </>
  )
}

function InviteModal({ roomId, onClose, onCopyCode, onCopyLink }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-[var(--overlay)] backdrop-blur-sm" onClick={onClose} />
      <section className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,460px)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-retro-border bg-retro-surface p-5 shadow-[var(--shadow-pop)]">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Invite collaborators</h2>
            <p className="mt-1 text-sm text-[var(--text-dim)]">Share the session code or direct room link.</p>
          </div>
          <button onClick={onClose} className="icon-button">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <button onClick={onCopyCode} className="flex w-full items-center justify-between rounded border border-retro-border bg-[var(--surface-raised)] p-4 text-left">
            <div>
              <div className="ui-label">Session code</div>
              <div className="mt-1 font-mono-ui text-2xl font-semibold tracking-[0.16em] text-retro-cyan">{roomId}</div>
            </div>
            <Copy className="h-5 w-5 text-[var(--text-dim)]" />
          </button>

          <button onClick={onCopyLink} className="flex w-full items-center justify-between rounded border border-retro-border bg-[var(--surface-raised)] p-4 text-left">
            <div>
              <div className="ui-label">Direct link</div>
              <div className="mt-1 max-w-[320px] truncate text-sm text-[var(--text-dim)]">{window.location.href}</div>
            </div>
            <Link className="h-5 w-5 text-[var(--text-dim)]" />
          </button>
        </div>
      </section>
    </>
  )
}

export default EditorPage
