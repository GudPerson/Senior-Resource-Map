import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext.jsx';
import Navbar from './components/layout/Navbar.jsx';
import DiscoverPage from './pages/DiscoverPage.jsx';
import AuthPage from './pages/AuthPage.jsx';
import DashboardPage from './pages/dashboard/DashboardPage.jsx';
import DashboardOverview from './pages/dashboard/DashboardOverview.jsx';
import ResourcesPage from './pages/dashboard/ResourcesPage.jsx';
import ProfilePage from './pages/dashboard/ProfilePage.jsx';
import AdminPage from './pages/dashboard/AdminPage.jsx';

import ResourcePage from './pages/ResourcePage.jsx';

function ProtectedRoute({ children, requireAdmin }) {
    const { user, isAuth } = useAuth();
    if (!isAuth) return <Navigate to="/login" replace />;
    const adminRoles = ['super_admin', 'regional_admin'];
    if (requireAdmin && !adminRoles.includes(user?.role)) return <Navigate to="/dashboard" replace />;
    return children;
}

export default function App() {
    return (
        <BrowserRouter>
            <Navbar />
            <Routes>
                <Route path="/" element={<Navigate to="/discover" replace />} />
                <Route path="/list" element={<Navigate to="/discover" replace />} />
                <Route path="/discover" element={<DiscoverPage />} />
                <Route path="/resource/:type/:id" element={<ResourcePage />} />
                <Route path="/login" element={<AuthPage isPartner={false} />} />
                <Route path="/partner-login" element={<AuthPage isPartner={true} />} />
                <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>}>
                    <Route index element={<DashboardOverview />} />
                    <Route path="resources" element={<ResourcesPage />} />
                    <Route path="profile" element={<ProfilePage />} />
                    <Route path="admin" element={<ProtectedRoute requireAdmin><AdminPage /></ProtectedRoute>} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}
