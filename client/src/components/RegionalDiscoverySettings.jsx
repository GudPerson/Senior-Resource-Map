import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { useLocale } from '../contexts/LocaleContext.jsx';
import RegionalDiscoveryView from '../features/regional-discovery/RegionalDiscoveryView.jsx';
import useRegionalDiscovery from '../features/regional-discovery/useRegionalDiscovery.js';
import { normalizeRegionalDiscoveryPayload } from '../features/regional-discovery/regionalDiscoveryContract.js';
import { getRegionalDiscoveryCopy } from '../pages/RegionalDiscoveryPage.jsx';
import {
    buildRegionalDiscoveryPublishIntent, getPublishedRegionalDiscoveryUrl,
    normalizeRegionalDiscoverySettings, containHandledRegionalPreviewEscape,
} from '../features/regional-discovery/regionalDiscoverySettings.js';

const controlClass = 'min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50';
const entryKey = entry => `${entry.resourceType}:${entry.resourceId}`;

function savedDocument(value) {
    if (!Number.isSafeInteger(value?.revision) || value.revision < 0 || value.revision > 2147483647) {
        throw new Error('Invalid regional settings response.');
    }
    return { revision: value.revision, config: normalizeRegionalDiscoverySettings(value.config) };
}

function OwnerPreview({ mapId, revision, initialPayload }) {
    const { t } = useLocale();
    const token = `owner:${mapId}:${revision}`;
    const evaluateImpl = useCallback(async (_token, { postalCode, signal }) => normalizeRegionalDiscoveryPayload(
        await api.previewRegionalDiscovery(mapId, { revision, ...(postalCode !== undefined ? { postalCode } : {}) }, { signal }),
    ), [mapId, revision]);
    const { postalInput, setPostalInput, submitPostal, clearPostal, state, retry } = useRegionalDiscovery({ token, initialPayload, evaluateImpl });
    const copy = getRegionalDiscoveryCopy(t);
    const error = state.error ? t(state.error === 'invalid-postal' ? 'regionalDiscoveryInvalidPostal'
        : state.error === 'unavailable' ? 'regionalDiscoveryUnavailable' : 'regionalDiscoveryRequestFailed') : '';
    return <section aria-label="Saved regional preview" className="space-y-2">
        <p className="text-sm text-slate-600">Preview of saved settings. This does not publish your directory.</p>
        {(state.error || ['coverage-unconfirmed', 'postal-unresolved'].includes(state.payload?.evaluation.status)) &&
            <button type="button" className={controlClass} disabled={state.loading || state.evaluating} onClick={() => void retry()}>{t('regionalDiscoveryRetry')}</button>}
        <div className="h-[720px] overflow-hidden rounded-xl border" onKeyDown={containHandledRegionalPreviewEscape}>
            <RegionalDiscoveryView payload={state.payload} loading={state.loading} evaluating={state.evaluating} error={error}
                postalInput={postalInput} onPostalInputChange={setPostalInput} onEvaluate={submitPostal} onClearPostal={clearPostal}
                copy={copy} className="h-full" />
        </div>
    </section>;
}

