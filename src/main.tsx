import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import App from './App.tsx'
import { AppProvider } from './contexts/AppContext.tsx'
import { initAnalytics } from './lib/analytics.ts'

initAnalytics()

// Keep useful metadata in the initial HTML, then give the app one owner.
// Helmet 3 uses React 19's native metadata hoisting, which does not replace
// hand-written head tags or deduplicate competing Helmet instances.
document.head.querySelectorAll('[data-rh="true"]').forEach((element) => element.remove())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <AppProvider>
        <App />
      </AppProvider>
    </HelmetProvider>
  </StrictMode>,
)
