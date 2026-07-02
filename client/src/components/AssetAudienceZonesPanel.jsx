import { useEffect, useMemo, useState } from 'react';
import { MapPin, Plus, RefreshCw, Trash2 } from 'lucide-react';

import { api } from '../lib/api.js';
import { normalizeRole } from '../lib/roles.js';
import { useConfirmDialog } from './ConfirmDialog.jsx';

function normalizePostalText(value) {
    return String(value || '')
        .split(/[\n,;]+/)
        .map((entry) => entry.trim())
        .filter(Boolean)
        .join('\n');
}

function formatSharingStatus(status) {
    if (status === 'pending_approval') return 'Pending approval';
    if (status === 'approved') return 'Shared';
    return 'Local';
}

export default function AssetAudienceZonesPanel({ asset, currentUser, onChanged }) {
    const { confirm: requestConfirmation, confirmDialog } = useConfirmDialog();
    const [zones, setZones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const [draft, setDraft] = useState({
        name: '',
        zoneCode: '',
        sharingStatus: 'local',
        postalCodes: '',
    });

    const currentRole = normalizeRole(currentUser?.role);
    const canApproveSharing = currentRole === 'super_admin' || currentRole === 'regional_admin';
    const assetZones = useMemo(() => (
        zones.filter((zone) => Number(zone.hardAssetId) === Number(asset?.id))
    ), [asset?.id, zones]);

    async function loadZones() {
        if (!asset?.id) return;
        setLoading(true);
        setFeedback(null);
        try {
            const data = await api.getAudienceZones();
            setZones(Array.isArray(data) ? data : []);
        } catch (err) {
            setFeedback({ type: 'error', message: err.message || 'Unable to load audience zones.' });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadZones();
    }, [asset?.id]);

    async function handleCreate(e) {
        e.preventDefault();
        if (!asset?.id || !draft.name.trim()) return;
        setSaving(true);
        setFeedback(null);
        try {
            await api.createAudienceZone({
                name: draft.name,
                zoneCode: draft.zoneCode,
                hardAssetId: asset.id,
                sharingStatus: draft.sharingStatus,
                postalCodes: normalizePostalText(draft.postalCodes),
            });
            setDraft({ name: '', zoneCode: '', sharingStatus: 'local', postalCodes: '' });
            setFeedback({ type: 'success', message: 'Audience zone created.' });
            await loadZones();
            await onChanged?.();
        } catch (err) {
            setFeedback({ type: 'error', message: err.message || 'Unable to create audience zone.' });
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(zone) {
        if (!zone?.id) return;
        const confirmed = await requestConfirmation({
            title: 'Delete audience zone?',
            message: `Delete audience zone "${zone.name}"?`,
            confirmLabel: 'Delete',
            loadingLabel: 'Deleting...',
            tone: 'danger',
        });
        if (!confirmed) return;
        setSaving(true);
        setFeedback(null);
        try {
            await api.deleteAudienceZone(zone.id);
            setFeedback({ type: 'success', message: 'Audience zone deleted.' });
            await loadZones();
            await onChanged?.();
        } catch (err) {
            setFeedback({ type: 'error', message: err.message || 'Unable to delete audience zone.' });
        } finally {
            setSaving(false);
        }
    }

    const feedbackClass = feedback?.type === 'error'
        ? 'border-red-200 bg-red-50 text-red-700'
        : 'border-green-200 bg-green-50 text-green-700';

    return (
        <>
            {confirmDialog}

            <div className="space-y-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
                        <MapPin size={22} />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-slate-900">Audience zones</h3>
                        <p className="mt-1 text-sm font-medium text-slate-500">
                            Create postal-code areas for this asset's offerings.
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={loadZones}
                    disabled={loading || saving}
                    className="btn-ghost justify-center disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            {feedback ? (
                <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${feedbackClass}`}>
                    {feedback.message}
                </div>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.9fr)]">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h4 className="text-lg font-bold text-slate-900">Asset zones</h4>
                            <p className="mt-1 text-sm text-slate-500">Local zones work for this asset. Shared zones can be reused after approval.</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                            {assetZones.length} zone{assetZones.length === 1 ? '' : 's'}
                        </span>
                    </div>

                    {loading ? (
                        <div className="mt-4 space-y-3">
                            {[...Array(2)].map((_, index) => (
                                <div key={index} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
                            ))}
                        </div>
                    ) : assetZones.length === 0 ? (
                        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-500">
                            No zones have been created for this asset.
                        </div>
                    ) : (
                        <div className="mt-4 space-y-3">
                            {assetZones.map((zone) => (
                                <div key={zone.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="font-bold text-slate-900">{zone.name}</p>
                                                <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-bold text-sky-700">
                                                    {formatSharingStatus(zone.sharingStatus)}
                                                </span>
                                                {zone.zoneCode ? (
                                                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-bold text-slate-600">
                                                        {zone.zoneCode}
                                                    </span>
                                                ) : null}
                                            </div>
                                            <p className="mt-1 text-sm text-slate-500">
                                                {zone.postalCodeCount || 0} postal code{Number(zone.postalCodeCount || 0) === 1 ? '' : 's'}
                                            </p>
                                        </div>
                                        {zone.sharingStatus !== 'approved' ? (
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(zone)}
                                                disabled={saving}
                                                className="btn-ghost justify-center text-xs text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                <Trash2 size={14} />
                                                Delete
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <form onSubmit={handleCreate} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                            <Plus size={20} />
                        </div>
                        <div>
                            <h4 className="text-lg font-bold text-slate-900">Create zone</h4>
                            <p className="mt-1 text-sm text-slate-500">Use one postal code or range per line.</p>
                        </div>
                    </div>

                    <div className="mt-4 space-y-3">
                        <input
                            value={draft.name}
                            onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                            className="input-field w-full"
                            placeholder="Zone name"
                            required
                        />
                        <input
                            value={draft.zoneCode}
                            onChange={(event) => setDraft((prev) => ({ ...prev, zoneCode: event.target.value }))}
                            className="input-field w-full"
                            placeholder="Zone code (optional)"
                        />
                        <select
                            value={draft.sharingStatus}
                            onChange={(event) => setDraft((prev) => ({ ...prev, sharingStatus: event.target.value }))}
                            className="input-field w-full"
                        >
                            <option value="local">Local to this asset</option>
                            <option value="pending_approval">Request shared approval</option>
                            {canApproveSharing ? <option value="approved">Shared</option> : null}
                        </select>
                        <textarea
                            value={draft.postalCodes}
                            onChange={(event) => setDraft((prev) => ({ ...prev, postalCodes: event.target.value }))}
                            className="input-field min-h-[120px] w-full font-mono text-sm"
                            placeholder={'680153\n680574-680599'}
                        />
                        <button
                            type="submit"
                            disabled={saving || !draft.name.trim()}
                            className="btn-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {saving ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />}
                            Create zone
                        </button>
                    </div>
                </form>
            </div>
            </div>
        </>
    );
}
