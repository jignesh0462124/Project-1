import { Moon, Sun } from 'lucide-react'
import { useTheme } from './useTheme'

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className={`
        pixel-button pixel-button--small flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300
        ${theme === 'dark' 
          ? 'bg-retro-surface border-2 border-retro-border hover:border-retro-cyan hover:bg-retro-cyan/10' 
          : 'bg-white border-2 border-slate-300 hover:border-blue-500 hover:bg-blue-50 shadow-sm'
        }
      `}
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? (
        <Moon className={`w-5 h-5 ${theme === 'light' ? 'text-slate-700' : 'text-retro-text'} opacity-70 group-hover:opacity-100 transition-colors`} />
      ) : (
        <Sun className={`w-5 h-5 ${theme === 'dark' ? 'text-amber-400' : 'text-retro-text'} opacity-70 group-hover:opacity-100 transition-colors`} />
      )}
    </button>
  )
}

export default ThemeToggle
