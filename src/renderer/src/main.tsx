import { createRoot } from 'react-dom/client'
import { App } from './components/App'
import { ErrorBoundary } from './components/ErrorBoundary'
import './styles.css'

// il warning ResizeObserver loop è benigno (notifica fuori dal frame) e sporca console/devtools
window.addEventListener('error', (e) => {
  if (String(e.message).includes('ResizeObserver loop')) {
    e.stopImmediatePropagation()
  }
})

const root = createRoot(document.getElementById('root')!)
root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)
