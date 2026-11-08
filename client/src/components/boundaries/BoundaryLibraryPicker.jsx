import { useEffect, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { api } from '../../lib/api.js';
import { updateBoundaryLibrarySelection } from '../../lib/boundaryLibrarySelection.js';
import { collectMatchingBoundaryIds, loadBoundarySnapshots, createBoundaryOwnerScope } from '../../lib/boundaryLibraryPickerModel.js';
import { boundaryDrawingToArea } from '../../../../shared/boundaryDrawing.js';
import { buildKmlBoundaryPreview } from '../../lib/kmlBoundaries.js';

const button = 'min-h-11 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold disabled:opacity-40';
export function FrozenPreview({ item }) {
    const area = useMemo(() => boundaryDrawingToArea(item.drawing), [item]);
    const paths = useMemo(() => {
        if (area.type === 'circle') return [];
        const polygons = area.type === 'Polygon' ? [area.coordinates] : area.coordinates;
        const points = polygons.flatMap(polygon => polygon.flatMap(ring => ring.slice(0, -1).map(([lng, lat]) => [lat, lng])));
        return buildKmlBoundaryPreview([{ points, boundaryParts: polygons.map(polygon => polygon.map(ring => ring.length - 1)) }])[0]?.svgPaths || [];
    }, [area]);
    const style = item.drawing.style;
    return <figure className="space-y-3">
        <svg viewBox="0 0 600 300" role="img" aria-label={`Frozen boundary preview: ${item.name}`} className="w-full rounded-lg bg-slate-50">
            {area.type === 'circle' ? <circle cx="300" cy="150" r="120" stroke={style.color} fill={style.fillColor} fillOpacity={style.fillOpacity} strokeWidth={style.weight} strokeOpacity={style.strokeOpacity ?? 1} strokeDasharray={style.dashed ? '8 6' : undefined} />
                : paths.map((path, index) => <path key={index} d={path} fillRule="evenodd" stroke={style.color} fill={style.fillColor} fillOpacity={style.fillOpacity} strokeOpacity={style.strokeOpacity ?? 1} strokeWidth={style.weight} strokeDasharray={style.dashed ? '8 6' : undefined} vectorEffect="non-scaling-stroke" />)}
        </svg>
        <figcaption className="space-y-1 text-sm text-slate-600"><strong className="block break-words text-slate-900">{item.name}</strong>
            <p>{item.groupName || 'No library group'} · {item.drawing.type} · {item.pointCount} stored points</p>
            {area.type === 'circle' ? <p>Radius: {Math.round(area.radiusMeters).toLocaleString()} m</p> : null}
            {item.sourceName ? <p className="break-words">Source drawing: {item.sourceName}</p> : null}
            {item.sourceGroupName ? <p className="break-words">Source group: {item.sourceGroupName}</p> : null}
            <p className="text-xs">Frozen personal snapshot. Imported copies stay independent.</p>
        </figcaption>
    </figure>;
}

/** Controlled keys are normalized strings; onConfirm receives full snapshots with numeric canonical IDs. */
export default function BoundaryLibraryPicker({ selectedIds = [], onSelectionChange, onConfirm, onDraw, onCancel,
    scopeKey = '', workflowSession = null, maxSelection = 256, multiple = true, validateBatch = null, confirmLabel = 'Use selected boundaries' }) {
    const { user } = useAuth();
    const owner = String(user?.id || '');
    const sessionToken = workflowSession?.capture();
    const epoch = workflowSession?.generation || 0;
    const scope = `${owner}:${scopeKey}:${epoch}`;
    const liveScope = useRef(null), previousOwner = useRef(scope), mounted = useRef(true);
    if (!liveScope.current) liveScope.current = createBoundaryOwnerScope(scope);
    liveScope.current.setOwner(scope);
    const generation = liveScope.current.capture();
    const changedOwner = previousOwner.current !== scope;
    useEffect(() => { if (previousOwner.current !== scope) { previousOwner.current = scope; onSelectionChange?.([]); } }, [scope, onSelectionChange]);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    return <PickerSession key={scope} {...{ onConfirm, onDraw, onCancel, onSelectionChange, multiple, validateBatch, confirmLabel }} maxSelection={multiple ? maxSelection : 1}
        selectedIds={changedOwner ? [] : selectedIds} isCurrent={() => mounted.current && liveScope.current.isCurrent(generation) && (!workflowSession || workflowSession.isCurrent(sessionToken))} accountReady={Boolean(owner && user?.role !== 'guest' && !workflowSession?.loggingOut)} />;
}
function PickerSession({ selectedIds, onSelectionChange, onConfirm, onDraw, onCancel, maxSelection, multiple, validateBatch, confirmLabel, isCurrent, accountReady }) {
    const [search, setSearch] = useState(''), [group, setGroup] = useState('');
    const [items, setItems] = useState([]), [nextCursor, setNextCursor] = useState(null);
    const [loading, setLoading] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const [preview, setPreview] = useState(null), [previewLoading, setPreviewLoading] = useState(false);
    const [reload, setReload] = useState(0);
    const request = useRef(0), previewRequest = useRef(0), action = useRef(false);
    const filters = useMemo(() => ({ ...(search.trim() ? { search: search.trim() } : {}), ...(group.trim() ? { group: group.trim() } : {}) }), [search, group]);
    const keys = selectedIds.map(String);
    useEffect(() => {
        let cancelled = false;
        const token = ++request.current;
        setItems([]); setNextCursor(null); setPreview(null); setPreviewLoading(false); setError('');
        if (!accountReady) { setLoading(false); return; }
        setLoading(true);
        api.listBoundaryLibrary({ ...filters, limit: 50 }).then(data => {
            if (cancelled || token !== request.current || !isCurrent()) return;
            setItems(data.items); setNextCursor(data.nextCursor);
        }).catch(failure => { if (!cancelled && token === request.current && isCurrent()) setError(failure.message); })
            .finally(() => { if (!cancelled && token === request.current && isCurrent()) setLoading(false); });
        return () => { cancelled = true; request.current++; previewRequest.current++; };
    }, [filters, reload, accountReady]);
    function select(next) {
        if (next.length > maxSelection) { setError(`Selection limit is ${maxSelection} boundaries. Select fewer boundaries.`); return; }
        setError(''); onSelectionChange?.(next);
    }
    async function showPreview(id) {
        const token = ++previewRequest.current;setPreview(null);setPreviewLoading(true);setError('');
        try {
            const [detail] = await loadBoundarySnapshots([id], api.getBoundaryLibrary, { isCurrent });
            if (isCurrent() && token === previewRequest.current) setPreview(detail);
        } catch (failure) { if (isCurrent() && token === previewRequest.current) setError(failure.message); }
        finally { if (isCurrent() && token === previewRequest.current) setPreviewLoading(false); }
    }
    async function run(work) {
        if (action.current || !accountReady) return;
        action.current = true;setBusy(true);setError('');
        try { await work(); } catch (failure) { if (isCurrent()) setError(failure.message || 'Boundary Library is unavailable.'); }
        finally { action.current = false;if (isCurrent()) setBusy(false); }
    }
    return <Dialog.Root open onOpenChange={open => { if (!open && !busy) onCancel?.(); }}>
        <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[1999] bg-slate-900/40" />
            <Dialog.Content className="fixed left-1/2 top-1/2 z-[2101] flex max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-white shadow-xl"
                onPointerDown={event => event.stopPropagation()} onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onInteractOutside={event => event.preventDefault()}>
                <header className="border-b p-4"><Dialog.Title className="text-lg font-bold">Boundary Library</Dialog.Title>
                    <Dialog.Description className="mt-1 text-sm text-slate-600">Your saved boundary snapshots. Select a boundary or draw a new one.</Dialog.Description></header>
                <div className="min-h-0 overflow-y-auto p-4">
                    {!accountReady ? <p role="alert">Sign in with a personal account to use Boundary Library.</p> : <>
                        <div className="mb-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Search names and groups<input value={search} disabled={busy} onChange={event => setSearch(event.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3 font-normal" /></label>
                            <label className="text-sm font-semibold">Library group<input value={group} disabled={busy} onChange={event => setGroup(event.target.value)} placeholder="All groups" className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3 font-normal" /></label></div>
                        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm"><span className="mr-auto font-semibold">{keys.length} selected</span>
                            {multiple ? <button className={button} type="button" disabled={loading || busy} onClick={() => run(async () => {
                                const token = request.current;
                                const matching = await collectMatchingBoundaryIds(api.listBoundaryLibrary, filters, { maxSelection, isCurrent: () => isCurrent() && token === request.current });
                                if (isCurrent() && token === request.current) select(updateBoundaryLibrarySelection(keys, matching, 'select-all-visible'));
                            })}>Select all matching</button> : null}
                            <button type="button" className={button} disabled={busy || !keys.length} onClick={() => select([])}>Clear selection</button></div>
                        <div className="grid gap-5 md:grid-cols-2"><section aria-label="Saved boundaries" className="min-w-0">
                            {loading ? <p role="status">Loading boundaries…</p> : null}
                            {!loading && !items.length ? <div className="space-y-3 py-6 text-sm text-slate-600"><p>{search || group ? 'No boundaries match these filters.' : 'Your library is empty. Draw a boundary, then save a snapshot here.'}</p>
                                {onDraw ? <button type="button" className={button} disabled={busy} onClick={onDraw}>Draw a new boundary</button> : null}</div> : null}
                            <ul className="divide-y divide-slate-200">{items.map(item => <li key={item.id} className="flex items-center gap-3 py-2">
                                <label className="flex min-h-11 min-w-0 flex-1 items-center gap-3"><input type={multiple ? 'checkbox' : 'radio'} name="boundary-library-selection" checked={keys.includes(String(item.id))} disabled={busy} onChange={() => select(multiple ? updateBoundaryLibrarySelection(keys, [], { toggleId: item.id }) : [String(item.id)])} className="h-5 w-5 shrink-0 accent-brand-700" />
                                    <span className="min-w-0 text-sm"><span className="block break-words font-semibold">{item.name}</span><span className="block break-words text-xs text-slate-500">{item.groupName || 'No library group'} · {item.type}</span></span></label>
                                <button className={`${button} text-brand-800`} type="button" disabled={busy} aria-label={`Preview ${item.name}`} onClick={() => showPreview(item.id)}>Preview</button></li>)}</ul>
                            {nextCursor ? <button type="button" className={`${button} mt-3 w-full`} disabled={busy || loading} onClick={() => run(async () => {
                                const token = request.current, data = await api.listBoundaryLibrary({ ...filters, limit: 50, cursor: nextCursor });
                                if (isCurrent() && token === request.current) { setItems(current => [...current, ...data.items.filter(item => !current.some(old => old.id === item.id))]); setNextCursor(data.nextCursor); }
                            })}>Load more boundaries</button> : null}
                        </section><section aria-label="Boundary preview" className="min-w-0 border-t border-slate-200 pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0">
                            {previewLoading ? <p role="status">Loading preview…</p> : preview ? <FrozenPreview item={preview} /> : <p className="py-6 text-sm text-slate-500">Choose Preview to inspect a frozen boundary.</p>}
                        </section></div>
                    </>}
                    {error ? <div className="mt-3 text-sm text-red-700"><p role="alert">{error}</p><button type="button" className={button} disabled={busy} onClick={() => setReload(value => value + 1)}>Refresh library</button></div> : null}
                </div>
                <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t p-4"><button type="button" className={button} disabled={busy} onClick={onCancel}>Cancel</button>
                    <button type="button" className={`${button} border-brand-700 bg-brand-700 text-white`} disabled={loading || busy || !keys.length || !accountReady} onClick={() => run(async () => {
                        const snapshots = await loadBoundarySnapshots(keys, api.getBoundaryLibrary, { maxSelection, isCurrent, validateBatch });
                        if (isCurrent()) await onConfirm?.(snapshots);
                    })}>{busy ? 'Working…' : confirmLabel}</button></footer>
            </Dialog.Content></Dialog.Portal>
    </Dialog.Root>;
}
