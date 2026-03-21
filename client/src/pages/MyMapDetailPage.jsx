import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Link2, Pencil, Plus, Printer, Trash2 } from 'lucide-react';

import CreateMapModal from '../components/CreateMapModal.jsx';
import DirectoryMap from '../components/DirectoryMap.jsx';
import DirectoryPrintView from '../components/DirectoryPrintView.jsx';
import DirectorySearchBar from '../components/DirectorySearchBar.jsx';
import EditMapDetailsModal from '../components/EditMapDetailsModal.jsx';
import MapImageExportButton from '../components/MapImageExportButton.jsx';
import ShareMapModal from '../components/ShareMapModal.jsx';
import SharedMapDirectoryList from '../components/SharedMapDirectoryList.jsx';
import { DashboardMobileNavigation } from '../components/dashboard/DashboardNavigation.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useSavedAssets } from '../hooks/useSavedAssets.js';
import { api } from '../lib/api.js';

function MapDetailLoadingState() {
    return (
        <div className="space-y-5">
            <div className="h-44 animate-pulse rounded-[32px] border border-slate-200 bg-white shadow-sm" />
            <div className="h-80 animate-pulse rounded-[32px] border border-slate-200 bg-white shadow-sm" />
            <div className="h-64 animate-pulse rounded-[32px] border border-slate-200 bg-white shadow-sm" />
        </div>
    );
}

function OwnerHeader({
    directory,
    actionError,
    onAddAssets,
    onEditDetails,
    onOpenPrintView,
    onOpenShare,
    onDelete,
}) {
    const isShared = Boolean(directory?.share?.isShared);

    return (
        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">My Map</p>
                    <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                        {directory.name}
                    </h1>
                    {directory.description ? (
                        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
                            {directory.description}
                        </p>
                    ) : (
                        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">
                            Add a short subtitle to explain what this directory is for before you share it.
                        </p>
                    )}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
                    <button type="button" onClick={onAddAssets} className="btn-primary justify-center">
                        <Plus size={16} />
                        Add from Saved Assets
                    </button>
                    <button type="button" onClick={onEditDetails} className="btn-ghost justify-center border border-slate-200 text-slate-700">
                        <Pencil size={16} />
                        Edit details
                    </button>
                    <button type="button" onClick={onOpenPrintView} className="btn-ghost justify-center border border-slate-200 text-slate-700">
                        <Printer size={16} />
                        Print view
                    </button>
                    <button type="button" onClick={onOpenShare} className="btn-ghost justify-center border border-slate-200 text-slate-700">
                        <Link2 size={16} />
                        Share
                    </button>
                    <MapImageExportButton directory={directory} />
                    <button
                        type="button"
                        onClick={onDelete}
                        className="btn-ghost justify-center border border-red-200 text-red-600 hover:bg-red-50"
                    >
                        <Trash2 size={16} />
                        Delete
                    </button>
                </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Curated resources</p>
                        <p className="mt-2 text-3xl font-extrabold text-slate-900">{directory.summary.resourceCount}</p>
                    </div>
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Places</p>
                        <p className="mt-2 text-3xl font-extrabold text-slate-900">{directory.summary.placeCount}</p>
                    </div>
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Mapped places</p>
                        <p className="mt-2 text-3xl font-extrabold text-slate-900">{directory.summary.mappablePlaceCount}</p>
                    </div>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-brand-50 to-white p-5">
                    <p className="text-sm font-semibold text-slate-900">
                        {isShared ? 'Shared link is live' : 'Private map'}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                        {isShared
                            ? 'Anyone with the link can view this read-only directory. Changes you make here will appear on the shared page.'
                            : 'Only you can view this map. Publish a read-only share link when you are ready to share this directory.'}
                    </p>
                </div>
            </div>

            {actionError ? (
                <p className="mt-4 text-sm font-medium text-red-600">{actionError}</p>
            ) : null}
        </div>
    );
}

function EmptyOwnerDirectory({ onAddAssets }) {
    return (
        <div className="rounded-[32px] border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center">
            <h2 className="text-2xl font-bold text-slate-900">This directory is empty</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-500">
                Add saved resources to turn this private map into a grouped directory you can share or export later.
            </p>
            <button type="button" onClick={onAddAssets} className="btn-primary mt-6 inline-flex justify-center">
                <Plus size={16} />
                Add from Saved Assets
            </button>
        </div>
    );
}

