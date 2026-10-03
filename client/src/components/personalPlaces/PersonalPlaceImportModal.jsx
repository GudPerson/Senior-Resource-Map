import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Download, FileSpreadsheet, LoaderCircle, RotateCcw, X } from 'lucide-react';

import { api } from '../../lib/api.js';
import { searchOneMap } from '../../lib/geo.js';
import { handleModalKeyboardEvent } from '../../lib/modalKeyboard.js';
import {
    PERSONAL_PLACE_IMPORT_BATCH_SIZE, PERSONAL_PLACE_IMPORT_TEMPLATE,
    applyPersonalPlaceImportLookup, lookupPersonalPlaceImportLocations, markPersonalPlaceImportRejectedBatch, personalPlaceImportPayload,
    readPersonalPlaceImportBatchResults, readPersonalPlaceImportFile,
    reconcilePersonalPlaceImportRows, reviewPersonalPlaceImportRows,
} from '../../lib/personalPlaceImport.js';

export function PersonalPlaceImportRows({ rows, categories = [], disabled = false, lookupBusy = false, onChange, onRetry }) {
    const activeCategories = categories.filter((category) => !category.isArchived);
    return (
        <ol className="space-y-3" aria-label="Spreadsheet preview">
            {rows.map((row) => {
                const locked = disabled || Boolean(row.result);
                const selectedUnavailable = row.categoryId !== null && !activeCategories.some((category) => Number(category.id) === Number(row.categoryId));
                return (
                    <li key={row.id} className={`rounded-2xl border p-4 ${row.reviewStatus === 'invalid' ? 'border-red-200 bg-red-50/40' : 'border-slate-200 bg-white'} ${row.excluded ? 'opacity-70' : ''}`} data-import-row={row.rowNumber}>
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-500">Row {row.rowNumber} · {row.postalCode || 'Missing postal code'}</p>
                                <h3 className="mt-1 break-words text-sm font-bold text-slate-900">{row.name || 'Missing name'}</h3>
                                {row.shortDescription ? <p className="mt-1 break-words text-sm text-slate-600">{row.shortDescription}</p> : null}
                            </div>
                            {!row.result ? (
                                <label className="inline-flex min-h-11 flex-shrink-0 items-center gap-2 text-sm font-semibold text-slate-600">
                                    <input type="checkbox" checked={row.excluded} disabled={locked} onChange={(event) => onChange?.(row.id, { excluded: event.target.checked })} aria-label={`Skip row ${row.rowNumber}`} className="h-5 w-5 rounded border-slate-300 text-brand-600" />
                                    Skip
                                </label>
                            ) : <CheckCircle2 size={20} className="flex-shrink-0 text-brand-700" aria-label={row.result.confirmed ? 'Confirmed' : 'Awaiting confirmation'} />}
                        </div>
                        {!row.parseErrors.length ? (
                            <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
                                <label className="min-w-0 space-y-1.5">
                                    <span className="text-xs font-bold text-slate-600">Address and unit details</span>
                                    <input type="text" value={row.address} maxLength={500} disabled={locked || row.excluded || !row.location} onChange={(event) => onChange?.(row.id, { address: event.target.value, addressEdited: true })} aria-label={`Address for row ${row.rowNumber}`} placeholder="Address appears after lookup" className="input-field min-h-11 w-full disabled:bg-slate-100 disabled:text-slate-500" />
                                </label>
                                <label className="min-w-0 space-y-1.5">
                                    <span className="text-xs font-bold text-slate-600">Category</span>
                                    <select value={row.categoryId ?? ''} disabled={locked || row.excluded} onChange={(event) => onChange?.(row.id, { categoryId: event.target.value ? Number(event.target.value) : null })} aria-label={`Category for row ${row.rowNumber}`} className="input-field min-h-11 w-full disabled:bg-slate-100">
                                        <option value="">Personal place</option>
                                        {selectedUnavailable ? <option value={row.categoryId}>Category unavailable — choose another</option> : null}
                                        {activeCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                                    </select>
                                </label>
                            </div>
                        ) : null}
                        <p className={`mt-3 break-words text-sm ${row.reviewStatus === 'invalid' ? 'font-semibold text-red-700' : row.reviewStatus === 'completed' ? 'font-semibold text-brand-700' : 'text-slate-600'}`} role={row.reviewStatus === 'invalid' ? 'alert' : undefined}>{row.reviewMessage}</p>
                        {row.lookupStatus === 'failed' && !row.excluded && !row.result ? (
                            <button type="button" onClick={() => onRetry?.(row.postalCode)} disabled={disabled || lookupBusy} aria-label={`Retry location for row ${row.rowNumber}`} className="btn-ghost mt-2 min-h-11 px-3 disabled:opacity-50"><RotateCcw size={15} /> Retry location</button>
                        ) : null}
                    </li>
                );
            })}
        </ol>
    );
}

export default function PersonalPlaceImportModal({ open, mapId, identityKey, categories = [], personalPlaces = [], onClose, onImported }) {
    const [rows, setRows] = useState([]);
    const [fileName, setFileName] = useState('');
    const [sheetNames, setSheetNames] = useState([]);
    const [selectedSheetName, setSelectedSheetName] = useState('');
    const [parseBusy, setParseBusy] = useState(false);
    const [lookupBusy, setLookupBusy] = useState(false);
    const [saving, setSaving] = useState(false);
    const [refreshBusy, setRefreshBusy] = useState(false);
    const [refreshPending, setRefreshPending] = useState(false);
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const dialogRef = useRef(null);
    const fileInputRef = useRef(null);
    const fileRef = useRef(null);
    const rowsRef = useRef([]);
    const sessionRef = useRef(0);
    const onImportedRef = useRef(onImported);
    onImportedRef.current = onImported;

    const changeRows = useCallback((update) => {
        const next = typeof update === 'function' ? update(rowsRef.current) : update;
        rowsRef.current = next;
        setRows(next);
    }, []);

    useEffect(() => {
        sessionRef.current += 1;
        if (open) {
            changeRows([]);
            fileRef.current = null;
            setFileName(''); setSheetNames([]); setSelectedSheetName('');
            setParseBusy(false); setLookupBusy(false); setSaving(false); setRefreshBusy(false);
            setRefreshPending(false); setHasSubmitted(false); setError(''); setNotice('');
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
        return () => { sessionRef.current += 1; };
    }, [open, mapId, identityKey, changeRows]);

    useEffect(() => {
        if (!open) return undefined;
        const previousFocus = document.activeElement;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const firstControl = dialogRef.current?.querySelector('button:not([disabled])');
        (firstControl || dialogRef.current)?.focus();
        return () => {
            document.body.style.overflow = previousOverflow;
            if (previousFocus?.isConnected) previousFocus.focus?.();
        };
    }, [open]);

    const reviewed = useMemo(() => reviewPersonalPlaceImportRows(rows, { categories, personalPlaces, mapId }), [rows, categories, personalPlaces, mapId]);
    const ready = reviewed.filter((row) => row.reviewStatus === 'ready');
    const invalidCount = reviewed.filter((row) => row.reviewStatus === 'invalid').length;
    const skippedCount = reviewed.filter((row) => row.reviewStatus === 'skipped').length;
    const completedCount = reviewed.filter((row) => row.reviewStatus === 'completed').length;
    const pendingCount = reviewed.filter((row) => row.reviewStatus === 'pending').length;
    const createCount = ready.filter((row) => row.previewAction === 'created').length;
    const reuseCount = ready.filter((row) => ['attached', 'duplicate'].includes(row.previewAction)).length;
    const alreadyCount = ready.filter((row) => row.previewAction === 'already_added').length;
    const allDone = rows.length > 0 && ready.length === 0 && invalidCount === 0 && pendingCount === 0 && !refreshPending && completedCount > 0;
    const locked = saving || refreshBusy;
    const canSave = ready.length > 0 && invalidCount === 0 && pendingCount === 0 && !lookupBusy && !parseBusy && !locked && !refreshPending;

    async function lookUp(nextRows, token) {
        setLookupBusy(true);
        await lookupPersonalPlaceImportLocations(nextRows, searchOneMap, (postalCode, outcome) => {
            changeRows((current) => current.map((row) => row.postalCode === postalCode ? applyPersonalPlaceImportLookup(row, outcome) : row));
        }, () => sessionRef.current === token);
        if (sessionRef.current === token) setLookupBusy(false);
    }

    async function readFile(file, sheetName) {
        const token = ++sessionRef.current;
        setError(''); setNotice(''); setParseBusy(true); setLookupBusy(false);
        changeRows([]);
        setFileName(file?.name || '');
        fileRef.current = file;
        if (!sheetName) setSheetNames([]);
        setSelectedSheetName(sheetName || '');
        try {
            const parsed = await readPersonalPlaceImportFile(file, { sheetName });
            if (sessionRef.current !== token) return;
            setSheetNames(parsed.sheetNames); setSelectedSheetName(parsed.selectedSheetName || '');
            changeRows(parsed.rows);
            setParseBusy(false);
            if (parsed.rows.length) await lookUp(parsed.rows, token);
        } catch (readError) {
            if (sessionRef.current === token) {
                setError(readError.message || 'The spreadsheet could not be read.');
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        } finally {
            if (sessionRef.current === token) setParseBusy(false);
        }
    }

    async function retryLookup(postalCode) {
        if (locked || lookupBusy || refreshPending) return;
        const token = sessionRef.current;
        changeRows((current) => current.map((row) => row.postalCode === postalCode && !row.result ? { ...row, lookupStatus: 'pending', lookupError: '' } : row));
        await lookUp(rowsRef.current.filter((row) => row.postalCode === postalCode), token);
    }

    async function refreshSavedResults(token) {
        setRefreshPending(true);
        const context = await onImportedRef.current?.({
            results: rowsRef.current.filter((row) => row.result).map((row) => row.result),
            rows: rowsRef.current.filter((row) => row.attempted).map(personalPlaceImportPayload),
        });
        if (sessionRef.current !== token) return false;
        changeRows(reconcilePersonalPlaceImportRows(rowsRef.current, context, mapId));
        setRefreshPending(false);
        return true;
    }

    async function handleRefresh() {
        if (locked) return;
        const token = sessionRef.current;
        setRefreshBusy(true); setError('');
        try {
            await refreshSavedResults(token);
            if (sessionRef.current === token) setNotice('Saved results have been refreshed. Confirmed rows will not be sent again.');
        } catch (refreshError) {
            if (sessionRef.current === token) setError(refreshError.message || 'Saved results could not be refreshed.');
        } finally {
            if (sessionRef.current === token) setRefreshBusy(false);
        }
    }

    async function handleImport() {
        if (!canSave || typeof onImportedRef.current !== 'function') return;
        const token = sessionRef.current;
        const selected = [...ready];
        setSaving(true); setHasSubmitted(true); setError(''); setNotice('');
        try {
            for (let offset = 0; offset < selected.length; offset += PERSONAL_PLACE_IMPORT_BATCH_SIZE) {
                if (sessionRef.current !== token) return;
                const batch = selected.slice(offset, offset + PERSONAL_PLACE_IMPORT_BATCH_SIZE);
                const ids = new Set(batch.map((row) => row.id));
                changeRows((current) => current.map((row) => ids.has(row.id) ? { ...row, attempted: true } : row));
                let response;
                try {
                    response = await api.importMyMapPersonalPlaces(mapId, { rows: batch.map(personalPlaceImportPayload) });
                    if (sessionRef.current !== token) return;
                    const results = new Map(readPersonalPlaceImportBatchResults(response, batch).map((item) => [item.id, item.result]));
                    changeRows((current) => current.map((row) => results.has(row.id) ? { ...row, result: results.get(row.id) } : row));
                } catch (saveError) {
                    if (sessionRef.current !== token) return;
                    changeRows((current) => markPersonalPlaceImportRejectedBatch(current, batch.map((row) => row.id), saveError.status));
                    setError(saveError.message || 'This batch could not be confirmed.');
                    try {
                        await refreshSavedResults(token);
                        if (sessionRef.current === token) setNotice('Your saved places have been checked. Confirmed rows will not be sent again; review any remaining rows before retrying.');
                    } catch (refreshError) {
                        if (sessionRef.current === token) setError(`${saveError.message || 'This batch could not be confirmed.'} ${refreshError.message || 'Refresh saved results before continuing.'}`);
                    }
                    return;
                }
                await refreshSavedResults(token);
                if (sessionRef.current !== token) return;
                setNotice(`${rowsRef.current.filter((row) => row.result?.confirmed).length} rows confirmed on this map.`);
            }
        } catch (refreshError) {
            if (sessionRef.current === token) setError(refreshError.message || 'Saved places could not be refreshed. Refresh saved results before continuing.');
        } finally {
            if (sessionRef.current === token) setSaving(false);
        }
    }

    function downloadTemplate() {
        const url = URL.createObjectURL(new Blob([PERSONAL_PLACE_IMPORT_TEMPLATE], { type: 'text/csv;charset=utf-8' }));
        const anchor = document.createElement('a');
        anchor.href = url; anchor.download = 'personal-places-import.csv';
        document.body.appendChild(anchor); anchor.click(); anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    if (!open) return null;
    return (
        <div className="fixed inset-0 z-[1400] flex items-end bg-slate-950/45 sm:items-center sm:justify-center sm:p-6" onClick={() => { if (!locked) onClose?.(); }} role="presentation">
            <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Import personal places" aria-busy={locked || parseBusy} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => {
                if (event.key === 'Escape') event.stopPropagation();
                handleModalKeyboardEvent(event, { onEscape: locked ? null : onClose });
            }} className="flex max-h-[90dvh] w-full min-w-0 flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl outline-none sm:max-w-3xl sm:rounded-[28px]">
                <header className="flex flex-shrink-0 items-center gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
                    <FileSpreadsheet size={23} className="flex-shrink-0 text-brand-700" aria-hidden="true" />
                    <div className="min-w-0 flex-1"><h2 className="text-base font-black text-slate-900">Import personal places</h2><p className="mt-0.5 text-xs text-slate-500">Private places for My Places and this map.</p></div>
                    <button type="button" onClick={onClose} disabled={locked} aria-label="Close import" className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-40"><X size={19} /></button>
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
                    <p className="text-sm leading-6 text-slate-600">Use <strong>Name</strong> and <strong>Postal Code</strong>, with optional <strong>Short Description</strong>. Addresses are looked up automatically. Review each address and add unit details before saving. These places stay private and are excluded from shared links and embeds.</p>
                    <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-end">
                        <label className="min-w-0 flex-1 space-y-2"><span className="block text-sm font-bold text-slate-800">Choose a spreadsheet</span><input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" disabled={locked || parseBusy || hasSubmitted} aria-label="Select CSV or Excel spreadsheet" onChange={(event) => { const file = event.target.files?.[0]; if (file) readFile(file); }} className="block w-full min-w-0 text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-3 file:font-semibold file:text-brand-700" /><p className="text-xs text-slate-500">CSV, XLSX or XLS · up to 2 MB and 500 places. Store postal codes as text.</p></label>
                        <button type="button" onClick={downloadTemplate} disabled={locked} className="btn-ghost min-h-11 justify-center border border-slate-200 bg-white px-3"><Download size={15} /> Download template</button>
                    </div>
                    {sheetNames.length > 1 ? <label className="mt-4 block space-y-2"><span className="block text-sm font-bold text-slate-800">Choose a worksheet</span><select value={selectedSheetName} disabled={locked || parseBusy || hasSubmitted} aria-label="Choose worksheet" onChange={(event) => { if (event.target.value) readFile(fileRef.current, event.target.value); }} className="input-field min-h-11 w-full"><option value="">Select a data sheet</option>{sheetNames.map((name) => <option key={name} value={name}>{name}</option>)}</select></label> : null}
                    {parseBusy || lookupBusy ? <p role="status" className="mt-4 flex items-center gap-2 text-sm font-semibold text-brand-700"><LoaderCircle size={17} className="animate-spin" aria-hidden="true" />{parseBusy ? 'Reading spreadsheet…' : 'Looking up postal codes…'}</p> : null}
                    {error ? <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
                    {notice ? <p role="status" className="mt-4 text-sm font-semibold text-brand-700">{notice}</p> : null}
                    {rows.length ? <>
                        <div className="mb-3 mt-5 space-y-2"><p className="break-words text-sm font-bold text-slate-900">{fileName}{selectedSheetName ? ` · ${selectedSheetName}` : ''}</p><p className="text-sm text-slate-600" aria-live="polite">{ready.length} ready · {skippedCount} skipped · {invalidCount} need attention · {completedCount} confirmed{pendingCount ? ` · ${pendingCount} looking up` : ''}</p>{ready.length ? <p className="text-xs text-slate-500">{createCount} new · {reuseCount} to reuse · {alreadyCount} already on this map</p> : null}<p className="text-xs leading-5 text-slate-500">{hasSubmitted ? 'Completed rows are kept out of retries. Existing places are reused without changing their details.' : 'Nothing is saved until you confirm. Correct the file or skip rows that need attention.'}</p></div>
                        <PersonalPlaceImportRows rows={reviewed} categories={categories} disabled={locked || refreshPending} lookupBusy={lookupBusy} onChange={(id, patch) => changeRows((current) => current.map((row) => row.id === id && !row.result ? { ...row, ...patch } : row))} onRetry={retryLookup} />
                    </> : null}
                </div>
                <footer className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
                    <button type="button" disabled={locked} onClick={onClose} className="btn-ghost min-h-11 px-4 disabled:opacity-40">{hasSubmitted ? 'Close' : 'Cancel'}</button>
                    {refreshPending ? <button type="button" disabled={locked} onClick={handleRefresh} className="btn-primary min-h-11 px-4 disabled:opacity-50"><RotateCcw size={16} />{refreshBusy ? 'Refreshing…' : 'Refresh saved results'}</button>
                        : allDone ? <button type="button" onClick={onClose} className="btn-primary min-h-11 px-5">Done</button>
                            : <button type="button" disabled={!canSave || typeof onImported !== 'function'} onClick={handleImport} className="btn-primary min-h-11 px-4 disabled:opacity-50">{saving ? 'Adding and checking…' : `Add ${ready.length} ${ready.length === 1 ? 'place' : 'places'} to this map`}</button>}
                </footer>
            </section>
        </div>
    );
}
