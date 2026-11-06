import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { buildSavedAssetKey } from '../lib/savedAssets.js';
import { AREA_RESOURCE_MAX_VENUES, filterAreaResources, getAreaResourcePlaceIds } from '../lib/mapAreaResourceSelection.js';
import { formatAreaMessage as f, getMapAreaResourceMessages } from '../lib/mapAreaResourceMessages.js';

const keyFor = row => buildSavedAssetKey(row.resourceType, row.resourceId);
const hasCoordinates = location => location?.lat !== null && location?.lat !== undefined && location?.lat !== ''
    && location?.lng !== null && location?.lng !== undefined && location?.lng !== ''
    && Number.isFinite(Number(location.lat)) && Number.isFinite(Number(location.lng));

export default function MapAreaResourceChooser({ rows = [], existingAssets = [], scopeKey, disabled = false,
    onSaveAndAdd, onBusyChange }) {
    const { locale } = useLocale(); const m = getMapAreaResourceMessages(locale);
    const [query, setQuery] = useState(''), [type, setType] = useState('all');
    const [selected, setSelected] = useState(new Set()), [choices, setChoices] = useState({});
    const [busy, setBusy] = useState(false), [stopping, setStopping] = useState(false);
    const [results, setResults] = useState([]), [error, setError] = useState('');
    const operation = useRef(null), currentScope = useRef(scopeKey), busyListener = useRef(onBusyChange);
    currentScope.current = scopeKey; busyListener.current = onBusyChange;
    useEffect(() => () => { operation.current?.abort(); busyListener.current?.(false); }, []);
    useEffect(() => {
        operation.current?.abort(); setSelected(new Set()); setChoices({}); setResults([]); setError('');
        setQuery(''); setType('all'); setBusy(false); setStopping(false); busyListener.current?.(false);
    }, [scopeKey]);
    const existing = useMemo(() => new Set(existingAssets.map(keyFor)), [existingAssets]);
    const shown = useMemo(() => filterAreaResources(rows, query, type), [rows, query, type]);
    const stateByKey = new Map(results.map(row => [row.assetKey, row.status]));
    const choiceFor = row => choices[keyFor(row)] || { all: false, ids: getAreaResourcePlaceIds(row) };
    const supported = row => { const c = choiceFor(row); return c.all || (c.ids.length > 0 && c.ids.length <= AREA_RESOURCE_MAX_VENUES); };
    const selectable = row => !existing.has(keyFor(row)) && supported(row);
    const selectedRows = rows.filter(row => selected.has(keyFor(row)) && !existing.has(keyFor(row)));
    const outsideCount = selectedRows.filter(row => !shown.some(match => keyFor(match) === keyFor(row))).length;
    const matching = shown.filter(selectable);
    const everyShownSelected = matching.length > 0 && matching.every(row => selected.has(keyFor(row)));
    const added = results.filter(row => ['added', 'already_on_map'].includes(row.status)).length;
    function toggleResource(row) {
        const key = keyFor(row);
        setSelected(current => { const next = new Set(current); next.has(key) ? next.delete(key) : next.add(key); return next; });
    }
    function updateChoice(row, update) {
        const key = keyFor(row);
        setChoices(current => ({ ...current, [key]: update(current[key] || { all: false, ids: getAreaResourcePlaceIds(row) }) }));
    }
    async function submit() {
        if (busy || disabled || !selectedRows.length || selectedRows.some(row => !supported(row))) return;
        const controller = new AbortController(), startedScope = scopeKey;
        operation.current = controller; setBusy(true); setStopping(false); setError(''); setResults([]); busyListener.current?.(true);
        try {
            const items = selectedRows.map(row => ({ resourceType: row.resourceType, resourceId: row.resourceId,
                ...(choiceFor(row).all ? {} : { selectedPlaceIds: choiceFor(row).ids }) }));
            const result = await onSaveAndAdd(items, { signal: controller.signal, onProgress: value => {
                if (currentScope.current === startedScope && operation.current === controller) setResults(value);
            } });
            if (currentScope.current !== startedScope || operation.current !== controller) return;
            setResults(result.items);
            const completed = new Set(result.items.filter(row => ['added', 'already_on_map'].includes(row.status)).map(row => row.assetKey));
            setSelected(current => new Set([...current].filter(key => !completed.has(key))));
            if (result.rateLimited) setError(m.rateLimited);
            else if (!result.reconciled) setError(m.addError);
        } catch (cause) {
            if (currentScope.current === startedScope && operation.current === controller) setError(cause?.message || m.addError);
        } finally {
            if (operation.current === controller) {
                operation.current = null; setBusy(false); setStopping(false); busyListener.current?.(false);
            }
        }
    }
    return <section className="flex min-h-0 flex-1 flex-col" data-map-area-resource-chooser>
        <div className="shrink-0 space-y-3 border-b border-slate-100 p-4">
            <p className="text-xs leading-5 text-slate-600">{m.saveHelp}</p>
            <input type="search" aria-label={m.search} placeholder={m.search} value={query} disabled={busy}
                onChange={event => setQuery(event.target.value)} className="input-field w-full" />
            <div className="flex flex-wrap items-center gap-3">
                <select aria-label={m.all} value={type} onChange={event => setType(event.target.value)} disabled={busy} className="input-field min-h-11">
                    <option value="all">{m.all}</option><option value="hard">{m.hard}</option><option value="soft">{m.soft}</option>
                </select>
                <span className="text-sm font-bold text-brand-800" data-map-area-selected-count>{f(m.selected, { count: selectedRows.length })}</span>
                <button type="button" className="btn-ghost min-h-11 text-sm" disabled={busy || !selected.size} onClick={() => setSelected(new Set())}>{m.clear}</button>
            </div>
            {outsideCount > 0 ? <p className="text-xs text-slate-500">{f(m.outsideResults, { count: outsideCount })}</p> : null}
            <label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={everyShownSelected}
                disabled={busy || disabled || !matching.length} onChange={event => setSelected(current => {
                    const next = new Set(current); matching.forEach(row => event.target.checked ? next.add(keyFor(row)) : next.delete(keyFor(row))); return next;
                })} />{m.selectResults}</label>
        </div>
        <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {shown.map(row => {
                const key = keyFor(row), choice = choiceFor(row), already = existing.has(key), picked = selected.has(key);
                const allLocations = row.allLocations || row.locations || [];
                const uniqueLocations = [...new Map((row.locations || []).map((location, index) => [Number(location.id) > 0 ? `place-${location.id}` : `missing-${index}`, location])).values()];
                return <li key={key} data-map-area-resource={key} className={`rounded-2xl border p-3 ${picked ? 'border-brand-300 bg-brand-50/40' : 'border-slate-200 bg-white'}`}>
                    <div className="flex items-start gap-3">
                        <input type="checkbox" aria-label={`${m.selectResource}: ${row.name}`} checked={picked && !already} disabled={busy || disabled || already || (!picked && !supported(row))}
                            data-map-area-resource-select={key} className="mt-1 h-5 w-5 shrink-0" onChange={() => toggleResource(row)} />
                        <div className="min-w-0 flex-1"><a href={row.detailPath} target="_blank" rel="noopener noreferrer" className="break-words text-sm font-bold text-brand-800 underline underline-offset-2">{row.name}</a>
                            <p className="mt-1 text-xs text-slate-500">{m[row.resourceType]}</p>
                            {already ? <p data-map-area-resource-state="already_on_map" className="mt-2 text-xs font-bold text-brand-700">{m.already}</p> : null}
                            {stateByKey.has(key) ? <p data-map-area-add-result={stateByKey.get(key)} className="mt-2 text-xs font-semibold" role="status">{m[`status_${stateByKey.get(key)}`]}</p> : null}
                        </div>
                    </div>
                    <details className="mt-3 rounded-xl bg-slate-50 p-3" open={picked || !getAreaResourcePlaceIds(row).length}>
                        <summary className="cursor-pointer text-xs font-bold text-slate-700">{m.venues} · {f(m.insideLocations, { count: uniqueLocations.length })}</summary>
                        <p className="mt-2 text-xs leading-5 text-slate-500">{m.venueHelp}</p>
                        <ul className="mt-2 space-y-2">{uniqueLocations.map((location, index) => {
                            const id = Number(location.id), valid = Number.isSafeInteger(id) && id > 0;
                            return <li key={valid ? id : `missing-${index}`}><label className="flex items-start gap-2 text-sm leading-5">
                                <input type="checkbox" aria-label={`${m.selectedVenue}: ${location.name || location.address || row.name}`}
                                    data-map-area-venue={`${key}:${valid ? id : 'unsupported'}`} disabled={busy || disabled || already || choice.all || !valid}
                                    checked={valid && choice.ids.includes(id)} className="mt-1 shrink-0" onChange={event => updateChoice(row, previous => ({ all: false,
                                        ids: event.target.checked ? [...new Set([...previous.ids, id])] : previous.ids.filter(value => value !== id) }))} />
                                <span className="min-w-0 break-words">{location.name ? <strong className="block">{location.name}</strong> : null}{location.address || location.postalCode || location.postal_code || row.name}</span>
                            </label></li>;
                        })}</ul>
                        {!getAreaResourcePlaceIds(row).length ? <p className="mt-2 text-xs text-amber-800">{m.unsupported}</p> : null}
                        <label className="mt-3 flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" data-map-area-all-venues={key}
                            checked={choice.all} disabled={busy || disabled || already} onChange={event => updateChoice(row, previous => ({ ...previous, all: event.target.checked }))} />{m.allVenues}</label>
                        {choice.all ? <><p className="text-xs leading-5 text-slate-600">{m.allVenuesHelp}</p><ul className="mt-2 space-y-2 text-xs leading-5 text-slate-600">{allLocations.map((location, index) =>
                            <li key={index} className="break-words">{location.name || location.address || row.name}{location.address && location.name ? ` · ${location.address}` : ''}{!hasCoordinates(location) ? ` · ${m.notMapped}` : ''}</li>)}</ul></> : null}
                        {picked && !supported(row) ? <p role="alert" className="mt-2 text-xs text-amber-800">{m.chooseVenue}</p> : null}
                    </details>
                </li>;
            })}
        </ul>
        <footer className="shrink-0 space-y-2 border-t border-slate-200 bg-white p-4">
            <div data-map-area-add-status aria-live="polite" className="text-xs leading-5 text-slate-600">{busy ? (stopping ? m.stopping : m.progress)
                : results.length ? f(m.summary, { added, remaining: results.length - added }) : null}</div>
            {error ? <p role="alert" className="text-sm text-amber-800">{error}</p> : null}
            {busy ? <button type="button" className="btn-secondary min-h-11 w-full" data-map-area-stop disabled={stopping} onClick={() => { operation.current?.abort(); setStopping(true); }}>{m.stop}</button>
                : <button type="button" className="btn-primary min-h-11 w-full" data-map-area-save-add disabled={disabled || !selectedRows.length || selectedRows.some(row => !supported(row))} onClick={submit}>{f(m.add, { count: selectedRows.length })}</button>}
        </footer>
    </section>;
}
