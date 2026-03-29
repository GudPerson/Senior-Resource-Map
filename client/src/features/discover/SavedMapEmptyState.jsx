import { useEffect, useState } from 'react';
import { Heart, MapPinned, MapPin, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext.jsx';
import { api } from '../../lib/api.js';

export function SavedMapEmptyState({
    encourageHomePostalCode = false,
    hasSavedAssets = false,
    isAuthenticated = false,
    onBrowse,
    unmappableCount = 0,
}) {
    const navigate = useNavigate();
    const { login, user } = useAuth();
    const [postalCode, setPostalCode] = useState(user?.postalCode || '');
    const [postalCodeError, setPostalCodeError] = useState('');
    const [postalCodeSaving, setPostalCodeSaving] = useState(false);
    const shouldShowPostalWizard = isAuthenticated && encourageHomePostalCode && !user?.postalCode;

    useEffect(() => {
        setPostalCode(user?.postalCode || '');
        setPostalCodeError('');
    }, [user?.postalCode]);

    const title = shouldShowPostalWizard
        ? 'Add your home postal code to activate this map'
        : !isAuthenticated
        ? 'Sign in to build your saved map'
        : hasSavedAssets
            ? 'No saved places to map yet'
            : 'Save assets to pin them here';

    const description = shouldShowPostalWizard
        ? 'We can centre the map around Home even before you save places, and use it to personalize nearby results across the app.'
        : !isAuthenticated
        ? 'Once you sign in and save useful resources, your personal discovery map will appear here.'
        : hasSavedAssets
            ? unmappableCount > 0
                ? `${unmappableCount} saved ${unmappableCount === 1 ? 'asset has' : 'assets have'} no usable map location right now. Keep browsing and save places with valid coordinates to see them pinned here.`
                : 'Keep browsing and save places or offerings to see them pinned here.'
            : 'Your discovery map only shows places represented by assets you have saved.';

    async function handleSavePostalCode(event) {
        event.preventDefault();
        const normalized = postalCode.replace(/\D/g, '').slice(0, 6);
        if (normalized.length !== 6) {
            setPostalCodeError('Enter a valid 6-digit postal code.');
            return;
        }

        setPostalCodeSaving(true);
        setPostalCodeError('');

        try {
            const updatedUser = await api.updateMe({ postalCode: normalized });
            login(updatedUser);
        } catch (error) {
            setPostalCodeError(error.message || 'Failed to save your postal code.');
        } finally {
            setPostalCodeSaving(false);
        }
    }

    return (
        <div className="flex h-full items-center justify-center p-4 sm:p-6">
            <div
                className="w-full max-w-md rounded-[28px] border px-6 py-10 text-center shadow-sm"
                style={{
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(239,250,248,0.94) 100%)',
                    borderColor: 'var(--color-border)',
                }}
            >
                <div
                    className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand-strong)' }}
                >
                    {hasSavedAssets ? <MapPinned size={28} /> : <Heart size={28} />}
                </div>
                <h2 className="mt-5 text-xl font-extrabold" style={{ color: 'var(--color-text)' }}>
                    {title}
                </h2>
                <p className="mt-2 text-sm leading-7" style={{ color: 'var(--color-text-secondary)' }}>
                    {description}
                </p>
                {shouldShowPostalWizard ? (
                    <form onSubmit={handleSavePostalCode} className="mt-5 space-y-3 text-left">
                        <label className="block">
                            <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--color-text-muted)' }}>
                                Home postal code
                            </span>
                            <div className="relative">
                                <MapPin size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    value={postalCode}
                                    onChange={(event) => setPostalCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder="680153"
                                    autoComplete="postal-code"
                                    className="w-full rounded-2xl border bg-white py-3 pl-11 pr-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                                    style={{ borderColor: 'var(--color-border)' }}
                                />
                            </div>
                        </label>
                        {postalCodeError ? (
                            <p className="text-xs font-medium text-red-600">{postalCodeError}</p>
                        ) : (
                            <p className="text-xs leading-5" style={{ color: 'var(--color-text-muted)' }}>
                                We’ll save this to your profile and use it as your Home fallback across the app.
                            </p>
                        )}
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <button type="submit" disabled={postalCodeSaving} className="btn-primary min-w-[170px] justify-center disabled:opacity-60">
                                {postalCodeSaving ? 'Saving…' : 'Save home postal code'}
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate('/dashboard/profile')}
                                className="btn-ghost min-w-[140px] justify-center"
                            >
                                <UserRound size={16} />
                                Open profile
                            </button>
                        </div>
                    </form>
                ) : null}
                {onBrowse ? (
                    <button type="button" onClick={onBrowse} className="btn-primary mt-6 inline-flex justify-center">
                        Browse directory
                    </button>
                ) : null}
            </div>
        </div>
    );
}

export default SavedMapEmptyState;
