import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Drawer } from 'vaul';
import { ArrowLeft, Link2, Menu, Pencil, Plus, Printer, X } from 'lucide-react';

import CreateMapModal from '../components/CreateMapModal.jsx';
import DirectoryDistanceControls from '../components/DirectoryDistanceControls.jsx';
import DirectoryMap from '../components/DirectoryMap.jsx';
import DirectoryPrintView from '../components/DirectoryPrintView.jsx';
import DirectorySearchBar from '../components/DirectorySearchBar.jsx';
import EditMapDetailsModal from '../components/EditMapDetailsModal.jsx';
import MapImageExportButton from '../components/MapImageExportButton.jsx';
import ShareMapModal from '../components/ShareMapModal.jsx';
import SharedMapDirectoryList from '../components/SharedMapDirectoryList.jsx';
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
    onAddAssets,
    onEditDetails,
    onOpenPrintView,
    onOpenShare,
}) {
    const compactActionClassName = 'w-full justify-center px-4 py-2.5 text-sm sm:w-auto sm:px-5 sm:py-3 sm:text-base';

    return (
        <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:rounded-[32px] sm:p-6 xl:p-9">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                    <h1 className="text-[2rem] font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                        {directory.name}
                    </h1>
                    {directory.description ? (
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:mt-3 sm:text-lg sm:leading-7">
                            {directory.description}
                        </p>
                    ) : null}
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
                </div>
            </div>
        </div>
    );
}

function MyMapMobileControls({
    directory,
    query,
    onQueryChange,
    anchorState,
    onAddAssets,
    onEditDetails,
    onOpenPrintView,
    onOpenShare,
}) {
    const [open, setOpen] = useState(false);

    const runDrawerAction = useCallback((action) => {
        setOpen(false);
        window.requestAnimationFrame(() => {
            action?.();
        });
    }, []);

    return (
        <>
            <div className="sticky top-[56px] z-30 -mx-4 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:top-[64px] sm:-mx-6 xl:hidden">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => setOpen(true)}
                        className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm"
                        aria-label="Open map controls"
                    >
                        <Menu size={20} />
                    </button>

                    <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-bold text-slate-900 sm:text-[17px]">{directory.name}</p>
                    </div>
                </div>
            </div>

            <Drawer.Root direction="left" open={open} onOpenChange={setOpen}>
                <Drawer.Portal>
                    <Drawer.Overlay className="fixed inset-0 z-[580] bg-slate-950/35 xl:hidden" />
                    <Drawer.Content
                        className="fixed bottom-0 left-0 top-[56px] z-[590] flex w-[min(92vw,380px)] flex-col border-r bg-white shadow-2xl sm:top-[64px] xl:hidden"
                        style={{
                            borderColor: 'var(--color-border)',
                            background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(246,252,251,0.96) 100%)',
                        }}
                    >
                        <Drawer.Title className="sr-only">Map controls</Drawer.Title>
                        <Drawer.Description className="sr-only">
                            Manage this map, search the directory, and adjust distance settings.
                        </Drawer.Description>

                        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-4">
                            <div className="min-w-0">
                                <h2 className="truncate text-[17px] font-bold text-slate-900">{directory.name}</h2>
                            </div>

                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                aria-label="Close map controls"
                                className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4">
                            <Link
                                to="/my-directory?section=my-maps"
                                onClick={() => setOpen(false)}
                                className="btn-ghost justify-center border border-slate-200 text-slate-700"
                            >
                                <ArrowLeft size={16} />
                                Back to My Maps
                            </Link>

                            <div className="mt-4 grid grid-cols-2 gap-2">
                                <button type="button" onClick={() => runDrawerAction(onAddAssets)} className="btn-primary col-span-2 w-full justify-center px-4 py-2.5 text-sm">
                                    <Plus size={16} />
                                    Add from Saved Assets
                                </button>
                                <button type="button" onClick={() => runDrawerAction(onEditDetails)} className="btn-ghost w-full justify-center border border-slate-200 px-4 py-2.5 text-sm text-slate-700">
                                    <Pencil size={16} />
                                    Edit details
                                </button>
                                <button type="button" onClick={() => runDrawerAction(onOpenPrintView)} className="btn-ghost w-full justify-center border border-slate-200 px-4 py-2.5 text-sm text-slate-700">
                                    <Printer size={16} />
                                    Print view
                                </button>
                                <button type="button" onClick={() => runDrawerAction(onOpenShare)} className="btn-ghost w-full justify-center border border-slate-200 px-4 py-2.5 text-sm text-slate-700">
                                    <Link2 size={16} />
                                    Share
                                </button>
                            </div>

                            <div className="mt-4 space-y-4 pb-4">
                                <DirectorySearchBar
                                    value={query}
                                    onChange={onQueryChange}
                                    inputId="directory-search-mobile"
                                    className="shadow-none"
                                />
                                <DirectoryDistanceControls anchorState={anchorState} className="shadow-none" />
                            </div>
                        </div>
                    </Drawer.Content>
                </Drawer.Portal>
            </Drawer.Root>
        </>
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
    const [searchParams, setSearchParams] = useSearchParams();
    const { user } = useAuth();
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
                <div className="mx-auto w-full max-w-[1800px] px-4 py-6 sm:px-6 xl:px-10 2xl:px-14">
                    <MapDetailLoadingState />
                </div>
            </div>
        );
    }

    if (error || !directory) {
        return (
            <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
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
                <MyMapMobileControls
                    directory={directory}
                    query={query}
                    onQueryChange={setQuery}
                    anchorState={anchorState}
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
                />

                <div className="mx-auto w-full max-w-[1800px] space-y-4 px-4 py-4 sm:px-6 sm:py-6 xl:px-10 2xl:px-14 xl:space-y-5">
                    <div className="hidden xl:block">
                        <Link to="/my-directory?section=my-maps" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 transition hover:text-brand-800">
                            <ArrowLeft size={16} />
                            Back to My Maps
                        </Link>
                    </div>

                    <div className="hidden xl:block">
                        <OwnerHeader
                            directory={directory}
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
                        />
                    </div>

                    {directory.summary.resourceCount === 0 ? (
                        <EmptyOwnerDirectory onAddAssets={() => setAddOpen(true)} />
                    ) : (
                        <>
                            <div className="hidden xl:grid xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.9fr)] xl:gap-4">
                                <DirectorySearchBar
                                    value={query}
                                    onChange={setQuery}
                                    inputId="directory-search-desktop"
                                />
                                <DirectoryDistanceControls anchorState={anchorState} />
                            </div>

                            {actionError ? (
                                <p className="text-sm font-medium text-red-600">{actionError}</p>
                            ) : null}

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
                                mobileMapStickyClassName="sticky top-[124px] z-20 bg-slate-50 pb-3 sm:top-[132px]"
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
        </>
    );
}
