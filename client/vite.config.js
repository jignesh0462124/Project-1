import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const vendorChunks = [
  { name: 'vendor-react', packages: ['react', 'react-dom', 'scheduler'] },
  { name: 'vendor-router', packages: ['react-router-dom', '@remix-run/router'] },
  { name: 'vendor-realtime', packages: ['socket.io-client', 'engine.io-client'] },
  { name: 'vendor-supabase', packages: ['@supabase/'] },
  { name: 'vendor-ui', packages: ['lucide-react', 'react-hot-toast'] },
]

function normalizeModuleId(id) {
  return id.replaceAll('\\', '/')
}

function matchesPackage(normalizedId, packageName) {
  const packageRoot = `/node_modules/${packageName}`
  return packageName.endsWith('/')
    ? normalizedId.includes(packageRoot)
    : normalizedId.includes(`${packageRoot}/`)
}

function resolveModulePreloadDependencies(_filename, deps, context) {
  if (context.hostType !== 'html') return deps
  return deps.filter((dependency) => !dependency.includes('monaco-'))
}

function getManualChunk(id) {
  const normalizedId = normalizeModuleId(id)

  if (normalizedId.includes('vite/preload-helper')
    || normalizedId.includes('commonjsHelpers')) {
    return 'vendor-runtime'
  }

  if (!normalizedId.includes('/node_modules/')) return undefined

  if (normalizedId.includes('/node_modules/monaco-editor/esm/vs/basic-languages/')
    || normalizedId.includes('/node_modules/monaco-editor/esm/vs/language/')) {
    return 'monaco-languages'
  }

  if (normalizedId.includes('/node_modules/monaco-editor/')) {
    return 'monaco-core'
  }

  const vendorChunk = vendorChunks.find(({ packages }) =>
    packages.some((packageName) => matchesPackage(normalizedId, packageName))
  )

  return vendorChunk?.name
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true
  },
  build: {
    outDir: 'dist',
    modulePreload: {
      resolveDependencies: resolveModulePreloadDependencies,
    },
    minify: 'terser',
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      output: {
        manualChunks: getManualChunk,
      }
    },
    terserOptions: {
      compress: {
        drop_console: true,    // Remove all console.* in production
        drop_debugger: true,   // Remove debugger statements
      }
    }
  }
})
