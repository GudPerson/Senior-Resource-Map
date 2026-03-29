import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useMediaQuery } from '../hooks/useMediaQuery.js';

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
    query,
    onQueryChange,
    anchorState,
    actionError,
    onAddAssets,
    onEditDetails,
    onOpenPrintView,
    onOpenShare,
}) {
    const compactActionClassName = 'h-12 justify-center px-3.5 text-sm sm:w-auto sm:px-4';

    return (
        <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:rounded-[32px] sm:p-5 xl:p-6">
            <div className="flex flex-col gap-5">
                {/* Row 1: Title and Actions */}
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                    <div className="min-w-0 flex-1">
                        <h1 className="truncate text-[1.8rem] font-extrabold tracking-tight text-slate-900 sm:text-[2rem]">
                            {directory.name}
                        </h1>
                        {directory.description ? (
                            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                                {directory.description}
                            </p>
                        ) : null}
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                        <button type="button" onClick={onAddAssets} className={`btn-primary min-w-[172px] ${compactActionClassName}`}>
                            <Plus size={16} />
                            Manage assets
                        </button>
                        <button type="button" onClick={onEditDetails} className={`btn-ghost ${compactActionClassName} border border-slate-200 text-slate-700`}>
                            <Pencil size={16} />
                            Edit
                        </button>
                        <button type="button" onClick={onOpenPrintView} className={`btn-ghost ${compactActionClassName} border border-slate-200 text-slate-700`}>
                            <Printer size={16} />
                            Print
                        </button>
                        <button type="button" onClick={onOpenShare} className={`btn-ghost ${compactActionClassName} border border-slate-200 text-slate-700`}>
                            <Link2 size={16} />
                            Share
                        </button>
                    </div>
                </div>

                {/* Row 2: Navigation, Search, and Distance */}
                <div className="grid gap-4 lg:grid-cols-[auto_minmax(320px,1fr)_auto] lg:items-center">
                    <Link
                        to="/my-directory?section=my-maps"
                        className="btn-ghost h-12 flex-shrink-0 justify-center border border-slate-200 px-4 text-sm font-semibold text-brand-700 shadow-sm transition hover:bg-brand-50"
                    >
                        <ArrowLeft size={16} />
                        My Maps
                    </Link>

                    <DirectorySearchBar
                        value={query}
                        onChange={onQueryChange}
                        inputId="directory-search-desktop"
                        placeholder="Search directory"
                        compact
                        className="min-w-0"
                    />

                    <DirectoryDistanceControls anchorState={anchorState} compact className="min-w-0 lg:min-w-[520px]" />
                </div>

                {actionError ? (
                    <p className="text-sm font-medium text-red-600">{actionError}</p>
                ) : null}
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
            <div className="sticky top-[56px] z-30 -mx-4 flex h-[60px] items-center border-b border-slate-200 bg-slate-50 px-6 backdrop-blur sm:top-[64px] sm:-mx-6 sm:h-[68px] xl:hidden disable-font-scaling">
                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={() => setOpen(true)}
                        className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm active:scale-95 transition-transform"
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
                                className="inline-flex items-center gap-2 self-start px-1 text-sm font-semibold text-brand-700 transition hover:text-brand-800"
                            >
                                <ArrowLeft size={16} />
                                Back to My Maps
                            </Link>

                            <div className="mt-4 space-y-2">
                                <button type="button" onClick={() => runDrawerAction(onAddAssets)} className="btn-primary h-12 w-full justify-center px-4 text-sm">
                                    <Plus size={16} />
                                    Manage assets
                                </button>
                                <button type="button" onClick={() => runDrawerAction(onEditDetails)} className="btn-ghost h-12 w-full justify-center border border-slate-200 px-4 text-sm text-slate-700">
                                    <Pencil size={16} />
                                    Edit details
                                </button>
                                <button type="button" onClick={() => runDrawerAction(onOpenPrintView)} className="btn-ghost h-12 w-full justify-center border border-slate-200 px-4 text-sm text-slate-700">
                                    <Printer size={16} />
                                    Print view
                                </button>
                                <button type="button" onClick={() => runDrawerAction(onOpenShare)} className="btn-ghost h-12 w-full justify-center border border-slate-200 px-4 text-sm text-slate-700">
                                    <Link2 size={16} />
                                    Share
                                </button>
                            </div>

                            <div className="mt-4 space-y-4 pb-4">
                                <DirectorySearchBar
                                    value={query}
                                    onChange={onQueryChange}
                                    inputId="directory-search-mobile"
                                    compact
                                    className="min-w-0"
                                />
                                <DirectoryDistanceControls
                                    anchorState={anchorState}
                                    compact
                                    compactLayout="stacked"
                                    className="min-w-0"
                                />
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
    const [hoveredPlaceKey, setHoveredPlaceKey] = useState(null);
    const [hoveredClusterPlaceKeys, setHoveredClusterPlaceKeys] = useState([]);
    const [editOpen, setEditOpen] = useState(false);
    const [editSubmitting, setEditSubmitting] = useState(false);
    const [editError, setEditError] = useState('');
    const [shareOpen, setShareOpen] = useState(false);
    const [shareSubmitting, setShareSubmitting] = useState(false);
    const [shareError, setShareError] = useState('');
    const [addOpen, setAddOpen] = useState(false);
    const [addSubmitting, setAddSubmitting] = useState(false);
    const [addError, setAddError] = useState('');
    const pendingFocusFrameRef = useRef(null);
    const useDesktopOwnerLayout = useMediaQuery('(min-width: 1024px)');
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

    const clearMapSelection = useCallback(() => {
        if (pendingFocusFrameRef.current !== null) {
            window.cancelAnimationFrame(pendingFocusFrameRef.current);
            pendingFocusFrameRef.current = null;
        }
        setFocusedPlaceKey(null);
        setHighlightPlaceKey(null);
        setHoveredPlaceKey(null);
        setHoveredClusterPlaceKeys([]);
    }, []);

    const handleMapFocusHandled = useCallback((handledPlaceKey) => {
        setFocusedPlaceKey((current) => (current === handledPlaceKey ? null : current));
    }, []);

    const activePlaceKey = hoveredClusterPlaceKeys.length ? null : (hoveredPlaceKey || highlightPlaceKey || null);
    const activePlaceKeys = hoveredClusterPlaceKeys.length ? hoveredClusterPlaceKeys : (activePlaceKey ? [activePlaceKey] : []);
    const effectiveFocusedPlaceKey = hoveredClusterPlaceKeys.length ? null : focusedPlaceKey;

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

    async function handleManageAssets({ assets }) {
        if (!directory) return;
        setAddSubmitting(true);
        setAddError('');
        try {
            const targetKeys = new Set(assets.map(a => `${a.resourceType}-${a.resourceId}`));
            const toAdd = assets.filter(a => !existingAssetKeys.has(`${a.resourceType}-${a.resourceId}`));
            const toRemove = directory.assets.filter(a => {
                const k = a.assetKey || `${a.resourceType}-${a.resourceId}`;
                return !targetKeys.has(k);
            });

            await Promise.all([
                ...toAdd.map((asset) => api.addMyMapAsset(directory.id, asset)),
                ...toRemove.map((asset) => api.removeMyMapAsset(directory.id, asset.resourceType, asset.resourceId))
            ]);

            setAddOpen(false);
            await loadMap();
        } catch (err) {
            console.error(err);
            setAddError(err.message || 'Failed to update directory resources.');
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

    function focusPlaceOnMap(placeKey) {
        const zoomKey = String(placeKey) + ':zoom';
        clearMapSelection();
        pendingFocusFrameRef.current = window.requestAnimationFrame(() => {
            pendingFocusFrameRef.current = null;
            setFocusedPlaceKey(zoomKey);
            setHighlightPlaceKey(String(placeKey));
        });
    }

    function handleViewSection(placeKey) {
        setQuery('');
        focusPlaceOnMap(placeKey);
    }

    function handleViewOnMap(placeKey) {
        focusPlaceOnMap(placeKey);
    }

    const handleMapHoverStart = useCallback((placeKey) => {
        if (suspendMapInteraction || !placeKey) return;
        setHighlightPlaceKey(null);
        setHoveredClusterPlaceKeys([]);
        setHoveredPlaceKey(String(placeKey));
    }, [suspendMapInteraction]);

    const handleMapHoverEnd = useCallback((placeKey) => {
        setHoveredPlaceKey((current) => (String(current) === String(placeKey) ? null : current));
    }, []);

    const handleMapClusterHoverStart = useCallback((placeKeys) => {
        if (suspendMapInteraction || !placeKeys?.length) return;
        setHighlightPlaceKey(null);
        setHoveredPlaceKey(null);
        setHoveredClusterPlaceKeys(placeKeys.map((value) => String(value)));
    }, [suspendMapInteraction]);

    const handleMapClusterHoverEnd = useCallback((placeKeys) => {
        const normalizedKeys = new Set((placeKeys || []).map((value) => String(value)));
        setHoveredClusterPlaceKeys((current) => current.filter((value) => !normalizedKeys.has(String(value))));
    }, []);

    const handleMapClusterSelect = useCallback((placeKeys) => {
        if (suspendMapInteraction || !placeKeys?.length) return;
        setFocusedPlaceKey(null);
        setHighlightPlaceKey(null);
        setHoveredPlaceKey(null);
        setHoveredClusterPlaceKeys(placeKeys.map((value) => String(value)));
    }, [suspendMapInteraction]);

    useEffect(() => () => {
        if (pendingFocusFrameRef.current !== null) {
            window.cancelAnimationFrame(pendingFocusFrameRef.current);
        }
    }, []);

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
            <div className="min-h-screen bg-white">
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

                <div className="w-full h-full overflow-auto">
                    <DirectoryPrintView
                        directory={directory}
                        mode="owner"
                        generatedAt={new Date()}
                        activeAnchor={activeAnchor}
                        shareUrl={sharedDirectoryUrl}
                        footerNote={directory.share?.isShared ? 'Open the shared link for the full interactive directory.' : ''}
                        className="w-full"
                    />
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
                {!useDesktopOwnerLayout ? (
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
                ) : null}

                <div className="mx-auto w-full max-w-[1800px] space-y-4 px-4 py-4 sm:px-6 sm:py-6 xl:px-10 2xl:px-14 xl:space-y-5">
                    {useDesktopOwnerLayout ? (
                        <div>
                            <OwnerHeader
                            directory={directory}
                            query={query}
                            onQueryChange={setQuery}
                            anchorState={anchorState}
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
                            />
                        </div>
                    ) : null}

                    {directory.summary.resourceCount === 0 ? (
                        <EmptyOwnerDirectory onAddAssets={() => setAddOpen(true)} />
                    ) : (
                        <>
                            <SharedMapDirectoryList
                                presentation={interactivePresentation}
                                mode="owner"
                                layout={useDesktopOwnerLayout ? 'desktop' : 'responsive'}
                                onViewOnMap={handleViewOnMap}
                                onRemoveResource={handleRemoveResource}
                                highlightPlaceKey={activePlaceKey}
                                highlightPlaceKeys={activePlaceKeys}
                                autoScrollToHighlight={!hoveredPlaceKey}
                                showDesktopHoverLogo
                                desktopGridClassName="lg:grid-cols-[minmax(280px,1fr)_minmax(380px,1.15fr)_minmax(280px,1fr)] xl:grid-cols-[minmax(320px,1fr)_minmax(560px,1.6fr)_minmax(320px,1fr)] 2xl:grid-cols-[minmax(360px,1fr)_minmax(680px,1.8fr)_minmax(360px,1fr)]"
                                renderDesktopMap={() => (
                                    <DirectoryMap
                                        pins={interactivePresentation.pins}
                                        focusedPlaceKey={effectiveFocusedPlaceKey}
                                        activePlaceKey={activePlaceKey}
                                        activePlaceKeys={activePlaceKeys}
                                        onViewSection={handleViewSection}
                                        onHoverPlaceStart={handleMapHoverStart}
                                        onHoverPlaceEnd={handleMapHoverEnd}
                                        onHoverClusterStart={handleMapClusterHoverStart}
                                        onHoverClusterEnd={handleMapClusterHoverEnd}
                                        onClusterSelect={handleMapClusterSelect}
                                        onFocusHandled={handleMapFocusHandled}
                                        onResetView={clearMapSelection}
                                        interactive={!suspendMapInteraction}
                                        markerMode="number"
                                        placeNumberByKey={interactivePresentation.placeNumberByKey}
                                        emptyLabel={query ? 'No mappable places match this directory search.' : 'This directory does not have any mappable places yet.'}
                                        mapHeightClassName="h-[42vh] min-h-[400px] max-h-[620px]"
                                    />
                                )}
                                renderMobileMap={() => (
                                    <DirectoryMap
                                        pins={interactivePresentation.pins}
                                        focusedPlaceKey={effectiveFocusedPlaceKey}
                                        activePlaceKey={activePlaceKey}
                                        activePlaceKeys={activePlaceKeys}
                                        onViewSection={handleViewSection}
                                        onHoverPlaceStart={handleMapHoverStart}
                                        onHoverPlaceEnd={handleMapHoverEnd}
                                        onHoverClusterStart={handleMapClusterHoverStart}
                                        onHoverClusterEnd={handleMapClusterHoverEnd}
                                        onClusterSelect={handleMapClusterSelect}
                                        onFocusHandled={handleMapFocusHandled}
                                        onResetView={clearMapSelection}
                                        interactive={!suspendMapInteraction}
                                        markerMode="number"
                                        placeNumberByKey={interactivePresentation.placeNumberByKey}
                                        emptyLabel={query ? 'No mappable places match this directory search.' : 'This directory does not have any mappable places yet.'}
                                        mapHeightClassName="h-[32svh] min-h-[240px] max-h-[360px]"
                                    />
                                )}
                                mobileMapStickyClassName="sticky top-[116px] sm:top-[132px] z-30 pb-5 isolate disable-font-scaling"
                            />
                        </>
                    )}
                </div>
            </div>

            <CreateMapModal
                isOpen={addOpen}
                mode="manage-assets"
                savedAssets={savedAssets}
                initialAssetKeys={[...existingAssetKeys]}
                submitting={addSubmitting}
                error={addError}
                onClose={() => {
                    if (addSubmitting) return;
                    setAddOpen(false);
                    setAddError('');
                }}
                onSubmit={handleManageAssets}
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