function escapeAttribute(value) {
    return String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/** Optional owner-only editor. Loading, saving and previewing never invoke onPublish. */
export default function RegionalDiscoverySettings({ mapId, mapName, onPublish, disabled = false, publicationRefreshKey = '' }) {
    const [saved, setSaved] = useState(null);
    const [draft, setDraft] = useState(null);
    const [options, setOptions] = useState(null);
    const [publication, setPublication] = useState(null);
    const [readbackKey, setReadbackKey] = useState(null);
    const [preview, setPreview] = useState(null);
    const [busy, setBusy] = useState('load');
    const [error, setError] = useState('');
    const [conflict, setConflict] = useState(false);
    const [feedback, setFeedback] = useState('');
    const [availabilityWarning, setAvailabilityWarning] = useState('');
    const [reload, setReload] = useState(0);
    const requestEpoch = useRef(0);
    const activeRequest = useRef(null);
    const hasUnsavedChanges = saved && draft && JSON.stringify(saved.config) !== JSON.stringify(draft);
    const locked = disabled || Boolean(busy);
    const regionalPath = readbackKey === publicationRefreshKey ? getPublishedRegionalDiscoveryUrl(publication) : '';
    const regionalUrl = regionalPath && typeof window !== 'undefined' ? new URL(regionalPath, window.location.origin).toString() : regionalPath;
    const regionalCode = regionalUrl ? `<iframe src="${escapeAttribute(regionalUrl)}" title="${escapeAttribute(`${mapName || 'CareAround SG'} regional directory`)}" width="100%" height="720" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" style="border:0"></iframe>` : '';
    const services = useMemo(() => (options?.serviceOptions || []).filter(service => ['hard', 'soft'].includes(service.resourceType)), [options]);

    useEffect(() => {
        const epoch = ++requestEpoch.current;
        const controller = new AbortController();
        activeRequest.current?.abort();
        activeRequest.current = controller;
        setBusy('load'); setError(''); setAvailabilityWarning(''); setConflict(false); setPreview(null);
        setSaved(null); setDraft(null); setOptions(null);
        api.getRegionalDiscoveryDocument(mapId, { signal: controller.signal }).then(value => {
            if (epoch !== requestEpoch.current) return;
            const document = savedDocument(value);
            setSaved(document); setDraft(document.config); setOptions(value.options);
        }).catch(() => {
            if (epoch === requestEpoch.current) setError('Regional settings could not load. You can still use the ordinary Share controls.');
        }).finally(() => { if (epoch === requestEpoch.current) setBusy(''); });
        return () => { ++requestEpoch.current; activeRequest.current?.abort(); };
    }, [mapId, reload]);

    // C1 readback is independent of draft mode. A changed publication invalidates old copy controls immediately.
    useEffect(() => {
        const controller = new AbortController();
        let current = true;
        setPublication(null); setReadbackKey(null);
        api.getRegionalDiscoveryDocument(mapId, { signal: controller.signal }).then(value => {
            if (current) { setPublication(value.publication); setReadbackKey(publicationRefreshKey); }
        }).catch(() => { /* No publication proof means no regional URL. Draft/compact controls remain independent. */ });
        return () => { current = false; controller.abort(); };
    }, [mapId, publicationRefreshKey, reload]);

    function edit(update) {
        setDraft(current => update(current)); setFeedback(''); setError(''); setPreview(null);
    }
    function updateEntry(key, change) {
        edit(current => ({ ...current, entries: current.entries.map(entry => entryKey(entry) === key ? { ...entry, ...change } : entry) }));
    }
    function toggleService(service, checked) {
        edit(current => ({ ...current, entries: checked ? [...current.entries, {
            resourceType: service.resourceType, resourceId: service.resourceId, mapPlacement: 'published-locations',
            distanceSource: 'published-locations', emailMode: 'original', phoneMode: 'original',
        }] : current.entries.filter(entry => entryKey(entry) !== entryKey(service)) }));
    }
    function reportFailure(err) {
        if (err?.status === 409) { setConflict(true); setError('These settings changed in another session. Reload saved settings before trying again. Your draft has been kept.'); }
        else setError('Regional settings could not be completed. Check your choices and try again.');
    }
    async function perform(action) {
        if (locked || conflict) return;
        const epoch = ++requestEpoch.current;
        const controller = new AbortController();
        activeRequest.current?.abort(); activeRequest.current = controller;
        setBusy(action); setError(''); setFeedback(''); setAvailabilityWarning('');
        try {
            if (action === 'save') {
                const config = normalizeRegionalDiscoverySettings(draft);
                const value = await api.replaceRegionalDiscoveryDocument(mapId, { revision: saved.revision, config }, { signal: controller.signal });
                if (epoch !== requestEpoch.current) return;
                const document = savedDocument(value);
                setSaved(document); setDraft(document.config); setPreview(null);
                setFeedback('Settings saved. The published directory has not changed.');
                // Refresh approval availability for newly included home areas; never read recipient values.
                setOptions(current => ({ ...current, contactAvailability: null }));
                try {
                    const refreshed = await api.getRegionalDiscoveryDocument(mapId, { signal: controller.signal });
                    if (epoch === requestEpoch.current) setOptions(refreshed.options);
                } catch {
                    if (epoch === requestEpoch.current) setAvailabilityWarning('Approval availability could not refresh. Reload saved settings to check it again.');
                }
            } else {
                const intent = buildRegionalDiscoveryPublishIntent({ savedRevision: saved.revision, hasUnsavedChanges, config: draft });
                if (action === 'preview') {
                    if (intent.mode !== 'regional-discovery') return;
                    const payload = normalizeRegionalDiscoveryPayload(await api.previewRegionalDiscovery(mapId, { revision: saved.revision }, { signal: controller.signal }));
                    if (epoch === requestEpoch.current) setPreview({ revision: saved.revision, payload });
                } else {
                    const published = await onPublish?.(intent);
                    if (epoch === requestEpoch.current && published) setFeedback('Publication updated. Regional copy controls appear only when the published directory is available.');
                }
            }
        } catch (err) { if (epoch === requestEpoch.current) reportFailure(err); }
        finally { if (epoch === requestEpoch.current) setBusy(''); }
    }
    async function copy(value) {
        if (!value || locked) return;
        try { await navigator.clipboard.writeText(value); setFeedback('Copied.'); }
        catch { setError('Copy failed. Select and copy the published URL instead.'); }
    }

    return <details className="rounded-2xl border border-slate-200 p-4" data-regional-discovery-settings="true">
        <summary className="cursor-pointer py-2 font-semibold text-slate-900">Regional directory (optional)</summary>
        <div className="mt-3 space-y-4">
            <p className="text-sm text-slate-600">Choose a curated regional directory for embedding. Save and Preview do not publish. Use the explicit publication button below to change the embedded view.</p>
            {busy === 'load' && <p role="status">Loading regional settings…</p>}
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            {availabilityWarning && <p role="status" className="text-sm text-amber-800">{availabilityWarning}</p>}
            {feedback && <p role="status" className="text-sm text-teal-800">{feedback}</p>}
            {(!saved || conflict) && !busy && <button type="button" className={controlClass} disabled={disabled} onClick={() => setReload(value => value + 1)}>Reload saved settings{draft ? ' (discard draft)' : ''}</button>}
            {draft && <>
                <fieldset disabled={locked || conflict} className="space-y-4">
                    <label className="flex flex-wrap items-center gap-3">Embedded view
                        <select className={controlClass} value={draft.mode} onChange={event => edit(current => ({ ...current, mode: event.target.value }))}>
                            <option value="compact">Compact map</option><option value="regional-discovery">Regional directory</option>
                        </select>
                    </label>
                    {draft.mode === 'regional-discovery' && <>
                        <fieldset className="space-y-2"><legend className="font-medium">Included local areas</legend>
                            {(options?.subregions || []).map(area => <label key={area.id} className="flex min-h-[44px] items-center gap-2">
                                <input type="checkbox" checked={draft.includedSubregionIds.includes(area.id)} onChange={event => edit(current => ({ ...current, includedSubregionIds: event.target.checked
                                    ? [...current.includedSubregionIds, area.id] : current.includedSubregionIds.filter(id => id !== area.id) }))} />{area.name}
                            </label>)}
                            {!options?.subregions?.length && <p className="text-sm text-slate-600">No configured local areas are available.</p>}
                        </fieldset>
                        <fieldset><legend className="font-medium">Regional map extent</legend><div className="grid grid-cols-2 gap-2">
                            {['West', 'South', 'East', 'North'].map((label, index) => <label key={label} className="text-sm">{label}
                                <input type="number" step="any" className={`${controlClass} w-full`} value={Number.isNaN(draft.regionExtent[index]) ? '' : draft.regionExtent[index]}
                                    onChange={event => edit(current => ({ ...current, regionExtent: current.regionExtent.map((value, i) => i === index ? event.target.valueAsNumber : value) }))} />
                            </label>)}
                        </div></fieldset>
                        <fieldset className="space-y-3"><legend className="font-medium">Curated services already in this map</legend>
                            {services.map(service => {
                                const key = entryKey(service);
                                const entry = draft.entries.find(item => entryKey(item) === key);
                                const emailApproved = options?.contactAvailability?.originalEmail?.find(item => entryKey(item) === key)?.available;
                                return <div key={key} className="space-y-2 rounded-xl border p-3">
                                    <label className="flex min-h-[44px] items-center gap-2"><input type="checkbox" checked={Boolean(entry)} onChange={event => toggleService(service, event.target.checked)} />{service.name}</label>
                                    {entry && <div className="grid gap-2 sm:grid-cols-2">
                                        <label className="text-sm">Map placement<select className={`${controlClass} block w-full`} value={entry.mapPlacement} onChange={event => updateEntry(key, { mapPlacement: event.target.value })}>
                                            <option value="published-locations">Approved public locations</option><option value="unplotted">Directory only — no pin</option>
                                        </select></label>
                                        <label className="text-sm">Distance<select className={`${controlClass} block w-full`} value={entry.distanceSource} onChange={event => updateEntry(key, { distanceSource: event.target.value })}>
                                            <option value="published-locations">Approved public locations</option><option value="none">Do not show distance</option>
                                        </select></label>
                                        {['email', 'phone'].map(channel => <label key={channel} className="text-sm">{channel === 'email' ? 'Email' : 'Phone'}
                                            <select className={`${controlClass} block w-full`} value={entry[`${channel}Mode`]} onChange={event => updateEntry(key, { [`${channel}Mode`]: event.target.value })}>
                                                <option value="original">Original (subject to permission)</option><option value="hidden">Hidden</option><option value="home-sr">Replace with home-area enquiry contact</option>
                                            </select>
                                        </label>)}
                                        <p className="text-xs text-slate-600 sm:col-span-2">Original email: {emailApproved ? 'approved availability confirmed' : 'approval unavailable or not confirmed'}. Selecting a contact mode does not grant publication approval.</p>
                                    </div>}
                                </div>;
                            })}
                            {!services.length && <p className="text-sm text-slate-600">No publishable services are available in this map.</p>}
                            {draft.entries.filter(entry => !services.some(service => entryKey(service) === entryKey(entry))).map(entry => <div key={entryKey(entry)} className="flex items-center justify-between gap-2 rounded border p-2">
                                <span className="text-sm">Previously selected service is no longer available.</span>
                                <button type="button" className={controlClass} onClick={() => toggleService(entry, false)}>Remove selection</button>
                            </div>)}
                        </fieldset>
                        <div className="space-y-1 text-sm text-slate-600"><p>Replacement email and phone use the senior’s home area. Only approved enquiry contacts can appear. This editor cannot approve or change recipients.</p>
                            {draft.includedSubregionIds.map(id => {
                                const area = options?.subregions?.find(item => item.id === id);
                                const availability = options?.contactAvailability?.replacements?.find(item => item.subregionId === id);
                                return <p key={id}>{area?.name || 'Selected area'}: email {availability?.email ? 'available' : 'not confirmed'}, phone {availability?.phone ? 'available' : 'not confirmed'}.</p>;
                            })}
                        </div>
                    </>}
                </fieldset>
                {hasUnsavedChanges && <p role="status" className="text-sm text-amber-800">Unsaved regional settings. Save before Preview or explicit publication. Ordinary Share does not promote this draft.</p>}
                <div className="flex flex-wrap gap-2">
                    <button type="button" className={controlClass} disabled={locked || conflict || !hasUnsavedChanges} onClick={() => void perform('save')}>Save regional settings</button>
                    {!conflict && <button type="button" className={controlClass} disabled={locked} onClick={() => setReload(value => value + 1)}>Reload saved settings{hasUnsavedChanges ? ' (discard draft)' : ''}</button>}
                    <button type="button" className={controlClass} disabled={locked || conflict || hasUnsavedChanges || !saved.revision || draft.mode !== 'regional-discovery'} onClick={() => void perform('preview')}>Preview saved regional directory</button>
                    <button type="button" className={controlClass} disabled={locked || conflict || hasUnsavedChanges || (draft.mode === 'regional-discovery' && !saved.revision)} onClick={() => void perform('publish')}>
                        {draft.mode === 'regional-discovery' ? 'Publish saved regional directory' : 'Publish compact view'}
                    </button>
                </div>
                {preview && <OwnerPreview key={`owner:${mapId}:${preview.revision}`} mapId={mapId} revision={preview.revision} initialPayload={preview.payload} />}
            </>}
            {regionalUrl && <div className="space-y-2 border-t pt-3">
                <label className="block text-sm font-medium">Published regional URL<input readOnly className={`${controlClass} mt-1 w-full`} value={regionalUrl} /></label>
                <div className="flex flex-wrap gap-2"><button type="button" className={controlClass} disabled={locked} onClick={() => void copy(regionalUrl)}>Copy regional URL</button>
                    <button type="button" className={controlClass} disabled={locked} onClick={() => void copy(regionalCode)}>Copy regional embed code</button></div>
            </div>}
        </div>
    </details>;
}
