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

    return (
        <div className={`rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <span>I am here</span>
                    {homeAvailable ? (
                        <button
                            type="button"
                            onClick={activateHome}
                            disabled={isResolvingHome}
                            aria-label={activeMode === 'home' ? 'Using Home' : 'Use Home'}
                            title={activeMode === 'home' ? 'Using Home' : 'Use Home'}
                            className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition ${
                                activeMode === 'home'
                                    ? 'border-brand-200 bg-brand-50 text-brand-700'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-brand-200 hover:text-brand-700'
                            } disabled:cursor-wait disabled:opacity-60`}
                        >
                            <Home size={17} />
                        </button>
                    ) : null}
                </div>

                <label className="min-w-0 flex-1">
                    <span className="sr-only">Set temporary location by postal code</span>
                    <div className="relative">
                        <MapPin size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={postalCodeInput}
                            onChange={(event) => setPostalCodeInput(event.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="Postal code"
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                        />
                    </div>
                </label>

                <button
                    type="submit"
                    disabled={isSettingTemporary || postalCodeInput.length !== 6}
                    aria-label="Set location"
                    title="Set location"
                    className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <MapPin size={16} />
                </button>

                {(activeMode === 'temporary' || activeMode === 'home') ? (
                    <button
                        type="button"
                        onClick={activeMode === 'temporary' ? clearTemporaryLocation : clearActiveAnchor}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-brand-200 hover:text-brand-700"
                    >
                        <X size={16} />
                        Clear
                    </button>
                ) : null}
            </form>

            {error ? (
                <p className="mt-2 text-sm font-medium text-red-600">{error}</p>
            ) : null}
        </div>
    );
}
