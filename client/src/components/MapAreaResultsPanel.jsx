import { useEffect, useRef, useState } from 'react';
import MapSpatialDialog from './MapSpatialDialog.jsx';
import MapAreaResourceChooser from './MapAreaResourceChooser.jsx';
import { AddressSnapshotNotice } from './NearbyAddressPicker.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { getMapSpatialMessages } from '../lib/mapSpatialMessages.js';
import { api } from '../lib/api.js';
import { fetchAllPaginatedResults } from '../lib/paginatedResults.js';
import { classifyMapAreaResources } from '../lib/mapAreaResources.js';
import { findSnapshotAddressesWithinArea } from '../lib/addressSnapshotClient.js';
import { serializeAddressSnapshotCsv } from '../lib/mapSpatialGeometry.js';
import { formatAreaMessage, getMapAreaResourceMessages } from '../lib/mapAreaResourceMessages.js';

function downloadCsv(rows) {
    const blob = new Blob([serializeAddressSnapshotCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'carearound-area-addresses.csv';
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function MapAreaResultsPanel({ area, onClose, embedded = false, initialTab = 'addresses',
    existingAssets = [], scopeKey = '', disabled = false, onSaveAndAdd = null, onBusyChange = null }) {
    const { locale } = useLocale();
    const m = getMapSpatialMessages(locale);
    const rm = getMapAreaResourceMessages(locale);
    const [tab, setTab] = useState(initialTab);
    const [resourceBusy, setResourceBusy] = useState(false);
    const [addressRetry, setAddressRetry] = useState(0), [resourceRetry, setResourceRetry] = useState(0);
    const [result, setResult] = useState(null), [addressStatus, setAddressStatus] = useState('loading');
    const [addressError, setAddressError] = useState(false), [loadingPage, setLoadingPage] = useState(false);
    const [resources, setResources] = useState(null), [resourceStatus, setResourceStatus] = useState('loading');
    const [selected, setSelected] = useState(new Set()), [notice, setNotice] = useState('');
    const [exporting, setExporting] = useState(false);
    const addressController = useRef(null), exportController = useRef(null), pageBusy = useRef(false), exportBusy = useRef(false);

    async function loadPage(offset, controller, reset = false) {
        if (pageBusy.current && !reset) return;
        pageBusy.current = true;
        setLoadingPage(true); setAddressError(false);
        try {
            const value = await findSnapshotAddressesWithinArea({ area, offset, limit: 200, snapshotSha256: reset ? undefined : result?.snapshot?.sha256, signal: controller.signal });
            if (controller.signal.aborted) return;
            if (!reset && result?.snapshot?.sha256 && value.snapshot?.sha256 !== result.snapshot.sha256) throw new Error('Snapshot changed');
            setResult(current => {
                if (reset || !current) return value;
                const seen = new Set(current.rows.map(row => row.id));
                return { ...value, rows: [...current.rows, ...value.rows.filter(row => !seen.has(row.id))] };
            });
            setAddressStatus('ready');
        } catch (error) {
            if (!controller.signal.aborted) { setAddressError({ code: error?.code || 'ADDRESS_SNAPSHOT_UNAVAILABLE', limit: error?.addressLimit }); if (reset) setAddressStatus('error'); }
        } finally {
            if (!controller.signal.aborted) { pageBusy.current = false; setLoadingPage(false); }
        }
    }

    useEffect(() => {
        const controller = new AbortController();
        addressController.current = controller;
        setResult(null); setSelected(new Set()); setNotice(''); setAddressStatus('loading'); setExporting(false); exportBusy.current = false;
        pageBusy.current = false;
        loadPage(0, controller, true);
        return () => { controller.abort(); exportController.current?.abort(); };
    }, [area, addressRetry]);

    useEffect(() => {
        const controller = new AbortController();
        setResources(null); setResourceStatus('loading');
        // Use the same authenticated visible catalogue endpoints as Discover.
        const options = { maxAttempts: 1, pageTimeoutMs: 15000 };
        Promise.all([
            fetchAllPaginatedResults((params, pageOptions) => api.getHardAssets(params, { ...pageOptions, signal: controller.signal }), { scope: 'visible' }, options),
            fetchAllPaginatedResults((params, pageOptions) => api.getSoftAssets(params, { ...pageOptions, signal: controller.signal }), { scope: 'visible', assetMode: 'offering' }, options),
        ]).then(([hard, soft]) => {
            if (controller.signal.aborted) return;
            setResources(classifyMapAreaResources(hard, soft, area)); setResourceStatus('ready');
        }).catch(() => {
            if (!controller.signal.aborted) {
                setResourceStatus('error');
                // A failed page must cancel its transport and the sibling catalogue load.
                controller.abort();
            }
        });
        return () => controller.abort();
    }, [area, resourceRetry]);

    const rows = result?.rows || [];
    const selectedRows = rows.filter(row => selected.has(row.id));
    const allLoadedSelected = rows.length > 0 && selectedRows.length === rows.length;
    function toggleRow(id) {
        setNotice('');
        setSelected(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    }
    async function copyPostalCodes() {
        try { await navigator.clipboard.writeText([...new Set(selectedRows.map(row => row.postalCode))].join('\n')); setNotice(m.copied); }
        catch { setNotice(m.copyFailed); }
    }
    async function exportAll() {
        if (exportBusy.current || !result) return;
        const controller = new AbortController();
        exportController.current = controller; exportBusy.current = true;
        setExporting(true); setNotice('');
        try {
            const all = [], ids = new Set(); let offset = 0;
            while (offset < result.total) {
                const value = await findSnapshotAddressesWithinArea({ area, offset, limit: 200, snapshotSha256: result.snapshot.sha256, signal: controller.signal });
                if (controller.signal.aborted) return;
                if (value.snapshot?.sha256 !== result.snapshot?.sha256 || value.total !== result.total || !value.rows.length) throw new Error('Snapshot changed');
                for (const row of value.rows) {
                    if (ids.has(row.id)) throw new Error('Repeated export page');
                    ids.add(row.id); all.push(row);
                }
                offset += value.rows.length;
            }
            if (all.length !== result.total) throw new Error('Incomplete export');
            if (!controller.signal.aborted) downloadCsv(all);
        } catch (error) { if (!controller.signal.aborted) setNotice(error?.code === 'ADDRESS_SNAPSHOT_AREA_TOO_LARGE' ? m.areaTooLarge : error?.code === 'ADDRESS_SNAPSHOT_CHANGED' ? m.snapshotChanged : m.exportFailed); }
        finally { if (!controller.signal.aborted) setExporting(false); exportBusy.current = false; }
    }
    const content = <>
        <div role="tablist" aria-label={m.findWithin} className="flex shrink-0 gap-1 border-b border-slate-100 p-2">
            {[['addresses', m.addresses], ['resources', m.resources]].map(([id, label]) => <button key={id} type="button" role="tab" id={`map-area-tab-${id}`} aria-controls={`map-area-panel-${id}`} aria-selected={tab === id}
                className={`min-h-11 min-w-0 flex-1 rounded-xl px-3 text-sm font-bold ${tab === id ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-50'}`}
                disabled={resourceBusy} onClick={() => { setTab(id); setNotice(''); }} onKeyDown={event => { if (!resourceBusy && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const next = event.key === 'Home' ? 'addresses' : event.key === 'End' ? 'resources' : id === 'addresses' ? 'resources' : 'addresses'; setTab(next); document.getElementById(`map-area-tab-${next}`)?.focus(); } }}>
                {label}{id === 'addresses' && result ? ` (${result.total})` : id === 'resources' && resources ? ` (${resources.inside.length})` : ''}
            </button>)}
        </div>
        {tab === 'addresses' ? <div role="tabpanel" id="map-area-panel-addresses" aria-labelledby="map-area-tab-addresses" className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 border-b border-slate-100 px-4 py-3 sm:px-5">
                <AddressSnapshotNotice snapshot={result?.snapshot} messages={m} />
                {result ? <p className="mt-1 text-xs font-semibold text-slate-700">{rows.length} {m.loaded} / {result.total} {m.total} . {selectedRows.length} {m.selected}</p> : null}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
                {addressStatus === 'loading' ? <p role="status" className="py-5 text-sm text-slate-600">{m.loadingAddresses}</p> : null}
                {addressError ? <div role="alert" data-map-area-address-error={addressError.code} className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <p>{addressError.code === 'ADDRESS_SNAPSHOT_AREA_TOO_LARGE' ? rm.tooLarge : addressError.code === 'ADDRESS_SNAPSHOT_CHANGED' ? rm.changed : addressError.code === 'ADDRESS_SNAPSHOT_INVALID_QUERY' ? rm.invalid : m.addressesError}</p>
                    {addressError.limit && rm[`limit_${addressError.limit.reason}`] ? <p className="mt-2 text-xs leading-5" data-map-area-address-limit={addressError.limit.reason}>{rm[`limit_${addressError.limit.reason}`]} {formatAreaMessage(rm.limitNumbers, addressError.limit)}</p> : null}
                    <button type="button" className="btn-ghost mt-2 min-h-11" onClick={addressError.code === 'ADDRESS_SNAPSHOT_AREA_TOO_LARGE' ? onClose : () => setAddressRetry(value => value + 1)}>{addressError.code === 'ADDRESS_SNAPSHOT_AREA_TOO_LARGE' ? m.shrinkArea : m.retry}</button></div> : null}
                {addressStatus === 'ready' && !rows.length ? <p role="status" className="py-4 text-sm text-slate-600">{m.noAddresses}</p> : null}
                {rows.length ? <label className="mb-2 flex min-h-11 cursor-pointer items-center gap-3 text-sm font-bold text-slate-700"><input type="checkbox" checked={allLoadedSelected} onChange={() => setSelected(allLoadedSelected ? new Set() : new Set(rows.map(row => row.id)))} className="h-5 w-5 accent-brand-600" />{m.selectAll}</label> : null}
                <ul className="space-y-2">
                    {rows.map(row => <li key={row.id}><label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 hover:border-brand-300">
                        <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleRow(row.id)} aria-label={`${row.postalCode} ${row.address}`} className="mt-1 h-5 w-5 shrink-0 accent-brand-600" />
                        <span className="min-w-0"><span className="block text-sm font-bold text-slate-900">{row.building && row.building !== 'NIL' ? row.building : row.address}</span><span className="mt-1 block break-words text-sm leading-5 text-slate-600">{row.address}</span><span className="mt-1 block text-xs font-bold text-brand-700">{row.postalCode}</span></span>
                    </label></li>)}
                </ul>
                {result && rows.length < result.total ? <button type="button" disabled={loadingPage || exporting} onClick={() => loadPage(rows.length, addressController.current)} className="btn-ghost mt-3 min-h-11 w-full justify-center border border-slate-200">{loadingPage ? m.loadingAddresses : m.loadMore}</button> : null}
            </div>
            <footer className="shrink-0 border-t border-slate-100 p-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
                <div className="grid gap-2 sm:grid-cols-3">
                    <button type="button" className="btn-ghost min-h-11 flex-1 justify-center border border-slate-200 text-xs disabled:opacity-40" disabled={!selectedRows.length || exporting} onClick={copyPostalCodes}>{m.copy}</button>
                    <button type="button" className="btn-ghost min-h-11 flex-1 justify-center border border-slate-200 text-xs disabled:opacity-40" disabled={!selectedRows.length || exporting} onClick={() => downloadCsv(selectedRows)}>{m.downloadSelected}</button>
                    <button type="button" className="btn-primary min-h-11 flex-1 justify-center text-xs disabled:opacity-40" disabled={!result?.total || exporting || addressStatus !== 'ready'} onClick={exportAll}>{exporting ? m.exporting : m.downloadAll}</button>
                </div>
                {notice ? <p role="status" className="mt-2 text-xs leading-5 text-slate-600">{notice}</p> : null}
            </footer>
        </div> : <div role="tabpanel" id="map-area-panel-resources" aria-labelledby="map-area-tab-resources" className={onSaveAndAdd ? 'flex min-h-0 flex-1 flex-col' : 'min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5'}>
            <p className="shrink-0 px-4 pt-3 text-xs leading-5 text-slate-500">{m.visibleCatalogue}</p>
            {resourceStatus === 'loading' ? <p role="status" className="py-5 text-sm text-slate-600">{m.loadingResources}</p> : null}
            {resourceStatus === 'error' ? <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><p>{m.resourcesError}</p><button type="button" className="btn-ghost mt-2 min-h-11" onClick={() => setResourceRetry(value => value + 1)}>{m.retry}</button></div> : null}
            {resourceStatus === 'ready' && !resources?.inside.length ? <p className="py-4 text-sm text-slate-600">{m.noResources}</p> : null}
            {onSaveAndAdd && resourceStatus === 'ready' ? <MapAreaResourceChooser rows={resources?.inside || []} existingAssets={existingAssets}
                scopeKey={scopeKey} disabled={disabled} onSaveAndAdd={onSaveAndAdd} onBusyChange={value => { setResourceBusy(value); onBusyChange?.(value); }} /> : <ul className="space-y-2">{(resources?.inside || []).map(row => <li key={row.id} className="rounded-xl border border-slate-200 p-3">
                <a href={row.detailPath} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-brand-800 underline underline-offset-2">{row.name}</a>
                <p className="mt-1 text-xs text-slate-500">{row.resourceType === 'hard' ? 'Place' : 'Programme / service'}</p>
                {row.locations.map((location, index) => <p key={index} className="mt-1 break-words text-sm leading-5 text-slate-600">{location.address || location.name || location.postalCode || location.postal_code || `${location.lat}, ${location.lng}`}</p>)}
            </li>)}</ul>}
            {resources?.unassessed.length ? <p className="shrink-0 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600" data-map-area-unlocated>{m.unlocatedHeading}: {resources.unassessed.length}. {m.unlocated}</p> : null}
        </div>}
    </>;
    return embedded ? <section className="flex min-h-0 flex-1 flex-col" data-map-area-results>{content}</section>
        : <MapSpatialDialog title={m.findWithin} closeLabel={m.close} onClose={onClose} wide data-map-area-results>{content}</MapSpatialDialog>;
}
