import { useState, useEffect, createContext, useContext } from 'react'

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  // Check local storage or default to 'dark'
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme')
      if (savedTheme) {
        return savedTheme
      }
      return 'dark'
    }
    return 'dark'
  })

  useEffect(() => {
    const root = window.document.documentElement
    
    root.classList.remove('light', 'dark')
    root.classList.add(theme)
    
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light')
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
