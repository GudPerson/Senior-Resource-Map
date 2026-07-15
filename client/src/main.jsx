import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { A11yProvider } from './contexts/A11yContext.jsx'
import { MapStyleProvider } from './contexts/MapStyleContext.jsx'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { registerCareAroundPwa } from './lib/pwaRegistration.js'

createRoot(document.getElementById('root')).render(
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
