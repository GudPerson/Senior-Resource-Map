import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import MapSpatialDialog from './MapSpatialDialog.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { getMapSpatialMessages } from '../lib/mapSpatialMessages.js';
import { findNearbySnapshotAddresses } from '../lib/addressSnapshotClient.js';
import { formatRadiusDistance } from '../lib/mapSpatialGeometry.js';

export function AddressSnapshotNotice({ snapshot, messages }) {
    const { locale } = useLocale();
    const dateLocale = { en: 'en-SG', zh: 'zh-SG', ms: 'ms-SG', ta: 'ta-SG' }[locale] || 'en-SG';
    return <p className="text-xs leading-5 text-slate-500" data-address-snapshot-notice>
        {snapshot?.label || messages.snapshot}{snapshot?.preparedAt ? ` . ${messages.prepared} ${new Date(snapshot.preparedAt).toLocaleDateString(dateLocale, { timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', year: 'numeric' })}` : ''}. {messages.coverage}
    </p>;
}

export default function NearbyAddressPicker({ point, onClose, onChoose, onMapOnly, onManual }) {
    const { locale } = useLocale();
    const m = getMapSpatialMessages(locale);
    const [radius, setRadius] = useState(100), [retry, setRetry] = useState(0);
    const [result, setResult] = useState(null), [status, setStatus] = useState('loading');
    useEffect(() => {
        const controller = new AbortController();
        setStatus('loading'); setResult(null);
        findNearbySnapshotAddresses({ ...point, radiusMeters: radius, limit: 10, signal: controller.signal }).then(value => {
            if (!controller.signal.aborted) { setResult(value); setStatus('ready'); }
        }).catch(() => { if (!controller.signal.aborted) setStatus('error'); });
        return () => controller.abort();
    }, [point.lat, point.lng, radius, retry]);
    return <MapSpatialDialog title={m.nearbyTitle} closeLabel={m.close} onClose={onClose} data-nearby-address-picker>
        <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-5">
            <p className="mb-3 text-sm leading-6 text-slate-600">{m.nearbyHelp}</p>
            <div className="mb-3 rounded-xl border border-slate-100 bg-slate-50 p-3"><AddressSnapshotNotice snapshot={result?.snapshot} messages={m} /></div>
            <div className="mb-3 rounded-xl bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-800"><MapPin className="mr-1 inline" size={14} />{Number(point.lat).toFixed(6)}, {Number(point.lng).toFixed(6)}</div>
            {status === 'loading' ? <p role="status" className="py-6 text-sm text-slate-600">{m.finding}</p> : null}
            {status === 'error' ? <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><p>{m.nearbyError}</p><button type="button" onClick={() => setRetry(value => value + 1)} className="btn-ghost mt-2 min-h-11">{m.retry}</button></div> : null}
            {status === 'ready' && !result?.rows?.length ? <p role="status" className="py-4 text-sm text-slate-600">{m.noNearby}</p> : null}
            <ul className="space-y-2">
                {(result?.rows || []).map(row => <li key={row.id} className="rounded-2xl border border-slate-200 p-3">
                    <p className="text-sm font-bold text-slate-900">{row.building && row.building !== 'NIL' ? row.building : row.address}</p>
                    <p className="mt-1 text-sm leading-5 text-slate-600">{row.address}</p>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-bold text-brand-700">{row.postalCode}{Number.isFinite(row.distanceMeters) ? ` . ${formatRadiusDistance(row.distanceMeters)} ${m.away}` : ''}</p>
                        <button type="button" className="btn-primary min-h-11 px-3 text-xs" onClick={() => onChoose(row, result.snapshot)}>{m.useAddress}</button>
                    </div>
                </li>)}
            </ul>
            {result?.truncated ? <p className="mt-3 text-xs text-slate-500">{result.rows.length} {m.loaded} / {result.total} {m.total}</p> : null}
        </div>
        <footer className="shrink-0 space-y-2 border-t border-slate-100 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {radius < 500 && status !== 'loading' ? <button type="button" className="btn-ghost min-h-11 w-full justify-center" onClick={() => setRadius(500)}>{m.wider}</button> : null}
            {onManual ? <button type="button" className="btn-ghost min-h-11 w-full justify-center border border-slate-200 text-sm" onClick={onManual}>{m.manualAddress}</button> : null}
            <button type="button" className="btn-ghost min-h-11 w-full justify-center border border-slate-200 text-sm" onClick={onMapOnly}>{m.mapOnly}</button>
        </footer>
    </MapSpatialDialog>;
}
