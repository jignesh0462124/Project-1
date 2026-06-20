import { useEffect, useRef, useState } from 'react'
import { Maximize2, Minimize2, Send } from 'lucide-react'

function ChatPanel({ messages, onSendMessage, currentUser, onFullscreen, isFullscreen = false }) {
  const [newMessage, setNewMessage] = useState('')
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (isFullscreen) inputRef.current?.focus()
  }, [isFullscreen])

  const handleSendMessage = (event) => {
    event.preventDefault()
    if (!newMessage.trim()) return
    onSendMessage(newMessage.trim())
    setNewMessage('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const formatTime = (timestamp) => {
    if (!timestamp) return ''
    const [hours, minutes] = timestamp.split(':')
    return `${hours}:${minutes}`
  }

  const counterVisible = newMessage.length >= 180

  return (
    <div className={`flex h-full min-h-0 flex-col bg-retro-surface ${isFullscreen ? 'fixed inset-4 z-50 rounded-lg border border-retro-border shadow-[var(--shadow-pop)]' : ''}`}>
      <div className="flex items-center justify-between border-b border-retro-border px-4 py-3">
        <div>
          <h3 className="ui-label text-retro-text">Chat</h3>
          <p className="mt-1 text-xs text-[var(--text-dim)]">{messages.length} room messages</p>
        </div>
        {onFullscreen && (
          <button onClick={onFullscreen} className="icon-button" title={isFullscreen ? 'Exit fullscreen chat' : 'Fullscreen chat'}>
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        )}
      </div>

      <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center text-sm text-[var(--text-dim)]">No messages yet.</div>
        ) : (
          messages.map((message, index) => {
            const isSystem = message.isSystem
            const isOwn = message.username === currentUser

            if (isSystem) {
              return (
                <div key={`${message.timestamp}-${index}`} className="text-xs leading-5 text-[var(--muted)]">
                  {message.message}
                </div>
              )
            }

            return (
              <div key={`${message.timestamp}-${index}`} className="group">
                <div className="mb-1 flex items-baseline gap-2">
                  <span className={`font-mono-ui text-[11px] font-semibold ${isOwn ? 'text-retro-cyan' : 'text-retro-accent'}`}>
                    {message.username}
                  </span>
                  <span className="text-[11px] text-[var(--muted)]">{formatTime(message.timestamp)}</span>
                </div>
                <div className="rounded border border-retro-border bg-[var(--surface-raised)] px-3 py-2">
                  <p className="text-sm leading-6 text-retro-text">{message.message}</p>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="border-t border-retro-border p-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(event) => setNewMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) handleSendMessage(event)
              }}
              placeholder="Type a message..."
              maxLength={200}
              className="pixel-input pr-14"
            />
            {counterVisible && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono-ui text-[10px] text-[var(--muted)]">
                {newMessage.length}/200
              </span>
            )}
          </div>
          <button type="submit" disabled={!newMessage.trim()} className="btn btn-primary px-3" title="Send message">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  )
}

export default ChatPanel
