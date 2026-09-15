import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArchiveRestore, ExternalLink, MapPinned, Plus, Send, Share2, Trash2 } from 'lucide-react';

import { useConfirmDialog } from '../../components/ConfirmDialog.jsx';
import { api } from '../../lib/api.js';
import GovernedMapUpdates from '../../components/GovernedMapUpdates.jsx';
import { GOVERNED_MAP_LIFECYCLE_UI_ENABLED } from '../../lib/governedPilotRelease.js';

function keyOf(resource) {
    return `${resource.resourceType}:${resource.resourceId}`;
}

function Feedback({ value }) {
    if (!value) return null;
    return <p className={`rounded-xl border px-4 py-3 text-sm font-semibold ${value.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{value.message}</p>;
}

export default function GovernedMapsPage() {
    const { confirm: requestConfirmation, confirmDialog } = useConfirmDialog();
    const [regions, setRegions] = useState([]);
    const [maps, setMaps] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [createForm, setCreateForm] = useState({ regionGroupId: '', name: '', description: '' });
    const [editForm, setEditForm] = useState({ name: '', description: '', mapStyle: 'default', pinStyle: 'category-bubble', pinSize: 'standard' });
    const [allowedOrigins, setAllowedOrigins] = useState('');
    const [reasons, setReasons] = useState({});
    const [feedback, setFeedback] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const selected = useMemo(() => maps.find((map) => Number(map.id) === Number(selectedId)) || null, [maps, selectedId]);
    const selectedRegion = useMemo(() => regions.find((region) => Number(region.id) === Number(selected?.regionGroupId || createForm.regionGroupId)) || null, [createForm.regionGroupId, regions, selected]);
    const existingKeys = useMemo(() => new Set((selected?.resources || []).map(keyOf)), [selected?.resources]);
    const availableResources = useMemo(() => (selectedRegion?.resources || []).filter((resource) => !existingKeys.has(keyOf(resource))), [existingKeys, selectedRegion]);

    const load = useCallback(async (preferredId = null) => {
        setLoading(true);
        try {
            const [regionResult, mapResult] = await Promise.all([api.getGovernedMapRegions(), api.getGovernedMaps()]);
            const nextRegions = regionResult.regions || [];
            const nextMaps = mapResult.maps || [];
            setRegions(nextRegions);
            setMaps(nextMaps);
            setSelectedId((current) => {
                const candidate = preferredId || current;
                return nextMaps.some((map) => Number(map.id) === Number(candidate)) ? Number(candidate) : nextMaps[0]?.id || null;
            });
            setCreateForm((current) => ({ ...current, regionGroupId: current.regionGroupId || nextRegions[0]?.id || '' }));
        } catch (error) {
            setFeedback({ type: 'error', message: error.message || 'Unable to load Governed Care Maps.' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (!selected) return;
        setEditForm({
            name: selected.name || '',
            description: selected.description || '',
            mapStyle: selected.presentation?.mapStyle || 'default',
            pinStyle: selected.presentation?.pinStyle || 'category-bubble',
            pinSize: selected.presentation?.pinSize || 'standard',
        });
        setAllowedOrigins((selected.publication?.allowedOrigins || []).join('\n'));
    }, [selected]);

    async function perform(action, successMessage) {
        setSaving(true);
        setFeedback(null);
        try {
            const result = await action();
            const map = result.map;
            await load(map?.id || selectedId);
            setFeedback({ type: 'success', message: successMessage });
        } catch (error) {
            setFeedback({ type: 'error', message: error.message || 'The action could not be completed.' });
        } finally {
            setSaving(false);
        }
    }

    async function createMap(event) {
        event.preventDefault();
        await perform(() => api.createGovernedMap({ ...createForm, regionGroupId: Number(createForm.regionGroupId) }), 'Governed Care Map created.');
        setCreateForm((current) => ({ ...current, name: '', description: '' }));
    }

    async function saveMap(event) {
        event.preventDefault();
        await perform(() => api.updateGovernedMap(selected.id, {
            name: editForm.name,
            description: editForm.description,
            presentation: {
                mapStyle: editForm.mapStyle,
                pinStyle: editForm.pinStyle,
                pinSize: editForm.pinSize,
                pinsVisible: true,
            },
            expectedRevision: selected.revision,
        }), 'Map details and embed design saved.');
    }

    async function publish() {
        const confirmed = await requestConfirmation({
            title: selected.publication ? 'Update the published map?' : 'Publish this Governed Care Map?',
            message: 'The public link and embed will contain only the current map resources. Every resource must have active public-listing and external-sharing agreement coverage.',
            tone: 'info',
            confirmLabel: selected.publication ? 'Update publication' : 'Publish map',
        });
        if (!confirmed) return;
        const origins = allowedOrigins.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
        await perform(() => api.publishGovernedMap(selected.id, { allowedOrigins: origins }), 'Published map updated.');
    }

    async function retire() {
        const reason = String(reasons.retirement || '').trim();
        if (reason.length < 10) return setFeedback({ type: 'error', message: 'Enter a retirement reason of at least 10 characters.' });
        const confirmed = await requestConfirmation({ title: 'Start 30-day retirement?', message: 'The public map and embed will become unavailable immediately. Any current resource steward can restore it with a reason during the next 30 days.', tone: 'warning', confirmLabel: 'Start retirement' });
        if (confirmed) await perform(() => api.retireGovernedMap(selected.id, { reason }), 'Retirement started and participants were notified.');
    }

    async function restore() {
        const reason = String(reasons.restore || '').trim();
        if (reason.length < 10) return setFeedback({ type: 'error', message: 'Enter a restore reason of at least 10 characters.' });
        await perform(() => api.restoreGovernedMap(selected.id, { reason }), 'Map restored and participants were notified.');
    }

    async function withdraw(resource) {
        const reason = String(reasons[keyOf(resource)] || '').trim();
        if (reason.length < 10) return setFeedback({ type: 'error', message: 'Enter a resource removal reason of at least 10 characters.' });
        const confirmed = await requestConfirmation({ title: `Remove ${resource.name}?`, message: 'This resource will be removed from the map and any active public publication immediately. Other resources remain.', tone: 'warning', confirmLabel: 'Remove resource' });
        if (confirmed) await perform(() => api.withdrawGovernedMapResource(selected.id, { resourceType: resource.resourceType, resourceId: resource.resourceId, reason }), `${resource.name} removed from the map.`);
    }

    if (loading && maps.length === 0) return <main className="p-8 text-sm font-semibold text-slate-500">Loading Governed Care Maps…</main>;

    return (
        <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8" data-testid="governed-maps-page">
            <header><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"><MapPinned size={22} /></span><div><h1 className="text-3xl font-black text-slate-950">Governed Care Maps</h1><p className="text-sm text-slate-600">Shared stewardship follows the resources on each map. The creator receives no permanent ownership right.</p></div></div></header>
            <Feedback value={feedback} />
            <GovernedMapUpdates refreshKey={maps} />

            <section className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
                <aside className="space-y-5">
                    <form onSubmit={createMap} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                        <h2 className="font-black text-slate-950">Create a map</h2>
                        <label className="mt-4 block text-sm font-bold text-slate-700">Region group<select className="input-field mt-1" required value={createForm.regionGroupId} onChange={(event) => setCreateForm((current) => ({ ...current, regionGroupId: event.target.value }))}>{regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}</select></label>
                        <label className="mt-3 block text-sm font-bold text-slate-700">Map name<input className="input-field mt-1" required value={createForm.name} onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} /></label>
                        <label className="mt-3 block text-sm font-bold text-slate-700">Description<textarea className="input-field mt-1 min-h-24" value={createForm.description} onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))} /></label>
                        <button className="btn-primary mt-4 w-full justify-center" disabled={saving || regions.length === 0}><Plus size={16} /> Create</button>
                    </form>
                    <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm"><p className="px-2 py-2 text-xs font-black uppercase tracking-wider text-slate-500">Maps visible through your resources</p>{maps.length === 0 ? <p className="p-3 text-sm text-slate-500">No Governed Care Maps yet.</p> : maps.map((map) => <button type="button" key={map.id} onClick={() => setSelectedId(map.id)} className={`mt-1 w-full rounded-2xl px-4 py-3 text-left ${Number(selectedId) === Number(map.id) ? 'bg-brand-50 text-brand-900' : 'hover:bg-slate-50'}`}><span className="block font-black">{map.name}</span><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{map.lifecycleStatus.replace('_', ' ')} · {map.resources.length} resources</span></button>)}</div>
                </aside>

                {selected ? <div className="space-y-6">
                    <form onSubmit={saveMap} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-black text-slate-950">Map details and design</h2><p className="text-sm text-slate-500">Revision {selected.revision} · stewardship is recalculated from current access.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase text-slate-600">{selected.lifecycleStatus.replace('_', ' ')}</span></div>
                        <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold text-slate-700">Name<input className="input-field mt-1" required disabled={!selected.capabilities.canEditMetadata} value={editForm.name} onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))} /></label><label className="text-sm font-bold text-slate-700">Map style<select className="input-field mt-1" disabled={!selected.capabilities.canEditMetadata} value={editForm.mapStyle} onChange={(event) => setEditForm((current) => ({ ...current, mapStyle: event.target.value }))}><option value="default">Colour</option><option value="gray">Greyscale</option></select></label><label className="text-sm font-bold text-slate-700 sm:col-span-2">Description<textarea className="input-field mt-1 min-h-24" disabled={!selected.capabilities.canEditMetadata} value={editForm.description} onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))} /></label><label className="text-sm font-bold text-slate-700">Pin style<select className="input-field mt-1" disabled={!selected.capabilities.canEditMetadata} value={editForm.pinStyle} onChange={(event) => setEditForm((current) => ({ ...current, pinStyle: event.target.value }))}><option value="category-bubble">Category bubble</option><option value="category-icon">Category icon</option><option value="numbered">Numbered</option></select></label><label className="text-sm font-bold text-slate-700">Pin size<select className="input-field mt-1" disabled={!selected.capabilities.canEditMetadata} value={editForm.pinSize} onChange={(event) => setEditForm((current) => ({ ...current, pinSize: event.target.value }))}><option value="standard">Standard</option><option value="large">Large</option><option value="extra-large">Extra large</option></select></label></div>
                        {selected.capabilities.canEditMetadata ? <button disabled={saving} className="btn-secondary mt-4">Save details and design</button> : null}
                    </form>

                    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-black text-slate-950">Resources</h2><p className="text-sm text-slate-500">Any eligible participant can add region resources. Only that resource’s staff, owner or Organisation Admin can remove it.</p><div className="mt-5 space-y-3">{selected.resources.map((resource) => { const removable = selected.capabilities.removableResourceKeys.includes(keyOf(resource)); return <article key={keyOf(resource)} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-black text-slate-950">{resource.name}</p><p className="text-xs font-semibold uppercase text-slate-500">{resource.resourceType}</p></div>{removable ? <Trash2 size={18} className="text-amber-600" /> : null}</div>{removable ? <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"><input className="input-field" placeholder="Reason for removal" value={reasons[keyOf(resource)] || ''} onChange={(event) => setReasons((current) => ({ ...current, [keyOf(resource)]: event.target.value }))} /><button type="button" className="btn-secondary" onClick={() => withdraw(resource)}>Remove</button></div> : null}</article>; })}</div>{selected.capabilities.canAddResource && availableResources.length ? <div className="mt-5 border-t border-slate-100 pt-5"><p className="text-sm font-black text-slate-700">Available in {selectedRegion?.name}</p><div className="mt-3 flex flex-wrap gap-2">{availableResources.map((resource) => <button key={keyOf(resource)} type="button" disabled={saving} onClick={() => perform(() => api.addGovernedMapResource(selected.id, resource), `${resource.name} added.`)} className="btn-secondary"><Plus size={15} /> {resource.name}</button>)}</div></div> : null}</section>

                    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-black text-slate-950">Publish and embed</h2><p className="text-sm text-slate-500">One HTTPS origin per line. Blank origins allow a share link but keep website embedding unavailable.</p><textarea className="input-field mt-4 min-h-24 font-mono text-sm" placeholder="https://partner.example.org" value={allowedOrigins} onChange={(event) => setAllowedOrigins(event.target.value)} disabled={!selected.capabilities.canPublish} />{selected.capabilities.canPublish ? <button type="button" onClick={publish} disabled={saving} className="btn-primary mt-4"><Send size={16} /> {selected.publication ? 'Update publication' : 'Publish'}</button> : null}{selected.publication ? <div className="mt-5 grid gap-3 sm:grid-cols-2"><a className="btn-secondary justify-center" href={selected.publication.sharePath} target="_blank" rel="noreferrer"><Share2 size={16} /> Open shared map</a>{selected.publication.allowedOrigins?.length ? <a className="btn-secondary justify-center" href={selected.publication.embedPath} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Preview embed</a> : <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-center text-sm text-slate-500">Add an approved website origin to activate embedding.</p>}</div> : null}</section>

                    {GOVERNED_MAP_LIFECYCLE_UI_ENABLED && selected.capabilities.canRequestRetirement ? <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6"><h2 className="font-black text-amber-950">Retire this map</h2><p className="mt-1 text-sm text-amber-800">Retirement is reversible for 30 days. All resource participants receive an in-app notification.</p><div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"><input className="input-field" placeholder="Reason for retirement" value={reasons.retirement || ''} onChange={(event) => setReasons((current) => ({ ...current, retirement: event.target.value }))} /><button type="button" onClick={retire} className="btn-secondary"><Trash2 size={16} /> Retire</button></div></section> : null}
                    {GOVERNED_MAP_LIFECYCLE_UI_ENABLED && selected.capabilities.canRestore ? <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6"><h2 className="font-black text-emerald-950">Retirement pending</h2><p className="mt-1 text-sm text-emerald-800">Scheduled archive: {selected.retirementEligibleAt ? new Date(selected.retirementEligibleAt).toLocaleString() : '30 days after request'}</p><div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"><input className="input-field" placeholder="Reason for restoring" value={reasons.restore || ''} onChange={(event) => setReasons((current) => ({ ...current, restore: event.target.value }))} /><button type="button" onClick={restore} className="btn-primary"><ArchiveRestore size={16} /> Restore map</button></div></section> : null}
                </div> : <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">Create a Governed Care Map from an available region group.</div>}
            </section>
            {confirmDialog}
        </main>
    );
}
