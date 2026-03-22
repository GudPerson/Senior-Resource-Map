import { CAREAROUND_BASEMAP_LOGO_URL } from '../lib/mapTheme.js';

export default function OneMapBadge() {
    return (
        <div className="pointer-events-none absolute bottom-2 left-2 z-[500] inline-flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white/92 px-2 py-1 shadow-sm backdrop-blur">
            <img
                src={CAREAROUND_BASEMAP_LOGO_URL}
                alt="OneMap"
                className="h-4 w-auto"
                loading="lazy"
                decoding="async"
            />
            <span className="text-[10px] font-semibold leading-none text-slate-700">Singapore Land Authority</span>
        </div>
    );
}
