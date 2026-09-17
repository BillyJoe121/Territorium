import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import './production.css'
import { AuthProvider } from './auth/AuthContext'
import { ErrorBoundary } from './ErrorBoundary'

createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary><AuthProvider><App /></AuthProvider></ErrorBoundary></StrictMode>)
