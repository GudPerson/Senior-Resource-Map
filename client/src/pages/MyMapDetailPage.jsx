import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Clock3, Map, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';

import CreateMapModal from '../components/CreateMapModal.jsx';
import RenameMapModal from '../components/RenameMapModal.jsx';
import { useSavedAssets } from '../hooks/useSavedAssets.js';
import { api } from '../lib/api.js';
import { buildSavedAssetDetailPath, buildSavedAssetKey } from '../lib/savedAssets.js';

function formatDate(value, prefix = 'Updated') {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    return `${prefix} ${new Intl.DateTimeFormat('en-SG', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    }).format(date)}`;
}

function AssetStatusBadge({ asset }) {
    if (asset.status === 'unavailable') {
        return (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                Unavailable
            </span>
        );
    }

    if (!asset.hasCoordinates) {
        return (
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                List only
            </span>
        );
    }

    return null;
}

function typeLabel(resourceType) {
    return resourceType === 'hard' ? 'Place' : 'Offering';
}

function MapDetailLoadingState() {
    return (
        <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
                <div
                    key={index}
                    className="animate-pulse rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                    <div className="h-6 w-24 rounded-full bg-slate-100" />
                    <div className="mt-4 h-6 w-1/2 rounded bg-slate-100" />
                    <div className="mt-3 h-14 rounded-2xl bg-slate-100" />
                    <div className="mt-4 flex gap-2">
                        <div className="h-11 flex-1 rounded-xl bg-slate-100" />
                        <div className="h-11 flex-1 rounded-xl bg-slate-100" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function EmptyMapState({ onAdd }) {
    return (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
                <Map size={28} />
            </div>
            <h2 className="mt-5 text-xl font-bold text-slate-900">This map is empty</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
                Add saved assets to keep this map useful and easy to revisit.
            </p>
            <button type="button" onClick={onAdd} className="btn-primary mt-6 inline-flex justify-center">
                <Plus size={16} />
                Add from Saved Assets
            </button>
        </div>
    );
}

function MapAssetCard({ asset, removing = false, onRemove }) {
    const detailPath = asset.detailPath || buildSavedAssetDetailPath(asset.resourceType, asset.resourceId);
    const addedAt = formatDate(asset.addedAt, 'Added');

    return (
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
            <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700">
                                {typeLabel(asset.resourceType)}
                            </span>
                            {asset.subCategory ? (
                                <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                                    {asset.subCategory}
                                </span>
                            ) : null}
                            <AssetStatusBadge asset={asset} />
                        </div>
                        <h2 className="mt-3 text-lg font-bold leading-snug text-slate-900">
                            {asset.name || 'Saved resource'}
                        </h2>
                    </div>
                    {addedAt ? (
                        <span className="inline-flex flex-shrink-0 items-center gap-1 text-xs font-medium text-slate-400">
                            <Clock3 size={13} />
                            {addedAt}
                        </span>
                    ) : null}
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3.5 py-3">
                    <div className="flex items-start gap-2 text-sm text-slate-600">
                        <MapPin size={16} className="mt-0.5 flex-shrink-0 text-slate-400" />
                        <p className="leading-6">
                            {asset.address || (asset.status === 'unavailable' ? 'Location is no longer available.' : 'Location details are not available.')}
                        </p>
                    </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                    <Link to={detailPath} className="btn-primary flex-1 justify-center">
                        View details
                        <ArrowRight size={16} />
                    </Link>
                    <button
                        type="button"
                        onClick={() => onRemove?.(asset)}
                        disabled={removing}
                        className="btn-ghost flex-1 justify-center border border-slate-200 text-slate-700 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-wait disabled:opacity-70"
                    >
                        <Trash2 size={16} />
                        {removing ? 'Removing…' : 'Remove from map'}
                    </button>
                </div>
            </div>
        </article>
    );
}

export default function MyMapDetailPage() {
    const { mapId } = useParams();
    const navigate = useNavigate();
    const { savedAssets } = useSavedAssets();
    const [map, setMap] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionError, setActionError] = useState('');
    const [renameOpen, setRenameOpen] = useState(false);
    const [renameSubmitting, setRenameSubmitting] = useState(false);
    const [renameError, setRenameError] = useState('');
    const [addOpen, setAddOpen] = useState(false);
    const [addSubmitting, setAddSubmitting] = useState(false);
    const [addError, setAddError] = useState('');
    const [deleting, setDeleting] = useState(false);
    const [removingKeys, setRemovingKeys] = useState([]);

    const loadMap = useCallback(async () => {
        if (!mapId) return;
        setLoading(true);
        setError('');
        try {
            const item = await api.getMyMap(mapId);
            setMap(item);
        } catch (err) {
            console.error(err);
            setError(err.message || 'Failed to load this map.');
        } finally {
            setLoading(false);
        }
    }, [mapId]);

    useEffect(() => {
        loadMap();
    }, [loadMap]);

    const existingAssetKeys = useMemo(
        () => new Set((map?.assets || []).map((asset) => buildSavedAssetKey(asset.resourceType, asset.resourceId))),
        [map?.assets]
    );

    async function handleRename(name) {
        if (!map) return;
        setRenameSubmitting(true);
        setRenameError('');
        try {
            const updated = await api.updateMyMap(map.id, { name });
            setMap((current) => current ? { ...current, ...updated } : current);
            setRenameOpen(false);
        } catch (err) {
            console.error(err);
            setRenameError(err.message || 'Failed to rename this map.');
        } finally {
            setRenameSubmitting(false);
        }
    }

    async function handleAddAssets({ assets }) {
        if (!map) return;
        setAddSubmitting(true);
        setAddError('');
        try {
            await Promise.all(
                assets.map((asset) => api.addMyMapAsset(map.id, asset))
            );
            setAddOpen(false);
            await loadMap();
        } catch (err) {
            console.error(err);
            setAddError(err.message || 'Failed to add one or more assets to this map.');
        } finally {
            setAddSubmitting(false);
        }
    }

    async function handleRemoveAsset(asset) {
        if (!map) return;
        const assetKey = buildSavedAssetKey(asset.resourceType, asset.resourceId);
        setActionError('');
        setRemovingKeys((items) => [...items, assetKey]);
        try {
            await api.removeMyMapAsset(map.id, asset.resourceType, asset.resourceId);
            setMap((current) => {
                if (!current) return current;
                const nextAssets = current.assets.filter((item) => buildSavedAssetKey(item.resourceType, item.resourceId) !== assetKey);
                return {
                    ...current,
                    assets: nextAssets,
                    assetCount: nextAssets.length,
                };
            });
        } catch (err) {
            console.error(err);
            setActionError(err.message || 'Failed to remove this asset from the map.');
        } finally {
            setRemovingKeys((items) => items.filter((item) => item !== assetKey));
        }
    }

    async function handleDeleteMap() {
        if (!map) return;
        const confirmed = window.confirm(`Delete "${map.name}"? This removes the map and its asset list.`);
        if (!confirmed) return;

        setDeleting(true);
        setActionError('');
        try {
            await api.deleteMyMap(map.id);
            navigate('/my-directory?section=my-maps', { replace: true });
        } catch (err) {
            console.error(err);
            setActionError(err.message || 'Failed to delete this map.');
            setDeleting(false);
        }
    }

    if (loading) {
        return (
            <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
                <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
                    <MapDetailLoadingState />
                </div>
            </div>
        );
    }

    if (error || !map) {
        return (
            <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
                <div className="mx-auto w-full max-w-3xl px-4 py-12 text-center sm:px-6 lg:px-8">
                    <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-16 shadow-sm">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
                            <Map size={28} />
                        </div>
                        <h1 className="mt-5 text-2xl font-bold text-slate-900">Map not available</h1>
                        <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">
                            {error || 'This map could not be found or you no longer have access to it.'}
                        </p>
                        <Link to="/my-directory?section=my-maps" className="btn-primary mt-6 inline-flex justify-center">
                            <ArrowLeft size={16} />
                            Back to My Maps
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const updatedAtLabel = formatDate(map.updatedAt);

    return (
        <>
            <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
                <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
                    <div className="mb-4">
                        <Link to="/my-directory?section=my-maps" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 transition hover:text-brand-800">
                            <ArrowLeft size={16} />
                            Back to My Maps
                        </Link>
                    </div>

                    <header className="rounded-3xl border border-slate-200 bg-white px-5 py-6 shadow-sm sm:px-6">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">My Map</p>
                                <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{map.name}</h1>
                                <p className="mt-2 text-sm text-slate-500">
                                    {map.assetCount} {map.assetCount === 1 ? 'asset' : 'assets'}
                                    {updatedAtLabel ? ` • ${updatedAtLabel}` : ''}
                                </p>
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row">
                                <button type="button" onClick={() => setAddOpen(true)} className="btn-primary justify-center">
                                    <Plus size={16} />
                                    Add from Saved Assets
                                </button>
                                <button type="button" onClick={() => {
                                    setRenameError('');
                                    setRenameOpen(true);
                                }} className="btn-ghost justify-center border border-slate-200 text-slate-700">
                                    <Pencil size={16} />
                                    Rename
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDeleteMap}
                                    disabled={deleting}
                                    className="btn-ghost justify-center border border-slate-200 text-slate-700 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-wait disabled:opacity-70"
                                >
                                    <Trash2 size={16} />
                                    {deleting ? 'Deleting…' : 'Delete'}
                                </button>
                            </div>
                        </div>
                    </header>

                    {actionError ? (
                        <p className="mt-4 text-sm font-medium text-red-600">{actionError}</p>
                    ) : null}

                    <section className="mt-6">
                        {map.assets.length === 0 ? (
                            <EmptyMapState onAdd={() => setAddOpen(true)} />
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                {map.assets.map((asset) => (
                                    <MapAssetCard
                                        key={asset.assetKey || `${asset.resourceType}-${asset.resourceId}`}
                                        asset={asset}
                                        removing={removingKeys.includes(buildSavedAssetKey(asset.resourceType, asset.resourceId))}
                                        onRemove={handleRemoveAsset}
                                    />
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </div>

            <CreateMapModal
                isOpen={addOpen}
                mode="add-assets"
                savedAssets={savedAssets}
                excludedAssetKeys={[...existingAssetKeys]}
                submitting={addSubmitting}
                error={addError}
                onClose={() => {
                    if (addSubmitting) return;
                    setAddOpen(false);
                    setAddError('');
                }}
                onSubmit={handleAddAssets}
            />

            <RenameMapModal
                isOpen={renameOpen}
                map={map}
                submitting={renameSubmitting}
                error={renameError}
                onClose={() => {
                    if (renameSubmitting) return;
                    setRenameOpen(false);
                    setRenameError('');
                }}
                onSubmit={handleRename}
            />
        </>
    );
}
