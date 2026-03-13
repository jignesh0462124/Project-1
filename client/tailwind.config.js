/** @type {import('tailwindcss').Config} */

function withOpacity(variableName) {
  return ({ opacityValue }) => {
    if (opacityValue !== undefined) {
      return `rgb(var(${variableName}) / ${opacityValue})`
    }
    return `rgb(var(${variableName}))`
  }
}

export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'pixel': ['"Press Start 2P"', 'cursive'],
      },
      colors: {
        'retro-bg': withOpacity('--color-bg'),
        'retro-surface': withOpacity('--color-surface'),
        'retro-panel': withOpacity('--color-panel'),
        'retro-border': withOpacity('--color-border'),
        'retro-cyan': withOpacity('--color-primary'),
        'retro-text': withOpacity('--color-text'),
        'retro-accent': withOpacity('--color-secondary'),
        'retro-yellow': withOpacity('--color-warning'),
      },
      boxShadow: {
        'retro': '0 4px 6px -1px var(--color-shadow), 0 2px 4px -1px var(--color-shadow-light)',
        'retro-cyan': '0 4px 6px -1px var(--color-primary-shadow), 0 2px 4px -1px var(--color-primary-shadow-light)',
      },
      animation: {
        'blink': 'blink 1s infinite',
        'fade-in': 'fadeIn 0.5s ease-in-out',
      },
      keyframes: {
        blink: {
          '0%, 50%': { opacity: '1' },
          '51%, 100%': { opacity: '0' }
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(5px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      }
    },
  },
  plugins: [],
}