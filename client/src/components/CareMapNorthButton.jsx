import { Navigation } from 'lucide-react';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { normalizeCareMapBearing } from '../lib/careMapGestureState.js';

export default function CareMapNorthButton({ configuration, interactive = true, compact = false, onReset }) {
    const { t } = useLocale();
    if (!configuration || configuration.active === false) return null;
    const reset = onReset || (() => configuration.onBearingChange?.(0));

    return <button type="button"
        data-care-map-north="true"
        className={`inline-flex shrink-0 touch-manipulation items-center justify-center border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:text-slate-300 ${compact ? 'h-[32px] w-[32px] rounded-lg' : 'h-[44px] w-[44px] rounded-xl'}`}
        disabled={!interactive} aria-label={t('careMapResetNorth')} title={`${t('careMapResetNorth')} — ${t('careMapGesturesHint')}`}
        onMouseDown={event => event.stopPropagation()}
        onTouchStart={event => event.stopPropagation()}
        onTouchMove={event => event.stopPropagation()}
        onTouchEnd={event => event.stopPropagation()}
        onClick={event => { event.preventDefault(); event.stopPropagation(); reset(); }}>
        <Navigation size={compact ? 16 : 20} style={{ transform: `rotate(${-normalizeCareMapBearing(configuration.bearing)}deg)` }} aria-hidden="true" />
    </button>;
}
