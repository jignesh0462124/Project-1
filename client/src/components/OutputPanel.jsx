function OutputPanel({ result, isRunning, onClear }) {
  const getStatusColor = () => {
    if (!result?.status) return 'text-[var(--text-dim)]'
    const id = result.status.id
    if (id === 3) return 'text-retro-cyan'
    if (id === 5) return 'text-[var(--warn)]'
    if (id === 6 || (id >= 7 && id <= 12)) return 'text-[var(--danger)]'
    return 'text-[var(--warn)]'
  }

  const getStatusLabel = () => {
    if (isRunning) return 'Running...'
    if (!result) return 'Ready'
    if (result.status) return result.status.description || 'Done'
    return 'Done'
  }

  const hasOutput = result && (result.stdout || result.stderr || result.compile_output || result.error)

  return (
    <div className="flex h-full min-h-0 flex-col bg-retro-surface">
      <div className="flex items-center justify-between border-b border-retro-border px-4 py-3">
        <div>
          <h3 className="ui-label text-retro-text">Output</h3>
          <div className={`mt-1 font-mono-ui text-xs font-semibold ${getStatusColor()}`}>{getStatusLabel()}</div>
        </div>
        <button onClick={onClear} className="btn btn-ghost" disabled={isRunning}>
          Clear
        </button>
      </div>

      <div className="custom-scrollbar flex-1 overflow-auto p-4 font-mono-ui text-xs leading-6">
        {isRunning && (
          <div className="flex items-center gap-2 text-[var(--text-dim)]">
            <span className="h-2 w-2 rounded-full bg-[var(--warn)] typing-dot" />
            Executing code on remote server...
          </div>
        )}

        {!isRunning && !hasOutput && !result && (
          <div className="text-sm text-[var(--text-dim)]">Run your code to see output here.</div>
        )}

        {!isRunning && result && !hasOutput && (
          <div className="text-sm text-[var(--text-dim)]">Program finished with no output.</div>
        )}

        {result?.stdout && (
          <OutputBlock label="Stdout" value={result.stdout} />
        )}

        {result?.stderr && (
          <OutputBlock label="Stderr" value={result.stderr} tone="danger" />
        )}

        {result?.compile_output && (
          <OutputBlock label="Compile output" value={result.compile_output} tone="warn" />
        )}

        {result?.error && (
          <OutputBlock
            label="Error"
            value={`${result.error}${result.details ? `\n${typeof result.details === 'string' ? result.details : JSON.stringify(result.details, null, 2)}` : ''}`}
            tone="danger"
          />
        )}
      </div>
    </div>
  )
}

function OutputBlock({ label, value, tone = 'default' }) {
  const toneClass = tone === 'danger' ? 'text-[var(--danger)]' : tone === 'warn' ? 'text-[var(--warn)]' : 'text-retro-cyan'

  return (
    <section className="mb-4">
      <div className={`ui-label mb-2 ${toneClass}`}>{label}</div>
      <pre className="whitespace-pre-wrap break-words rounded border border-retro-border bg-retro-bg p-3 text-retro-text">{value}</pre>
    </section>
  )
}

export default OutputPanel
