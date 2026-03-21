import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogIn, LogOut, Sun, Moon, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useA11y } from '../../contexts/A11yContext.jsx';
import BrandLockup from './BrandLockup.jsx';

function joinClasses(...parts) {
    return parts.filter(Boolean).join(' ');
}

export default function Navbar() {
    const { user, isAuth, isImpersonating, logout } = useAuth();
    const { highContrast, toggleHighContrast, canIncreaseZoom, increaseZoom, decreaseZoom } = useA11y();
    const location = useLocation();
    const navigate = useNavigate();

    const isActive = (path) => location.pathname === path;
    const accountLabel = user?.name?.split(' ')[0] || 'Account';
    const dashboardButtonActive = location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/my-directory');

    async function handleLogout() {
        const impersonationExit = isImpersonating;
        await logout();
        navigate(impersonationExit ? '/dashboard' : '/');
    }

    return (
        <nav
            className="hc-nav sticky top-0 z-50 shadow-sm"
            style={{
                backgroundColor: 'var(--color-nav-bg)',
                borderBottom: '1px solid var(--color-border)',
            }}
        >
            <div className="w-full px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-[56px] sm:h-[64px] gap-2">

                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-2 flex-shrink-0 min-w-0">
                        <BrandLockup compact className="min-w-0" />
                    </Link>

                    {/* Right controls */}
                    <div className="flex items-center gap-1.5 sm:gap-2">

                        {/* Accessibility toggles */}
                        <button
                            id="toggle-high-contrast"
                            onClick={toggleHighContrast}
                            title="Toggle High Contrast"
                            aria-pressed={highContrast}
                            className="flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-bold transition-all min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px]"
                            style={{
                                backgroundColor: highContrast ? 'var(--color-brand-strong)' : 'var(--color-badge-bg)',
                                color: highContrast ? 'var(--color-surface)' : 'var(--color-text-secondary)',
                                border: `1px solid ${highContrast ? 'var(--color-brand-strong)' : 'var(--color-border)'}`,
                            }}
                        >
                            {highContrast ? <Moon size={15} /> : <Sun size={15} />}
                            <span className="hidden sm:inline">{highContrast ? 'Normal' : 'Contrast'}</span>
                        </button>

                        <div className="flex items-center rounded-xl" style={{ backgroundColor: 'var(--color-badge-bg)', border: '1px solid var(--color-border)' }}>
                            <button
                                id="decrease-zoom"
                                onClick={decreaseZoom}
                                title="Decrease Zoom"
                                aria-label="Decrease Zoom"
                                className="flex items-center justify-center px-2.5 py-2 transition-all min-h-[40px] min-w-[36px] sm:min-h-[44px] sm:min-w-[44px] rounded-l-xl font-bold text-xs"
                                style={{ color: 'var(--color-text-secondary)' }}
                            >
                                A-
                            </button>
                            {canIncreaseZoom ? (
                                <>
                                    <div className="w-px h-5" style={{ backgroundColor: 'var(--color-border)' }}></div>
                                    <button
                                        id="increase-zoom"
                                        onClick={increaseZoom}
                                        title="Increase Zoom"
                                        aria-label="Increase Zoom"
                                        className="flex items-center justify-center px-2.5 py-2 transition-all min-h-[40px] min-w-[36px] sm:min-h-[44px] sm:min-w-[44px] rounded-r-xl font-bold text-xs"
                                        style={{ color: 'var(--color-text-secondary)' }}
                                    >
                                        A+
                                    </button>
                                </>
                            ) : null}
                        </div>

                        {/* Auth */}
                        {isAuth ? (
                            <div className="flex items-center gap-1.5">
                                {isImpersonating ? (
                                    <div
                                        className="hidden lg:flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold"
                                        style={{
                                            backgroundColor: 'rgba(14, 165, 164, 0.1)',
                                            border: '1px solid rgba(14, 165, 164, 0.2)',
                                            color: 'var(--color-brand-strong)',
                                        }}
                                    >
                                        <span>Viewing as {user?.name}</span>
                                        {user?.impersonatedBy?.name ? (
                                            <span className="opacity-70">via {user.impersonatedBy.name}</span>
                                        ) : null}
                                    </div>
                                ) : null}
                                <Link
                                    to="/dashboard"
                                    id="nav-account"
                                    title={accountLabel}
                                    aria-label={accountLabel}
                                    className={joinClasses(
                                        'btn-ghost text-xs sm:text-sm px-2.5 py-2 flex',
                                        dashboardButtonActive ? 'border border-brand-200 bg-brand-50 text-brand-700' : ''
                                    )}
                                >
                                    <User size={16} />
                                    <span className="hidden md:inline">{accountLabel}</span>
                                </Link>
                                <button
                                    id="nav-logout"
                                    onClick={handleLogout}
                                    className="btn-ghost text-xs sm:text-sm px-2.5 py-2"
                                >
                                    <LogOut size={16} />
                                    <span className="hidden sm:inline">{isImpersonating ? 'Exit User View' : 'Logout'}</span>
                                </button>
                            </div>
                        ) : (
                            <Link
                                to="/login"
                                id="nav-login"
                                className="btn-primary text-xs sm:text-sm px-3 sm:px-4 py-2"
                            >
                                <LogIn size={16} />
                                <span className="hidden sm:inline">Login</span>
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
}
