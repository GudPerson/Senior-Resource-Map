import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { LayoutDashboard, BookOpen, User, Shield, LogOut, Activity, Map, MapPin, X } from 'lucide-react';
import { api } from '../../lib/api.js';
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
    const { user, login, logout, isImpersonating } = useAuth();
    const navigate = useNavigate();
    const roleMeta = getRoleMeta(user?.role);
    const [postalCode, setPostalCode] = useState(user?.postalCode || '');
    const [postalCodeError, setPostalCodeError] = useState('');
    const [postalCodeSaving, setPostalCodeSaving] = useState(false);
    const [postalPromptDismissed, setPostalPromptDismissed] = useState(false);
    const postalPromptDismissKey = user?.id ? `carearound:postal-prompt-dismissed:${user.id}` : null;
    const shouldPromptForPostalCode = isStandardUserRole(user?.role) && user?.needsPostalCode && !isImpersonating;
    const resourcesPath = isStandardUserRole(user?.role) ? '/my-directory' : '/dashboard/resources';

    useEffect(() => {
        setPostalCode(user?.postalCode || '');
        setPostalCodeError('');
    }, [user?.id, user?.postalCode]);

    useEffect(() => {
        if (typeof window === 'undefined' || !postalPromptDismissKey) {
            setPostalPromptDismissed(false);
            return;
        }

        if (!shouldPromptForPostalCode) {
            window.sessionStorage.removeItem(postalPromptDismissKey);
            setPostalPromptDismissed(false);
            return;
        }

        setPostalPromptDismissed(window.sessionStorage.getItem(postalPromptDismissKey) === '1');
    }, [postalPromptDismissKey, shouldPromptForPostalCode]);

    async function handleLogout() {
        const impersonationExit = isImpersonating;
        await logout();
        navigate(impersonationExit ? '/dashboard' : '/');
    }

    function dismissPostalPrompt() {
        if (typeof window !== 'undefined' && postalPromptDismissKey) {
            window.sessionStorage.setItem(postalPromptDismissKey, '1');
        }
        setPostalPromptDismissed(true);
        setPostalCodeError('');
    }

    async function handlePostalCodeSubmit(e) {
        e.preventDefault();
        if (!postalCode.trim()) {
            setPostalCodeError('Enter a valid 6-digit postal code, or skip for now.');
            return;
        }

        setPostalCodeSaving(true);
        setPostalCodeError('');
        try {
            const updatedUser = await api.updateMe({ postalCode });
            login(updatedUser);
            if (typeof window !== 'undefined' && postalPromptDismissKey) {
                window.sessionStorage.removeItem(postalPromptDismissKey);
            }
            setPostalPromptDismissed(false);
        } catch (err) {
            setPostalCodeError(err.message || 'Failed to save your postal code.');
        } finally {
            setPostalCodeSaving(false);
        }
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
                <SidebarLink to={resourcesPath} icon={BookOpen} label={isStandardUserRole(user?.role) ? 'Saved Assets' : 'My Resources'} id="dash-resources" />
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
                {shouldPromptForPostalCode && !postalPromptDismissed ? (
                    <div className="border-b border-amber-200 bg-amber-50/80 px-6 py-4 lg:px-8">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="max-w-2xl">
                                <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                                    <MapPin size={16} />
                                    Add your postal code to finish setup
                                </div>
                                <p className="mt-1 text-sm text-amber-900/80">
                                    You can already browse public resources. Add your 6-digit postal code to personalize nearby results and unlock any partner-boundary offerings you qualify for.
                                </p>
                            </div>

                            <form onSubmit={handlePostalCodeSubmit} className="flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:items-start">
                                <div className="min-w-0 flex-1">
                                    <input
                                        type="text"
                                        value={postalCode}
                                        onChange={(e) => setPostalCode(e.target.value)}
                                        placeholder="680153"
                                        autoComplete="postal-code"
                                        className="input-field w-full border-amber-200 bg-white"
                                    />
                                    {postalCodeError ? (
                                        <p className="mt-2 text-xs font-medium text-red-700">{postalCodeError}</p>
                                    ) : (
                                        <p className="mt-2 text-xs text-amber-900/70">You can also add or update this later in your profile.</p>
                                    )}
                                </div>
                                <button type="submit" disabled={postalCodeSaving} className="btn-primary min-w-[140px] justify-center disabled:opacity-60">
                                    {postalCodeSaving ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Save postal code'}
                                </button>
                                <button type="button" onClick={dismissPostalPrompt} className="btn-ghost min-w-[120px] justify-center whitespace-nowrap">
                                    <X size={16} /> Skip for now
                                </button>
                            </form>
                        </div>
                    </div>
                ) : null}
                <Outlet />
            </main>
        </div>
    );
}
