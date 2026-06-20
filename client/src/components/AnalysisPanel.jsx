function AnalysisPanel({ analysis, isAnalyzing, onClear }) {
  const normalizedAnalysis = typeof analysis === 'string' ? analysis : analysis?.error || ''

  return (
    <div className="flex h-full min-h-0 flex-col bg-retro-surface">
      <div className="flex items-center justify-between border-b border-retro-border px-4 py-3">
        <div>
          <h3 className="ui-label text-retro-text">AI Analysis</h3>
          <div className="mt-1 font-mono-ui text-xs font-semibold text-retro-accent">
            {isAnalyzing ? 'Analyzing...' : analysis ? 'Complete' : 'Idle'}
          </div>
        </div>
        <button onClick={onClear} className="btn btn-ghost" disabled={isAnalyzing}>
          Clear
        </button>
      </div>

      <div className="custom-scrollbar flex-1 overflow-auto p-4">
        {isAnalyzing && (
          <div className="flex items-center gap-2 text-sm text-[var(--text-dim)]">
            <span className="h-2 w-2 rounded-full bg-retro-accent typing-dot" />
            Reviewing the current file and latest compiler output...
          </div>
        )}

        {!isAnalyzing && !analysis && (
          <div className="text-sm text-[var(--text-dim)]">Run Analyze to get feedback on the current file.</div>
        )}

        {!isAnalyzing && normalizedAnalysis && (
          <div className="space-y-1 text-sm leading-6 text-retro-text">
            {normalizedAnalysis.split('\n').map((line, index) => {
              if (line.startsWith('## ')) {
                return (
                  <h4 key={index} className="ui-label mt-5 border-b border-retro-border pb-2 text-retro-accent first:mt-0">
                    {line.replace('## ', '')}
                  </h4>
                )
              }

              if (line.startsWith('### ')) {
                return (
                  <h5 key={index} className="ui-label mt-4 text-retro-cyan">
                    {line.replace('### ', '')}
                  </h5>
                )
              }

              if (line.startsWith('```')) return null

              if (line.startsWith('- ') || line.startsWith('* ')) {
                return (
                  <div key={index} className="flex gap-2 py-1">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-retro-accent" />
                    <span>{line.replace(/^[-*] /, '')}</span>
                  </div>
                )
              }

              if (!line.trim()) return <div key={index} className="h-2" />

              return <p key={index}>{line}</p>
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default AnalysisPanel
