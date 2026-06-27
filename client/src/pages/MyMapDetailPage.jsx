import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Drawer } from 'vaul';
import { ArrowLeft, Link2, Menu, Pencil, Plus, Printer, X } from 'lucide-react';

import CreateMapModal from '../components/CreateMapModal.jsx';
import DirectoryDistanceControls from '../components/DirectoryDistanceControls.jsx';
import DirectoryMap from '../components/DirectoryMap.jsx';
import DirectoryPrintView from '../components/DirectoryPrintView.jsx';
import DirectorySearchBar from '../components/DirectorySearchBar.jsx';
import EditMapDetailsModal from '../components/EditMapDetailsModal.jsx';
import MyMapPdfExportButton from '../components/MyMapPdfExportButton.jsx';
import MyMapV2PreviewScaffold from '../components/MyMapV2PreviewScaffold.jsx';
import ShareMapModal from '../components/ShareMapModal.jsx';
import SharedMapDirectoryList from '../components/SharedMapDirectoryList.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { useSavedAssets } from '../hooks/useSavedAssets.js';
import { api } from '../lib/api.js';
import {
    getGroupFocusFallbackResourceIds,
    mergeGroupFocusDetailsIntoDirectory,
} from '../lib/directoryGroupFocus.js';
import { buildDirectoryPresentation, buildDirectoryShareUrl } from '../lib/directoryPresentation.js';
import { fetchMyMapWithResilience } from '../lib/myMapsLoading.js';
import { MY_MAP_UI_MODE_V2, getMyMapUiMode } from '../lib/myMapUiMode.js';
import { useDirectoryDistanceAnchor } from '../hooks/useDirectoryDistanceAnchor.js';
import { useMediaQuery } from '../hooks/useMediaQuery.js';

