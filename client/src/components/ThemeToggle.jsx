import { Moon, Sun } from 'lucide-react'
import { useTheme } from './useTheme'

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className="icon-button group h-10 min-h-10 w-10 min-w-10 rounded"
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? (
        <Moon className="h-5 w-5 text-retro-text opacity-70 transition-colors group-hover:opacity-100" />
      ) : (
        <Sun className="h-5 w-5 text-retro-yellow opacity-80 transition-colors group-hover:opacity-100" />
      )}
    </button>
  )
}

export default ThemeToggle
