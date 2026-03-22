import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Link2, Pencil, Plus, Printer, Trash2 } from 'lucide-react';

import CreateMapModal from '../components/CreateMapModal.jsx';
import DirectoryDistanceControls from '../components/DirectoryDistanceControls.jsx';
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
import { buildDirectoryPresentation, buildDirectoryShareUrl } from '../lib/directoryPresentation.js';
import { useDirectoryDistanceAnchor } from '../hooks/useDirectoryDistanceAnchor.js';

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
    activeAnchor,
    shareUrl,
    actionError,
    onAddAssets,
    onEditDetails,
    onOpenPrintView,
    onOpenShare,
    onDelete,
}) {
    const isShared = Boolean(directory?.share?.isShared);
    const compactActionClassName = 'w-full justify-center px-4 py-2.5 text-sm sm:w-auto sm:px-5 sm:py-3 sm:text-base';

    return (
        <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:rounded-[32px] sm:p-6 xl:p-9">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">My Map</p>
                    <h1 className="mt-2 text-[2rem] font-extrabold tracking-tight text-slate-900 sm:mt-3 sm:text-4xl">
                        {directory.name}
                    </h1>
                    {directory.description ? (
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:mt-3 sm:text-lg sm:leading-7">
                            {directory.description}
                        </p>
                    ) : (
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 sm:mt-3 sm:leading-7">
                            Add a short subtitle to explain what this directory is for before you share it.
                        </p>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:flex-wrap sm:justify-end xl:max-w-[740px]">
                    <button type="button" onClick={onAddAssets} className={`btn-primary col-span-2 ${compactActionClassName}`}>
                        <Plus size={16} />
                        Add from Saved Assets
                    </button>
                    <button type="button" onClick={onEditDetails} className={`btn-ghost ${compactActionClassName} border border-slate-200 text-slate-700`}>
                        <Pencil size={16} />
                        Edit details
                    </button>
                    <button type="button" onClick={onOpenPrintView} className={`btn-ghost ${compactActionClassName} border border-slate-200 text-slate-700`}>
                        <Printer size={16} />
                        Print view
                    </button>
                    <button type="button" onClick={onOpenShare} className={`btn-ghost ${compactActionClassName} border border-slate-200 text-slate-700`}>
                        <Link2 size={16} />
                        Share
                    </button>
                    <MapImageExportButton
                        directory={directory}
                        activeAnchor={activeAnchor}
                        shareUrl={shareUrl}
                        className={compactActionClassName}
                    />
                    <button
                        type="button"
                        onClick={onDelete}
                        className={`btn-ghost col-span-2 ${compactActionClassName} border border-red-200 text-red-600 hover:bg-red-50 sm:col-auto`}
                    >
                        <Trash2 size={16} />
                        Delete
                    </button>
                </div>
            </div>

            <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(420px,0.95fr)] 2xl:grid-cols-[minmax(0,1.45fr)_minmax(480px,0.95fr)]">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
                    <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-3 sm:rounded-[24px] sm:p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Curated resources</p>
                        <p className="mt-1.5 text-2xl font-extrabold text-slate-900 sm:mt-2 sm:text-3xl">{directory.summary.resourceCount}</p>
                    </div>
                    <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-3 sm:rounded-[24px] sm:p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Places</p>
                        <p className="mt-1.5 text-2xl font-extrabold text-slate-900 sm:mt-2 sm:text-3xl">{directory.summary.placeCount}</p>
                    </div>
                    <div className="col-span-2 rounded-[20px] border border-slate-200 bg-slate-50 p-3 sm:col-span-1 sm:rounded-[24px] sm:p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Mapped places</p>
                        <p className="mt-1.5 text-2xl font-extrabold text-slate-900 sm:mt-2 sm:text-3xl">{directory.summary.mappablePlaceCount}</p>
                    </div>
                </div>

                <div className="rounded-[22px] border border-slate-200 bg-gradient-to-br from-brand-50 to-white p-4 sm:rounded-[24px] sm:p-5">
                    <p className="text-sm font-semibold text-slate-900">
                        {isShared ? 'Shared link is live' : 'Private map'}
                    </p>
                    <p className="mt-1.5 text-sm leading-6 text-slate-600 sm:mt-2 sm:leading-7">
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
    const anchorState = useDirectoryDistanceAnchor({
        storageKey: mapId ? `my-map:${mapId}` : 'my-map',
        userPostalCode: user?.postalCode || '',
    });

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
    const activeAnchor = anchorState.activeAnchor;
    const interactivePresentation = useMemo(() => (
        buildDirectoryPresentation(directory, { query, activeAnchor })
    ), [activeAnchor, directory, query]);
    const sharedDirectoryUrl = useMemo(() => (
        buildDirectoryShareUrl(directory?.share?.sharePath)
    ), [directory?.share?.sharePath]);

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
                <div className="mx-auto w-full max-w-[1800px] px-4 py-6 sm:px-6 xl:px-10 2xl:px-14">
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
                        <MapImageExportButton directory={directory} activeAnchor={activeAnchor} shareUrl={sharedDirectoryUrl} />
                    </div>
                </div>

                <div className="px-4 py-6 sm:px-6 lg:px-8">
                    <DirectoryPrintView
                        directory={directory}
                        mode="owner"
                        generatedAt={new Date()}
                        activeAnchor={activeAnchor}
                        shareUrl={sharedDirectoryUrl}
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

                <div className="mx-auto w-full max-w-[1800px] space-y-4 px-4 py-4 sm:px-6 sm:py-6 xl:px-10 2xl:px-14 xl:space-y-5">
                    <div className="hidden sm:block">
                        <Link to="/my-directory?section=my-maps" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 transition hover:text-brand-800">
                            <ArrowLeft size={16} />
                            Back to My Maps
                        </Link>
                    </div>

                    <OwnerHeader
                        directory={directory}
                        activeAnchor={activeAnchor}
                        shareUrl={sharedDirectoryUrl}
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
                            <div className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.9fr)] xl:gap-4">
                                <DirectorySearchBar
                                    value={query}
                                    onChange={setQuery}
                                />
                                <DirectoryDistanceControls anchorState={anchorState} />
                            </div>

                            <SharedMapDirectoryList
                                presentation={interactivePresentation}
                                mode="owner"
                                layout="responsive"
                                onViewOnMap={handleViewOnMap}
                                onRemoveResource={handleRemoveResource}
                                highlightPlaceKey={highlightPlaceKey}
                                desktopGridClassName="lg:grid-cols-[minmax(250px,0.95fr)_minmax(420px,1.45fr)_minmax(250px,0.95fr)] xl:grid-cols-[minmax(280px,1fr)_minmax(720px,2.2fr)_minmax(280px,1fr)] 2xl:grid-cols-[minmax(300px,1fr)_minmax(840px,2.35fr)_minmax(300px,1fr)]"
                                renderDesktopMap={() => (
                                    <DirectoryMap
                                        pins={interactivePresentation.pins}
                                        focusedPlaceKey={focusedPlaceKey}
                                        onViewSection={handleViewSection}
                                        interactive={!suspendMapInteraction}
                                        markerMode="number"
                                        placeNumberByKey={interactivePresentation.placeNumberByKey}
                                        emptyLabel={query ? 'No mappable places match this directory search.' : 'This directory does not have any mappable places yet.'}
                                        mapHeightClassName="h-[56vh] min-h-[520px] max-h-[780px]"
                                    />
                                )}
                                renderMobileMap={() => (
                                    <DirectoryMap
                                        pins={interactivePresentation.pins}
                                        focusedPlaceKey={focusedPlaceKey}
                                        onViewSection={handleViewSection}
                                        interactive={!suspendMapInteraction}
                                        markerMode="number"
                                        placeNumberByKey={interactivePresentation.placeNumberByKey}
                                        emptyLabel={query ? 'No mappable places match this directory search.' : 'This directory does not have any mappable places yet.'}
                                        mapHeightClassName="h-[32svh] min-h-[240px] max-h-[360px]"
                                    />
                                )}
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
