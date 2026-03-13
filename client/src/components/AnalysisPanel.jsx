import { useState } from 'react'

function AnalysisPanel({ analysis, isAnalyzing, onClear }) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <div className="bg-retro-surface border-t-2 border-retro-border flex flex-col" style={{ minHeight: isCollapsed ? 'auto' : '140px', maxHeight: '350px' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-retro-border bg-retro-panel">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-retro-text opacity-60 hover:opacity-100 transition-opacity text-[10px] tracking-wider uppercase font-bold"
          >
            {isCollapsed ? '▶' : '▼'} AI ANALYSIS
          </button>
          {isAnalyzing && (
            <>
              <span className="text-amber-400 text-[9px] tracking-wider uppercase font-bold">ANALYZING...</span>
              <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
            </>
          )}
          {!isAnalyzing && analysis && (
            <span className="text-violet-400 text-[9px] tracking-wider uppercase font-bold">COMPLETE</span>
          )}
        </div>
        <button
          onClick={onClear}
          className="pixel-button pixel-button--small text-[8px] opacity-70 hover:opacity-100"
          disabled={isAnalyzing}
        >
          CLEAR
        </button>
      </div>

      {/* Body */}
      {!isCollapsed && (
        <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed" style={{ fontFamily: '"JetBrains Mono", "Fira Code", "Courier New", monospace', fontSize: '11px' }}>
          {isAnalyzing && (
            <div className="text-retro-text opacity-50 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse"></div>
              Gemini is analyzing your code...
            </div>
          )}

          {!isAnalyzing && !analysis && (
            <div className="text-retro-text opacity-30 text-[10px] tracking-wider uppercase">
              Click 🔍 ANALYZE to get AI-powered feedback on your code.
            </div>
          )}

          {!isAnalyzing && analysis && (
            <div className="text-retro-text prose-sm">
              {/* Render markdown-like analysis */}
              {analysis.split('\n').map((line, i) => {
                // Headers
                if (line.startsWith('## ')) {
                  return (
                    <h3 key={i} className="text-violet-600 dark:text-violet-400 text-[11px] font-bold uppercase tracking-wider mt-4 mb-2 border-b border-retro-border/30 pb-1">
                      {line.replace('## ', '')}
                    </h3>
                  )
                }
                if (line.startsWith('### ')) {
                  return (
                    <h4 key={i} className="text-blue-600 dark:text-retro-cyan text-[10px] font-bold uppercase tracking-wider mt-3 mb-1">
                      {line.replace('### ', '')}
                    </h4>
                  )
                }
                // Code blocks
                if (line.startsWith('```')) {
                  return null // Skip code fence markers
                }
                // Bullet points
                if (line.startsWith('- ') || line.startsWith('* ')) {
                  return (
                    <div key={i} className="text-retro-text pl-3 py-0.5 flex gap-2">
                      <span className="text-retro-cyan opacity-60">•</span>
                      <span>{line.replace(/^[-*] /, '')}</span>
                    </div>
                  )
                }
                // Empty lines
                if (line.trim() === '') {
                  return <div key={i} className="h-2"></div>
                }
                // Regular text
                return (
                  <div key={i} className="text-retro-text py-0.5 opacity-90">
                    {line}
                  </div>
                )
              })}
            </div>
          )}

          {/* Error display */}
          {!isAnalyzing && analysis && typeof analysis === 'object' && analysis.error && (
            <div className="text-red-400 bg-red-950/20 rounded p-3 border border-red-900/30">
              {analysis.error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default AnalysisPanel