const MapImageExportButton = lazy(() => import('../components/MapImageExportButton.jsx'));

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
    renderPdfExportButton,
}) {
    const { t } = useLocale();
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
                            {t('manageResources')}
                        </button>
                        <button type="button" onClick={onEditDetails} className={`btn-ghost ${compactActionClassName} border border-slate-200 text-slate-700`}>
                            <Pencil size={16} />
                            {t('edit')}
                        </button>
                        <button type="button" onClick={onOpenPrintView} className={`btn-ghost ${compactActionClassName} border border-slate-200 text-slate-700`}>
                            <Printer size={16} />
                            {t('print')}
                        </button>
                        {renderPdfExportButton?.(`h-12 justify-center px-3.5 text-sm sm:w-auto sm:px-4`)}
                        <button type="button" onClick={onOpenShare} className={`btn-ghost ${compactActionClassName} border border-slate-200 text-slate-700`}>
                            <Link2 size={16} />
                            {t('share')}
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
                        {t('myMaps')}
                    </Link>

                    <DirectorySearchBar
                        value={query}
                        onChange={onQueryChange}
                        inputId="directory-search-desktop"
                        placeholder={t('searchThisMap')}
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
    renderPdfExportButton,
    compactOverlay = false,
}) {
    const { t } = useLocale();
    const [open, setOpen] = useState(false);
    const headerClassName = compactOverlay
        ? 'sticky top-[56px] z-40 -mx-4 flex h-11 items-center border-b border-slate-200 bg-slate-50/95 px-4 shadow-[0_12px_24px_-24px_rgba(15,23,42,0.45)] backdrop-blur sm:top-[64px] sm:-mx-6 sm:h-12 sm:px-6 xl:hidden disable-font-scaling'
        : 'sticky top-[56px] z-30 -mx-4 flex h-[60px] items-center border-b border-slate-200 bg-slate-50 px-6 backdrop-blur sm:top-[64px] sm:-mx-6 sm:h-[68px] xl:hidden disable-font-scaling';
    const menuButtonClassName = compactOverlay
        ? 'inline-flex h-8 w-10 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-sm transition hover:bg-white active:scale-95 sm:h-9 sm:w-11'
        : 'inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm active:scale-95 transition-transform';

    const runDrawerAction = useCallback((action) => {
        setOpen(false);
        window.requestAnimationFrame(() => {
            action?.();
        });
    }, []);

    return (
        <>
            <div className={headerClassName}>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                    <button
                        type="button"
                        onClick={() => setOpen(true)}
                        className={menuButtonClassName}
                        aria-label={t('openMapControls')}
                    >
                        <Menu size={compactOverlay ? 18 : 20} strokeWidth={compactOverlay ? 2.3 : 2} />
                    </button>

                    <div className="min-w-0 flex-1">
                        <p className={`${compactOverlay ? 'text-[15px] sm:text-base' : 'text-base sm:text-[17px]'} truncate font-bold text-slate-900`}>{directory.name}</p>
                    </div>
                </div>
            </div>

            <Drawer.Root direction="left" open={open} onOpenChange={setOpen}>
                <Drawer.Portal>
                    <Drawer.Overlay className="fixed inset-0 z-[1200] bg-slate-950/35 xl:hidden" />
                    <Drawer.Content
                        className="fixed bottom-0 left-0 top-[56px] z-[1210] flex w-[min(92vw,380px)] flex-col border-r bg-white shadow-2xl sm:top-[64px] xl:hidden"
                        style={{
                            borderColor: 'var(--color-border)',
                            background: 'linear-gradient(180deg, #ffffff 0%, #f6fcfb 100%)',
                        }}
                    >
                        <Drawer.Title className="sr-only">{t('mapOptions')}</Drawer.Title>
                        <Drawer.Description className="sr-only">
                            {t('mapOptionsDescription')}
                        </Drawer.Description>

                        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-4">
                            <div className="min-w-0">
                                <h2 className="truncate text-[17px] font-bold text-slate-900">{directory.name}</h2>
                            </div>

                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                            aria-label={t('closeMapOptions')}
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
                                {t('backToMyMaps')}
                            </Link>

                            <div className="mt-4 space-y-2">
                                <button type="button" onClick={() => runDrawerAction(onAddAssets)} className="btn-primary h-12 w-full justify-center px-4 text-sm">
                                    <Plus size={16} />
                                    {t('manageResources')}
                                </button>
                                <button type="button" onClick={() => runDrawerAction(onEditDetails)} className="btn-ghost h-12 w-full justify-center border border-slate-200 px-4 text-sm text-slate-700">
                                    <Pencil size={16} />
                                    {t('editDetails')}
                                </button>
                                <button type="button" onClick={() => runDrawerAction(onOpenPrintView)} className="btn-ghost h-12 w-full justify-center border border-slate-200 px-4 text-sm text-slate-700">
                                    <Printer size={16} />
                                    {t('printFriendlyView')}
                                </button>
                                {renderPdfExportButton?.('h-12 w-full justify-center px-4 text-sm')}
                                <button type="button" onClick={() => runDrawerAction(onOpenShare)} className="btn-ghost h-12 w-full justify-center border border-slate-200 px-4 text-sm text-slate-700">
                                    <Link2 size={16} />
                                    {t('share')}
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
    const { t } = useLocale();
    return (
        <div className="rounded-[32px] border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center">
            <h2 className="text-2xl font-bold text-slate-900">{t('mapNoResourcesTitle')}</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-500">
                {t('mapNoResourcesDescription')}
            </p>
            <button type="button" onClick={onAddAssets} className="btn-primary mt-6 inline-flex justify-center">
                <Plus size={16} />
                {t('addFromMyDirectory')}
            </button>
        </div>
    );
}

function applyResourceNotesToDirectory(directory, resourceType, resourceId, notes) {
    if (!directory) return directory;
    const matchesResource = (item) => item?.resourceType === resourceType && Number(item?.resourceId) === Number(resourceId);
    const patchItem = (item) => (matchesResource(item) ? { ...item, notes } : item);

    return {
        ...directory,
        assets: (directory.assets || []).map(patchItem),
        places: (directory.places || []).map((place) => ({
            ...place,
            rows: (place.rows || []).map(patchItem),
        })),
    };
}

function normalizeCategoryMetaKey(value) {
    if (value === undefined || value === null) return '';
    return String(value).trim().toLowerCase();
}

function normalizeMapAddress(value) {
    const text = String(value || '').trim();
    return text || '';
}

function buildSubCategoryMetaLookup(subcategories = []) {
    const lookup = new Map();

    (Array.isArray(subcategories) ? subcategories : []).forEach((subcategory) => {
        const key = normalizeCategoryMetaKey(subcategory?.name);
        if (!key) return;
        lookup.set(key, {
            color: subcategory?.color || null,
            iconUrl: subcategory?.iconUrl || null,
        });
    });

    return lookup;
}

function applySubCategoryMetaToRow(row, lookup) {
    if (!row || !lookup.size) return row;
    const categoryMeta = lookup.get(normalizeCategoryMetaKey(row.iconKey || row.subCategory));
    const mapCategoryMeta = lookup.get(normalizeCategoryMetaKey(row.mapIconKey || row.mapSubCategory || row.mapCategoryLabel));
    if (!categoryMeta && !mapCategoryMeta) return row;
    const nextCategoryColor = row.categoryColor || categoryMeta?.color || null;
    const nextCategoryIconUrl = row.categoryIconUrl || categoryMeta?.iconUrl || null;
    const nextMapCategoryColor = row.mapCategoryColor || mapCategoryMeta?.color || null;
    const nextMapCategoryIconUrl = row.mapCategoryIconUrl || mapCategoryMeta?.iconUrl || null;

    if (
        nextCategoryColor === (row.categoryColor || null)
        && nextCategoryIconUrl === (row.categoryIconUrl || null)
        && nextMapCategoryColor === (row.mapCategoryColor || null)
        && nextMapCategoryIconUrl === (row.mapCategoryIconUrl || null)
    ) {
        return row;
    }

    return {
        ...row,
        categoryColor: nextCategoryColor,
        categoryIconUrl: nextCategoryIconUrl,
        ...(row.mapSubCategory || row.mapCategoryLabel || row.mapIconKey ? {
            mapCategoryColor: nextMapCategoryColor,
            mapCategoryIconUrl: nextMapCategoryIconUrl,
        } : {}),
    };
}

function applySubCategoryMetaToDirectory(directory, subcategories = []) {
    if (!directory) return directory;
    const lookup = buildSubCategoryMetaLookup(subcategories);
    if (!lookup.size) return directory;

    return {
        ...directory,
        assets: (directory.assets || []).map((asset) => applySubCategoryMetaToRow(asset, lookup)),
        places: (directory.places || []).map((place) => ({
            ...place,
            rows: (place.rows || []).map((row) => applySubCategoryMetaToRow(row, lookup)),
        })),
    };
}

function getMissingHardAddressIds(directory) {
    const ids = new Set();

    (directory?.places || []).forEach((place) => {
        if (normalizeMapAddress(place?.address)) return;
        (place?.rows || []).forEach((row) => {
            if (row?.resourceType !== 'hard' || row?.status === 'unavailable') return;
            const id = Number(row.resourceId);
            if (Number.isInteger(id) && id > 0) {
                ids.add(id);
            }
        });
    });

    return [...ids];
}

function applyHardAddressBackfillsToDirectory(directory, addressByHardAssetId) {
    if (!directory || !addressByHardAssetId?.size) return directory;

    return {
        ...directory,
        places: (directory.places || []).map((place) => {
            const hardRow = (place.rows || []).find((row) => row?.resourceType === 'hard' && addressByHardAssetId.has(Number(row.resourceId)));
            const backfilledAddress = hardRow ? addressByHardAssetId.get(Number(hardRow.resourceId)) : '';
            const nextAddress = normalizeMapAddress(place.address) || backfilledAddress || null;
            let changed = nextAddress !== (place.address || null);
            const nextRows = (place.rows || []).map((row) => {
                if (row?.resourceType !== 'hard') return row;
                const rowAddress = addressByHardAssetId.get(Number(row.resourceId));
                if (!rowAddress || normalizeMapAddress(row.address)) return row;
                changed = true;
                return {
                    ...row,
                    address: rowAddress,
                };
            });

            if (!changed) return place;

            return {
                ...place,
                address: nextAddress,
                rows: nextRows,
            };
        }),
    };
}

async function backfillMissingHardPlaceAddresses(directory) {
    const missingHardAddressIds = getMissingHardAddressIds(directory);
    if (!missingHardAddressIds.length) return directory;

    const details = await Promise.all(
        missingHardAddressIds.map((id) => api.getHardAsset(id, { suppressAuthExpired: true }).catch(() => null)),
    );
    const addressByHardAssetId = new Map();
    details.forEach((detail, index) => {
        const address = normalizeMapAddress(detail?.address);
        if (address) {
            addressByHardAssetId.set(missingHardAddressIds[index], address);
        }
    });

    return applyHardAddressBackfillsToDirectory(directory, addressByHardAssetId);
}

async function backfillGroupFocusPlaceKeys(directory) {
    const resourceIds = getGroupFocusFallbackResourceIds(directory);
    if (!resourceIds.length) return directory;

    const details = await Promise.all(
        resourceIds.map((id) => api.getSoftAsset(id, { suppressAuthExpired: true }).catch(() => null)),
    );
    const groupDetailsByResourceId = new Map();
    details.forEach((detail, index) => {
        if (detail?.assetMode === 'group') {
            groupDetailsByResourceId.set(resourceIds[index], detail);
        }
    });

    return mergeGroupFocusDetailsIntoDirectory(directory, groupDetailsByResourceId);
}

export default function MyMapDetailPage() {
    const { mapId } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user } = useAuth();
    const { t } = useLocale();
    const { savedAssets } = useSavedAssets();
    const [directory, setDirectory] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionError, setActionError] = useState('');
    const [query, setQuery] = useState('');
    const [focusedPlaceKey, setFocusedPlaceKey] = useState(null);
    const [focusedPlaceKeys, setFocusedPlaceKeys] = useState([]);
    const [highlightPlaceKey, setHighlightPlaceKey] = useState(null);
    const [hoveredPlaceKey, setHoveredPlaceKey] = useState(null);
    const [hoveredClusterPlaceKeys, setHoveredClusterPlaceKeys] = useState([]);
    const [selectedClusterPlaceKeys, setSelectedClusterPlaceKeys] = useState([]);
    const [selectionScrollRequest, setSelectionScrollRequest] = useState(0);
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
    const desktopSelectionSnapRef = useRef(null);
    const useDesktopOwnerLayout = useMediaQuery('(min-width: 1024px)');
    const useDesktopDirectoryBodyLayout = useMediaQuery('(min-width: 1024px)');
    const suspendMapInteraction = shareOpen || editOpen || addOpen;
    const isPrintView = searchParams.get('view') === 'print';
    const myMapUiMode = getMyMapUiMode(searchParams);
    const isV2View = myMapUiMode === MY_MAP_UI_MODE_V2 && !isPrintView;
    const anchorState = useDirectoryDistanceAnchor({
        storageKey: mapId ? `my-map:no-default:${mapId}` : 'my-map:no-default',
        userPostalCode: user?.postalCode || '',
        defaultActiveMode: null,
    });

    const loadMap = useCallback(async () => {
        if (!mapId) return;
        setLoading(true);
        setError('');
        try {
            const [item, subcategories] = await Promise.all([
                fetchMyMapWithResilience(() => api.getMyMap(mapId)),
                api.getSubCategories({ suppressAuthExpired: true }).catch(() => []),
            ]);
            const enrichedDirectory = applySubCategoryMetaToDirectory(item, subcategories);
            const addressBackfilledDirectory = await backfillMissingHardPlaceAddresses(enrichedDirectory);
            setDirectory(await backfillGroupFocusPlaceKeys(addressBackfilledDirectory));
        } catch (err) {
            console.error(err);
            setError(err.message || t('failedLoadMap'));
        } finally {
            setLoading(false);
        }
    }, [mapId, t]);

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
    const v2Presentation = useMemo(() => (
        buildDirectoryPresentation(directory, { query, activeAnchor, presentationMode: 'v2-cards' })
    ), [activeAnchor, directory, query]);
    const ownerPresentation = isV2View ? v2Presentation : interactivePresentation;
    const pdfPresentation = useMemo(() => (
        buildDirectoryPresentation(directory)
    ), [directory]);
    const sharedDirectoryUrl = useMemo(() => (
        buildDirectoryShareUrl(directory?.share?.sharePath)
    ), [directory?.share?.sharePath]);
    const renderPdfExportButton = useCallback((className = '') => (
        <MyMapPdfExportButton
            directory={directory}
            presentation={pdfPresentation}
            className={className}
        />
    ), [directory, pdfPresentation]);

    const clearMapSelection = useCallback(() => {
        if (pendingFocusFrameRef.current !== null) {
            window.cancelAnimationFrame(pendingFocusFrameRef.current);
            pendingFocusFrameRef.current = null;
        }
        setFocusedPlaceKey(null);
        setFocusedPlaceKeys([]);
        setHighlightPlaceKey(null);
        setHoveredPlaceKey(null);
        setHoveredClusterPlaceKeys([]);
        setSelectedClusterPlaceKeys([]);
    }, []);

    const handleMapFocusHandled = useCallback((handledPlaceKey) => {
        setFocusedPlaceKey((current) => (current === handledPlaceKey ? null : current));
        setFocusedPlaceKeys((current) => (current.join('|') === handledPlaceKey ? [] : current));
    }, []);

    const getHoverPlaceKeys = useCallback((placeKey) => {
        const normalizedPlaceKey = placeKey ? String(placeKey) : '';
        return ownerPresentation.mapFocusPlaceKeysByKey?.[normalizedPlaceKey]
            || ownerPresentation.hoverPlaceKeysByKey?.[normalizedPlaceKey]
            || (normalizedPlaceKey ? [normalizedPlaceKey] : []);
    }, [ownerPresentation.hoverPlaceKeysByKey, ownerPresentation.mapFocusPlaceKeysByKey]);

    const activePlaceKey = (hoveredClusterPlaceKeys.length || selectedClusterPlaceKeys.length)
        ? null
        : (hoveredPlaceKey || highlightPlaceKey || null);
    const activePlaceKeys = hoveredClusterPlaceKeys.length
        ? hoveredClusterPlaceKeys
        : (selectedClusterPlaceKeys.length
            ? selectedClusterPlaceKeys
            : (hoveredPlaceKey ? getHoverPlaceKeys(hoveredPlaceKey) : (activePlaceKey ? getHoverPlaceKeys(activePlaceKey) : [])));
    const effectiveFocusedPlaceKey = (hoveredClusterPlaceKeys.length || selectedClusterPlaceKeys.length)
        ? null
        : focusedPlaceKey;

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
            setEditError(err.message || t('failedUpdateMap'));
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
            setAddError(err.message || t('failedUpdateMapResources'));
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
            setActionError(err.message || t('failedRemoveMapResource'));
        }
    }

    async function handlePublishShare(options = {}) {
        if (!directory) return;
        setShareSubmitting(true);
        setShareError('');
        try {
            void options;
            await api.publishMyMapShare(directory.id);
            await loadMap();
        } catch (err) {
            console.error(err);
            setShareError(err.message || t('failedPublishShare'));
        } finally {
            setShareSubmitting(false);
        }
    }

    async function handleUpdateResourceNotes(row, notes, options = {}) {
        if (!directory || !row?.resourceType || !row?.resourceId) return null;
        setActionError('');
        const updated = await api.updateMyMapAssetNotes(directory.id, row.resourceType, row.resourceId, notes, options);
        const nextNotes = updated?.notes || {
            items: notes.notes || [],
            notesUpdatedAt: new Date().toISOString(),
        };
        setDirectory((current) => applyResourceNotesToDirectory(current, row.resourceType, row.resourceId, nextNotes));
        return updated;
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
            setShareError(err.message || t('failedUnpublishShare'));
        } finally {
            setShareSubmitting(false);
        }
    }

    function focusPlaceOnMap(placeKey) {
        const mapFocusPlaceKeys = ownerPresentation.mapFocusPlaceKeysByKey?.[placeKey] || [];
        const resolvedPlaceKey = ownerPresentation.groupKeyByPlaceKey?.[placeKey] || placeKey;
        const singleFocusPlaceKey = mapFocusPlaceKeys.length === 1
            ? (ownerPresentation.groupKeyByPlaceKey?.[mapFocusPlaceKeys[0]] || mapFocusPlaceKeys[0])
            : resolvedPlaceKey;
        if (!singleFocusPlaceKey && !mapFocusPlaceKeys.length) return;
        clearMapSelection();
        pendingFocusFrameRef.current = window.requestAnimationFrame(() => {
            pendingFocusFrameRef.current = null;
            setSelectionScrollRequest((value) => value + 1);
            if (mapFocusPlaceKeys.length > 1) {
                setFocusedPlaceKeys(mapFocusPlaceKeys);
                setHighlightPlaceKey(String(placeKey));
                return;
            }
            setFocusedPlaceKey(`${singleFocusPlaceKey}:zoom`);
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
        setSelectedClusterPlaceKeys([]);
        setHoveredPlaceKey(String(placeKey));
    }, [suspendMapInteraction]);

    const handleMapHoverEnd = useCallback((placeKey) => {
        setHoveredPlaceKey((current) => (String(current) === String(placeKey) ? null : current));
    }, []);

    const handleMapClusterHoverStart = useCallback((placeKeys) => {
        if (suspendMapInteraction || !placeKeys?.length) return;
        setHighlightPlaceKey(null);
        setHoveredPlaceKey(null);
        setSelectedClusterPlaceKeys([]);
        setHoveredClusterPlaceKeys(placeKeys.map((value) => String(value)));
    }, [suspendMapInteraction]);

    const handleMapClusterHoverEnd = useCallback((placeKeys) => {
        const normalizedKeys = new Set((placeKeys || []).map((value) => String(value)));
        setHoveredClusterPlaceKeys((current) => current.filter((value) => !normalizedKeys.has(String(value))));
    }, []);

    const handleMapClusterSelect = useCallback((placeKeys) => {
        if (suspendMapInteraction || !placeKeys?.length) return;
        setFocusedPlaceKey(null);
        setFocusedPlaceKeys([]);
        setHighlightPlaceKey(null);
        setHoveredPlaceKey(null);
        setHoveredClusterPlaceKeys([]);
        setSelectedClusterPlaceKeys(placeKeys.map((value) => String(value)));
        setSelectionScrollRequest((value) => value + 1);
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
                        <h1 className="text-2xl font-bold text-slate-900">{t('mapNotAvailable')}</h1>
                        <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">
                            {error || t('mapNotAvailableDescription')}
                        </p>
                        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                            <button type="button" onClick={loadMap} className="btn-primary inline-flex justify-center">
                                {t('phoneLoginTryAgainButton')}
                            </button>
                            <Link to="/my-directory?section=my-maps" className="btn-ghost inline-flex justify-center border border-slate-200 text-slate-700">
                                <ArrowLeft size={16} />
                                {t('backToMyMaps')}
                            </Link>
                        </div>
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
                            {t('backToInteractiveView')}
                        </button>
                        <Suspense fallback={(
                            <span className="btn-ghost justify-center border border-slate-200 text-slate-500">
                                {t('loadingPage')}
                            </span>
                        )}>
                            <MapImageExportButton directory={directory} activeAnchor={activeAnchor} shareUrl={sharedDirectoryUrl} />
                        </Suspense>
                    </div>
                </div>

                <div className="w-full h-full overflow-auto">
                    <DirectoryPrintView
                        directory={directory}
                        mode="owner"
                        generatedAt={new Date()}
                        activeAnchor={activeAnchor}
                        shareUrl={sharedDirectoryUrl}
                        footerNote={directory.share?.isShared ? t('openSharedLinkForInteractiveMap') : ''}
                        className="w-full"
                    />
                </div>
            </div>
        );
    }

    if (isV2View) {
        return (
            <>
                <MyMapV2PreviewScaffold
                    directory={directory}
                    query={query}
                    onQueryChange={setQuery}
                    activeAnchor={activeAnchor}
                    presentation={v2Presentation}
                    useDesktopLayout={useDesktopOwnerLayout}
                    useDesktopBodyLayout={useDesktopDirectoryBodyLayout}
                    focusedPlaceKey={effectiveFocusedPlaceKey}
                    focusedPlaceKeys={focusedPlaceKeys}
                    activePlaceKey={activePlaceKey}
                    activePlaceKeys={activePlaceKeys}
                    selectionPlaceKey={highlightPlaceKey || selectedClusterPlaceKeys[0] || null}
                    selectionScrollRequest={selectionScrollRequest}
                    desktopScrollTargetRef={desktopSelectionSnapRef}
                    suspendMapInteraction={suspendMapInteraction}
                    onViewOnMap={handleViewOnMap}
                    onViewSection={handleViewSection}
                    onRemoveResource={handleRemoveResource}
                    onUpdateResourceNotes={handleUpdateResourceNotes}
                    onHoverPlaceStart={handleMapHoverStart}
                    onHoverPlaceEnd={handleMapHoverEnd}
                    onHoverClusterStart={handleMapClusterHoverStart}
                    onHoverClusterEnd={handleMapClusterHoverEnd}
                    onClusterSelect={handleMapClusterSelect}
                    onFocusHandled={handleMapFocusHandled}
                    onResetView={clearMapSelection}
                    toolbar={useDesktopOwnerLayout ? (
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
                            renderPdfExportButton={renderPdfExportButton}
                        />
                    ) : (
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
                            renderPdfExportButton={renderPdfExportButton}
                            compactOverlay
                        />
                    )}
                    emptyLabel={query ? t('noMapPlacesMatchSearch') : t('mapNoPlacesYet')}
                    emptyState={<EmptyOwnerDirectory onAddAssets={() => setAddOpen(true)} />}
                />

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
                        renderPdfExportButton={renderPdfExportButton}
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
                                renderPdfExportButton={renderPdfExportButton}
                            />
                        </div>
                    ) : null}

                    {useDesktopOwnerLayout ? (
                        <div
                            ref={desktopSelectionSnapRef}
                            aria-hidden="true"
                            className="h-px -mt-px scroll-mt-[56px] sm:scroll-mt-[64px]"
                        />
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
                                onHoverPlaceStart={handleMapHoverStart}
                                onHoverPlaceEnd={handleMapHoverEnd}
                                onRemoveResource={handleRemoveResource}
                                onUpdateResourceNotes={handleUpdateResourceNotes}
                                highlightPlaceKey={activePlaceKey}
                                highlightPlaceKeys={activePlaceKeys}
                                selectionPlaceKey={highlightPlaceKey || selectedClusterPlaceKeys[0] || null}
                                selectionScrollRequest={selectionScrollRequest}
                                showDesktopHoverLogo
                                desktopScrollTargetRef={desktopSelectionSnapRef}
                                desktopGridClassName="lg:grid-cols-[minmax(280px,1fr)_minmax(380px,1.15fr)_minmax(280px,1fr)] xl:grid-cols-[minmax(320px,1fr)_minmax(560px,1.6fr)_minmax(320px,1fr)] 2xl:grid-cols-[minmax(360px,1fr)_minmax(680px,1.8fr)_minmax(360px,1fr)]"
                                renderDesktopMap={() => (
                                    <DirectoryMap
                                        activeAnchor={activeAnchor}
                                        pins={interactivePresentation.pins}
                                        focusedPlaceKey={effectiveFocusedPlaceKey}
                                        focusedPlaceKeys={focusedPlaceKeys}
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
                                        emptyLabel={query ? t('noMapPlacesMatchSearch') : t('mapNoPlacesYet')}
                                        mapHeightClassName="h-[42vh] min-h-[400px] max-h-[620px]"
                                    />
                                )}
                                renderMobileMap={() => (
                                    <DirectoryMap
                                        activeAnchor={activeAnchor}
                                        pins={interactivePresentation.pins}
                                        focusedPlaceKey={effectiveFocusedPlaceKey}
                                        focusedPlaceKeys={focusedPlaceKeys}
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
                                        emptyLabel={query ? t('noMapPlacesMatchSearch') : t('mapNoPlacesYet')}
                                        mapHeightClassName="h-[32svh] min-h-[240px] max-h-[360px]"
                                    />
                                )}
                                mobileMapStickyClassName="sticky top-[116px] sm:top-[132px] z-30 -mx-4 bg-slate-50 px-4 pb-5 shadow-[0_18px_28px_-24px_rgba(15,23,42,0.45)] isolate disable-font-scaling"
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
