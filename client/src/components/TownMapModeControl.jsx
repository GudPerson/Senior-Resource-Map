import { useEffect, useState } from 'react';

export default function TownMapModeControl({
    mode = 'live',
    townAvailable = false,
    statusMessage = '',
    compactStatusMessage = statusMessage,
    townUnavailableMessage = '',
    townUnavailableCompactMessage = townUnavailableMessage,
    onModeChange,
    onUnavailableTownSelect,
    retryLabel = '',
    onRetry = null,
    variant = 'overlay',
}) {
    const [showTownUnavailableMessage, setShowTownUnavailableMessage] = useState(false);
    const isPanel = variant === 'panel';

    useEffect(() => {
        if (townAvailable || !townUnavailableMessage) {
            setShowTownUnavailableMessage(false);
        }
    }, [townAvailable, townUnavailableMessage]);

    const handleLiveSelect = () => {
        setShowTownUnavailableMessage(false);
        onModeChange?.('live');
    };

    const handleTownSelect = () => {
        if (!townAvailable) {
            setShowTownUnavailableMessage(Boolean(townUnavailableMessage));
            onUnavailableTownSelect?.();
            return;
        }
        setShowTownUnavailableMessage(false);
        onModeChange?.('town');
    };

    const visibleStatusMessage = showTownUnavailableMessage
        ? townUnavailableMessage
        : statusMessage;
    const visibleCompactStatusMessage = showTownUnavailableMessage
        ? townUnavailableCompactMessage
        : compactStatusMessage;
    const wrapperClassName = isPanel
        ? 'pointer-events-auto flex w-full flex-col items-start gap-2'
        : 'pointer-events-auto flex w-max max-w-full flex-nowrap items-center justify-center gap-1.5';
    const groupClassName = isPanel
        ? 'inline-flex w-full rounded-2xl border border-slate-200 bg-slate-50 p-1'
        : 'inline-flex w-max shrink-0 flex-nowrap rounded-full border border-slate-200 bg-white/95 p-0.5 shadow-md backdrop-blur';
    const optionClassName = isPanel
        ? 'flex-1 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-bold leading-5 transition'
        : 'shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold leading-4 transition sm:px-3 sm:text-xs';

    return (
        <div
            data-town-map-mode-control="true"
            className={wrapperClassName}
        >
            <div
                role="group"
                aria-label="Map detail"
                className={groupClassName}
            >
                <button
                    type="button"
                    aria-pressed={mode === 'live'}
                    onClick={handleLiveSelect}
                    className={`${optionClassName} ${
                        mode === 'live'
                            ? 'bg-brand-700 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    Standard
                </button>
                <button
                    type="button"
                    aria-pressed={mode === 'town'}
                    aria-disabled={!townAvailable}
                    onClick={handleTownSelect}
                    className={`${optionClassName} ${
                        mode === 'town'
                            ? 'bg-brand-700 text-white shadow-sm'
                            : townAvailable
                                ? 'text-slate-600 hover:bg-slate-100'
                                : 'cursor-help text-slate-400 hover:bg-slate-100'
                    }`}
                >
                    Detailed
                </button>
            </div>
            {visibleStatusMessage ? (
                <p
                    role="status"
                    aria-live="polite"
                    className={isPanel
                        ? 'w-full whitespace-normal rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-medium leading-5 text-slate-600'
                        : 'shrink-0 whitespace-nowrap rounded-full border border-slate-200 bg-white/95 px-2 py-1 text-center text-[10px] font-medium leading-4 text-slate-600 shadow-sm backdrop-blur sm:text-[11px]'}
                >
                    {isPanel ? visibleStatusMessage : (
                        <>
                            <span className="sm:hidden">{visibleCompactStatusMessage}</span>
                            <span className="hidden sm:inline">{visibleStatusMessage}</span>
                        </>
                    )}
                </p>
            ) : null}
            {retryLabel && onRetry ? (
                <button
                    type="button"
                    onClick={onRetry}
                    className={isPanel
                        ? 'inline-flex min-h-10 items-center justify-center rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm font-bold text-brand-700 shadow-sm transition hover:border-brand-300 hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2'
                        : 'inline-flex shrink-0 items-center justify-center rounded-full border border-brand-200 bg-white/95 px-2.5 py-1 text-[11px] font-bold text-brand-700 shadow-sm transition hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2'}
                >
                    {retryLabel}
                </button>
            ) : null}
        </div>
    );
}
