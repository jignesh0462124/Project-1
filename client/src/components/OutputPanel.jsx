import { useState } from 'react'

function OutputPanel({ result, isRunning, onClear }) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  const getStatusColor = () => {
    if (!result?.status) return 'text-retro-text opacity-60'
    const id = result.status.id
    if (id === 3) return 'text-emerald-400'    // Accepted
    if (id === 6) return 'text-red-400'         // Compilation Error
    if (id === 5) return 'text-amber-400'       // Time Limit Exceeded
    if (id >= 7 && id <= 12) return 'text-red-400' // Runtime errors
    return 'text-amber-400'
  }

  const getStatusLabel = () => {
    if (isRunning) return '⏳ RUNNING...'
    if (!result) return 'READY'
    if (result.status) return result.status.description?.toUpperCase() || 'DONE'
    return 'DONE'
  }

  const hasOutput = result && (result.stdout || result.stderr || result.compile_output)

  return (
    <div className="bg-retro-surface border-t-2 border-retro-border flex flex-col" style={{ minHeight: isCollapsed ? 'auto' : '160px', maxHeight: '300px' }}>
      {/* Console Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-retro-border bg-retro-panel">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-retro-text opacity-60 hover:opacity-100 transition-opacity text-[10px] tracking-wider uppercase font-bold"
          >
            {isCollapsed ? '▶' : '▼'} OUTPUT
          </button>
          <span className={`text-[9px] tracking-wider uppercase font-bold ${getStatusColor()}`}>
            {getStatusLabel()}
          </span>
          {isRunning && (
            <div className="w-3 h-3 border-2 border-retro-cyan border-t-transparent rounded-full animate-spin"></div>
          )}
        </div>
        <button
          onClick={onClear}
          className="pixel-button pixel-button--small text-[8px] opacity-70 hover:opacity-100"
          disabled={isRunning}
        >
          CLEAR
        </button>
      </div>

      {/* Console Body */}
      {!isCollapsed && (
        <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed" style={{ fontFamily: '"JetBrains Mono", "Fira Code", "Courier New", monospace', fontSize: '12px' }}>
          {isRunning && (
            <div className="text-retro-text opacity-50 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></div>
              Executing code on remote server...
            </div>
          )}

          {!isRunning && !hasOutput && !result && (
            <div className="text-retro-text opacity-30 text-[10px] tracking-wider uppercase">
              Click ▶ RUN to execute your code. Output will appear here.
            </div>
          )}

          {!isRunning && result && !hasOutput && (
            <div className="text-retro-text opacity-50 text-[10px] tracking-wider uppercase">
              Program finished with no output.
            </div>
          )}

          {/* Standard Output */}
          {result?.stdout && (
            <div className="mb-3">
              <div className="text-emerald-400 text-[9px] tracking-widest uppercase font-bold mb-1 opacity-80">STDOUT</div>
              <pre className="text-retro-text whitespace-pre-wrap break-words bg-retro-bg rounded p-3 border border-retro-border">
                {result.stdout}
              </pre>
            </div>
          )}

          {/* Standard Error */}
          {result?.stderr && (
            <div className="mb-3">
              <div className="text-red-400 text-[9px] tracking-widest uppercase font-bold mb-1 opacity-80">STDERR</div>
              <pre className="text-red-300 whitespace-pre-wrap break-words bg-red-950/20 rounded p-3 border border-red-900/30">
                {result.stderr}
              </pre>
            </div>
          )}

          {/* Compilation Output */}
          {result?.compile_output && (
            <div className="mb-3">
              <div className="text-amber-400 text-[9px] tracking-widest uppercase font-bold mb-1 opacity-80">COMPILE OUTPUT</div>
              <pre className="text-amber-300 whitespace-pre-wrap break-words bg-amber-950/20 rounded p-3 border border-amber-900/30">
                {result.compile_output}
              </pre>
            </div>
          )}

          {/* Error from server */}
          {result?.error && (
            <div className="mb-3">
              <div className="text-red-400 text-[9px] tracking-widest uppercase font-bold mb-1 opacity-80">ERROR</div>
              <pre className="text-red-300 whitespace-pre-wrap break-words bg-red-950/20 rounded p-3 border border-red-900/30">
                {result.error}
                {result.details ? `\n${typeof result.details === 'string' ? result.details : JSON.stringify(result.details, null, 2)}` : ''}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default OutputPanel
