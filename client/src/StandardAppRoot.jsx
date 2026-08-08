import { GoogleOAuthProvider } from '@react-oauth/google';

import App from './App.jsx';
import { A11yProvider } from './contexts/A11yContext.jsx';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { MapStyleProvider } from './contexts/MapStyleContext.jsx';

export default function StandardAppRoot() {
    return (
        <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
            <A11yProvider>
                <MapStyleProvider>
                    <AuthProvider>
                        <App />
                    </AuthProvider>
                </MapStyleProvider>
            </A11yProvider>
        </GoogleOAuthProvider>
    );
}
