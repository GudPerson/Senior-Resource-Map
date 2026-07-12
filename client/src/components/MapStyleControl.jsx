import { useMapStyle } from '../contexts/MapStyleContext.jsx';
import {
    CAREAROUND_MAP_STYLE_DEFAULT,
    CAREAROUND_MAP_STYLE_GRAY,
} from '../lib/mapTheme.js';

export default function MapStyleControl({ className = '', variant = 'overlay' }) {
    const { mapStyle, setMapStyle } = useMapStyle();
    const isPanel = variant === 'panel';
    const groupClassName = isPanel
        ? 'pointer-events-auto inline-flex w-full rounded-2xl border border-slate-200 bg-slate-50 p-1'
        : 'pointer-events-auto inline-flex w-max shrink-0 rounded-full border border-slate-200 bg-white/95 p-0.5 shadow-md backdrop-blur';
    const optionClassName = isPanel
        ? 'flex-1 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-bold leading-5 transition'
        : 'shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold leading-4 transition sm:px-3 sm:text-xs';

    return (
        <div
            data-map-style-control="true"
            role="group"
            aria-label="Map colour"
            className={`${groupClassName} ${className}`}
        >
            <button
                type="button"
                aria-pressed={mapStyle === CAREAROUND_MAP_STYLE_DEFAULT}
                onClick={() => setMapStyle(CAREAROUND_MAP_STYLE_DEFAULT)}
                className={`${optionClassName} ${
                    mapStyle === CAREAROUND_MAP_STYLE_DEFAULT
                        ? 'bg-brand-700 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                }`}
            >
                Default
            </button>
            <button
                type="button"
                aria-pressed={mapStyle === CAREAROUND_MAP_STYLE_GRAY}
                onClick={() => setMapStyle(CAREAROUND_MAP_STYLE_GRAY)}
                className={`${optionClassName} ${
                    mapStyle === CAREAROUND_MAP_STYLE_GRAY
                        ? 'bg-brand-700 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                }`}
            >
                Gray
            </button>
        </div>
    );
}
