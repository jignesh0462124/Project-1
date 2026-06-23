import { useMemo, useState } from 'react'

const EMPTY_ANALYSIS = {
  fixes: [],
  quality: { score: 0, grade: 'F', items: [] },
  complexity: { time: 'O(?)', space: 'O(?)', explanation: 'Run Analyze to inspect complexity.' }
}

const TABS = [
  { id: 'fixes', label: 'Fixes' },
  { id: 'quality', label: 'Quality' },
  { id: 'complexity', label: 'Complexity' }
]

const SEVERITY_CLASS = {
  critical: 'border-red-500/40 bg-red-500/10 text-red-500',
  warning: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-600 dark:text-yellow-300',
  info: 'border-blue-500/40 bg-blue-500/10 text-blue-500'
}

function parseAnalysis(analysis) {
  if (!analysis) return { data: null, error: null }

  if (typeof analysis === 'string') {
    if (analysis.startsWith('Error:')) return { data: null, error: analysis.replace(/^Error:\s*/, '') }
    try {
      return normalizeAnalysis(JSON.parse(analysis))
    } catch {
      return { data: null, error: analysis }
    }
  }

  if (analysis.error) return { data: null, error: analysis.message || analysis.details || analysis.error }
  if (analysis.analysis) return parseAnalysis(analysis.analysis)
  return normalizeAnalysis(analysis)
}

function normalizeAnalysis(value) {
  if (!value || typeof value !== 'object') return { data: EMPTY_ANALYSIS, error: null }

  return {
    data: {
      fixes: Array.isArray(value.fixes) ? value.fixes : [],
      quality: {
        score: Number.isFinite(Number(value.quality?.score)) ? Number(value.quality.score) : 0,
        grade: value.quality?.grade || 'F',
        items: Array.isArray(value.quality?.items) ? value.quality.items : []
      },
      complexity: {
        time: value.complexity?.time || 'O(?)',
        space: value.complexity?.space || 'O(?)',
        explanation: value.complexity?.explanation || 'No complexity explanation was returned.'
      }
    },
    error: null
  }
}

function LoadingState() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((item) => (
        <div key={item} className="rounded-lg border border-retro-border bg-[var(--surface-soft)] p-3">
          <div className="h-3 w-24 animate-pulse rounded bg-retro-border" />
          <div className="mt-3 h-3 w-full animate-pulse rounded bg-retro-border" />
          <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-retro-border" />
        </div>
      ))}
    </div>
  )
}

function AnalysisPanel({ analysis, isAnalyzing, onClear }) {
  const [activeTab, setActiveTab] = useState('fixes')
  const { data, error } = useMemo(() => parseAnalysis(analysis), [analysis])
  const current = data || EMPTY_ANALYSIS

  return (
    <div className="flex h-full min-h-0 flex-col bg-retro-surface">
      <div className="flex items-center justify-between border-b border-retro-border px-4 py-3">
        <div>
          <h3 className="ui-label text-retro-text">AI Analysis</h3>
          <div className="mt-1 font-mono-ui text-xs font-semibold text-retro-accent">
            {isAnalyzing ? 'Analyzing...' : analysis ? 'Complete' : 'Idle'}
          </div>
        </div>
        <button onClick={onClear} className="btn btn-ghost" disabled={isAnalyzing || !analysis}>
          Clear
        </button>
      </div>

      <div className="border-b border-retro-border px-3 py-2">
        <div className="grid grid-cols-3 gap-1 rounded-lg border border-retro-border bg-[var(--surface-soft)] p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-md px-2 py-2 font-mono-ui text-xs font-bold uppercase transition ${activeTab === tab.id ? 'bg-retro-accent text-[var(--on-accent)] shadow-retro' : 'text-[var(--text-dim)] hover:text-retro-text'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="custom-scrollbar flex-1 overflow-auto p-4">
        {isAnalyzing && <LoadingState />}

        {!isAnalyzing && !analysis && (
          <div className="rounded-lg border border-retro-border bg-[var(--surface-soft)] p-4 text-sm text-[var(--text-dim)]">
            Run Analyze to get structured feedback on fixes, quality, and complexity.
          </div>
        )}

        {!isAnalyzing && error && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4">
            <div className="ui-label text-red-500">Analysis Error</div>
            <p className="mt-2 text-sm leading-6 text-retro-text">{error}</p>
            <button type="button" onClick={onClear} className="btn btn-primary mt-4">Reset</button>
          </div>
        )}

        {!isAnalyzing && !error && data && activeTab === 'fixes' && (
          <div className="space-y-3">
            {current.fixes.length === 0 ? (
              <div className="rounded-lg border border-retro-border bg-[var(--surface-soft)] p-4 text-sm text-retro-text">The code looks clean.</div>
            ) : current.fixes.map((item, index) => (
              <div key={`${item.title}-${index}`} className="rounded-lg border border-retro-border bg-[var(--surface-soft)] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded border px-2 py-1 font-mono-ui text-[10px] font-bold uppercase ${SEVERITY_CLASS[item.severity] || SEVERITY_CLASS.info}`}>
                    {item.severity || 'info'}
                  </span>
                  <h4 className="text-sm font-bold text-retro-text">{item.title || 'Review note'}</h4>
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{item.description || 'No description provided.'}</p>
              </div>
            ))}
          </div>
        )}

        {!isAnalyzing && !error && data && activeTab === 'quality' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-retro-border bg-[var(--surface-soft)] p-4">
                <div className="font-mono-ui text-xs uppercase text-[var(--text-dim)]">Score</div>
                <div className="mt-2 text-3xl font-black text-retro-accent">{current.quality.score}</div>
              </div>
              <div className="rounded-lg border border-retro-border bg-[var(--surface-soft)] p-4">
                <div className="font-mono-ui text-xs uppercase text-[var(--text-dim)]">Grade</div>
                <div className="mt-2 text-3xl font-black text-retro-cyan">{current.quality.grade}</div>
              </div>
            </div>
            <div className="divide-y divide-retro-border overflow-hidden rounded-lg border border-retro-border bg-[var(--surface-soft)]">
              {current.quality.items.length === 0 ? (
                <div className="p-4 text-sm text-[var(--text-dim)]">No quality notes returned.</div>
              ) : current.quality.items.map((item, index) => (
                <div key={`${item.category}-${index}`} className="grid gap-2 p-4 sm:grid-cols-[120px_1fr]">
                  <div className="font-mono-ui text-xs font-bold uppercase text-retro-accent">{item.category || 'General'}</div>
                  <div className="text-sm leading-6 text-retro-text">{item.comment || 'No comment provided.'}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isAnalyzing && !error && data && activeTab === 'complexity' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-retro-border bg-[var(--surface-soft)] p-4">
                <div className="font-mono-ui text-xs uppercase text-[var(--text-dim)]">Time</div>
                <div className="mt-2 font-mono-ui text-2xl font-black text-retro-accent">{current.complexity.time}</div>
              </div>
              <div className="rounded-lg border border-retro-border bg-[var(--surface-soft)] p-4">
                <div className="font-mono-ui text-xs uppercase text-[var(--text-dim)]">Space</div>
                <div className="mt-2 font-mono-ui text-2xl font-black text-retro-cyan">{current.complexity.space}</div>
              </div>
            </div>
            <div className="rounded-lg border border-retro-border bg-[var(--surface-soft)] p-4 text-sm leading-6 text-retro-text">
              {current.complexity.explanation}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AnalysisPanel