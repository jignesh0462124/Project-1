import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/pixel.css'
import { ThemeProvider } from './components/ThemeContext'

ReactDOM.createRoot(document.getElementById('root')).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
)