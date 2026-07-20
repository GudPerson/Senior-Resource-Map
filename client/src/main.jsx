import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { A11yProvider } from './contexts/A11yContext.jsx'
import { MapStyleProvider } from './contexts/MapStyleContext.jsx'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { registerCareAroundPwa } from './lib/pwaRegistration.js'

const rootElement = document.getElementById('root')

// Keep a visible release marker in the shell and force a fresh hashed entry
// whenever the bootstrap contract changes.
document.documentElement.dataset.carearoundClientShell = '2026-07-21.1'

createRoot(rootElement).render(
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
        <A11yProvider>
            <MapStyleProvider>
                <AuthProvider>
                    <App />
                </AuthProvider>
            </MapStyleProvider>
        </A11yProvider>
    </GoogleOAuthProvider>
)

registerCareAroundPwa()
