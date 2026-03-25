import { useContext } from 'react'
import { ThemeContext } from './ThemeContext.jsx'

export const useTheme = () => useContext(ThemeContext)
