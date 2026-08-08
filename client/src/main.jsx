import { createRoot } from 'react-dom/client'
import './index.css'

const rootElement = document.getElementById('root')
const isEmbeddedMapRoute = window.location.pathname.startsWith('/embed/maps/')

// Keep a visible release marker in the shell and force a fresh hashed entry
// whenever the bootstrap contract changes.
document.documentElement.dataset.carearoundClientShell = '2026-08-08.1'

async function startClient() {
    if (isEmbeddedMapRoute) {
        const { default: EmbeddedApp } = await import('./EmbeddedApp.jsx')
        createRoot(rootElement).render(<EmbeddedApp />)
        return
    }

    const [{ default: StandardAppRoot }, { registerCareAroundPwa }] = await Promise.all([
        import('./StandardAppRoot.jsx'),
        import('./lib/pwaRegistration.js'),
    ])
    createRoot(rootElement).render(<StandardAppRoot />)
    registerCareAroundPwa()
}

startClient()
