import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import MapSpatialDialog from './MapSpatialDialog.jsx';
import MapAreaResourceChooser from './MapAreaResourceChooser.jsx';
import { AddressSnapshotNotice } from './NearbyAddressPicker.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { getMapSpatialMessages } from '../lib/mapSpatialMessages.js';
import { api } from '../lib/api.js';
import { fetchAllPaginatedResults } from '../lib/paginatedResults.js';
import { classifyMapAreaResources } from '../lib/mapAreaResources.js';
import { AddressSnapshotError, findSnapshotAddressesWithinArea } from '../lib/addressSnapshotClient.js';
import { useWholeAreaAddressScan } from '../hooks/useWholeAreaAddressScan.js';
import { serializeAddressSnapshotCsv } from '../lib/mapSpatialGeometry.js';
import { formatAreaMessage, getMapAreaResourceMessages } from '../lib/mapAreaResourceMessages.js';
import { ADDRESS_PAGE_SIZE, useAreaAddressFilter } from '../hooks/useAreaAddressFilter.js';
import { validatePinnedAreaAddressPage } from '../lib/pinnedAreaAddressCompletion.js';

function downloadCsv(rows, filename = 'carearound-area-addresses.csv') {
    const blob = new Blob([serializeAddressSnapshotCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = filename;
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
    const [notice, setNotice] = useState('');
    const [exporting, setExporting] = useState(false);
    const searchInput = useRef(null);
    const addressController = useRef(null), exportController = useRef(null), ordinaryOperation = useRef(null);
    const fallbackRequest = useRef(null);
    const scan = useWholeAreaAddressScan({ area, scopeKey });
    const { status: scanStatus, start: startScan, reset: resetScan } = scan;
    const wholeArea = addressStatus === 'whole-area';

    const filter = useAreaAddressFilter({ area, scopeKey, tab, result, wholeArea, scanRows: scan.completedRows,
        ordinaryBusy: loadingPage || exporting });
    const { complete, rows, selectedRows, selected, selection, preparation, filtering } = filter;
    const completionBusy = preparation.status === 'preparing';

    async function loadPage(offset, controller, reset = false) {
        if (!reset && (ordinaryOperation.current || completionBusy)) return;
        const isCurrent = () => addressController.current === controller && !controller.signal.aborted;
        ordinaryOperation.current = 'page';
        setLoadingPage(true); setAddressError(false);
        try {
            const value = await findSnapshotAddressesWithinArea({ area, offset, limit: ADDRESS_PAGE_SIZE, snapshotSha256: reset ? undefined : result?.snapshot?.sha256, signal: controller.signal });
            if (!isCurrent()) return;
            const prefix = reset ? [] : result.rows;
            const snapshot = reset ? value.snapshot : result.snapshot;
            const total = reset ? value.total : result.total;
            validatePinnedAreaAddressPage(value, { snapshotSha256: snapshot.sha256, total, offset,
                limit: ADDRESS_PAGE_SIZE, acceptedIds: new Set(prefix.map(row => row.id)) });
            if (value.snapshot.recordCount !== snapshot.recordCount) throw new Error('Snapshot metadata changed');
            setResult({ ...value, snapshot, rows: reset ? value.rows : [...prefix, ...value.rows] });
            setAddressStatus('ready');
        } catch (error) {
            if (!isCurrent()) return;
            if (error instanceof AddressSnapshotError && error.status === 422
                && error.code === 'ADDRESS_SNAPSHOT_AREA_TOO_LARGE' && error.addressLimit) {
                fallbackRequest.current = controller;
                setResult(null); filter.resetSource(); setNotice('');
                setAddressStatus('whole-area');
                return;
            }
            setAddressError({ code: error?.code || 'ADDRESS_SNAPSHOT_UNAVAILABLE', limit: error?.addressLimit });
            if (reset) setAddressStatus('error');
        } finally {
            if (isCurrent()) { ordinaryOperation.current = null; setLoadingPage(false); }
        }
    }

    useLayoutEffect(() => {
        const controller = new AbortController();
        addressController.current = controller;
        setResult(null); filter.resetSource(); setNotice(''); setAddressStatus('loading'); setExporting(false); ordinaryOperation.current = null;
        fallbackRequest.current = null;
        void loadPage(0, controller, true);
        return () => { controller.abort(); exportController.current?.abort(); };
    }, [area, scopeKey, addressRetry]);

    useLayoutEffect(() => {
        if (tab !== 'addresses') {
            if (scanStatus === 'scanning') resetScan();
            return;
        }
        if (wholeArea && scanStatus === 'idle' && fallbackRequest.current === addressController.current
            && !addressController.current.signal.aborted) void startScan();
    }, [wholeArea, tab, scanStatus, startScan, resetScan]);

    function selectTab(next) {
        setTab(next); setNotice('');
    }

    useEffect(() => {
        const controller = new AbortController();
        setResources(null); setResourceStatus('loading');
        // Use the same authenticated visible catalogue endpoints as Discover.
        const options = { maxAttempts: 1 };
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

    const total = wholeArea ? scan.total : result?.total;
    const ready = wholeArea ? scanStatus === 'ready' : addressStatus === 'ready';
    function loadMore() {
        if (complete) filter.showMore();
        else void loadPage(rows.length, addressController.current);
    }
    function editQuery(value) {
        setNotice('');
        filter.editQuery(value);
    }
    async function copyPostalCodes() {
        const controller = addressController.current;
        try {
            await navigator.clipboard.writeText([...new Set(selectedRows.map(row => row.postalCode))].join('\n'));
            if (!controller.signal.aborted) setNotice(m.copied);
        } catch { if (!controller.signal.aborted) setNotice(m.copyFailed); }
    }
    async function exportAll() {
        if (complete) {
            if (!complete.length) return;
            setNotice('');
            try { downloadCsv(complete); }
            catch { setNotice(m.exportFailed); }
            return;
        }
        if (ordinaryOperation.current || completionBusy || !result) return;
        const controller = new AbortController();
        exportController.current = controller; ordinaryOperation.current = 'export';
        setExporting(true); setNotice('');
        try {
            const all = [], ids = new Set(); let offset = 0;
            while (offset < result.total) {
                const value = await findSnapshotAddressesWithinArea({ area, offset, limit: ADDRESS_PAGE_SIZE, snapshotSha256: result.snapshot.sha256, signal: controller.signal });
                if (controller.signal.aborted) return;
                validatePinnedAreaAddressPage(value, { snapshotSha256: result.snapshot.sha256, total: result.total,
                    offset, limit: ADDRESS_PAGE_SIZE, acceptedIds: ids });
                if (value.snapshot.recordCount !== result.snapshot.recordCount) throw new Error('Snapshot metadata changed');
                for (const row of value.rows) {
                    ids.add(row.id); all.push(row);
                }
                offset += value.rows.length;
            }
            if (all.length !== result.total) throw new Error('Incomplete export');
            if (!controller.signal.aborted) downloadCsv(all);
        } catch (error) { if (!controller.signal.aborted) setNotice(error?.code === 'ADDRESS_SNAPSHOT_AREA_TOO_LARGE' ? m.areaTooLarge : error?.code === 'ADDRESS_SNAPSHOT_CHANGED' ? m.snapshotChanged : m.exportFailed); }
        finally { if (!controller.signal.aborted) { setExporting(false); ordinaryOperation.current = null; } }
    }
    const scanLimit = scan.error?.code === 'ADDRESS_SNAPSHOT_AREA_TOO_LARGE' && scan.error.status === 422
        ? scan.error.addressLimit : undefined;
    const displayedError = wholeArea
        ? scan.error && { code: scan.error.code || 'ADDRESS_SNAPSHOT_UNAVAILABLE', limit: scanLimit }
        : preparation.error || (complete ? null : addressError);
    const shrink = wholeArea ? Boolean(scanLimit) : addressError?.code === 'ADDRESS_SNAPSHOT_AREA_TOO_LARGE';
    const changed = scanStatus === 'changed' || preparation.status === 'changed';
    function retryAddresses() {
        if (shrink) onClose();
        else if (wholeArea && changed) void startScan();
        else if (wholeArea) void scan.resume();
        else if (preparation.status === 'error') void filter.resume();
        else setAddressRetry(value => value + 1);
    }
    const content = <>
        <div role="tablist" aria-label={m.findWithin} className="flex shrink-0 gap-1 border-b border-slate-100 p-2">
            {[['addresses', m.addresses], ['resources', m.resources]].map(([id, label]) => <button key={id} type="button" role="tab" id={`map-area-tab-${id}`} aria-controls={`map-area-panel-${id}`} aria-selected={tab === id}
                className={`min-h-11 min-w-0 flex-1 rounded-xl px-3 text-sm font-bold ${tab === id ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-50'}`}
                disabled={resourceBusy} onClick={() => selectTab(id)} onKeyDown={event => { if (!resourceBusy && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const next = event.key === 'Home' ? 'addresses' : event.key === 'End' ? 'resources' : id === 'addresses' ? 'resources' : 'addresses'; selectTab(next); document.getElementById(`map-area-tab-${next}`)?.focus(); } }}>
                {label}{id === 'addresses' && total != null ? ` (${total})` : id === 'resources' && resources ? ` (${resources.inside.length})` : ''}
            </button>)}
        </div>
        {tab === 'addresses' ? <div role="tabpanel" id="map-area-panel-addresses" aria-labelledby="map-area-tab-addresses" className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 border-b border-slate-100 px-4 py-3 sm:px-5">
                <AddressSnapshotNotice snapshot={wholeArea ? scan.snapshot : result?.snapshot} messages={m} />
                {ready ? <div className="mt-2 flex items-center gap-2">
                    <input ref={searchInput} type="search" value={filter.query} aria-label={m.searchAddresses} placeholder={m.searchAddresses}
                        onChange={event => editQuery(event.target.value)} className="input-field min-w-0 flex-1" />
                    {filter.query ? <button type="button" className="btn-ghost min-h-11" onClick={() => { editQuery(''); searchInput.current?.focus(); }}>{m.clearSearch}</button> : null}
                </div> : null}
                {total != null ? <p className="mt-1 text-xs font-semibold text-slate-700">
                    {filtering ? complete && formatAreaMessage(m.showingMatches, { shown: rows.length, matches: filter.matches.length })
                        : `${rows.length} ${m.loaded} / ${total} ${m.total}`} · {selectedRows.length} {m.selected}
                </p> : null}
                {filtering && complete && selectedRows.length > selection.selectedMatchingCount ? <p className="text-xs text-slate-600">
                    {formatAreaMessage(m.outsideFilter, { count: selectedRows.length - selection.selectedMatchingCount })}
                </p> : null}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
                {addressStatus === 'loading' ? <p role="status" className="py-5 text-sm text-slate-600">{m.loadingAddresses}</p> : null}
                {wholeArea && (scanStatus === 'idle' || scanStatus === 'scanning') ? <p role="status" className="py-5 text-sm text-slate-600">
                    {m.scanningWholeArea}{scan.progress ? <> {formatAreaMessage(m.scanProgress, scan.progress)}</> : null}
                </p> : null}
                {displayedError ? <div role="alert" data-map-area-address-error={displayedError.code} className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <p>{shrink ? rm.tooLarge : displayedError.code === 'ADDRESS_SNAPSHOT_CHANGED' ? rm.changed : wholeArea ? m.scanIncomplete : displayedError.code === 'ADDRESS_SNAPSHOT_INVALID_QUERY' ? rm.invalid : m.addressesError}</p>
                    {displayedError.limit && rm[`limit_${displayedError.limit.reason}`] ? <p className="mt-2 text-xs leading-5" data-map-area-address-limit={displayedError.limit.reason}>{rm[`limit_${displayedError.limit.reason}`]} {formatAreaMessage(rm.limitNumbers, displayedError.limit)}</p> : null}
                    <button type="button" className="btn-ghost mt-2 min-h-11" disabled={loadingPage || exporting} onClick={retryAddresses}>
                        {shrink ? m.shrinkArea : changed ? m.restartSearch : m.retry}
                    </button></div> : null}
                {filter.preparing ? <p role="status" className="py-3 text-sm text-slate-600">{m.preparingAddresses}</p> : null}
                {ready && !rows.length && (!filtering || complete) ? <p role="status" className="py-4 text-sm text-slate-600">{filtering ? m.noMatchingAddresses : m.noAddresses}</p> : null}
                {ready && (total > 0 || filtering) ? <label className="mb-2 flex min-h-11 cursor-pointer items-center gap-3 text-sm font-bold text-slate-700">
                    <input type="checkbox" checked={Boolean(complete && selection.checked)}
                        ref={node => { if (node) node.indeterminate = selection.mixed || (!complete && selection.selectedMatchingCount > 0); }}
                        disabled={filter.preparing || Boolean(preparation.error) || (filtering && !complete) || !total || (complete && !filter.matches.length)}
                        onChange={filter.toggleAll} className="h-5 w-5 accent-brand-600" />{m.selectAll}</label> : null}
                <ul className="space-y-2">
                    {rows.map(row => <li key={row.id}><label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 hover:border-brand-300">
                        <input type="checkbox" checked={selected.has(row.id)} onChange={() => { setNotice(''); filter.toggleRow(row.id); }} aria-label={`${row.postalCode} ${row.address}`} className="mt-1 h-5 w-5 shrink-0 accent-brand-600" />
                        <span className="min-w-0"><span className="block text-sm font-bold text-slate-900">{row.building && row.building !== 'NIL' ? row.building : row.address}</span><span className="mt-1 block break-words text-sm leading-5 text-slate-600">{row.address}</span><span className="mt-1 block text-xs font-bold text-brand-700">{row.postalCode}</span></span>
                    </label></li>)}
                </ul>
                {rows.length < (filtering ? filter.matches.length : total) ? <button type="button" disabled={loadingPage || exporting || completionBusy || Boolean(preparation.error)} onClick={loadMore} className="btn-ghost mt-3 min-h-11 w-full justify-center border border-slate-200">{loadingPage ? m.loadingAddresses : m.loadMore}</button> : null}
            </div>
            {!wholeArea || ready ? <footer className="shrink-0 border-t border-slate-100 p-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
                <div className={`grid gap-2 ${filtering ? 'grid-cols-2 sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
                    <button type="button" className="btn-ghost min-h-11 flex-1 justify-center border border-slate-200 text-xs disabled:opacity-40" disabled={!selectedRows.length || exporting} onClick={copyPostalCodes}>{m.copy}</button>
                    <button type="button" className="btn-ghost min-h-11 flex-1 justify-center border border-slate-200 text-xs disabled:opacity-40" disabled={!selectedRows.length || exporting} onClick={() => downloadCsv(selectedRows)}>{m.downloadSelected}</button>
                    {filtering ? <button type="button" className="btn-ghost min-h-11 justify-center border border-slate-200 text-xs disabled:opacity-40"
                        disabled={!complete || !filter.matches.length || exporting} onClick={() => downloadCsv(filter.matches, 'carearound-area-addresses-filtered.csv')}>{m.downloadFiltered}</button> : null}
                    <button type="button" className="btn-primary min-h-11 flex-1 justify-center text-xs disabled:opacity-40" disabled={!total || loadingPage || exporting || completionBusy || !ready} onClick={exportAll}>{exporting ? m.exporting : m.downloadAll}</button>
                </div>
                {notice ? <p role="status" className="mt-2 text-xs leading-5 text-slate-600">{notice}</p> : null}
            </footer> : null}
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
