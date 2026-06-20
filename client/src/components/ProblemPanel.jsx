import { useState } from 'react'
import {
  Code, Trophy, RotateCcw, ChevronDown, ChevronUp,
  CheckCircle, AlertCircle, BookOpen
} from 'lucide-react'

function ProblemPanel({
  problem,
  solvedProblems = [],
  onSelectProblem,
  onSelectRandom,
  onResetProblem,
  isOwner,
  onMarkSolved
}) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [showProblemList, setShowProblemList] = useState(false)
  const [activeTab, setActiveTab] = useState('description')

  const getDifficultyColor = (difficulty) => {
    switch (difficulty?.toLowerCase()) {
      case 'easy': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30'
      case 'medium': return 'text-amber-400 bg-amber-400/10 border-amber-400/30'
      case 'hard': return 'text-red-400 bg-red-400/10 border-red-400/30'
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/30'
    }
  }

  const isProblemSolved = (problemId) => solvedProblems.includes(problemId)

  return (
    <div className="flex flex-col h-full app-panel border-t border-retro-border">
      {/* Problem Header */}
      <div className="p-3 border-b border-retro-border/60 bg-retro-panel/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-retro-cyan" />
            <span className="text-retro-text text-[10px] uppercase tracking-wider font-bold">
              {problem ? 'Current Problem' : 'No Problem Selected'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Owner Controls */}
            {isOwner && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowProblemList(!showProblemList)}
                  className="pixel-button pixel-button--small text-[8px] flex items-center gap-1"
                  title="Select Problem"
                >
                  <Code className="w-3 h-3" />
                  SELECT
                </button>
                <button
                  onClick={onSelectRandom}
                  className="pixel-button pixel-button--small text-[8px] bg-retro-accent/20 border-retro-accent/30 hover:border-retro-accent"
                  title="Random Problem"
                >
                  RANDOM
                </button>
              </div>
            )}

            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="pixel-button pixel-button--small p-1"
            >
              {isCollapsed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Problem Info */}
        {problem && (
          <div className="flex items-center gap-3 mt-2">
            <span className={`text-[9px] px-2 py-1 rounded border uppercase tracking-wider font-bold ${getDifficultyColor(problem.difficulty)}`}>
              {problem.difficulty}
            </span>
            <span className="text-retro-text/60 text-[9px] uppercase tracking-wider">
              {problem.category}
            </span>
            {isProblemSolved(problem.id) && (
              <span className="flex items-center gap-1 text-emerald-400 text-[9px] uppercase tracking-wider">
                <CheckCircle className="w-3 h-3" />
                SOLVED
              </span>
            )}
          </div>
        )}
      </div>

      {/* Problem List Dropdown */}
      {showProblemList && (
        <div className="border-b border-retro-border/60 bg-retro-bg/80 max-h-48 overflow-y-auto">
          <div className="p-2 space-y-1">
            {[
              { id: 1, title: 'Two Sum', difficulty: 'Easy', category: 'Array' },
              { id: 2, title: 'Valid Parentheses', difficulty: 'Easy', category: 'Stack' },
              { id: 3, title: 'Merge Two Sorted Lists', difficulty: 'Easy', category: 'Linked List' },
              { id: 4, title: 'Maximum Subarray', difficulty: 'Medium', category: 'Dynamic Programming' },
              { id: 5, title: 'Binary Tree Level Order', difficulty: 'Medium', category: 'Binary Tree' }
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  onSelectProblem(p.id)
                  setShowProblemList(false)
                }}
                className={`
                  w-full text-left p-2 rounded border text-[9px] transition-all duration-200
                  ${isProblemSolved(p.id)
                    ? 'border-emerald-500/40 bg-emerald-500/10 opacity-80'
                    : 'border-retro-border/20 hover:border-retro-border/50 hover:bg-retro-surface/60'
                  }
                  ${problem?.id === p.id ? 'border-retro-cyan/50 bg-retro-cyan/5' : ''}
                `}
              >
                <div className="flex items-center justify-between">
                  <span className="text-retro-text/80 font-semibold">{p.title}</span>
                  <div className="flex items-center gap-2">
                    {isProblemSolved(p.id) && (
                      <CheckCircle className="w-3 h-3 text-emerald-400" />
                    )}
                    <span className={`text-[7px] px-1.5 py-0.5 rounded border uppercase ${getDifficultyColor(p.difficulty)}`}>
                      {p.difficulty}
                    </span>
                  </div>
                </div>
                <div className="text-retro-text/50 text-[8px] mt-0.5 uppercase tracking-wider">
                  {p.category}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Problem Content */}
      {!isCollapsed && problem && (
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-retro-border/50">
            <button
              onClick={() => setActiveTab('description')}
              className={`flex-1 px-3 py-2 text-[9px] uppercase tracking-wider transition-colors ${
                activeTab === 'description'
                  ? 'text-retro-cyan border-b-2 border-retro-cyan bg-retro-cyan/5'
                  : 'text-retro-text/60 hover:text-retro-text/80'
              }`}
            >
              Description
            </button>
            <button
              onClick={() => setActiveTab('examples')}
              className={`flex-1 px-3 py-2 text-[9px] uppercase tracking-wider transition-colors ${
                activeTab === 'examples'
                  ? 'text-retro-cyan border-b-2 border-retro-cyan bg-retro-cyan/5'
                  : 'text-retro-text/60 hover:text-retro-text/80'
              }`}
            >
              Examples
            </button>
            <button
              onClick={() => setActiveTab('constraints')}
              className={`flex-1 px-3 py-2 text-[9px] uppercase tracking-wider transition-colors ${
                activeTab === 'constraints'
                  ? 'text-retro-cyan border-b-2 border-retro-cyan bg-retro-cyan/5'
                  : 'text-retro-text/60 hover:text-retro-text/80'
              }`}
            >
              Constraints
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-3">
            {activeTab === 'description' && (
              <div className="space-y-3">
                <h3 className="text-retro-cyan text-xs font-bold">{problem.title}</h3>
                <div className="text-retro-text/80 text-[10px] leading-relaxed whitespace-pre-wrap font-mono">
                  {problem.description}
                </div>
              </div>
            )}

            {activeTab === 'examples' && (
              <div className="space-y-4">
                {problem.examples?.map((ex, idx) => (
                  <div key={idx} className="bg-retro-bg/60 rounded-lg p-3 border border-retro-border/40">
                    <div className="text-retro-text/60 text-[9px] uppercase tracking-wider mb-2">
                      Example {idx + 1}
                    </div>
                    <div className="space-y-1.5 font-mono text-[9px]">
                      <div>
                        <span className="text-retro-cyan">Input: </span>
                        <span className="text-retro-text/80">{ex.input}</span>
                      </div>
                      <div>
                        <span className="text-retro-cyan">Output: </span>
                        <span className="text-emerald-400">{ex.output}</span>
                      </div>
                      {ex.explanation && (
                        <div className="text-retro-text/60 text-[8px] italic mt-1">
                          Explanation: {ex.explanation}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'constraints' && (
              <div className="space-y-2">
                {problem.constraints?.map((c, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-[9px]">
                    <AlertCircle className="w-3 h-3 text-retro-cyan flex-shrink-0 mt-0.5" />
                    <span className="text-retro-text/80 font-mono">{c}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-2 border-t border-retro-border/60 flex items-center justify-between bg-retro-panel/60">
            <div className="flex items-center gap-2 text-[8px] text-retro-text/50">
              <Trophy className="w-3 h-3 text-retro-yellow" />
              <span>{solvedProblems.length}/5 Solved</span>
            </div>
            {isOwner && problem && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={onResetProblem}
                  className="pixel-button pixel-button--small text-[7px] flex items-center gap-1"
                  title="Reset to boilerplate"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  RESET
                </button>
                {!isProblemSolved(problem.id) && (
                  <button
                    onClick={() => onMarkSolved(problem.id)}
                    className="pixel-button pixel-button--small text-[7px] flex items-center gap-1 text-emerald-400 border-emerald-500/30 hover:border-emerald-500"
                    title="Mark as solved"
                  >
                    <CheckCircle className="w-2.5 h-2.5" />
                    MARK SOLVED
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* No Problem Selected State */}
      {!isCollapsed && !problem && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <Code className="w-10 h-10 text-retro-text/20 mb-3" />
          <div className="text-retro-text/40 text-[10px] uppercase tracking-wider mb-4">
            No Problem Selected
          </div>
          {isOwner ? (
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setShowProblemList(!showProblemList)}
                className="pixel-button pixel-button--small text-[9px]"
              >
                SELECT A PROBLEM
              </button>
              <button
                onClick={onSelectRandom}
                className="pixel-button pixel-button--small pixel-button--cyan text-[9px]"
              >
                RANDOM PROBLEM
              </button>
            </div>
          ) : (
            <div className="text-retro-text/30 text-[9px]">
              Waiting for owner to select a problem...
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ProblemPanel
