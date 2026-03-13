import { Moon, Sun } from 'lucide-react'
import { useTheme } from './ThemeContext'

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className="pixel-button pixel-button--small flex items-center justify-center w-8 h-8 rounded-full border-retro-border/30 hover:border-retro-border hover:bg-retro-surface transition-all group"
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? (
        <Moon className="w-4 h-4 text-retro-text opacity-70 group-hover:opacity-100 group-hover:text-retro-secondary transition-colors" />
      ) : (
        <Sun className="w-4 h-4 text-retro-text opacity-70 group-hover:opacity-100 group-hover:text-retro-yellow transition-colors" />
      )}
    </button>
  )
}

export default ThemeToggle
