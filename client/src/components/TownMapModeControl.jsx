import { useEffect, useState } from 'react';

export default function TownMapModeControl({
    mode = 'live',
    townAvailable = false,
    statusMessage = '',
    compactStatusMessage = statusMessage,
    townUnavailableMessage = '',
    townUnavailableCompactMessage = townUnavailableMessage,
    onModeChange,
}) {
    const [showTownUnavailableMessage, setShowTownUnavailableMessage] = useState(false);

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

    return (
        <div
            data-town-map-mode-control="true"
            className="pointer-events-auto flex w-max max-w-full flex-nowrap items-center justify-center gap-1.5"
        >
            <div
                role="group"
                aria-label="Map style"
                className="inline-flex w-max shrink-0 flex-nowrap rounded-full border border-slate-200 bg-white/95 p-0.5 shadow-md backdrop-blur"
            >
                <button
                    type="button"
                    aria-pressed={mode === 'live'}
                    onClick={handleLiveSelect}
                    className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold leading-4 transition sm:px-3 sm:text-xs ${
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
                    className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold leading-4 transition sm:px-3 sm:text-xs ${
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
                    className="shrink-0 whitespace-nowrap rounded-full border border-slate-200 bg-white/95 px-2 py-1 text-center text-[10px] font-medium leading-4 text-slate-600 shadow-sm backdrop-blur sm:text-[11px]"
                >
                    <span className="sm:hidden">{visibleCompactStatusMessage}</span>
                    <span className="hidden sm:inline">{visibleStatusMessage}</span>
                </p>
            ) : null}
        </div>
    );
}
