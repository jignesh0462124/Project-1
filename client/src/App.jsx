import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Home from './pages/Home'

const Editor = lazy(() => import('./pages/Editor'))

function EditorLoadingFallback() {
  return (
    <div className="min-h-screen grid place-items-center bg-retro-bg text-retro-text">
      <div className="border-2 border-retro-border bg-retro-panel px-5 py-3 text-sm font-bold uppercase tracking-wide shadow-pixel">
        Loading editor...
      </div>
    </div>
  )
}

function App() {
  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
      <div className="min-h-screen bg-retro-bg transition-colors duration-300">
        <Suspense fallback={<EditorLoadingFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/room/:roomId" element={<Editor />} />
          </Routes>
        </Suspense>

        <Toaster
          position="bottom-right"
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
