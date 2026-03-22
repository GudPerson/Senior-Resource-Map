import { useState } from 'react';
import { Home, MapPin, X } from 'lucide-react';

export default function DirectoryDistanceControls({
    anchorState,
    className = '',
}) {
    const {
        activeAnchor,
        activeMode,
        userPostalCode,
        homeAvailable,
        error,
        isResolvingHome,
        isSettingTemporary,
        activateHome,
        setTemporaryLocation,
        clearTemporaryLocation,
        clearActiveAnchor,
    } = anchorState;
    const [postalCodeInput, setPostalCodeInput] = useState('');

    async function handleSubmit(event) {
        event.preventDefault();
        const success = await setTemporaryLocation(postalCodeInput);
        if (success) {
            setPostalCodeInput('');
        }
    }

    const summaryLabel = activeMode === 'temporary'
        ? 'Using temporary location'
        : activeMode === 'home'
            ? 'From Home'
            : 'No distance anchor';

    return (
        <div className={`rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">Distance context</p>
                    <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-900">{summaryLabel}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                        {activeAnchor?.address
                            ? activeAnchor.address
                            : homeAvailable
                                ? `Home uses saved postal code ${userPostalCode}.`
                                : 'Set a temporary postal code to show place-level distance pills.'}
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    {homeAvailable ? (
                        <button
                            type="button"
                            onClick={activateHome}
                            disabled={isResolvingHome}
                            className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition ${
                                activeMode === 'home'
                                    ? 'border-brand-200 bg-brand-50 text-brand-700'
                                    : 'border-slate-200 bg-white text-slate-700 hover:border-brand-200 hover:text-brand-700'
                            } disabled:cursor-wait disabled:opacity-60`}
                        >
                            <Home size={16} />
                            {isResolvingHome ? 'Locating Home…' : 'Use Home'}
                        </button>
                    ) : null}

                    {activeMode === 'temporary' ? (
                        <button
                            type="button"
                            onClick={clearTemporaryLocation}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-brand-200 hover:text-brand-700"
                        >
                            <X size={16} />
                            {homeAvailable ? 'Clear to Home' : 'Clear'}
                        </button>
                    ) : activeMode === 'home' ? (
                        <button
                            type="button"
                            onClick={clearActiveAnchor}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-brand-200 hover:text-brand-700"
                        >
                            <X size={16} />
                            Hide distances
                        </button>
                    ) : null}
                </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3 sm:flex-row">
                <label className="flex-1">
                    <span className="sr-only">Set temporary location by postal code</span>
                    <div className="relative">
                        <MapPin size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={postalCodeInput}
                            onChange={(event) => setPostalCodeInput(event.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="Set Location by postal code"
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                        />
                    </div>
                </label>

                <button
                    type="submit"
                    disabled={isSettingTemporary || postalCodeInput.length !== 6}
                    className="btn-primary justify-center disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <MapPin size={16} />
                    {isSettingTemporary ? 'Setting…' : 'Set Location'}
                </button>
            </form>

            {!homeAvailable ? (
                <p className="mt-3 text-xs font-medium text-slate-400">
                    Home uses the saved postal code on your profile. Set Location is temporary and session-based.
                </p>
            ) : null}

            {error ? (
                <p className="mt-3 text-sm font-medium text-red-600">{error}</p>
            ) : null}
        </div>
    );
}

