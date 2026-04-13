import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext.jsx';
import Navbar from './components/layout/Navbar.jsx';
import DiscoverPage from './pages/DiscoverPage.jsx';
import AuthPage from './pages/AuthPage.jsx';

import { canAccessAdmin, normalizeRole } from './lib/roles.js';
import { SavedAssetsProvider } from './contexts/SavedAssetsContext.jsx';

const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage.jsx'));
const DashboardOverview = lazy(() => import('./pages/dashboard/DashboardOverview.jsx'));
const ResourcesPage = lazy(() => import('./pages/dashboard/ResourcesPage.jsx'));
const ProfilePage = lazy(() => import('./pages/dashboard/ProfilePage.jsx'));
const AdminPage = lazy(() => import('./pages/dashboard/AdminPage.jsx'));
const ResourcePage = lazy(() => import('./pages/ResourcePage.jsx'));
const MyDirectoryPage = lazy(() => import('./pages/MyDirectoryPage.jsx'));
const MyMapDetailPage = lazy(() => import('./pages/MyMapDetailPage.jsx'));
const SharedMapPage = lazy(() => import('./pages/SharedMapPage.jsx'));
const MembershipLinkPage = lazy(() => import('./pages/MembershipLinkPage.jsx'));

function ProtectedRoute({ children, requireAdmin, requireDirectoryAccess }) {
    const { user, isAuth } = useAuth();
    if (!isAuth) return <Navigate to="/login" replace />;
    if (requireAdmin && !canAccessAdmin(user?.role)) return <Navigate to="/dashboard" replace />;
    if (requireDirectoryAccess && normalizeRole(user?.role) === 'guest') return <Navigate to="/discover" replace />;
    return children;
}

export default function App() {
    return (
        <SavedAssetsProvider>
            <BrowserRouter>
                <AppShell />
            </BrowserRouter>
        </SavedAssetsProvider>
    );
}

function RouteLoadingFallback() {
    return (
        <div className="flex min-h-[calc(100vh-88px)] items-center justify-center px-6 py-16">
            <div className="rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
                <div className="flex items-center gap-3 text-sm font-semibold text-slate-600">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
                    Loading page…
                </div>
            </div>
        </div>
    );
}

function AppShell() {
    const location = useLocation();
    const ownerPrintView = location.pathname.startsWith('/my-directory/maps/')
        && new URLSearchParams(location.search).get('view') === 'print';
    const hideNavbar = location.pathname.startsWith('/shared/maps/') || ownerPrintView;

    return (
        <>
            {!hideNavbar ? <Navbar /> : null}
            <Suspense fallback={<RouteLoadingFallback />}>
                <Routes>
                    <Route path="/" element={<Navigate to="/discover" replace />} />
                    <Route path="/list" element={<Navigate to="/discover" replace />} />
                    <Route path="/discover" element={<DiscoverPage />} />
                    <Route path="/membership/link" element={<MembershipLinkPage />} />

                    <Route path="/resource/:type/:id" element={<ResourcePage />} />
                    <Route path="/shared/maps/:token" element={<SharedMapPage />} />
                    <Route path="/my-directory" element={<ProtectedRoute requireDirectoryAccess><MyDirectoryPage /></ProtectedRoute>} />
                    <Route path="/my-directory/maps/:mapId" element={<ProtectedRoute requireDirectoryAccess><MyMapDetailPage /></ProtectedRoute>} />
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
            </Suspense>
        </>
    );
}
