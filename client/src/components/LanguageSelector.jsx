import { useState } from 'react'
import { ChevronDown, Code } from 'lucide-react'

function LanguageSelector({ currentLanguage, onLanguageChange, languages, compact = false }) {
  const [isOpen, setIsOpen] = useState(false)

  const currentLang = languages.find(lang => lang.value === currentLanguage) || languages[0]

  const handleLanguageSelect = (language) => {
    onLanguageChange(language.value)
    setIsOpen(false)
  }

  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="app-chip flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:border-retro-cyan/60 transition-colors"
        >
          <span className="text-[10px] font-bold text-retro-cyan">{currentLang.label}</span>
          <ChevronDown
            className={`w-3 h-3 text-retro-text/50 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 mt-1 w-44 app-panel z-50 max-h-56 overflow-y-auto rounded-lg shadow-xl custom-scrollbar">
            {languages.map((language) => (
              <button
                key={language.value}
                onClick={() => handleLanguageSelect(language)}
                className={`
                  w-full text-left px-3 py-2 text-[10px] tracking-wider transition-colors
                  ${currentLanguage === language.value
                    ? 'bg-retro-cyan/10 border-l-2 border-retro-cyan text-retro-cyan font-bold'
                    : 'text-retro-text border-l-2 border-transparent hover:bg-retro-surface/80 hover:text-retro-cyan'
                  }
                `}
              >
                {language.label}
              </button>
            ))}
          </div>
        )}

        {isOpen && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="relative">
      <label className="block text-retro-text text-[10px] mb-2 uppercase flex items-center gap-2 opacity-70 tracking-widest pl-1">
        <Code className="w-3.5 h-3.5" />
        LANGUAGE:
      </label>

      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="pixel-button w-full flex items-center justify-between gap-2 text-left py-3 px-4"
        >
          <span className="text-[10px] tracking-wider font-bold">{currentLang.label}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 opacity-60 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 w-full mt-2 app-panel z-50 max-h-48 overflow-y-auto rounded-lg shadow-xl custom-scrollbar overflow-hidden">
            {languages.map((language) => (
              <button
                key={language.value}
                onClick={() => handleLanguageSelect(language)}
                className={`
                  w-full text-left px-4 py-3 text-[10px] tracking-wider transition-colors
                  ${currentLanguage === language.value
                    ? 'bg-retro-cyan/10 border-l-2 border-retro-cyan text-retro-cyan font-bold'
                    : 'text-retro-text border-l-2 border-transparent hover:bg-retro-surface/80 hover:text-retro-cyan'
                  }
                `}
              >
                {language.label}
                {currentLanguage === language.value && (
                  <span className="float-right bg-retro-cyan text-retro-bg w-3 h-3 flex items-center justify-center rounded-sm text-[8px]">✓</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}

export default LanguageSelector
