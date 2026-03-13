import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Home from './pages/Home'
import Editor from './pages/Editor'

function App() {
  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
      <div className="min-h-screen bg-retro-bg transition-colors duration-300">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/room/:roomId" element={<Editor />} />
        </Routes>
        
        <Toaster 
          position="top-center"
          toastOptions={{
            className: 'toast-pixel',
            duration: 4000,
            success: {
              className: 'toast-pixel toast-pixel--success',
            },
            error: {
              className: 'toast-pixel toast-pixel--error',
            },
          }}
        />
      </div>
    </Router>
  )
}

export default App