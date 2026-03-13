import { useState, useRef, useEffect } from 'react'
import { Send, MessageSquare } from 'lucide-react'

function ChatPanel({ messages, onSendMessage, currentUser }) {
  const [newMessage, setNewMessage] = useState('')
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendMessage = (e) => {
    e.preventDefault()
    
    if (!newMessage.trim()) return
    
    onSendMessage(newMessage.trim())
    setNewMessage('')
    
    // Focus back to input
    setTimeout(() => {
      inputRef.current?.focus()
    }, 0)
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage(e)
    }
  }

  const getMessageColor = (username) => {
    if (username === 'SYSTEM') return 'text-amber-400'
    if (username === currentUser) return 'text-retro-cyan'
    return 'text-retro-text'
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Chat Header */}
      <div className="p-4 border-b border-retro-border/30 bg-retro-surface/50">
        <h3 className="text-retro-text text-[10px] uppercase flex items-center gap-2 opacity-70 tracking-widest pl-1">
          <MessageSquare className="w-3.5 h-3.5" />
          TERMINAL <span className="opacity-50">({messages.length})</span>
        </h3>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full opacity-40">
            <MessageSquare className="w-6 h-6 mb-3 opacity-50" />
            <div className="text-retro-text text-[9px] text-center uppercase tracking-widest leading-relaxed">
              SYSTEM INITIALIZED.<br />
              WAITING FOR INPUT...
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={`${message.timestamp}-${index}`}
              className={`
                text-[11px] break-words
                ${message.isSystem 
                  ? 'flex justify-center opacity-70 my-2' 
                  : ''
                }
              `}
            >
              {message.isSystem ? (
                <div className="text-[9px] uppercase tracking-wider bg-retro-surface px-3 py-1 rounded-full border border-retro-border/20">
                  {message.message}
                </div>
              ) : (
                <>
                  {/* Message Header */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold tracking-wide ${getMessageColor(message.username)}`}>
                      {message.username}
                      {message.username === currentUser && <span className="opacity-50 font-normal"> (YOU)</span>}
                    </span>
                    <span className="text-retro-text opacity-40 text-[8px] tracking-wider">
                      {message.timestamp}
                    </span>
                  </div>
                  
                  {/* Message Content */}
                  <div className="text-retro-text opacity-90 leading-relaxed bg-retro-surface/30 px-3 py-2 rounded-lg rounded-tl-sm border border-retro-border/10">
                    {message.message}
                  </div>
                </>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <form onSubmit={handleSendMessage} className="p-4 border-t border-retro-border/30 bg-retro-surface/30">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="ENTER COMMAND..."
            maxLength={200}
            className="flex-1 pixel-input text-[10px]"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="pixel-button pixel-button--small flex items-center justify-center w-10 hover:bg-retro-cyan hover:border-retro-cyan hover:text-white transition-all disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
        
        {/* Character count */}
        <div className="text-retro-text text-[8px] opacity-40 mt-2 tracking-widest text-right">
          {newMessage.length}/200
        </div>
      </form>
    </div>
  )
}

export default ChatPanel