import { Component, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext.jsx';
import Navbar from './components/layout/Navbar.jsx';
import DiscoverPage from './pages/DiscoverPage.jsx';
import AuthPage from './pages/AuthPage.jsx';

import { canAccessAdmin, canAccessAuditTrail, canAccessOrganizationWorkspace, normalizeRole } from './lib/roles.js';
import { SavedAssetsProvider } from './contexts/SavedAssetsContext.jsx';
import { LocaleProvider, useLocale } from './contexts/LocaleContext.jsx';
import { isGudAuthPhoneLoginReturn } from './lib/phoneVerificationState.js';
import { LoadingState } from './components/LoadingState.jsx';

const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage.jsx'));
const DashboardOverview = lazy(() => import('./pages/dashboard/DashboardOverview.jsx'));
const ResourcesPage = lazy(() => import('./pages/dashboard/ResourcesPage.jsx'));
const ProfilePage = lazy(() => import('./pages/dashboard/ProfilePage.jsx'));
const AdminPage = lazy(() => import('./pages/dashboard/AdminPage.jsx'));
const AuditTrailPage = lazy(() => import('./pages/dashboard/AuditTrailPage.jsx'));
const OrganizationWorkspacePage = lazy(() => import('./pages/dashboard/OrganizationWorkspacePage.jsx'));
const ResourcePage = lazy(() => import('./pages/ResourcePage.jsx'));
const AuthTransitionPage = lazy(() => import('./pages/AuthTransitionPage.jsx'));
const MyDirectoryPage = lazy(() => import('./pages/MyDirectoryPage.jsx'));
const MyMapDetailPage = lazy(() => import('./pages/MyMapDetailPage.jsx'));
const SharedMapPage = lazy(() => import('./pages/SharedMapPage.jsx'));
const MembershipLinkPage = lazy(() => import('./pages/MembershipLinkPage.jsx'));
const LegalPage = lazy(() => import('./pages/LegalPage.jsx'));
const ROUTE_RELOAD_MARKER_KEY = 'carearound:route-recovery-reload';

function isRouteChunkLoadError(error) {
    const text = [
        error?.name,
        error?.message,
        error?.cause?.message,
        String(error || ''),
    ].filter(Boolean).join(' ');

    return /ChunkLoadError|Loading chunk|dynamically imported module|Failed to fetch module script|Importing a module script failed|error loading dynamically imported module/i.test(text);
}

function ProtectedRoute({
    children,
    requireAdmin,
    requireAuditAccess,
    requireDirectoryAccess,
    requireOrganizationAccess,
}) {
    const { user, isAuth } = useAuth();
    const location = useLocation();

    if (!isAuth) {
        if (isGudAuthPhoneLoginReturn(location.search)) {
            const returnTo = encodeURIComponent(`${location.pathname}${location.hash || ''}`);
            return <Navigate to={`/login?gudauth=phone_login&returnTo=${returnTo}`} replace />;
        }
        return <Navigate to="/login" replace />;
    }
    if (requireAdmin && !canAccessAdmin(user?.role)) return <Navigate to="/dashboard" replace />;
    if (requireAuditAccess && !canAccessAuditTrail(user)) return <Navigate to="/dashboard" replace />;
    if (requireDirectoryAccess && normalizeRole(user?.role) === 'guest') return <Navigate to="/discover" replace />;
    if (requireOrganizationAccess && !canAccessOrganizationWorkspace(user)) return <Navigate to="/dashboard" replace />;
    return children;
}

export default function App() {
    return (
        <LocaleProvider>
            <SavedAssetsProvider>
                <BrowserRouter>
                    <AppShell />
                </BrowserRouter>
            </SavedAssetsProvider>
        </LocaleProvider>
    );
}

function RouteLoadingFallback() {
    const { t } = useLocale();
    return <LoadingState label={t('loadingPage')} />;
}

function isProtectedShellRoute(pathname = '') {
    return pathname.startsWith('/my-directory') || pathname.startsWith('/dashboard');
}

function RouteErrorFallback({ error }) {
    const { t } = useLocale();
    const isChunkLoadError = isRouteChunkLoadError(error);

    return (
        <div className="flex min-h-[calc(100vh-88px)] items-center justify-center px-6 py-16">
            <div className="max-w-xl rounded-3xl border border-amber-200 bg-amber-50 px-6 py-6 text-slate-800 shadow-sm">
                <p className="text-sm font-bold uppercase tracking-[0.12em] text-amber-700">
                    {isChunkLoadError ? 'Page update needed' : 'Page could not load'}
                </p>
                <h1 className="mt-2 text-2xl font-bold text-slate-950">
                    {isChunkLoadError ? 'Please refresh this page' : 'Something stopped this page from opening'}
                </h1>
                <p className="mt-3 text-base leading-relaxed text-slate-700">
                    {isChunkLoadError
                        ? 'The app may have been updated while this tab was still open. Refreshing will load the latest version.'
                        : 'Your information is still safe. Refresh the app, or return to Discover and try again.'}
                </p>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="btn-primary justify-center"
                    >
                        Refresh app
                    </button>
                    <button
                        type="button"
                        onClick={() => window.location.assign('/discover')}
                        className="btn-secondary justify-center"
                    >
                        {t('backToDiscover')}
                    </button>
                </div>
            </div>
        </div>
    );
}

class RouteErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error('Route failed to render:', error, info);

        if (!isRouteChunkLoadError(error) || typeof window === 'undefined') {
            return;
        }

        const reloadMarker = `${window.location.pathname}${window.location.search}`;
        if (window.sessionStorage.getItem(ROUTE_RELOAD_MARKER_KEY) === reloadMarker) {
            return;
        }

        window.sessionStorage.setItem(ROUTE_RELOAD_MARKER_KEY, reloadMarker);
        window.location.reload();
    }

    componentDidUpdate(prevProps) {
        if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
            this.setState({ error: null });
        }
    }

    render() {
        if (this.state.error) {
            return <RouteErrorFallback error={this.state.error} />;
        }

        return this.props.children;
    }
}

