import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { LayoutDashboard, BookOpen, User, Shield, LogOut, Activity, Map } from 'lucide-react';
import { canAccessAdmin, getRoleMeta, isStandardUserRole } from '../../lib/roles.js';

function SidebarLink({ to, icon: Icon, label, id }) {
    return (
        <NavLink
            id={id}
            to={to}
            end
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

export default function DashboardPage() {
    const { user, logout, isImpersonating } = useAuth();
    const navigate = useNavigate();
    const roleMeta = getRoleMeta(user?.role);

    async function handleLogout() {
        const impersonationExit = isImpersonating;
        await logout();
        navigate(impersonationExit ? '/dashboard' : '/');
    }

    return (
        <div className="flex min-h-[calc(100vh-4rem)] bg-slate-50">
            {/* Sidebar */}
            <aside className=" w-64 bg-white border-r border-slate-100 flex flex-col py-6 px-4 gap-2 flex-shrink-0">
                {/* User info */}
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

                <SidebarLink to="/discover" icon={Map} label="Discovery Map" id="dash-discover" />
                <SidebarLink to="/dashboard" icon={LayoutDashboard} label="Overview" id="dash-overview" />
                <SidebarLink to="/dashboard/resources" icon={BookOpen} label={isStandardUserRole(user?.role) ? 'My Favorites' : 'My Resources'} id="dash-resources" />
                <SidebarLink to="/dashboard/profile" icon={User} label="Profile" id="dash-profile" />
                {canAccessAdmin(user?.role) && (
                    <SidebarLink to="/dashboard/admin" icon={Shield} label="Admin" id="dash-admin" />
                )}

                <div className="mt-auto">
                    <button
                        id="dash-logout"
                        onClick={handleLogout}
                        className=" w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all text-base font-semibold min-h-[44px]"
                    >
                        <LogOut size={20} /> {isImpersonating ? 'Exit User View' : 'Logout'}
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 overflow-auto">
                <Outlet />
            </main>
        </div>
    );
}
