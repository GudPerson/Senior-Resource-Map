import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { MapPin, X } from 'lucide-react';
import { api } from '../../lib/api.js';
import { canAccessAdmin, getRoleMeta, isStandardUserRole } from '../../lib/roles.js';
import { DashboardMobileNavigation, DashboardSidebar, getDashboardSectionLabel } from '../../components/dashboard/DashboardNavigation.jsx';

export default function DashboardPage() {
    const { user, login, logout, isImpersonating } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const roleMeta = getRoleMeta(user?.role);
    const [postalCode, setPostalCode] = useState(user?.postalCode || '');
    const [postalCodeError, setPostalCodeError] = useState('');
    const [postalCodeSaving, setPostalCodeSaving] = useState(false);
    const [postalPromptDismissed, setPostalPromptDismissed] = useState(false);
    const postalPromptDismissKey = user?.id ? `carearound:postal-prompt-dismissed:${user.id}` : null;
    const shouldPromptForPostalCode = isStandardUserRole(user?.role) && user?.needsPostalCode && !isImpersonating;
    const sectionLabel = useMemo(
        () => getDashboardSectionLabel(location.pathname),
        [location.pathname],
    );

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
            <aside className="hidden w-64 bg-white border-r border-slate-100 lg:flex flex-col py-6 px-4 gap-2 flex-shrink-0">
                <DashboardSidebar
                    isImpersonating={isImpersonating}
                    onLogout={handleLogout}
                    user={user}
                />
            </aside>

            {/* Main content */}
            <main className="flex-1 overflow-auto">
                <DashboardMobileNavigation
                    isImpersonating={isImpersonating}
                    onLogout={handleLogout}
                    sectionContextLabel="Dashboard"
                    sectionLabel={sectionLabel}
                    user={user}
                />
                {shouldPromptForPostalCode && !postalPromptDismissed ? (
                    <div className="border-b border-amber-200 bg-amber-50/80 px-6 py-4 lg:px-8">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="max-w-2xl">
                                <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                                    <MapPin size={16} />
                                    Add your postal code to finish setup
                                </div>
                                <p className="mt-1 text-sm text-amber-900/80">
                                    You can already browse public resources. Add your 6-digit postal code to see nearby resources and services available in your partner area.
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