function AppShell() {
    const location = useLocation();
    const { isLoading } = useAuth();
    const ownerPrintView = location.pathname.startsWith('/my-directory/maps/')
        && new URLSearchParams(location.search).get('view') === 'print';
    const hideNavbar = location.pathname.startsWith('/shared/maps/')
        || location.pathname.startsWith('/auth/transition')
        || ownerPrintView;
    const shouldUseAuthShellLoader = isProtectedShellRoute(location.pathname);

    if (isLoading && shouldUseAuthShellLoader) {
        return <RouteLoadingFallback />;
    }

    return (
        <>
            {!hideNavbar ? <Navbar /> : null}
            <RouteErrorBoundary resetKey={`${location.pathname}${location.search}`}>
                <Suspense fallback={<RouteLoadingFallback />}>
                    <Routes>
                        <Route path="/" element={<Navigate to="/discover" replace />} />
                        <Route path="/list" element={<Navigate to="/discover" replace />} />
                        <Route path="/discover" element={<DiscoverPage />} />
                        <Route path="/membership/link" element={<MembershipLinkPage />} />
                        <Route path="/privacy" element={<LegalPage type="privacy" />} />
                        <Route path="/terms" element={<LegalPage type="terms" />} />
                        <Route path="/auth/transition" element={<AuthTransitionPage />} />

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
                            <Route path="audit" element={<ProtectedRoute requireAuditAccess><AuditTrailPage /></ProtectedRoute>} />
                            <Route path="organization" element={<ProtectedRoute requireOrganizationAccess><OrganizationWorkspacePage /></ProtectedRoute>} />
                        </Route>
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </Suspense>
            </RouteErrorBoundary>
        </>
    );
}
