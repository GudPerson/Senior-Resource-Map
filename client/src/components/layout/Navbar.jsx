import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogIn, LogOut, Sun, Moon, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useA11y } from '../../contexts/A11yContext.jsx';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';
import MobileBottomSheet from '../mobile/MobileBottomSheet.jsx';
import BrandLockup from './BrandLockup.jsx';

function joinClasses(...parts) {
    return parts.filter(Boolean).join(' ');
}

export default function Navbar() {
    const { user, isAuth, isImpersonating, logout } = useAuth();
    const { highContrast, toggleHighContrast, canIncreaseZoom, increaseZoom, decreaseZoom } = useA11y();
    const { locale, locales, setLocale, t } = useLocale();
    const location = useLocation();
    const navigate = useNavigate();
    const isMobile = useMediaQuery('(max-width: 639px)');
    const [mobileA11yOpen, setMobileA11yOpen] = useState(false);

    const accountLabel = user?.name?.split(' ')[0] || 'Account';
    const dashboardButtonActive = location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/my-directory');

    async function handleLogout() {
        const impersonationExit = isImpersonating;
        await logout();
        navigate(impersonationExit ? '/dashboard' : '/');
    }

    return (
        <>
            <nav
                className="hc-nav sticky top-0 z-50 shadow-sm disable-font-scaling navbar-static-scale"
                style={{
                    backgroundColor: 'var(--color-nav-bg)',
                    borderBottom: '1px solid var(--color-border)',
                }}
            >
                <div className="navbar-shell w-full px-4 sm:px-6 lg:px-8">
                    <div className="navbar-row flex items-center justify-between h-[56px] sm:h-[64px] gap-2">

                        {/* Logo */}
                        <Link to="/" className="flex items-center gap-2 flex-shrink-0 min-w-0">
                            <BrandLockup compact className="min-w-0" />
                        </Link>

                        {/* Right controls */}
                        <div className="navbar-controls flex items-center gap-1.5 sm:gap-2">


                            <label className="sr-only" htmlFor="locale-select">{t('language')}</label>
                            <select
                                id="locale-select"
                                value={locale}
                                onChange={(event) => setLocale(event.target.value)}
                                className="min-h-[40px] max-w-[88px] rounded-xl border bg-white px-2 py-2 text-xs font-bold text-slate-700 shadow-sm sm:min-h-[44px] sm:max-w-[132px] sm:px-3"
                                style={{ borderColor: 'var(--color-border)' }}
                                title={t('language')}
                            >
                                {locales.map((item) => (
                                    <option key={item.code} value={item.code}>
                                        {isMobile ? item.shortLabel : item.label}
                                    </option>
                                ))}
                            </select>

                            {isMobile ? (
                                <button
                                    type="button"
                                    onClick={() => setMobileA11yOpen(true)}
                                    className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border px-2.5 py-2 text-xs font-bold transition-all"
                                    style={{
                                        backgroundColor: highContrast ? 'var(--color-brand-strong)' : 'var(--color-badge-bg)',
                                        color: highContrast ? 'var(--color-surface)' : 'var(--color-text-secondary)',
                                        borderColor: highContrast ? 'var(--color-brand-strong)' : 'var(--color-border)',
                                    }}
                                    aria-label="Open accessibility controls"
                                    aria-expanded={mobileA11yOpen}
                                >
                                    {highContrast ? <Moon size={16} /> : <Sun size={16} />}
                                </button>
                            ) : (
                                <>
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
                                        <span className="hidden sm:inline">{highContrast ? t('normal') : t('contrast')}</span>
                                    </button>

                                    <div className="navbar-zoom-group flex items-center rounded-xl" style={{ backgroundColor: 'var(--color-badge-bg)', border: '1px solid var(--color-border)' }}>
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
                                        <div className="w-px h-5" style={{ backgroundColor: 'var(--color-border)' }}></div>
                                        <button
                                            id="increase-zoom"
                                            onClick={increaseZoom}
                                            disabled={!canIncreaseZoom}
                                            title="Increase Zoom"
                                            aria-label="Increase Zoom"
                                            className="flex items-center justify-center px-2.5 py-2 transition-all min-h-[40px] min-w-[36px] sm:min-h-[44px] sm:min-w-[44px] rounded-r-xl font-bold text-xs disabled:cursor-not-allowed disabled:opacity-45"
                                            style={{ color: 'var(--color-text-secondary)' }}
                                        >
                                            A+
                                        </button>
                                    </div>
                                </>
                            )}

                            {/* Auth */}
                            {isAuth ? (
                                <div className="navbar-auth-controls flex items-center gap-1.5">
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
                                    <button
                                        type="button"
                                        onClick={() => navigate('/dashboard', { replace: false })}
                                        id="nav-account"
                                        title={accountLabel}
                                        aria-label={accountLabel}
                                        className={joinClasses(
                                            'navbar-auth-button btn-ghost text-xs sm:text-sm px-2.5 py-2 flex',
                                            dashboardButtonActive ? 'border border-brand-200 bg-brand-50 text-brand-700' : ''
                                        )}
                                    >
                                        <User size={16} />
                                        <span className="hidden md:inline">{accountLabel}</span>
                                    </button>
                                    <button
                                        id="nav-logout"
                                        onClick={handleLogout}
                                        className="navbar-auth-button btn-ghost text-xs sm:text-sm px-2.5 py-2"
                                    >
                                        <LogOut size={16} />
                                        <span className="hidden sm:inline">{isImpersonating ? 'Exit User View' : t('logout')}</span>
                                    </button>
                                </div>
                            ) : (
                                <Link
                                    to="/login"
                                    id="nav-login"
                                    className="navbar-auth-button btn-primary text-xs sm:text-sm px-3 sm:px-4 py-2"
                                >
                                    <LogIn size={16} />
                                    <span className="hidden sm:inline">{t('login')}</span>
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            </nav>

            <MobileBottomSheet
                open={isMobile && mobileA11yOpen}
                onOpenChange={setMobileA11yOpen}
                title="Accessibility"
                description="Adjust display contrast and text scaling without crowding the mobile header."
                headerActions={(
                    <button type="button" onClick={() => setMobileA11yOpen(false)} className="btn-ghost px-3 py-2 text-[13px] leading-none whitespace-nowrap">
                        Done
                    </button>
                )}
            >
                <div className="space-y-3 pb-2">
                    <button
                        id="toggle-high-contrast-mobile"
                        type="button"
                        onClick={toggleHighContrast}
                        aria-pressed={highContrast}
                        className="flex min-h-[56px] w-full items-center justify-between rounded-[22px] border px-4 py-3 text-left"
                        style={{
                            backgroundColor: highContrast ? 'var(--color-brand-light)' : 'rgba(255,255,255,0.92)',
                            borderColor: highContrast ? 'var(--color-brand)' : 'var(--color-border)',
                            color: 'var(--color-text)',
                        }}
                    >
                        <div>
                            <p className="text-[15px] font-bold leading-tight">
                                {highContrast ? 'Return to normal contrast' : 'Turn on high contrast'}
                            </p>
                            <p className="mt-1 text-[12px] leading-5" style={{ color: 'var(--color-text-secondary)' }}>
                                Improve readability across maps, cards, and page surfaces.
                            </p>
                        </div>
                        {highContrast ? <Moon size={18} /> : <Sun size={18} />}
                    </button>

                    <div className="rounded-[22px] border px-4 py-4" style={{ borderColor: 'var(--color-border)', backgroundColor: 'rgba(255,255,255,0.92)' }}>
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-[15px] font-bold leading-tight" style={{ color: 'var(--color-text)' }}>
                                    Text size
                                </p>
                                <p className="mt-1 text-[12px] leading-5" style={{ color: 'var(--color-text-secondary)' }}>
                                    Increase or reduce type size across the app.
                                </p>
                            </div>
                            <div className="inline-flex items-center rounded-2xl" style={{ backgroundColor: 'var(--color-badge-bg)', border: '1px solid var(--color-border)' }}>
                                <button
                                    type="button"
                                    onClick={decreaseZoom}
                                    className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-l-2xl px-3 text-sm font-bold"
                                    style={{ color: 'var(--color-text-secondary)' }}
                                    aria-label="Decrease text size"
                                >
                                    A-
                                </button>
                                <div className="h-5 w-px" style={{ backgroundColor: 'var(--color-border)' }} />
                                <button
                                    type="button"
                                    onClick={increaseZoom}
                                    disabled={!canIncreaseZoom}
                                    className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-r-2xl px-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-45"
                                    style={{ color: 'var(--color-text-secondary)' }}
                                    aria-label="Increase text size"
                                >
                                    A+
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </MobileBottomSheet>
        </>
    );
}
