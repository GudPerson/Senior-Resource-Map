import { useEffect, useId, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { FileUp, X } from 'lucide-react';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { getKmlBoundaryMessages } from '../lib/kmlBoundaryMessages.js';
import { KML_MAX_BYTES, KmlBoundaryError, parseKmlBoundaries, getKmlImportCapacity, buildKmlBoundaryPreview } from '../lib/kmlBoundaries.js';

export default function KmlBoundaryImport({ mapId, annotations, disabled = false, onImport }) {
    const { locale } = useLocale();
    const m = getKmlBoundaryMessages(locale);
    const id = useId();
    const fileRef = useRef(null), requestRef = useRef(0);
    const [open, setOpen] = useState(false);
    const [reading, setReading] = useState(false);
    const [result, setResult] = useState(null);
    const [selected, setSelected] = useState(new Set());
    const [error, setError] = useState('');
    const [fileName, setFileName] = useState('');
    useEffect(() => {
        requestRef.current++;
        setOpen(false); setResult(null); setSelected(new Set()); setReading(false); setError(''); setFileName('');
        return () => { requestRef.current++; };
    }, [mapId]);
    const areas = useMemo(() => result?.boundaries.filter(item => selected.has(item.key)) || [], [result, selected]);
    const preview = useMemo(() => buildKmlBoundaryPreview(result?.boundaries || []), [result]);
    const capacity = getKmlImportCapacity(annotations, areas);
    function changeOpen(next) {
        if (!next) { requestRef.current++; setReading(false); }
        setOpen(next);
    }
    async function readFile(event) {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (!file) return;
        const token = ++requestRef.current;
        setResult(null); setSelected(new Set()); setError(''); setFileName(file.name); setReading(true);
        try {
            if (!/\.kml$/i.test(file.name)) throw new KmlBoundaryError('file');
            if (file.size > KML_MAX_BYTES) throw new KmlBoundaryError('size');
            const xml = await file.text();
            if (requestRef.current !== token) return;
            const parsed = parseKmlBoundaries(xml);
            setResult(parsed); setSelected(new Set(parsed.boundaries.map(item => item.key)));
        } catch (failure) {
            if (requestRef.current === token) setError(failure instanceof KmlBoundaryError ? failure.code : 'read');
        } finally {
            if (requestRef.current === token) setReading(false);
        }
    }
    function updateStyle(key, patch) {
        setResult(current => ({ ...current, boundaries: current.boundaries.map(item => item.key === key ? { ...item, style: { ...item.style, ...patch } } : item) }));
    }
    function handleImport() {
        if (disabled || reading || capacity) return;
        try { onImport(areas); changeOpen(false); setResult(null); setSelected(new Set()); }
        catch (failure) { setError(failure instanceof KmlBoundaryError ? failure.code : 'read'); }
    }
    return (
        <Dialog.Root open={open} onOpenChange={changeOpen}>
            <Dialog.Trigger asChild>
                <button type="button" disabled={disabled} data-kml-import="true"
                    className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-bold text-brand-800 hover:bg-brand-100 disabled:opacity-50">
                    <FileUp size={16} aria-hidden="true" />{m.import}
                </button>
            </Dialog.Trigger>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-[2000] bg-slate-900/50" />
                <Dialog.Content className="fixed left-1/2 top-1/2 z-[2001] flex max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-white shadow-xl"
                    onPointerDown={event => event.stopPropagation()}>
                    <div className="flex shrink-0 items-start justify-between gap-3 border-b p-4">
                        <div><Dialog.Title className="text-lg font-bold text-slate-900">{m.title}</Dialog.Title>
                            <Dialog.Description className="mt-1 text-sm text-slate-600">{m.intro}</Dialog.Description></div>
                        <Dialog.Close aria-label={m.cancel} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-slate-100"><X size={20} /></Dialog.Close>
                    </div>
                    <div className="min-h-0 space-y-4 overflow-y-auto p-4">
                        <input ref={fileRef} type="file" accept=".kml,application/vnd.google-earth.kml+xml" aria-label={m.choose} className="sr-only" tabIndex={-1} onChange={readFile} />
                        <button type="button" onClick={() => fileRef.current?.click()} disabled={reading} className="min-h-11 rounded-lg border border-brand-200 px-4 py-2 font-semibold text-brand-800 disabled:opacity-50">{m.choose}</button>
                        <p className="text-xs text-slate-600">{m.limits}</p>
                        {fileName ? <p className="break-words text-sm font-semibold text-slate-800">{fileName}</p> : null}
                        {reading ? <p role="status">{m.reading}</p> : null}
                        {error ? <p role="alert" className="text-sm font-semibold text-red-700">{m.errors[error] || m.errors.read}</p> : null}
                        {result ? <>
                            {!result.boundaries.length ? <p role="status">{m.noAreas}</p> : <>
                                <svg viewBox="0 0 600 300" role="img" aria-label={m.preview} className="w-full rounded-lg bg-slate-100">
                                    {preview.map(item => <polygon key={item.key} points={item.svgPoints} fill={item.style.fillColor} fillOpacity={selected.has(item.key) ? item.style.fillOpacity : 0.03}
                                        stroke={item.style.color} strokeOpacity={selected.has(item.key) ? item.style.strokeOpacity : 0.15} strokeWidth={item.style.weight} vectorEffect="non-scaling-stroke"><title>{item.name}</title></polygon>)}
                                </svg>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <h3 className="font-bold text-slate-900">{m.select} · {areas.length} {m.selected}</h3>
                                    <div className="flex gap-2"><button type="button" onClick={() => setSelected(new Set(result.boundaries.map(item => item.key)))} className="min-h-11 px-2 text-sm font-semibold text-brand-800">{m.all}</button>
                                        <button type="button" onClick={() => setSelected(new Set())} className="min-h-11 px-2 text-sm font-semibold text-brand-800">{m.none}</button></div>
                                </div>
                                <div className="space-y-2">{result.boundaries.map(item => <div key={item.key} className="rounded-lg border border-slate-200 p-3">
                                    <label className="flex min-h-11 cursor-pointer items-start gap-3">
                                        <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-brand-700" checked={selected.has(item.key)} onChange={event => setSelected(current => {
                                            const next = new Set(current); if (event.target.checked) next.add(item.key); else next.delete(item.key); return next;
                                        })} />
                                        <span className="min-w-0"><span className="block break-words font-semibold text-slate-900">{item.name}</span><span className="block break-words text-xs text-slate-500">{item.folder} · {item.points.length} {m.corners}</span></span>
                                    </label>
                                    <details><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-brand-800">{m.styles}</summary>
                                        <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-3">
                                            {['color', 'fillColor'].map((field, index) => <label key={field} className="text-xs font-semibold text-slate-700">{index ? m.fill : m.outline}
                                                <input type="color" aria-label={`${item.name} — ${index ? m.fill : m.outline}`} value={item.style[field]} onChange={event => updateStyle(item.key, { [field]: event.target.value })} className="mt-1 block h-11 w-full rounded border border-slate-200" /></label>)}
                                            <label className="text-xs font-semibold text-slate-700" htmlFor={`${id}-${item.key}-width`}>{m.width}
                                                <input id={`${id}-${item.key}-width`} type="number" min="0" max="12" step="any" value={item.style.weight} onChange={event => { const n = Number(event.target.value); if (Number.isFinite(n) && n >= 0 && n <= 12) updateStyle(item.key, { weight: n }); }} className="mt-1 block min-h-11 w-full rounded border border-slate-200 px-2" /></label>
                                            {['fillOpacity', 'strokeOpacity'].map(field => <label key={field} className="text-xs font-semibold text-slate-700">{m[field]} · {Math.round(item.style[field] * 100)}%
                                                <input type="range" min="0" max="1" step="0.01" aria-label={`${item.name} — ${m[field]}`} value={item.style[field]} onChange={event => updateStyle(item.key, { [field]: Number(event.target.value) })} className="block min-h-11 w-full accent-brand-700" /></label>)}
                                        </div>
                                    </details>
                                </div>)}</div>
                            </>}
                            {result.skipped.length ? <details className="rounded-lg bg-slate-50 p-3"><summary className="min-h-11 cursor-pointer font-semibold">{m.skipped} ({result.skipped.length})</summary><ul className="space-y-2 text-sm text-slate-600">{result.skipped.map(item => <li key={item.key}><span className="font-semibold">{item.name || m.unnamed}</span>: {m.errors[item.reason]}</li>)}</ul></details> : null}
                            {result.warnings.length ? <p className="text-sm text-amber-800">{m.external}</p> : null}
                        </> : null}
                        <p className="text-xs leading-5 text-slate-600">{m.private}</p><p className="text-xs leading-5 text-slate-600">{m.hide}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t p-4">
                        {result?.boundaries.length && capacity ? <p role="status" className="w-full text-sm font-semibold text-amber-800">{m.errors[capacity]}</p> : null}
                        <Dialog.Close className="min-h-11 rounded-lg border border-slate-200 px-4 py-2 font-semibold">{m.cancel}</Dialog.Close>
                        <button type="button" disabled={disabled || reading || !result || Boolean(capacity)} onClick={handleImport} className="min-h-11 rounded-lg bg-brand-700 px-4 py-2 font-semibold text-white disabled:opacity-40">{m.add}</button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
