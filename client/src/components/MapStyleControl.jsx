import { useMapStyle } from '../contexts/MapStyleContext.jsx';
import {
    CAREAROUND_MAP_STYLE_DEFAULT,
    CAREAROUND_MAP_STYLE_GRAY,
} from '../lib/mapTheme.js';

export default function MapStyleControl({ className = '' }) {
    const { mapStyle, setMapStyle } = useMapStyle();

    return (
        <div
            data-map-style-control="true"
            role="group"
            aria-label="Map colour"
            className={`pointer-events-auto inline-flex w-max shrink-0 rounded-full border border-slate-200 bg-white/95 p-0.5 shadow-md backdrop-blur ${className}`}
        >
            <button
                type="button"
                aria-pressed={mapStyle === CAREAROUND_MAP_STYLE_DEFAULT}
                onClick={() => setMapStyle(CAREAROUND_MAP_STYLE_DEFAULT)}
                className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold leading-4 transition sm:px-3 sm:text-xs ${
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
                className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold leading-4 transition sm:px-3 sm:text-xs ${
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
