import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Activity, BookOpen, Files, LayoutDashboard, LogOut, Map, Menu, Shield, User } from 'lucide-react';

import { canAccessAdmin, getRoleMeta, isStandardUserRole } from '../../lib/roles.js';

function SidebarLink({ to, icon: Icon, id, label, onNavigate }) {
    return (
        <NavLink
            id={id}
            to={to}
            end
            onClick={onNavigate}
            className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-base font-semibold transition-all min-h-[44px] ${isActive
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
            }
        >
            <Icon size={20} /> {label}
        </NavLink>
    );
}

export function getDashboardSectionLabel(pathname) {
    if (pathname === '/dashboard' || pathname === '/dashboard/') return 'Overview';
    if (pathname.startsWith('/dashboard/profile')) return 'Profile';
    if (pathname.startsWith('/dashboard/admin')) return 'Admin';
    if (pathname.startsWith('/my-directory/maps/')) return 'My Maps';
    if (pathname.startsWith('/my-directory')) return 'My Directory';
    if (pathname.startsWith('/dashboard/resources')) return 'My Resources';
    return 'Menu';
}

export function DashboardSidebar({
    isImpersonating,
    onLogout,
    onNavigate,
    user,
}) {
    const roleMeta = getRoleMeta(user?.role);
    const isStandardUser = isStandardUserRole(user?.role);
    const canShowAdmin = canAccessAdmin(user?.role);

    return (
        <>
            <div className="px-4 py-3 mb-3 bg-brand-50 rounded-xl border border-brand-100">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center flex-shrink-0">
                        <Activity size={18} className="text-white" />
                    </div>
                    <div className="min-w-0">
                        <p className="font-bold text-slate-900 text-sm truncate">{user?.name}</p>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${roleMeta.pillClassName}`}>
                            {roleMeta.shortLabel}
                        </span>
                        {isImpersonating ? (
                            <p className="mt-1 text-[11px] font-semibold text-brand-700">
                                User view via {user?.impersonatedBy?.name || 'admin'}
                            </p>
                        ) : null}
                    </div>
                </div>
            </div>

            <SidebarLink to="/discover" icon={Map} label="Discovery Map" id="dash-discover" onNavigate={onNavigate} />
            <SidebarLink to="/dashboard" icon={LayoutDashboard} label="Overview" id="dash-overview" onNavigate={onNavigate} />
            <SidebarLink
                to="/my-directory"
                icon={BookOpen}
                label="My Directory"
                id="dash-directory"
                onNavigate={onNavigate}
            />
            {!isStandardUser ? (
                <SidebarLink
                    to="/dashboard/resources"
                    icon={Files}
                    label="My Resources"
                    id="dash-managed-resources"
                    onNavigate={onNavigate}
                />
            ) : null}
            <SidebarLink to="/dashboard/profile" icon={User} label="Profile" id="dash-profile" onNavigate={onNavigate} />
            {canShowAdmin ? (
                <SidebarLink to="/dashboard/admin" icon={Shield} label="Admin" id="dash-admin" onNavigate={onNavigate} />
            ) : null}

            <div className="mt-auto">
                <button
                    id="dash-logout"
                    onClick={onLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all text-base font-semibold min-h-[44px]"
                >
                    <LogOut size={20} /> {isImpersonating ? 'Exit User View' : 'Logout'}
                </button>
            </div>
        </>
    );
}

export function DashboardMobileNavigation({
    isImpersonating,
    onLogout,
    sectionContextLabel = 'Dashboard',
    sectionLabel,
    user,
}) {
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [navbarOffset, setNavbarOffset] = useState(() => (
        typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches ? 64 : 56
    ));
    const [headerHeight, setHeaderHeight] = useState(0);
    const headerRef = useRef(null);
    const location = useLocation();

    useEffect(() => {
        setMobileSidebarOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return undefined;
        }

        const mediaQuery = window.matchMedia('(min-width: 640px)');
        const syncOffset = (matches) => {
            setNavbarOffset(matches ? 64 : 56);
        };
        const handleChange = (event) => syncOffset(event.matches);

        syncOffset(mediaQuery.matches);

        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        }

        mediaQuery.addListener(handleChange);
        return () => mediaQuery.removeListener(handleChange);
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined' || !headerRef.current) {
            return undefined;
        }

        const syncHeight = () => {
            setHeaderHeight(headerRef.current?.offsetHeight || 0);
        };

        syncHeight();

        if (typeof ResizeObserver !== 'function') {
            window.addEventListener('resize', syncHeight);
            return () => window.removeEventListener('resize', syncHeight);
        }

        const observer = new ResizeObserver(syncHeight);
        observer.observe(headerRef.current);
        return () => observer.disconnect();
    }, [sectionContextLabel, sectionLabel]);

    const drawerTopOffset = navbarOffset + headerHeight;

    return (
        <>
            <div
                className={`fixed inset-x-0 bottom-0 z-40 lg:hidden ${mobileSidebarOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
                style={{ top: `${drawerTopOffset}px` }}
                aria-hidden={!mobileSidebarOpen}
            >
                <div
                    className={`absolute inset-0 bg-slate-900/30 transition-opacity ${mobileSidebarOpen ? 'opacity-100' : 'opacity-0'}`}
                    onClick={() => setMobileSidebarOpen(false)}
                />
                <aside
                    className={`absolute inset-y-0 left-0 flex w-[86vw] max-w-[320px] flex-col gap-2 overflow-y-auto border-r border-slate-100 bg-white px-4 py-5 shadow-xl transition-transform ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
                >
                    <DashboardSidebar
                        isImpersonating={isImpersonating}
                        onLogout={onLogout}
                        onNavigate={() => setMobileSidebarOpen(false)}
                        user={user}
                    />
                </aside>
            </div>

            <div
                ref={headerRef}
                className="sticky z-20 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden"
                style={{ top: `${navbarOffset}px` }}
            >
                <div className="flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={() => setMobileSidebarOpen((open) => !open)}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm"
                        aria-label={mobileSidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
                        aria-expanded={mobileSidebarOpen}
                    >
                        <Menu size={20} />
                    </button>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold uppercase tracking-[0.12em] text-slate-400">{sectionContextLabel}</p>
                        <p className="truncate text-lg font-bold text-slate-900">{sectionLabel}</p>
                    </div>
                </div>
            </div>
        </>
    );
}

export default DashboardSidebar;