export default function MyMapDetailPage() {
    const { mapId } = useParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user, logout, isImpersonating } = useAuth();
    const { savedAssets } = useSavedAssets();
    const [directory, setDirectory] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionError, setActionError] = useState('');
    const [query, setQuery] = useState('');
    const [focusedPlaceKey, setFocusedPlaceKey] = useState(null);
    const [highlightPlaceKey, setHighlightPlaceKey] = useState(null);
    const [editOpen, setEditOpen] = useState(false);
    const [editSubmitting, setEditSubmitting] = useState(false);
    const [editError, setEditError] = useState('');
    const [shareOpen, setShareOpen] = useState(false);
    const [shareSubmitting, setShareSubmitting] = useState(false);
    const [shareError, setShareError] = useState('');
    const [addOpen, setAddOpen] = useState(false);
    const [addSubmitting, setAddSubmitting] = useState(false);
    const [addError, setAddError] = useState('');
    const [deleting, setDeleting] = useState(false);
    const suspendMapInteraction = shareOpen || editOpen || addOpen;
    const isPrintView = searchParams.get('view') === 'print';

    const loadMap = useCallback(async () => {
        if (!mapId) return;
        setLoading(true);
        setError('');
        try {
            const item = await api.getMyMap(mapId);
            setDirectory(item);
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
        () => new Set((directory?.assets || []).map((asset) => asset.assetKey || `${asset.resourceType}-${asset.resourceId}`)),
        [directory?.assets]
    );

    async function handleLogout() {
        const impersonationExit = isImpersonating;
        await logout();
        navigate(impersonationExit ? '/dashboard' : '/');
    }

    async function handleUpdateDetails(nextValues) {
        if (!directory) return;
        setEditSubmitting(true);
        setEditError('');
        try {
            await api.updateMyMap(directory.id, nextValues);
            setEditOpen(false);
            await loadMap();
        } catch (err) {
            console.error(err);
            setEditError(err.message || 'Failed to update this directory.');
        } finally {
            setEditSubmitting(false);
        }
    }

    async function handleAddAssets({ assets }) {
        if (!directory) return;
        setAddSubmitting(true);
        setAddError('');
        try {
            await Promise.all(assets.map((asset) => api.addMyMapAsset(directory.id, asset)));
            setAddOpen(false);
            await loadMap();
        } catch (err) {
            console.error(err);
            setAddError(err.message || 'Failed to add one or more resources to this directory.');
        } finally {
            setAddSubmitting(false);
        }
    }

    async function handleRemoveResource(row) {
        if (!directory) return;
        setActionError('');
        try {
            await api.removeMyMapAsset(directory.id, row.resourceType, row.resourceId);
            await loadMap();
        } catch (err) {
            console.error(err);
            setActionError(err.message || 'Failed to remove this resource from the directory.');
        }
    }

    async function handlePublishShare() {
        if (!directory) return;
        setShareSubmitting(true);
        setShareError('');
        try {
            await api.publishMyMapShare(directory.id);
            await loadMap();
        } catch (err) {
            console.error(err);
            setShareError(err.message || 'Failed to publish this share link.');
        } finally {
            setShareSubmitting(false);
        }
    }

    async function handleUnpublishShare() {
        if (!directory) return;
        setShareSubmitting(true);
        setShareError('');
        try {
            await api.unpublishMyMapShare(directory.id);
            await loadMap();
        } catch (err) {
            console.error(err);
            setShareError(err.message || 'Failed to unpublish this share link.');
        } finally {
            setShareSubmitting(false);
        }
    }

    async function handleDeleteMap() {
        if (!directory) return;
        const confirmed = window.confirm(`Delete "${directory.name}"? This removes the directory and its curated resource list.`);
        if (!confirmed) return;
        setDeleting(true);
        setActionError('');
        try {
            await api.deleteMyMap(directory.id);
            navigate('/my-directory?section=my-maps', { replace: true });
        } catch (err) {
            console.error(err);
            setActionError(err.message || 'Failed to delete this map.');
            setDeleting(false);
        }
    }

    function handleViewSection(placeKey) {
        setQuery('');
        setHighlightPlaceKey(null);
        window.requestAnimationFrame(() => {
            setHighlightPlaceKey(placeKey);
        });
    }

    function handleViewOnMap(placeKey) {
        setFocusedPlaceKey(null);
        window.requestAnimationFrame(() => {
            setFocusedPlaceKey(placeKey);
        });
    }

    function openPrintView() {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('view', 'print');
        setSearchParams(nextParams);
    }

    function closePrintView() {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('view');
        setSearchParams(nextParams);
    }

    if (loading) {
        return (
            <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
                <DashboardMobileNavigation
                    isImpersonating={isImpersonating}
                    onLogout={handleLogout}
                    sectionContextLabel="My Directory"
                    sectionLabel="My Maps"
                    user={user}
                />
                <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
                    <MapDetailLoadingState />
                </div>
            </div>
        );
    }

    if (error || !directory) {
        return (
            <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
                <DashboardMobileNavigation
                    isImpersonating={isImpersonating}
                    onLogout={handleLogout}
                    sectionContextLabel="My Directory"
                    sectionLabel="My Maps"
                    user={user}
                />
                <div className="mx-auto w-full max-w-3xl px-4 py-12 text-center sm:px-6 lg:px-8">
                    <div className="rounded-[32px] border border-dashed border-slate-200 bg-white px-6 py-16 shadow-sm">
                        <h1 className="text-2xl font-bold text-slate-900">Map not available</h1>
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

    if (isPrintView) {
        return (
            <div className="min-h-screen bg-slate-100">
                <div className="print:hidden border-b border-slate-200 bg-white/90 backdrop-blur">
                    <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
                        <button
                            type="button"
                            onClick={closePrintView}
                            className="btn-ghost justify-center border border-slate-200 text-slate-700"
                        >
                            <ArrowLeft size={16} />
                            Back to interactive view
                        </button>
                        <MapImageExportButton directory={directory} />
                    </div>
                </div>

                <div className="px-4 py-6 sm:px-6 lg:px-8">
                    <DirectoryPrintView
                        directory={directory}
                        mode="owner"
                        generatedAt={new Date()}
                        footerNote={directory.share?.isShared ? 'Open the shared link for the full interactive directory.' : ''}
                        className="mx-auto"
                    />
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
                <DashboardMobileNavigation
                    isImpersonating={isImpersonating}
                    onLogout={handleLogout}
                    sectionContextLabel="My Directory"
                    sectionLabel={directory.name}
                    user={user}
                />

                <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-8 sm:px-6 lg:px-8">
                    <div>
                        <Link to="/my-directory?section=my-maps" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 transition hover:text-brand-800">
                            <ArrowLeft size={16} />
                            Back to My Maps
                        </Link>
                    </div>

                    <OwnerHeader
                        directory={directory}
                        actionError={actionError}
                        onAddAssets={() => setAddOpen(true)}
                        onEditDetails={() => {
                            setEditError('');
                            setEditOpen(true);
                        }}
                        onOpenPrintView={openPrintView}
                        onOpenShare={() => {
                            setShareError('');
                            setShareOpen(true);
                        }}
                        onDelete={handleDeleteMap}
                    />

                    {directory.summary.resourceCount === 0 ? (
                        <EmptyOwnerDirectory onAddAssets={() => setAddOpen(true)} />
                    ) : (
                        <>
                            <DirectoryMap
                                pins={directory.pins}
                                focusedPlaceKey={focusedPlaceKey}
                                onViewSection={handleViewSection}
                                interactive={!suspendMapInteraction}
                            />

                            <DirectorySearchBar
                                value={query}
                                onChange={setQuery}
                            />

                            <SharedMapDirectoryList
                                places={directory.places}
                                totalResourceCount={directory.summary.resourceCount}
                                query={query}
                                mode="owner"
                                onViewOnMap={handleViewOnMap}
                                onRemoveResource={handleRemoveResource}
                                highlightPlaceKey={highlightPlaceKey}
                            />
                        </>
                    )}
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

            <EditMapDetailsModal
                isOpen={editOpen}
                map={directory}
                submitting={editSubmitting}
                error={editError}
                onClose={() => {
                    if (editSubmitting) return;
                    setEditOpen(false);
                    setEditError('');
                }}
                onSubmit={handleUpdateDetails}
            />

            <ShareMapModal
                isOpen={shareOpen}
                map={directory}
                submitting={shareSubmitting}
                error={shareError}
                onClose={() => {
                    if (shareSubmitting) return;
                    setShareOpen(false);
                    setShareError('');
                }}
                onPublish={handlePublishShare}
                onUnpublish={handleUnpublishShare}
            />

            {deleting ? (
                <div className="fixed bottom-4 right-4 z-[70] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-lg">
                    Deleting map…
                </div>
            ) : null}
        </>
    );
}
