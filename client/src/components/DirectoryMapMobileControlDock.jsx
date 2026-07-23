import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Minus, Plus } from 'lucide-react';
import { useMap } from 'react-leaflet';

function readZoomState(map) {
    const zoom = Number(map?.getZoom?.());
    const minZoom = Number(map?.getMinZoom?.());
    const maxZoom = Number(map?.getMaxZoom?.());

    return {
        zoom,
        minZoom,
        maxZoom,
        canZoomOut: Number.isFinite(zoom) && Number.isFinite(minZoom)
            ? zoom > minZoom + 0.01
            : true,
        canZoomIn: Number.isFinite(zoom) && Number.isFinite(maxZoom)
            ? zoom < maxZoom - 0.01
            : true,
    };
}

export default function DirectoryMapMobileControlDock({
    target = null,
    settingsControl = null,
    showZoomControls = true,
}) {
    const map = useMap();
    const [zoomState, setZoomState] = useState(() => readZoomState(map));

    const syncZoomState = useCallback(() => {
        setZoomState(readZoomState(map));
    }, [map]);

    useEffect(() => {
        syncZoomState();
        map.on('zoom', syncZoomState);
        map.on('zoomend', syncZoomState);
        map.on('zoomlevelschange', syncZoomState);

        return () => {
            map.off('zoom', syncZoomState);
            map.off('zoomend', syncZoomState);
            map.off('zoomlevelschange', syncZoomState);
        };
    }, [map, syncZoomState]);

    if (!target || (!settingsControl && !showZoomControls)) return null;

    const roundedZoom = Math.round(zoomState.zoom);
    const zoomLabel = Number.isFinite(roundedZoom) ? String(roundedZoom) : '—';
    const controlButtonClassName = 'inline-flex h-12 w-12 shrink-0 touch-manipulation items-center justify-center rounded-xl border border-slate-200 bg-white p-0 text-slate-700 shadow-sm transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300';

    return createPortal(
        <div
            role="group"
            aria-label="Print map controls"
            className="pointer-events-auto inline-flex min-h-16 items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-lg backdrop-blur"
            data-print-mobile-map-controls="true"
        >
            {settingsControl}
            {settingsControl && showZoomControls ? (
                <span className="mx-0.5 h-8 w-px shrink-0 bg-slate-200" aria-hidden="true" />
            ) : null}
            {showZoomControls ? (
                <>
                    <button
                        type="button"
                        aria-label="Zoom out"
                        className={controlButtonClassName}
                        disabled={!zoomState.canZoomOut}
                        onClick={() => map.zoomOut()}
                    >
                        <Minus size={22} strokeWidth={2.5} aria-hidden="true" />
                    </button>
                    <output
                        aria-label={`Zoom level ${zoomLabel}`}
                        aria-live="polite"
                        className="flex h-12 min-w-12 select-none items-center justify-center rounded-xl bg-slate-100 px-2 text-base font-black tabular-nums text-slate-700"
                    >
                        {zoomLabel}
                    </output>
                    <button
                        type="button"
                        aria-label="Zoom in"
                        className={controlButtonClassName}
                        disabled={!zoomState.canZoomIn}
                        onClick={() => map.zoomIn()}
                    >
                        <Plus size={22} strokeWidth={2.5} aria-hidden="true" />
                    </button>
                </>
            ) : null}
        </div>,
        target,
    );
}
