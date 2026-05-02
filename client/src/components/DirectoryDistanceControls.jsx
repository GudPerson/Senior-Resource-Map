import { useState } from 'react';
import { Home, MapPin, X } from 'lucide-react';

export default function DirectoryDistanceControls({
    anchorState,
    compact = false,
    compactLayout = 'inline',
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
    const canSetTemporaryLocation = postalCodeInput.length === 6 && !isSettingTemporary;
    const setLocationHint = postalCodeInput.length === 6
        ? 'Set postal-code location'
        : 'Enter a 6-digit postal code first';
    const activeLocationLabel = activeMode === 'home'
        ? 'Using home'
        : activeMode === 'temporary'
            ? 'Using set location'
            : 'Distance from';

    async function handleSubmit(event) {
        event.preventDefault();
        const success = await setTemporaryLocation(postalCodeInput);
        if (success) {
            setPostalCodeInput('');
        }
    }

    const homeButton = homeAvailable ? (
        <button
            type="button"
            onClick={activateHome}
            disabled={isResolvingHome}
            aria-label={activeMode === 'home' ? 'Using Home' : 'Use Home'}
            title={activeMode === 'home' ? 'Using Home' : 'Use Home'}
            className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl border transition ${
                activeMode === 'home'
                    ? 'border-brand-200 bg-brand-50 text-brand-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-brand-200 hover:text-brand-700'
            } disabled:cursor-wait disabled:opacity-60`}
        >
            <Home size={17} />
        </button>
    ) : null;

    const clearButton = (activeMode === 'temporary' || activeMode === 'home') ? (
        <button
            type="button"
            onClick={activeMode === 'temporary' ? clearTemporaryLocation : clearActiveAnchor}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-brand-200 hover:text-brand-700"
        >
            <X size={16} />
            Clear
        </button>
    ) : null;

    const locationInput = (
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
                    placeholder="Enter postal code"
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                />
            </div>
        </label>
    );

    const locateButton = (
        <button
            type="submit"
            disabled={!canSetTemporaryLocation}
            aria-label={setLocationHint}
            title={setLocationHint}
            className="inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
            <MapPin size={16} />
        </button>
    );

    const form = compact && compactLayout === 'stacked' ? (
        <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <span>{activeLocationLabel}</span>
                    {homeButton}
                </div>
                {clearButton ? <div className="flex-shrink-0">{clearButton}</div> : null}
            </div>

            <div className="flex items-center gap-2">
                {locationInput}
                {locateButton}
            </div>
            <p className="text-xs leading-5 text-slate-500">
                Enter a postal code to compare distances from another location.
            </p>
        </form>
    ) : (
        <form onSubmit={handleSubmit} className={`flex gap-3 ${compact ? 'flex-wrap items-center xl:flex-nowrap' : 'flex-col lg:flex-row lg:items-center'}`}>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <span>{activeLocationLabel}</span>
                {homeButton}
            </div>

            {locationInput}
            {locateButton}
            {clearButton}
        </form>
    );

    if (compact) {
        return (
            <div className={className}>
                {form}
                {error ? (
                    <p className="mt-2 text-sm font-medium text-red-600">{error}</p>
                ) : null}
            </div>
        );
    }

    return (
        <div className={`rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
            {form}
            {error ? (
                <p className="mt-2 text-sm font-medium text-red-600">{error}</p>
            ) : null}
        </div>
    );
}
