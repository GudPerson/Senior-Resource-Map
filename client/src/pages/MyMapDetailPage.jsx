import { lazy, Suspense, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Drawer } from 'vaul';
import {
    AlignLeft,
    ArrowLeft,
    CheckCircle2,
    ChevronDown,
    Link2,
    ListOrdered,
    LoaderCircle,
    MapPin,
    Menu,
    PenLine,
    Pencil,
    Plus,
    Printer,
    Search,
    SlidersHorizontal,
    Trash2,
    X,
} from 'lucide-react';

import CreateMapModal from '../components/CreateMapModal.jsx';
import { useConfirmDialog } from '../components/ConfirmDialog.jsx';
import DirectoryDistanceControls from '../components/DirectoryDistanceControls.jsx';
import DirectoryMap from '../components/DirectoryMap.jsx';
import DirectoryPrintView from '../components/DirectoryPrintView.jsx';
import DirectorySearchBar from '../components/DirectorySearchBar.jsx';
import EditMapDetailsModal from '../components/EditMapDetailsModal.jsx';
import { FIXED_TOWN_SURFACE_MIN_ZOOM } from '../components/FixedTownSurfaceLayer.jsx';
import MyMapPdfExportButton from '../components/MyMapPdfExportButton.jsx';
import MyMapCategoryOrderModal from '../components/MyMapCategoryOrderModal.jsx';
import MyMapV2PreviewScaffold from '../components/MyMapV2PreviewScaffold.jsx';
import MapAssetShortDescriptionModal from '../components/MapAssetShortDescriptionModal.jsx';
import MapStudioViewsPanel from '../components/MapStudioViewsPanel.jsx';
import PrintAnnotationLayer from '../components/PrintAnnotationLayer.jsx';
import AddPersonalPlaceChooserModal from '../components/personalPlaces/AddPersonalPlaceChooserModal.jsx';
import PersonalPlaceCategoryManagerModal from '../components/personalPlaces/PersonalPlaceCategoryManagerModal.jsx';
import PersonalPlaceEditorModal from '../components/personalPlaces/PersonalPlaceEditorModal.jsx';
import ShareMapModal from '../components/ShareMapModal.jsx';
import SharedMapDirectoryList from '../components/SharedMapDirectoryList.jsx';
import TownMapModeControl from '../components/TownMapModeControl.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { useMapStyle } from '../contexts/MapStyleContext.jsx';
import { useSavedAssets } from '../hooks/useSavedAssets.js';
import { api } from '../lib/api.js';
import { searchOneMap } from '../lib/geo.js';
import {
    getGroupFocusFallbackResourceIds,
    mergeGroupFocusDetailsIntoDirectory,
} from '../lib/directoryGroupFocus.js';
import { buildDirectoryPresentation, buildDirectoryShareUrl } from '../lib/directoryPresentation.js';
import { fetchMyMapWithResilience } from '../lib/myMapsLoading.js';
import { collectMyMapCategoryOptions } from '../lib/myMapCategoryOrder.js';
import {
    buildMyMapAssetMutationPlan,
    isMyMapAssetSelectionReconciled,
} from '../lib/myMapResourceSelection.js';
import {
    CAREAROUND_BASEMAP_MIN_NATIVE_ZOOM,
    CAREAROUND_MAP_STYLE_DEFAULT,
    CAREAROUND_MAP_STYLE_GRAY,
} from '../lib/mapTheme.js';
import { buildMapStudioInteractiveModel } from '../lib/mapStudioInteractiveAdapter.js';
import {
    buildMapStudioPrintState,
    createMapStudioExportSettings,
} from '../lib/mapStudioState.js';
import {
    buildMapStudioResourceLayerCatalog,
    filterMapStudioDirectoryByLayers,
} from '../lib/mapStudioPresentationAdapter.js';
import { MY_MAP_UI_MODE_V2, getMyMapUiMode } from '../lib/myMapUiMode.js';
import {
    fetchFixedTownSurfaceManifest,
    fetchFixedTownSurfaceSource,
    isPointWithinWsenBounds,
    normalizeFixedTownAssetBaseUrl,
    resolveFixedTownSurfaceAssetBaseUrl,
    resolveFixedTownSurfaceManifestPath,
    resolveFixedTownSurfaceTier,
    selectFixedTownSurfaceForViewport,
} from '../lib/fixedTownSurface.js';
import { useDirectoryDistanceAnchor } from '../hooks/useDirectoryDistanceAnchor.js';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import { usePrintAnnotations } from '../hooks/usePrintAnnotations.js';
import useInteractiveMapAnnotationEditor from '../hooks/useInteractiveMapAnnotationEditor.jsx';
import {
    PRINT_MAP_ANNOTATION_LAYER_HIDE,
    PRINT_MAP_ANNOTATION_LAYER_SHOW,
    PRINT_MAP_LAYOUT_FULL,
    createOwnerPrintMapState,
} from '../lib/printMapState.js';
import { filterPrintMapAnnotations } from '../lib/printMapLayers.js';

const MapImageExportButton = lazy(() => import('../components/MapImageExportButton.jsx'));
const TOWN_MAP_PROOF_ENABLED = import.meta.env.VITE_TOWN_MAP_PROOF_ENABLED === 'true';
const TOWN_MAP_ASSET_BASE_URL = normalizeFixedTownAssetBaseUrl(import.meta.env.VITE_TOWN_MAP_ASSET_BASE_URL || '');
const TOWN_MAP_GRAY_ASSET_BASE_URL = normalizeFixedTownAssetBaseUrl(import.meta.env.VITE_TOWN_MAP_GRAY_ASSET_BASE_URL || '');
const TOWN_MAP_OVERVIEW_ENABLED = TOWN_MAP_PROOF_ENABLED
    && import.meta.env.VITE_TOWN_MAP_ZOOM14_OVERVIEW_ENABLED === 'true';
const TOWN_MAP_OVERVIEW_ASSET_BASE_URL = normalizeFixedTownAssetBaseUrl(
    import.meta.env.VITE_TOWN_MAP_OVERVIEW_ASSET_BASE_URL || '',
);
const TOWN_MAP_GRAY_OVERVIEW_ASSET_BASE_URL = normalizeFixedTownAssetBaseUrl(
    import.meta.env.VITE_TOWN_MAP_GRAY_OVERVIEW_ASSET_BASE_URL || '',
);
const TOWN_MAP_PROOF_MINIMUM_ZOOM_CENTER = [1.3521, 103.846];
const OWNER_PRINT_BASEMAP_OPTIONS = TOWN_MAP_PROOF_ENABLED
    ? { basemapMode: 'auto' }
    : undefined;
const MY_MAP_DETAIL_CACHE_LIMIT = 8;
const MY_MAP_ROUTE_CACHE_VERSION = '2026-07-29.1';
const myMapDetailCache = new Map();

const CLASSIC_DESKTOP_MAP_HEIGHT_CLASSES = Object.freeze({
    compact: 'h-[36vh] min-h-[340px] max-h-[500px]',
    standard: 'h-[42vh] min-h-[400px] max-h-[620px]',
    tall: 'h-[60vh] min-h-[520px] max-h-[820px]',
});
const CLASSIC_MOBILE_MAP_HEIGHT_CLASSES = Object.freeze({
    compact: 'h-[26svh] min-h-[220px] max-h-[300px]',
    standard: 'h-[32svh] min-h-[240px] max-h-[360px]',
    tall: 'h-[48svh] min-h-[360px] max-h-[560px]',
});
const CLASSIC_EMPTY_MAP_HEIGHT_CLASSES = Object.freeze({
    compact: 'h-[36vh] min-h-[280px] max-h-[500px]',
    standard: 'h-[42vh] min-h-[320px] max-h-[620px]',
    tall: 'h-[60vh] min-h-[480px] max-h-[820px]',
});

function resolveClassicMapHeightClass(mapHeight, viewport = 'desktop', empty = false) {
    const classes = empty
        ? CLASSIC_EMPTY_MAP_HEIGHT_CLASSES
        : viewport === 'mobile'
            ? CLASSIC_MOBILE_MAP_HEIGHT_CLASSES
            : CLASSIC_DESKTOP_MAP_HEIGHT_CLASSES;
    return classes[mapHeight] || classes.standard;
}

function getMyMapDetailCacheKey(user, mapId) {
    const userId = Number(user?.id);
    const resolvedMapId = Number(mapId);
    if (!Number.isSafeInteger(userId) || userId <= 0) return '';
    if (!Number.isSafeInteger(resolvedMapId) || resolvedMapId <= 0) return '';
    return `${userId}:${resolvedMapId}`;
}

function getCachedMyMapDetail(user, mapId) {
    const cacheKey = getMyMapDetailCacheKey(user, mapId);
    return cacheKey ? myMapDetailCache.get(cacheKey) || null : null;
}

function cacheMyMapDetail(user, mapId, directory) {
    const cacheKey = getMyMapDetailCacheKey(user, mapId);
    if (!cacheKey || !directory) return;

    myMapDetailCache.delete(cacheKey);
    myMapDetailCache.set(cacheKey, directory);
    while (myMapDetailCache.size > MY_MAP_DETAIL_CACHE_LIMIT) {
        const oldestKey = myMapDetailCache.keys().next().value;
        myMapDetailCache.delete(oldestKey);
    }
}

function MapDetailLoadingState() {
    return (
        <div className="space-y-5">
            <div className="h-44 animate-pulse rounded-[32px] border border-slate-200 bg-white shadow-sm" />
            <div className="h-80 animate-pulse rounded-[32px] border border-slate-200 bg-white shadow-sm" />
            <div className="h-64 animate-pulse rounded-[32px] border border-slate-200 bg-white shadow-sm" />
        </div>
    );
}

function PersonalPlaceActionStatus({ status }) {
    if (!status) return null;

    const pending = status.phase === 'pending';
    return (
        <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            data-personal-place-action-status={status.phase}
            className={`pointer-events-none flex min-h-12 w-full items-center gap-3 rounded-xl border px-4 py-3 text-sm font-bold shadow-lg backdrop-blur-sm ${
                pending
                    ? 'border-brand-200 bg-white/95 text-slate-800'
                    : 'border-emerald-200 bg-emerald-50/95 text-emerald-900'
            }`}
        >
            {pending ? (
                <LoaderCircle size={18} className="flex-shrink-0 animate-spin text-brand-700" aria-hidden="true" />
            ) : (
                <CheckCircle2 size={18} className="flex-shrink-0 text-emerald-700" aria-hidden="true" />
            )}
            <span>{status.message}</span>
        </div>
    );
}

function PersonalPlacePlacementPrompt({ message }) {
    return (
        <div
            role="status"
            aria-live="polite"
            data-personal-place-placement-prompt="true"
            className="pointer-events-none flex min-h-12 w-full items-center gap-3 rounded-xl border border-brand-200 bg-white/95 px-4 py-3 text-sm font-bold text-slate-800 shadow-lg backdrop-blur-sm"
        >
            <MapPin size={18} className="flex-shrink-0 text-brand-700" aria-hidden="true" />
            <span>{message}</span>
        </div>
    );
}

function OwnerEditContentMenu({
    onArrangeCategories,
    categoryCount = 0,
    onToggleShortDescription,
    shortDescriptionMode = false,
    onToggleAnnotations,
    annotationEditing = false,
    canEditAnnotations = false,
    annotationsReady = false,
    onToggleResourceRemoval,
    resourceRemovalMode = false,
    inFlow = false,
}) {
    const { t } = useLocale();
    const menuId = useId();
    const rootRef = useRef(null);
    const menuRef = useRef(null);
    const triggerRef = useRef(null);
    const [open, setOpen] = useState(false);
    const contentModeActive = shortDescriptionMode || annotationEditing || resourceRemovalMode;

    const focusFirstAvailableItem = useCallback(() => {
        window.requestAnimationFrame(() => {
            menuRef.current?.querySelector('button:not(:disabled)')?.focus();
        });
    }, []);

    useEffect(() => {
        if (!open) return undefined;
        const handlePointerDown = (event) => {
            if (rootRef.current?.contains(event.target)) return;
            setOpen(false);
        };
        const handleKeyDown = (event) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            setOpen(false);
            triggerRef.current?.focus();
        };
        window.addEventListener('pointerdown', handlePointerDown);
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('pointerdown', handlePointerDown);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [open]);

    const runAction = useCallback((action) => {
        setOpen(false);
        action?.();
    }, []);

    return (
        <div ref={rootRef} className={`relative ${inFlow ? 'w-full' : ''}`} data-owner-edit-content-menu="true">
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setOpen((current) => !current)}
                onKeyDown={(event) => {
                    if (event.key !== 'ArrowDown') return;
                    event.preventDefault();
                    setOpen(true);
                    focusFirstAvailableItem();
                }}
                className={`btn-ghost h-12 justify-center border px-3.5 text-sm sm:px-4 ${inFlow ? 'w-full' : ''} ${
                    open || contentModeActive
                        ? 'border-brand-600 bg-brand-50 text-brand-800'
                        : 'border-slate-200 text-slate-700'
                }`}
                aria-expanded={open}
                aria-haspopup="menu"
                aria-controls={menuId}
            >
                <AlignLeft size={16} aria-hidden="true" />
                {t('editContent')}
                <ChevronDown size={15} className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>

            {open ? (
                <div
                    ref={menuRef}
                    id={menuId}
                    role="menu"
                    aria-label={t('editContent')}
                    className={`${inFlow ? 'mt-2 w-full' : 'absolute right-0 top-[calc(100%+8px)] z-[1140] w-64'} overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl`}
                >
                    <button
                        type="button"
                        role="menuitem"
                        onClick={() => runAction(onArrangeCategories)}
                        disabled={categoryCount < 1}
                        className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-bold text-slate-700 transition hover:bg-brand-50 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                        <ListOrdered size={17} className="text-brand-700" aria-hidden="true" />
                        {t('arrangeCategories')}
                    </button>
                    <button
                        type="button"
                        role="menuitemcheckbox"
                        aria-checked={shortDescriptionMode}
                        onClick={() => runAction(onToggleShortDescription)}
                        className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-bold transition focus:outline-none focus:ring-4 focus:ring-brand-100 ${
                            shortDescriptionMode ? 'bg-brand-50 text-brand-800' : 'text-slate-700 hover:bg-brand-50'
                        }`}
                    >
                        <AlignLeft size={17} className="text-brand-700" aria-hidden="true" />
                        {t('addShortDescription')}
                    </button>
                    <button
                        type="button"
                        role="menuitemcheckbox"
                        aria-checked={annotationEditing}
                        onClick={() => runAction(onToggleAnnotations)}
                        disabled={!canEditAnnotations || !annotationsReady}
                        className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-bold transition focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:cursor-wait disabled:opacity-45 ${
                            annotationEditing ? 'bg-brand-50 text-brand-800' : 'text-slate-700 hover:bg-brand-50'
                        }`}
                    >
                        <PenLine size={17} className="text-brand-700" aria-hidden="true" />
                        {t('mapStudioAnnotate')}
                    </button>
                    <button
                        type="button"
                        role="menuitemcheckbox"
                        aria-checked={resourceRemovalMode}
                        onClick={() => runAction(onToggleResourceRemoval)}
                        className={`mt-1 flex min-h-11 w-full items-center gap-3 border-t border-slate-100 px-3 py-2 text-left text-sm font-bold transition focus:outline-none focus:ring-4 focus:ring-red-100 ${
                            resourceRemovalMode
                                ? 'rounded-xl bg-red-50 text-red-700'
                                : 'rounded-b-xl text-red-700 hover:bg-red-50'
                        }`}
                        data-owner-resource-removal-mode="true"
                    >
                        <Trash2 size={17} className="text-red-600" aria-hidden="true" />
                        {t('removeResources')}
                    </button>
                </div>
            ) : null}
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
    onArrangeCategories,
    categoryCount = 0,
    onAddPersonalPlace,
    personalPlacePickerActive = false,
    onToggleShortDescription,
    shortDescriptionMode = false,
    onToggleAnnotations,
    annotationEditing = false,
    canEditAnnotations = false,
    annotationsReady = false,
    onToggleResourceRemoval,
    resourceRemovalMode = false,
    onEditLayout,
    editLayoutDisabled = false,
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
                        <div className="flex min-w-0 items-center gap-2">
                            <h1 className="truncate text-[1.8rem] font-extrabold tracking-tight text-slate-900 sm:text-[2rem]">
                                {directory.name}
                            </h1>
                            <button
                                type="button"
                                onClick={onEditDetails}
                                className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-brand-800 focus:outline-none focus:ring-4 focus:ring-brand-100"
                                aria-label={t('editMapDetails')}
                                title={t('editMapDetails')}
                                data-owner-map-title-edit="true"
                            >
                                <Pencil size={18} aria-hidden="true" />
                            </button>
                        </div>
                        {directory.description ? (
                            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                                {directory.description}
                            </p>
                        ) : null}
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2" data-owner-map-toolbar="true">
                        <button type="button" onClick={onAddAssets} className={`btn-primary min-w-[172px] ${compactActionClassName}`}>
                            <Plus size={16} />
                            {t('manageResources')}
                        </button>
                        <button type="button" onClick={onAddPersonalPlace} className={`btn-ghost ${compactActionClassName} border border-slate-200 text-slate-700`} aria-pressed={personalPlacePickerActive}>
                            <Plus size={16} />
                            {personalPlacePickerActive ? t('cancelAddPersonalPlace') : t('personalPlace')}
                        </button>
                        <OwnerEditContentMenu
                            onArrangeCategories={onArrangeCategories}
                            categoryCount={categoryCount}
                            onToggleShortDescription={onToggleShortDescription}
                            shortDescriptionMode={shortDescriptionMode}
                            onToggleAnnotations={onToggleAnnotations}
                            annotationEditing={annotationEditing}
                            canEditAnnotations={canEditAnnotations}
                            annotationsReady={annotationsReady}
                            onToggleResourceRemoval={onToggleResourceRemoval}
                            resourceRemovalMode={resourceRemovalMode}
                        />
                        <button type="button" onClick={onEditLayout} disabled={editLayoutDisabled} className={`btn-ghost ${compactActionClassName} border border-slate-200 text-slate-700 disabled:cursor-wait disabled:opacity-45`} aria-haspopup="dialog" aria-controls={`map-studio-design-settings-${directory.id}`}>
                            <SlidersHorizontal size={16} aria-hidden="true" />
                            {t('editLayout')}
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
                {personalPlacePickerActive ? (
                    <p className="text-sm font-semibold text-brand-700">{t('personalPlaceMapHint')}</p>
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
    onArrangeCategories,
    categoryCount = 0,
    onAddPersonalPlace,
    personalPlacePickerActive = false,
    onToggleShortDescription,
    shortDescriptionMode = false,
    onToggleAnnotations,
    annotationEditing = false,
    canEditAnnotations = false,
    annotationsReady = false,
    onToggleResourceRemoval,
    resourceRemovalMode = false,
    onEditLayout,
    editLayoutDisabled = false,
    onEditDetails,
    onOpenPrintView,
    onOpenShare,
    renderPdfExportButton,
    compactOverlay = false,
}) {
    const { t } = useLocale();
    const [open, setOpen] = useState(false);
    const headerClassName = compactOverlay
        ? 'sticky top-[56px] z-[1100] flex h-11 items-center border-b border-slate-200 bg-slate-50/95 px-4 shadow-[0_12px_24px_-24px_rgba(15,23,42,0.45)] backdrop-blur sm:top-[64px] sm:h-12 sm:px-6 xl:hidden disable-font-scaling'
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

                    <div className="flex min-w-0 flex-1 items-center gap-1">
                        <p className={`${compactOverlay ? 'text-[15px] sm:text-base' : 'text-base sm:text-[17px]'} min-w-0 flex-1 truncate font-bold text-slate-900`}>{directory.name}</p>
                        <button
                            type="button"
                            onClick={onEditDetails}
                            className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-slate-600 transition hover:bg-white focus:outline-none focus:ring-4 focus:ring-brand-100"
                            aria-label={t('editMapDetails')}
                            title={t('editMapDetails')}
                            data-owner-map-title-edit="true"
                        >
                            <Pencil size={17} aria-hidden="true" />
                        </button>
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
                            <div className="flex min-w-0 flex-1 items-center gap-1">
                                <h2 className="min-w-0 flex-1 truncate text-[17px] font-bold text-slate-900">{directory.name}</h2>
                                <button
                                    type="button"
                                    onClick={() => runDrawerAction(onEditDetails)}
                                    className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-brand-100"
                                    aria-label={t('editMapDetails')}
                                    title={t('editMapDetails')}
                                >
                                    <Pencil size={17} aria-hidden="true" />
                                </button>
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
                                <button type="button" onClick={() => runDrawerAction(onAddPersonalPlace)} className="btn-ghost h-12 w-full justify-center border border-slate-200 px-4 text-sm text-slate-700">
                                    <Plus size={16} />
                                    {personalPlacePickerActive ? t('cancelAddPersonalPlace') : t('personalPlace')}
                                </button>
                                <OwnerEditContentMenu
                                    onArrangeCategories={() => runDrawerAction(onArrangeCategories)}
                                    categoryCount={categoryCount}
                                    onToggleShortDescription={() => runDrawerAction(onToggleShortDescription)}
                                    shortDescriptionMode={shortDescriptionMode}
                                    onToggleAnnotations={() => runDrawerAction(onToggleAnnotations)}
                                    annotationEditing={annotationEditing}
                                    canEditAnnotations={canEditAnnotations}
                                    annotationsReady={annotationsReady}
                                    onToggleResourceRemoval={() => runDrawerAction(onToggleResourceRemoval)}
                                    resourceRemovalMode={resourceRemovalMode}
                                    inFlow
                                />
                                <button type="button" onClick={() => runDrawerAction(onEditLayout)} disabled={editLayoutDisabled} className="btn-ghost h-12 w-full justify-center border border-slate-200 px-4 text-sm text-slate-700 disabled:cursor-wait disabled:opacity-45" aria-haspopup="dialog" aria-controls={`map-studio-design-settings-${directory.id}`}>
                                    <SlidersHorizontal size={16} aria-hidden="true" />
                                    {t('editLayout')}
                                </button>
                                <button type="button" onClick={() => runDrawerAction(onOpenPrintView)} className="btn-ghost h-12 w-full justify-center border border-slate-200 px-4 text-sm text-slate-700">
                                    <Printer size={16} />
                                    {t('print')}
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

function EmptyOwnerDirectory({ onAddAssets, onAddPersonalPlace }) {
    const { t } = useLocale();
    return (
        <div className="rounded-[32px] border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center">
            <h2 className="text-2xl font-bold text-slate-900">{t('mapNoResourcesTitle')}</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-500">
                {t('mapNoResourcesDescription')}
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <button type="button" onClick={onAddAssets} className="btn-primary inline-flex justify-center">
                    <Plus size={16} />
                    {t('addFromMyDirectory')}
                </button>
                <button type="button" onClick={onAddPersonalPlace} className="btn-ghost inline-flex justify-center border border-slate-200 text-slate-700">
                    <MapPin size={16} />
                    {t('addPersonalPlace')}
                </button>
            </div>
        </div>
    );
}

function formatPersonalPlaceCoordinate(value) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed.toFixed(7) : '';
}

function extractPostalCodeFromText(value) {
    const match = String(value || '').match(/\b(\d{6})\b/);
    return match?.[1] || '';
}

function PersonalPlaceModal({
    open,
    draft,
    submitting = false,
    error = '',
    onClose,
    onSubmit,
}) {
    const { t } = useLocale();
    const [form, setForm] = useState({
        name: '',
        categoryLabel: '',
        address: '',
        postalCode: '',
        lat: '',
        lng: '',
        shortDescription: '',
    });
    const [lookupQuery, setLookupQuery] = useState('');
    const [lookupBusy, setLookupBusy] = useState(false);
    const [lookupError, setLookupError] = useState('');

    useEffect(() => {
        if (!open) return;
        setForm({
            name: draft?.name || '',
            categoryLabel: draft?.categoryLabel || '',
            address: draft?.address || '',
            postalCode: draft?.postalCode || '',
            lat: formatPersonalPlaceCoordinate(draft?.lat),
            lng: formatPersonalPlaceCoordinate(draft?.lng),
            shortDescription: draft?.shortDescription || draft?.note || '',
        });
        setLookupQuery(draft?.postalCode || draft?.address || '');
        setLookupError('');
    }, [draft, open]);

    if (!open) return null;

    const isEditing = Boolean(draft?.id);
    const parsedLat = Number.parseFloat(form.lat);
    const parsedLng = Number.parseFloat(form.lng);
    const canSubmit = Boolean(form.name.trim())
        && Number.isFinite(parsedLat)
        && Number.isFinite(parsedLng)
        && !submitting;

    function updateField(field, value) {
        setForm((current) => ({ ...current, [field]: value }));
    }

    async function handleLookup() {
        const query = String(lookupQuery || form.postalCode || form.address || '').trim();
        if (!query) return;
        setLookupBusy(true);
        setLookupError('');
        try {
            const result = await searchOneMap(query);
            if (!result) {
                setLookupError(t('personalPlaceLookupFailed'));
                return;
            }
            const nextAddress = result.address || form.address;
            const nextPostalCode = result.postalCode || extractPostalCodeFromText(nextAddress) || form.postalCode;
            setForm((current) => ({
                ...current,
                address: nextAddress,
                postalCode: nextPostalCode,
                lat: formatPersonalPlaceCoordinate(result.lat),
                lng: formatPersonalPlaceCoordinate(result.lng),
                name: current.name || result.name || '',
            }));
        } catch (err) {
            console.error(err);
            setLookupError(t('personalPlaceLookupFailed'));
        } finally {
            setLookupBusy(false);
        }
    }

    function handleSubmit(event) {
        event.preventDefault();
        if (!canSubmit) return;
        onSubmit?.({
            id: draft?.id || null,
            name: form.name.trim(),
            categoryLabel: form.categoryLabel.trim(),
            address: form.address.trim(),
            postalCode: form.postalCode.trim(),
            lat: parsedLat,
            lng: parsedLng,
            shortDescription: form.shortDescription.trim(),
        });
    }

    return (
        <div
            className="fixed inset-0 z-[1400] flex items-end bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-6"
            role="presentation"
            onClick={() => {
                if (!submitting) onClose?.();
            }}
        >
            <section
                className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:max-w-2xl sm:rounded-[28px]"
                role="dialog"
                aria-modal="true"
                aria-label={isEditing ? t('editPersonalPlace') : t('addPersonalPlace')}
                onClick={(event) => event.stopPropagation()}
            >
                <header className="flex flex-shrink-0 items-center gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
                    <span className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                        <MapPin size={19} strokeWidth={2.2} />
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="text-base font-black leading-tight text-slate-900">
                            {isEditing ? t('editPersonalPlace') : t('addPersonalPlace')}
                        </p>
                        <p className="mt-0.5 text-xs font-semibold leading-5 text-slate-500">{t('personalPlacePrivateHelp')}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:cursor-wait disabled:opacity-60"
                        aria-label={t('close')}
                    >
                        <X size={19} />
                    </button>
                </header>

                <form onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                    <div className="space-y-4">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <label htmlFor="personal-place-lookup" className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                                {t('personalPlaceLookupLabel')}
                            </label>
                            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                                <input
                                    id="personal-place-lookup"
                                    type="text"
                                    value={lookupQuery}
                                    onChange={(event) => setLookupQuery(event.target.value)}
                                    placeholder={t('personalPlaceLookupPlaceholder')}
                                    className="input-field min-h-11 flex-1"
                                />
                                <button
                                    type="button"
                                    onClick={handleLookup}
                                    disabled={lookupBusy}
                                    className="btn-ghost min-h-11 justify-center border border-slate-200 px-4 text-sm text-slate-700 disabled:cursor-wait disabled:opacity-60"
                                >
                                    <Search size={16} />
                                    {lookupBusy ? t('loadingPage') : t('findLocation')}
                                </button>
                            </div>
                            {lookupError ? <p className="mt-2 text-xs font-semibold text-red-600">{lookupError}</p> : null}
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className="space-y-1.5 sm:col-span-2">
                                <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{t('personalPlaceName')}</span>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={(event) => updateField('name', event.target.value)}
                                    maxLength={160}
                                    required
                                    className="input-field min-h-11"
                                    placeholder={t('personalPlaceNamePlaceholder')}
                                />
                            </label>
                            <label className="space-y-1.5">
                                <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{t('personalPlaceCategory')}</span>
                                <input
                                    type="text"
                                    value={form.categoryLabel}
                                    onChange={(event) => updateField('categoryLabel', event.target.value)}
                                    maxLength={120}
                                    className="input-field min-h-11"
                                    placeholder={t('personalPlaceCategoryPlaceholder')}
                                />
                            </label>
                            <label className="space-y-1.5">
                                <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{t('personalPlacePostalCode')}</span>
                                <input
                                    type="text"
                                    value={form.postalCode}
                                    onChange={(event) => updateField('postalCode', event.target.value)}
                                    maxLength={20}
                                    inputMode="numeric"
                                    className="input-field min-h-11"
                                    placeholder="680153"
                                />
                            </label>
                            <label className="space-y-1.5 sm:col-span-2">
                                <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{t('personalPlaceAddress')}</span>
                                <input
                                    type="text"
                                    value={form.address}
                                    onChange={(event) => updateField('address', event.target.value)}
                                    maxLength={500}
                                    className="input-field min-h-11"
                                    placeholder={t('personalPlaceAddressPlaceholder')}
                                />
                            </label>
                            <label className="space-y-1.5">
                                <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{t('latitude')}</span>
                                <input
                                    type="number"
                                    step="0.0000001"
                                    value={form.lat}
                                    onChange={(event) => updateField('lat', event.target.value)}
                                    required
                                    className="input-field min-h-11"
                                />
                            </label>
                            <label className="space-y-1.5">
                                <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{t('longitude')}</span>
                                <input
                                    type="number"
                                    step="0.0000001"
                                    value={form.lng}
                                    onChange={(event) => updateField('lng', event.target.value)}
                                    required
                                    className="input-field min-h-11"
                                />
                            </label>
                            <label className="space-y-1.5 sm:col-span-2">
                                <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{t('personalPlaceShortDescription')}</span>
                                <textarea
                                    value={form.shortDescription}
                                    onChange={(event) => updateField('shortDescription', event.target.value)}
                                    maxLength={240}
                                    rows={2}
                                    className="input-field min-h-[76px] resize-y"
                                    placeholder={t('personalPlaceShortDescriptionPlaceholder')}
                                />
                            </label>
                        </div>

                        {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}

                        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={submitting}
                                className="btn-ghost min-h-11 justify-center border border-slate-200 px-4 text-sm text-slate-700 disabled:cursor-wait disabled:opacity-60"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                type="submit"
                                disabled={!canSubmit}
                                className="btn-primary min-h-11 justify-center px-4 text-sm disabled:cursor-wait disabled:opacity-60"
                            >
                                {submitting ? t('saving') : t('save')}
                            </button>
                        </div>
                    </div>
                </form>
            </section>
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

function applyResourceShortDescriptorToDirectory(directory, resourceType, resourceId, descriptorPatch) {
    if (!directory) return directory;
    const matchesResource = (item) => item?.resourceType === resourceType
        && Number(item?.resourceId) === Number(resourceId);
    const {
        shortDescriptor,
        shortDescriptorTextColor,
        shortDescriptorHighlightColor,
        shortDescriptors = [],
    } = descriptorPatch;

    return {
        ...directory,
        assets: (directory.assets || []).map((asset) => (
            matchesResource(asset) ? {
                ...asset,
                shortDescriptor,
                shortDescriptorTextColor,
                shortDescriptorHighlightColor,
                shortDescriptors,
            } : asset
        )),
        personalPlaces: (directory.personalPlaces || []).map((place) => (
            matchesResource(place) ? {
                ...place,
                shortDescription: shortDescriptor,
                shortDescriptor,
                shortDescriptorTextColor,
                shortDescriptorHighlightColor,
                shortDescriptors,
            } : place
        )),
        places: (directory.places || []).map((place) => ({
            ...place,
            rows: (place.rows || []).map((row) => (
                matchesResource(row) ? {
                    ...row,
                    mapShortDescriptor: shortDescriptor,
                    mapShortDescriptorTextColor: shortDescriptorTextColor,
                    mapShortDescriptorHighlightColor: shortDescriptorHighlightColor,
                    mapShortDescriptors: shortDescriptors,
                } : row
            )),
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

function createTownMapManifestState(status = 'idle') {
    return {
        status,
        sourceType: 'none',
        index: null,
        manifest: null,
        activeSurfaceId: '',
        activeAssetBaseUrl: '',
        activeManifestStatus: status,
        manifestsById: {},
    };
}

function isTownMapManifestStateError(state) {
    return state?.status === 'error' || state?.activeManifestStatus === 'error';
}

function isTownMapManifestStateLoading(state) {
    return state?.status === 'loading' || state?.activeManifestStatus === 'loading';
}

function isTownMapPointCoveredByState(point, state) {
    if (!point || !state) return false;
    if (state.index?.surfaces?.length) {
        return state.index.surfaces.some((surface) => (
            isPointWithinWsenBounds(point, surface.bounds?.surface || surface.bounds?.nominal)
        ));
    }
    return isPointWithinWsenBounds(point, state.manifest?.bounds?.nominal);
}

function buildTownMapSelectionKey({ style, surfaceId, viewportBounds, points }) {
    const viewportKey = Array.isArray(viewportBounds)
        ? viewportBounds.map((value) => Number(value).toFixed(6)).join(',')
        : '';
    const pointsKey = Array.isArray(points)
        ? points
            .map((point) => `${point.id || ''}:${Number(point.lat).toFixed(6)},${Number(point.lng).toFixed(6)}`)
            .join('|')
        : '';
    return `${style || ''}:${surfaceId || ''}:${viewportKey}:${pointsKey}`;
}

function useTownMapOverviewManifestStates({
    enabled,
    viewportBounds,
    coveragePoints,
    focusSurfaceId,
    reloadVersion = 0,
}) {
    const [states, setStates] = useState({
        [CAREAROUND_MAP_STYLE_DEFAULT]: createTownMapManifestState(),
        [CAREAROUND_MAP_STYLE_GRAY]: createTownMapManifestState(),
    });
    const selectionKeyRef = useRef({});

    useEffect(() => {
        if (!enabled) return undefined;

        selectionKeyRef.current = {};
        const controller = new AbortController();
        const assetBaseUrls = {
            [CAREAROUND_MAP_STYLE_DEFAULT]: TOWN_MAP_OVERVIEW_ASSET_BASE_URL,
            [CAREAROUND_MAP_STYLE_GRAY]: TOWN_MAP_GRAY_OVERVIEW_ASSET_BASE_URL,
        };
        setStates(Object.fromEntries(
            Object.entries(assetBaseUrls).map(([style, assetBaseUrl]) => [
                style,
                createTownMapManifestState(assetBaseUrl ? 'loading' : 'error'),
            ]),
        ));

        Object.entries(assetBaseUrls).forEach(([style, assetBaseUrl]) => {
            if (!assetBaseUrl) return;
            fetchFixedTownSurfaceSource(assetBaseUrl, { signal: controller.signal })
                .then((source) => {
                    setStates((current) => ({
                        ...current,
                        [style]: source.type === 'index'
                            ? {
                                ...createTownMapManifestState('ready'),
                                sourceType: 'index',
                                index: source.index,
                                activeManifestStatus: 'idle',
                            }
                            : {
                                ...createTownMapManifestState('ready'),
                                sourceType: 'manifest',
                                manifest: source.manifest,
                                activeSurfaceId: source.manifest.map?.id || '',
                                activeAssetBaseUrl: assetBaseUrl,
                                activeManifestStatus: 'ready',
                            },
                    }));
                })
                .catch((error) => {
                    if (error?.name === 'AbortError') return;
                    setStates((current) => ({
                        ...current,
                        [style]: createTownMapManifestState('error'),
                    }));
                });
        });

        return () => controller.abort();
    }, [enabled, reloadVersion]);

    useEffect(() => {
        if (!enabled) return undefined;

        const assetBaseUrls = {
            [CAREAROUND_MAP_STYLE_DEFAULT]: TOWN_MAP_OVERVIEW_ASSET_BASE_URL,
            [CAREAROUND_MAP_STYLE_GRAY]: TOWN_MAP_GRAY_OVERVIEW_ASSET_BASE_URL,
        };
        Object.entries(states).forEach(([style, state]) => {
            if (state?.status !== 'ready' || state.sourceType !== 'index' || !state.index) return;

            const selectedSurface = focusSurfaceId
                ? state.index.surfaces.find((surface) => surface?.id === focusSurfaceId) || null
                : selectFixedTownSurfaceForViewport(
                    state.index,
                    viewportBounds,
                    coveragePoints,
                );
            const activeSurfaceId = selectedSurface?.id || '';
            const selectionKey = buildTownMapSelectionKey({
                style,
                surfaceId: activeSurfaceId,
                viewportBounds,
                points: coveragePoints,
            });
            if (!activeSurfaceId) {
                if (state.activeSurfaceId || state.manifest || state.activeManifestStatus !== 'idle') {
                    setStates((current) => ({
                        ...current,
                        [style]: {
                            ...current[style],
                            manifest: null,
                            activeSurfaceId: '',
                            activeAssetBaseUrl: '',
                            activeManifestStatus: 'idle',
                        },
                    }));
                }
                selectionKeyRef.current[style] = selectionKey;
                return;
            }
            if (
                selectionKeyRef.current[style] === selectionKey
                && state.activeSurfaceId === activeSurfaceId
                && (
                    state.manifest
                    || ['loading', 'error'].includes(state.activeManifestStatus)
                )
            ) {
                return;
            }
            selectionKeyRef.current[style] = selectionKey;

            const cachedManifest = state.manifestsById?.[activeSurfaceId] || null;
            const activeAssetBaseUrl = resolveFixedTownSurfaceAssetBaseUrl(
                assetBaseUrls[style],
                selectedSurface,
            );
            const manifestPath = resolveFixedTownSurfaceManifestPath(selectedSurface);
            if (!activeAssetBaseUrl || !manifestPath) {
                setStates((current) => ({
                    ...current,
                    [style]: {
                        ...current[style],
                        manifest: null,
                        activeSurfaceId,
                        activeAssetBaseUrl: '',
                        activeManifestStatus: 'error',
                    },
                }));
                return;
            }
            if (cachedManifest) {
                setStates((current) => ({
                    ...current,
                    [style]: {
                        ...current[style],
                        manifest: cachedManifest,
                        activeSurfaceId,
                        activeAssetBaseUrl,
                        activeManifestStatus: 'ready',
                    },
                }));
                return;
            }

            setStates((current) => ({
                ...current,
                [style]: {
                    ...current[style],
                    manifest: null,
                    activeSurfaceId,
                    activeAssetBaseUrl,
                    activeManifestStatus: 'loading',
                },
            }));
            fetchFixedTownSurfaceManifest(assetBaseUrls[style], { manifestPath })
                .then((manifest) => {
                    setStates((current) => {
                        const currentStyleState = current[style]
                            || createTownMapManifestState('ready');
                        if (currentStyleState.activeSurfaceId !== activeSurfaceId) return current;
                        return {
                            ...current,
                            [style]: {
                                ...currentStyleState,
                                manifest,
                                activeSurfaceId,
                                activeAssetBaseUrl,
                                activeManifestStatus: 'ready',
                                manifestsById: {
                                    ...(currentStyleState.manifestsById || {}),
                                    [activeSurfaceId]: manifest,
                                },
                            },
                        };
                    });
                })
                .catch((error) => {
                    if (error?.name === 'AbortError') return;
                    setStates((current) => {
                        const currentStyleState = current[style]
                            || createTownMapManifestState('ready');
                        if (currentStyleState.activeSurfaceId !== activeSurfaceId) return current;
                        return {
                            ...current,
                            [style]: {
                                ...currentStyleState,
                                manifest: null,
                                activeManifestStatus: 'error',
                            },
                        };
                    });
                });
        });
        return undefined;
    }, [coveragePoints, enabled, focusSurfaceId, states, viewportBounds]);

    return states;
}

export default function MyMapDetailPage() {
    const { mapId } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user } = useAuth();
    const { t } = useLocale();
    const { confirm: requestConfirmation, confirmDialog } = useConfirmDialog();
    const { mapStyle } = useMapStyle();
    const {
        savedAssets,
        savedAssetsLoading,
        savedAssetsLoadError,
    } = useSavedAssets();
    const currentMapCacheKey = getMyMapDetailCacheKey(user, mapId);
    const [directory, setDirectory] = useState(() => getCachedMyMapDetail(user, mapId));
    const [loading, setLoading] = useState(() => !getCachedMyMapDetail(user, mapId));
    const directoryCacheKeyRef = useRef(directory ? currentMapCacheKey : '');
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
    const [addLoading, setAddLoading] = useState(false);
    const [addReady, setAddReady] = useState(false);
    const [addSubmitting, setAddSubmitting] = useState(false);
    const [addError, setAddError] = useState('');
    const [categoryOrderOpen, setCategoryOrderOpen] = useState(false);
    const [categoryOrderSubmitting, setCategoryOrderSubmitting] = useState(false);
    const [categoryOrderError, setCategoryOrderError] = useState('');
    const [personalPlacePickerActive, setPersonalPlacePickerActive] = useState(false);
    const [personalPlaceModalOpen, setPersonalPlaceModalOpen] = useState(false);
    const [personalPlaceDraft, setPersonalPlaceDraft] = useState(null);
    const [personalPlaceSubmitting, setPersonalPlaceSubmitting] = useState(false);
    const [personalPlaceError, setPersonalPlaceError] = useState('');
    const [personalPlacesLibrary, setPersonalPlacesLibrary] = useState([]);
    const [personalPlaceCategories, setPersonalPlaceCategories] = useState([]);
    const [personalPlaceChooserOpen, setPersonalPlaceChooserOpen] = useState(false);
    const [personalPlaceChooserSubmitting, setPersonalPlaceChooserSubmitting] = useState(false);
    const [personalPlaceChooserError, setPersonalPlaceChooserError] = useState('');
    const [personalPlaceActionStatus, setPersonalPlaceActionStatus] = useState(null);
    const [personalPlaceCategoryManagerOpen, setPersonalPlaceCategoryManagerOpen] = useState(false);
    const [personalPlaceCategoryBusy, setPersonalPlaceCategoryBusy] = useState(false);
    const [personalPlaceCategoryError, setPersonalPlaceCategoryError] = useState('');
    const [shortDescriptionRow, setShortDescriptionRow] = useState(null);
    const [shortDescriptionSubmitting, setShortDescriptionSubmitting] = useState(false);
    const [shortDescriptionError, setShortDescriptionError] = useState('');
    const [basemapMode, setBasemapMode] = useState(() => (TOWN_MAP_PROOF_ENABLED ? 'auto' : 'live'));
    const mapStudioControllerRef = useRef(null);
    const [mapStudioRuntimeSnapshot, setMapStudioRuntimeSnapshot] = useState(null);
    const mapStudioInteractiveModel = useMemo(() => (
        mapStudioRuntimeSnapshot?.design
            ? buildMapStudioInteractiveModel(mapStudioRuntimeSnapshot.design)
            : null
    ), [mapStudioRuntimeSnapshot?.design]);
    const interactiveMapStyle = mapStudioInteractiveModel?.directoryMap?.mapStyleOverride
        || mapStyle;
    const interactiveBasemapMode = mapStudioInteractiveModel?.directoryMap?.basemapMode
        || basemapMode;
    const mapStudioLayoutSignature = mapStudioRuntimeSnapshot
        ? [
            'studio',
            mapStudioRuntimeSnapshot.activeViewId,
            mapStudioRuntimeSnapshot.design?.camera?.mode,
            mapStudioInteractiveModel?.layout?.mapHeight,
            mapStudioInteractiveModel?.layout?.preset,
            mapStudioInteractiveModel?.layout?.mapSide,
            mapStudioInteractiveModel?.layout?.mapWidth,
            mapStudioInteractiveModel?.layout?.resourceColumnCount,
            mapStudioInteractiveModel?.layout?.sideResourceColumnCount,
        ].join(':')
        : 'legacy';
    const [printMapState, setPrintMapState] = useState(() => (
        createOwnerPrintMapState(mapStyle, OWNER_PRINT_BASEMAP_OPTIONS)
    ));
    const [activePrintStudioView, setActivePrintStudioView] = useState(null);
    const [printStudioLoadError, setPrintStudioLoadError] = useState('');
    const pendingPrintStudioViewRef = useRef(null);
    const [printAnnotationEditorOpen, setPrintAnnotationEditorOpen] = useState(false);
    const [printShortDescriptionMode, setPrintShortDescriptionMode] = useState(false);
    const [interactiveAnnotationEditorOpen, setInteractiveAnnotationEditorOpen] = useState(false);
    const [interactiveShortDescriptionMode, setInteractiveShortDescriptionMode] = useState(false);
    const [resourceRemovalMode, setResourceRemovalMode] = useState(false);
    const [townMapManifestStates, setTownMapManifestStates] = useState({
        [CAREAROUND_MAP_STYLE_DEFAULT]: createTownMapManifestState(),
        [CAREAROUND_MAP_STYLE_GRAY]: createTownMapManifestState(),
    });
    const [townMapManifestReloadVersion, setTownMapManifestReloadVersion] = useState(0);
    const [townMapViewportBounds, setTownMapViewportBounds] = useState(null);
    const [townMapFocusSurfaceId, setTownMapFocusSurfaceId] = useState('');
    const [townMapFallbackReason, setTownMapFallbackReason] = useState('');
    const townMapRootAssetBaseUrl = interactiveMapStyle === CAREAROUND_MAP_STYLE_GRAY
        ? TOWN_MAP_GRAY_ASSET_BASE_URL
        : TOWN_MAP_ASSET_BASE_URL;
    const townMapManifestState = townMapManifestStates[interactiveMapStyle]
        || createTownMapManifestState();
    const townMapAssetBaseUrl = townMapManifestState.activeAssetBaseUrl || townMapRootAssetBaseUrl;
    const mapAssetMutationInFlightRef = useRef(false);
    const mapCardRemovalInFlightRef = useRef(false);
    const personalPlaceMutationInFlightRef = useRef(false);
    const pendingFocusFrameRef = useRef(null);
    const townMapFocusSurfaceClearTimerRef = useRef(null);
    const desktopSelectionSnapRef = useRef(null);
    const townMapSelectionKeyRef = useRef({});
    const useDesktopOwnerLayout = useMediaQuery('(min-width: 1024px)');
    const useDesktopDirectoryBodyLayout = useMediaQuery('(min-width: 1024px)');
    const suspendMapInteraction = shareOpen
        || editOpen
        || addOpen
        || categoryOrderOpen
        || personalPlaceModalOpen
        || personalPlaceChooserOpen
        || personalPlaceCategoryManagerOpen
        || Boolean(shortDescriptionRow);
    const directoryMapInteractionSuspended = suspendMapInteraction && !personalPlacePickerActive;
    const personalPlaceMapSurfaceStatus = personalPlacePickerActive ? (
        <PersonalPlacePlacementPrompt message={t('personalPlaceMapHint')} />
    ) : personalPlaceActionStatus ? (
        <PersonalPlaceActionStatus status={personalPlaceActionStatus} />
    ) : null;
    const isPrintView = searchParams.get('view') === 'print';
    const printStudioViewId = searchParams.get('studioView') || '';
    const previousPrintViewRef = useRef(isPrintView);
    const myMapUiMode = getMyMapUiMode(searchParams);
    const isV2View = myMapUiMode === MY_MAP_UI_MODE_V2 && !isPrintView;
    const canEditPrintAnnotations = useMediaQuery(
        '(hover: hover) and (pointer: fine)',
    );
    const printAnnotations = usePrintAnnotations({
        mapId,
        userId: user?.id,
        enabled: Boolean(mapId && user?.id),
        restoreLocalDraft: true,
        autosave: isPrintView || interactiveAnnotationEditorOpen,
    });
    const printAnnotationsReady = ['saved', 'unsaved', 'saving'].includes(printAnnotations.status);
    const ownerReadOnlyAnnotationOverlay = useMemo(() => {
        if (isPrintView || interactiveAnnotationEditorOpen || !printAnnotations.annotations.length) return null;
        const annotations = mapStudioInteractiveModel
            ? filterPrintMapAnnotations(printAnnotations.annotations, {
                annotationLayer: mapStudioInteractiveModel.annotationLayer.visible
                    ? PRINT_MAP_ANNOTATION_LAYER_SHOW
                    : PRINT_MAP_ANNOTATION_LAYER_HIDE,
                hiddenAnnotationIds: mapStudioInteractiveModel.annotationLayer.hiddenAnnotationIds,
            })
            : printAnnotations.annotations;
        if (!annotations.length) return null;
        return (
            <PrintAnnotationLayer
                annotations={annotations}
                editable={false}
            />
        );
    }, [interactiveAnnotationEditorOpen, isPrintView, mapStudioInteractiveModel, printAnnotations.annotations]);
    const interactiveAnnotationEditor = useInteractiveMapAnnotationEditor({
        enabled: interactiveAnnotationEditorOpen && !isPrintView,
        annotations: printAnnotations.annotations,
        status: printAnnotations.status,
        error: printAnnotations.error,
        replaceAnnotations: printAnnotations.replaceAnnotations,
        saveNow: printAnnotations.saveNow,
        undo: printAnnotations.undo,
        redo: printAnnotations.redo,
        canUndo: printAnnotations.canUndo,
        canRedo: printAnnotations.canRedo,
        onClose: () => setInteractiveAnnotationEditorOpen(false),
    });
    const ownerInteractiveAnnotationOverlay = interactiveAnnotationEditor.mapOverlay
        || ownerReadOnlyAnnotationOverlay;
    const isFullMapPrintLayout = printMapState.layoutPreset === PRINT_MAP_LAYOUT_FULL;
    const anchorState = useDirectoryDistanceAnchor({
        storageKey: mapId ? `my-map:no-default:${mapId}` : 'my-map:no-default',
        userPostalCode: user?.postalCode || '',
        defaultActiveMode: null,
    });

    const handleOwnerMapStudioSessionChange = useCallback((snapshot) => {
        setMapStudioRuntimeSnapshot(snapshot);
    }, []);

    const handleMapStudioMapStyleChange = useCallback((nextStyle) => {
        if (!mapStudioRuntimeSnapshot) return;
        mapStudioControllerRef.current?.patchDesign(
            { basemap: { style: nextStyle } },
            { enterDesign: true },
        );
    }, [mapStudioRuntimeSnapshot]);

    const handleInteractiveMapViewStateChange = useCallback((cameraView) => {
        mapStudioControllerRef.current?.patchExploration({ cameraView });
    }, []);

    useEffect(() => {
        setMapStudioRuntimeSnapshot(null);
        setResourceRemovalMode(false);
    }, [mapId]);

    useEffect(() => {
        if (!mapStudioRuntimeSnapshot) return;
        const cleanFocusedPlaceKey = focusedPlaceKey
            ? String(focusedPlaceKey).replace(/:zoom$/, '')
            : '';
        mapStudioControllerRef.current?.patchExploration({
            query,
            hoveredPlaceKey: hoveredPlaceKey || hoveredClusterPlaceKeys[0] || null,
            focusedPlaceKeys: focusedPlaceKeys.length
                ? focusedPlaceKeys
                : cleanFocusedPlaceKey ? [cleanFocusedPlaceKey] : [],
            selectedPlaceKeys: selectedClusterPlaceKeys.length
                ? selectedClusterPlaceKeys
                : highlightPlaceKey ? [highlightPlaceKey] : [],
        });
    }, [
        focusedPlaceKey,
        focusedPlaceKeys,
        highlightPlaceKey,
        hoveredClusterPlaceKeys,
        hoveredPlaceKey,
        mapStudioRuntimeSnapshot?.activeViewId,
        query,
        selectedClusterPlaceKeys,
    ]);

    const loadMap = useCallback(async () => {
        if (!mapId) return null;
        const cachedDirectory = getCachedMyMapDetail(user, mapId);
        if (cachedDirectory) {
            directoryCacheKeyRef.current = currentMapCacheKey;
            setDirectory(cachedDirectory);
            setLoading(false);
        } else {
            directoryCacheKeyRef.current = '';
            setDirectory(null);
            setLoading(true);
        }
        setError('');
        try {
            const [item, subcategories, libraryPlaces, categories] = await Promise.all([
                fetchMyMapWithResilience(() => api.getMyMap(mapId)),
                api.getSubCategories({ suppressAuthExpired: true }).catch(() => []),
                api.getPersonalPlaces().catch(() => []),
                api.getPersonalPlaceCategories().catch(() => []),
            ]);
            setPersonalPlacesLibrary(Array.isArray(libraryPlaces) ? libraryPlaces : []);
            setPersonalPlaceCategories(Array.isArray(categories) ? categories : []);
            const enrichedDirectory = applySubCategoryMetaToDirectory(item, subcategories);
            const addressBackfilledDirectory = await backfillMissingHardPlaceAddresses(enrichedDirectory);
            const nextDirectory = await backfillGroupFocusPlaceKeys(addressBackfilledDirectory);
            cacheMyMapDetail(user, mapId, nextDirectory);
            directoryCacheKeyRef.current = currentMapCacheKey;
            setDirectory(nextDirectory);
            return nextDirectory;
        } catch (err) {
            console.error(err);
            if (!cachedDirectory) {
                setError(err.message || t('failedLoadMap'));
            }
            return null;
        } finally {
            setLoading(false);
        }
    }, [currentMapCacheKey, mapId, t, user]);

    useEffect(() => {
        loadMap();
    }, [loadMap]);

    useEffect(() => {
        if (personalPlaceActionStatus?.phase !== 'success') return undefined;
        const completedStatus = personalPlaceActionStatus;
        const timeoutId = window.setTimeout(() => {
            setPersonalPlaceActionStatus((current) => (
                current === completedStatus ? null : current
            ));
        }, 2400);
        return () => window.clearTimeout(timeoutId);
    }, [personalPlaceActionStatus]);

    useEffect(() => {
        if (directoryCacheKeyRef.current !== currentMapCacheKey) return;
        cacheMyMapDetail(user, mapId, directory);
    }, [currentMapCacheKey, directory, mapId, user]);

    useEffect(() => {
        setBasemapMode(TOWN_MAP_PROOF_ENABLED ? 'auto' : 'live');
        setTownMapFocusSurfaceId('');
        setTownMapFallbackReason('');
    }, [mapId]);

    useEffect(() => {
        const wasPrintView = previousPrintViewRef.current;
        previousPrintViewRef.current = isPrintView;
        if (isPrintView && !wasPrintView && !printStudioViewId) {
            setPrintMapState(createOwnerPrintMapState(mapStyle, OWNER_PRINT_BASEMAP_OPTIONS));
            setActivePrintStudioView(null);
            pendingPrintStudioViewRef.current = null;
            setPrintAnnotationEditorOpen(false);
            setPrintShortDescriptionMode(false);
        }
    }, [isPrintView, mapStyle, printStudioViewId]);

    useEffect(() => {
        if (!isPrintView) return undefined;
        if (!printStudioViewId) {
            if (activePrintStudioView) {
                setActivePrintStudioView(null);
                pendingPrintStudioViewRef.current = null;
                setPrintMapState(createOwnerPrintMapState(mapStyle, OWNER_PRINT_BASEMAP_OPTIONS));
            }
            setPrintStudioLoadError('');
            return undefined;
        }
        if (
            activePrintStudioView?.id === printStudioViewId
            || pendingPrintStudioViewRef.current?.id === printStudioViewId
        ) {
            return undefined;
        }

        let cancelled = false;
        setPrintStudioLoadError('');
        api.getMyMapStudio(mapId)
            .then((response) => {
                if (cancelled) return;
                const document = response?.document;
                const selectedView = document?.views?.find((view) => view.id === printStudioViewId);
                if (!selectedView) throw new Error('The selected Map Studio view is no longer available.');
                const snapshot = {
                    id: selectedView.id,
                    name: selectedView.name,
                    design: selectedView.design,
                    designDirty: false,
                };
                pendingPrintStudioViewRef.current = snapshot;
                setActivePrintStudioView(snapshot);
                setPrintMapState(buildMapStudioPrintState(
                    snapshot.design,
                    createMapStudioExportSettings(),
                ));
                setPrintAnnotationEditorOpen(false);
            })
            .catch((error) => {
                if (cancelled) return;
                console.error('Failed to load the selected Map Studio export view:', error);
                pendingPrintStudioViewRef.current = null;
                setActivePrintStudioView(null);
                setPrintStudioLoadError(t('mapStudioExportLoadFailed'));
                setPrintMapState(createOwnerPrintMapState(mapStyle, OWNER_PRINT_BASEMAP_OPTIONS));
            });

        return () => {
            cancelled = true;
        };
    }, [activePrintStudioView, isPrintView, mapId, mapStyle, printStudioViewId, t]);

    useEffect(() => {
        if (isPrintView && canEditPrintAnnotations) return;
        setPrintAnnotationEditorOpen(false);
    }, [canEditPrintAnnotations, isPrintView]);

    useEffect(() => {
        if (isFullMapPrintLayout) return;
        setPrintAnnotationEditorOpen(false);
    }, [isFullMapPrintLayout]);

    useEffect(() => {
        if (!TOWN_MAP_PROOF_ENABLED) {
            return undefined;
        }

        townMapSelectionKeyRef.current = {};
        const controller = new AbortController();
        const assetBaseUrls = {
            [CAREAROUND_MAP_STYLE_DEFAULT]: TOWN_MAP_ASSET_BASE_URL,
            [CAREAROUND_MAP_STYLE_GRAY]: TOWN_MAP_GRAY_ASSET_BASE_URL,
        };

        setTownMapManifestStates(Object.fromEntries(
            Object.entries(assetBaseUrls).map(([style, assetBaseUrl]) => [
                style,
                createTownMapManifestState(assetBaseUrl ? 'loading' : 'error'),
            ]),
        ));

        Object.entries(assetBaseUrls).forEach(([style, assetBaseUrl]) => {
            if (!assetBaseUrl) return;
            fetchFixedTownSurfaceSource(assetBaseUrl, { signal: controller.signal })
                .then((source) => {
                    setTownMapManifestStates((current) => ({
                        ...current,
                        [style]: source.type === 'index'
                            ? {
                                ...createTownMapManifestState('ready'),
                                sourceType: 'index',
                                index: source.index,
                                activeManifestStatus: 'idle',
                            }
                            : {
                                ...createTownMapManifestState('ready'),
                                sourceType: 'manifest',
                                manifest: source.manifest,
                                activeSurfaceId: source.manifest.map?.id || '',
                                activeAssetBaseUrl: assetBaseUrl,
                                activeManifestStatus: 'ready',
                            },
                    }));
                })
                .catch((error) => {
                    if (error?.name === 'AbortError') return;
                    setTownMapManifestStates((current) => ({
                        ...current,
                        [style]: createTownMapManifestState('error'),
                    }));
                });
        });

        return () => controller.abort();
    }, [townMapManifestReloadVersion]);

    const existingAssetKeys = useMemo(
        () => new Set((directory?.assets || []).map((asset) => asset.assetKey || `${asset.resourceType}-${asset.resourceId}`)),
        [directory?.assets]
    );
    const existingAssetKeyList = useMemo(
        () => [...existingAssetKeys].sort(),
        [existingAssetKeys],
    );
    const activeAnchor = anchorState.activeAnchor;
    const townMapCoveragePresentation = useMemo(() => (
        buildDirectoryPresentation(directory, { activeAnchor, presentationMode: 'v2-cards' })
    ), [activeAnchor, directory]);
    const mapStudioResourceLayerCatalog = useMemo(() => (
        buildMapStudioResourceLayerCatalog(townMapCoveragePresentation)
    ), [townMapCoveragePresentation]);
    const mapStudioFilteredDirectory = useMemo(() => (
        mapStudioInteractiveModel
            ? filterMapStudioDirectoryByLayers(
                directory,
                mapStudioResourceLayerCatalog,
                mapStudioInteractiveModel.resourceLayer.hiddenResourceLayerKeys,
            )
            : directory
    ), [directory, mapStudioInteractiveModel, mapStudioResourceLayerCatalog]);
    const interactivePresentation = useMemo(() => (
        buildDirectoryPresentation(mapStudioFilteredDirectory, { query, activeAnchor })
    ), [activeAnchor, mapStudioFilteredDirectory, query]);
    const v2Presentation = useMemo(() => (
        buildDirectoryPresentation(mapStudioFilteredDirectory, { query, activeAnchor, presentationMode: 'v2-cards' })
    ), [activeAnchor, mapStudioFilteredDirectory, query]);
    const categoryOrderOptions = useMemo(() => (
        collectMyMapCategoryOptions(townMapCoveragePresentation)
    ), [townMapCoveragePresentation]);
    const ownerPresentation = isV2View ? v2Presentation : interactivePresentation;
    const pdfPresentation = useMemo(() => (
        buildDirectoryPresentation(directory)
    ), [directory]);
    const sharedDirectoryUrl = useMemo(() => (
        buildDirectoryShareUrl(directory?.share?.sharePath)
    ), [directory?.share?.sharePath]);
    const ownerInteractiveDirectoryUrl = useMemo(() => {
        if (!mapId || typeof window === 'undefined') return '';
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('view');
        const queryString = nextParams.toString();
        return `${window.location.origin}/my-directory/maps/${encodeURIComponent(mapId)}${queryString ? `?${queryString}` : ''}`;
    }, [mapId, searchParams]);
    const printQrDirectoryUrl = sharedDirectoryUrl || ownerInteractiveDirectoryUrl;
    const renderPdfExportButton = useCallback((className = '') => (
        <MyMapPdfExportButton
            directory={directory}
            presentation={pdfPresentation}
            className={className}
        />
    ), [directory, pdfPresentation]);

    const townMapCoveragePoints = useMemo(() => {
        const pinPoints = (townMapCoveragePresentation.pins || []).map((pin) => ({
            id: pin.placeKey,
            lat: pin.lat,
            lng: pin.lng,
        }));
        const anchorPoint = activeAnchor
            ? [{ id: 'active-anchor', lat: activeAnchor.lat, lng: activeAnchor.lng }]
            : [];
        return [...pinPoints, ...anchorPoint];
    }, [activeAnchor, townMapCoveragePresentation.pins]);
    const townMapOverviewManifestStates = useTownMapOverviewManifestStates({
        enabled: TOWN_MAP_OVERVIEW_ENABLED,
        viewportBounds: townMapViewportBounds,
        coveragePoints: townMapCoveragePoints,
        focusSurfaceId: townMapFocusSurfaceId,
        reloadVersion: townMapManifestReloadVersion,
    });
    const townMapOverviewRootAssetBaseUrl = interactiveMapStyle === CAREAROUND_MAP_STYLE_GRAY
        ? TOWN_MAP_GRAY_OVERVIEW_ASSET_BASE_URL
        : TOWN_MAP_OVERVIEW_ASSET_BASE_URL;
    const townMapOverviewManifestState = townMapOverviewManifestStates[interactiveMapStyle]
        || createTownMapManifestState();
    const townMapOverviewAssetBaseUrl = townMapOverviewManifestState.activeAssetBaseUrl
        || townMapOverviewRootAssetBaseUrl;
    const townMapOverviewViewportSurface = useMemo(() => {
        if (
            !TOWN_MAP_OVERVIEW_ENABLED
            || townMapOverviewManifestState.status !== 'ready'
            || townMapOverviewManifestState.sourceType !== 'index'
            || !townMapOverviewManifestState.index
        ) {
            return null;
        }
        return selectFixedTownSurfaceForViewport(
            townMapOverviewManifestState.index,
            townMapViewportBounds,
            townMapCoveragePoints,
        );
    }, [
        townMapCoveragePoints,
        townMapOverviewManifestState.index,
        townMapOverviewManifestState.sourceType,
        townMapOverviewManifestState.status,
        townMapViewportBounds,
    ]);
    const townMapOverviewViewportSurfaceId = townMapOverviewViewportSurface?.id || '';
    const townMapOverviewSurfaceResolving = Boolean(
        TOWN_MAP_OVERVIEW_ENABLED
        && townMapOverviewManifestState.status === 'ready'
        && townMapOverviewManifestState.sourceType === 'index'
        && townMapOverviewViewportSurfaceId
        && townMapOverviewViewportSurfaceId !== townMapOverviewManifestState.activeSurfaceId
    );
    const townMapOverviewFocusSurfaceMismatch = Boolean(
        TOWN_MAP_OVERVIEW_ENABLED
        && townMapOverviewManifestState.status === 'ready'
        && townMapOverviewManifestState.sourceType === 'index'
        && townMapFocusSurfaceId
        && townMapFocusSurfaceId !== townMapOverviewManifestState.activeSurfaceId
    );
    const townMapOverviewFocusSurfacePending = Boolean(
        TOWN_MAP_OVERVIEW_ENABLED
        && townMapOverviewManifestState.status === 'ready'
        && townMapOverviewManifestState.sourceType === 'index'
        && townMapFocusSurfaceId
    );
    const townMapOverviewAvailable = Boolean(
        TOWN_MAP_OVERVIEW_ENABLED
        && townMapOverviewAssetBaseUrl
        && townMapOverviewManifestState.status === 'ready'
        && townMapOverviewManifestState.manifest
        && townMapOverviewManifestState.activeManifestStatus === 'ready'
        && !townMapOverviewSurfaceResolving
        && !townMapOverviewFocusSurfaceMismatch
        && townMapCoveragePoints.length
    );
    const townMapOverviewSurfacePending = Boolean(
        TOWN_MAP_OVERVIEW_ENABLED
        && (
            townMapOverviewManifestState.status === 'loading'
            || (
                townMapOverviewManifestState.status === 'ready'
                && townMapOverviewManifestState.sourceType === 'index'
                && (
                    townMapOverviewManifestState.activeManifestStatus === 'loading'
                    || townMapOverviewSurfaceResolving
                    || townMapOverviewFocusSurfacePending
                )
            )
        )
    );
    const townMapViewportSurface = useMemo(() => {
        if (
            !TOWN_MAP_PROOF_ENABLED
            || townMapManifestState.status !== 'ready'
            || townMapManifestState.sourceType !== 'index'
            || !townMapManifestState.index
        ) {
            return null;
        }
        return selectFixedTownSurfaceForViewport(
            townMapManifestState.index,
            townMapViewportBounds,
            townMapCoveragePoints,
        );
    }, [
        townMapCoveragePoints,
        townMapManifestState.index,
        townMapManifestState.sourceType,
        townMapManifestState.status,
        townMapViewportBounds,
    ]);
    const townMapViewportSurfaceId = townMapViewportSurface?.id || '';

    useEffect(() => {
        if (!TOWN_MAP_PROOF_ENABLED) return undefined;

        const assetBaseUrls = {
            [CAREAROUND_MAP_STYLE_DEFAULT]: TOWN_MAP_ASSET_BASE_URL,
            [CAREAROUND_MAP_STYLE_GRAY]: TOWN_MAP_GRAY_ASSET_BASE_URL,
        };

        Object.entries(townMapManifestStates).forEach(([style, state]) => {
            if (state?.status !== 'ready' || state.sourceType !== 'index' || !state.index) return;

            const selectedSurface = townMapFocusSurfaceId
                ? state.index.surfaces.find((surface) => surface?.id === townMapFocusSurfaceId) || null
                : selectFixedTownSurfaceForViewport(
                    state.index,
                    townMapViewportBounds,
                    townMapCoveragePoints,
                );
            const activeSurfaceId = selectedSurface?.id || '';
            const selectionKey = buildTownMapSelectionKey({
                style,
                surfaceId: activeSurfaceId,
                viewportBounds: townMapViewportBounds,
                points: townMapCoveragePoints,
            });
            if (!activeSurfaceId) {
                if (state.activeSurfaceId || state.manifest || state.activeManifestStatus !== 'idle') {
                    setTownMapManifestStates((current) => ({
                        ...current,
                        [style]: {
                            ...current[style],
                            manifest: null,
                            activeSurfaceId: '',
                            activeAssetBaseUrl: '',
                            activeManifestStatus: 'idle',
                        },
                    }));
                }
                townMapSelectionKeyRef.current[style] = selectionKey;
                return;
            }
            if (
                townMapSelectionKeyRef.current[style] === selectionKey
                && state.activeSurfaceId === activeSurfaceId
                && state.manifest
            ) {
                return;
            }
            if (
                townMapSelectionKeyRef.current[style] === selectionKey
                && state.activeSurfaceId === activeSurfaceId
                && ['loading', 'error'].includes(state.activeManifestStatus)
            ) {
                return;
            }
            townMapSelectionKeyRef.current[style] = selectionKey;

            const cachedManifest = state.manifestsById?.[activeSurfaceId] || null;
            const activeAssetBaseUrl = resolveFixedTownSurfaceAssetBaseUrl(
                assetBaseUrls[style],
                selectedSurface,
            );
            const manifestPath = resolveFixedTownSurfaceManifestPath(selectedSurface);
            if (!activeAssetBaseUrl || !manifestPath) {
                setTownMapManifestStates((current) => ({
                    ...current,
                    [style]: {
                        ...current[style],
                        manifest: null,
                        activeSurfaceId,
                        activeAssetBaseUrl: '',
                        activeManifestStatus: 'error',
                    },
                }));
                return;
            }

            if (cachedManifest) {
                setTownMapManifestStates((current) => ({
                    ...current,
                    [style]: {
                        ...current[style],
                        manifest: cachedManifest,
                        activeSurfaceId,
                        activeAssetBaseUrl,
                        activeManifestStatus: 'ready',
                    },
                }));
                return;
            }

            setTownMapManifestStates((current) => ({
                ...current,
                [style]: {
                    ...current[style],
                    manifest: null,
                    activeSurfaceId,
                    activeAssetBaseUrl,
                    activeManifestStatus: 'loading',
                },
            }));
            fetchFixedTownSurfaceManifest(assetBaseUrls[style], {
                manifestPath,
            })
                .then((manifest) => {
                    setTownMapManifestStates((current) => {
                        const currentStyleState = current[style] || createTownMapManifestState('ready');
                        if (currentStyleState.activeSurfaceId !== activeSurfaceId) return current;
                        return {
                            ...current,
                            [style]: {
                                ...currentStyleState,
                                manifest,
                                activeSurfaceId,
                                activeAssetBaseUrl,
                                activeManifestStatus: 'ready',
                                manifestsById: {
                                    ...(currentStyleState.manifestsById || {}),
                                    [activeSurfaceId]: manifest,
                                },
                            },
                        };
                    });
                })
                .catch((error) => {
                    if (error?.name === 'AbortError') return;
                    setTownMapManifestStates((current) => {
                        const currentStyleState = current[style] || createTownMapManifestState('ready');
                        if (currentStyleState.activeSurfaceId !== activeSurfaceId) return current;
                        return {
                            ...current,
                            [style]: {
                                ...currentStyleState,
                                manifest: null,
                                activeManifestStatus: 'error',
                            },
                        };
                    });
                });
        });

        return undefined;
    }, [townMapCoveragePoints, townMapFocusSurfaceId, townMapManifestStates, townMapViewportBounds]);

    const townMapSurfaceResolving = Boolean(
        TOWN_MAP_PROOF_ENABLED
        && townMapManifestState.status === 'ready'
        && townMapManifestState.sourceType === 'index'
        && townMapViewportSurfaceId
        && townMapViewportSurfaceId !== townMapManifestState.activeSurfaceId
    );
    const townMapFocusSurfaceMismatch = Boolean(
        TOWN_MAP_PROOF_ENABLED
        && townMapManifestState.status === 'ready'
        && townMapManifestState.sourceType === 'index'
        && townMapFocusSurfaceId
        && townMapFocusSurfaceId !== townMapManifestState.activeSurfaceId
    );
    const townMapFocusSurfacePending = Boolean(
        TOWN_MAP_PROOF_ENABLED
        && townMapManifestState.status === 'ready'
        && townMapManifestState.sourceType === 'index'
        && townMapFocusSurfaceId
    );
    const townMapAvailable = Boolean(
        TOWN_MAP_PROOF_ENABLED
        && townMapAssetBaseUrl
        && townMapManifestState.status === 'ready'
        && townMapManifestState.manifest
        && townMapManifestState.activeManifestStatus === 'ready'
        && !townMapSurfaceResolving
        && !townMapFocusSurfaceMismatch
        && townMapCoveragePoints.length
    );
    const townMapSurfacePending = Boolean(
        TOWN_MAP_PROOF_ENABLED
        && (
            townMapManifestState.status === 'loading'
            || (
                townMapManifestState.status === 'ready'
                && townMapManifestState.sourceType === 'index'
                && (
                    townMapManifestState.activeManifestStatus === 'loading'
                    || townMapSurfaceResolving
                    || townMapFocusSurfacePending
                )
            )
        )
    );

    useEffect(() => {
        if (!townMapFocusSurfaceId) return;
        if (
            !TOWN_MAP_PROOF_ENABLED
            || townMapManifestState.sourceType !== 'index'
            || interactiveBasemapMode === 'live'
        ) {
            setTownMapFocusSurfaceId('');
            return;
        }
        if (
            townMapManifestState.activeSurfaceId === townMapFocusSurfaceId
            && townMapManifestState.activeManifestStatus === 'ready'
        ) {
            const clearTimer = window.setTimeout(() => {
                townMapFocusSurfaceClearTimerRef.current = null;
                setTownMapFocusSurfaceId('');
            }, 1200);
            townMapFocusSurfaceClearTimerRef.current = clearTimer;
            return () => {
                window.clearTimeout(clearTimer);
                if (townMapFocusSurfaceClearTimerRef.current === clearTimer) {
                    townMapFocusSurfaceClearTimerRef.current = null;
                }
            };
        }
        return undefined;
    }, [
        interactiveBasemapMode,
        townMapFocusSurfaceId,
        townMapManifestState.activeManifestStatus,
        townMapManifestState.activeSurfaceId,
        townMapManifestState.sourceType,
    ]);
    const printTownMapRootAssetBaseUrl = printMapState.mapStyle === CAREAROUND_MAP_STYLE_GRAY
        ? TOWN_MAP_GRAY_ASSET_BASE_URL
        : TOWN_MAP_ASSET_BASE_URL;
    const printTownMapManifestState = townMapManifestStates[printMapState.mapStyle]
        || createTownMapManifestState();
    const printTownMapAssetBaseUrl = printTownMapManifestState.activeAssetBaseUrl
        || printTownMapRootAssetBaseUrl;
    const printTownMapOverviewRootAssetBaseUrl = printMapState.mapStyle === CAREAROUND_MAP_STYLE_GRAY
        ? TOWN_MAP_GRAY_OVERVIEW_ASSET_BASE_URL
        : TOWN_MAP_OVERVIEW_ASSET_BASE_URL;
    const printTownMapOverviewManifestState = townMapOverviewManifestStates[printMapState.mapStyle]
        || createTownMapManifestState();
    const printTownMapOverviewAssetBaseUrl = printTownMapOverviewManifestState.activeAssetBaseUrl
        || printTownMapOverviewRootAssetBaseUrl;
    const printTownMapViewportSurface = useMemo(() => {
        if (
            !TOWN_MAP_PROOF_ENABLED
            || printTownMapManifestState.status !== 'ready'
            || printTownMapManifestState.sourceType !== 'index'
            || !printTownMapManifestState.index
        ) {
            return null;
        }
        return selectFixedTownSurfaceForViewport(
            printTownMapManifestState.index,
            townMapViewportBounds,
            townMapCoveragePoints,
        );
    }, [
        printTownMapManifestState.index,
        printTownMapManifestState.sourceType,
        printTownMapManifestState.status,
        townMapCoveragePoints,
        townMapViewportBounds,
    ]);
    const printTownMapViewportSurfaceId = printTownMapViewportSurface?.id || '';
    const printTownMapSurfaceResolving = Boolean(
        TOWN_MAP_PROOF_ENABLED
        && printTownMapManifestState.status === 'ready'
        && printTownMapManifestState.sourceType === 'index'
        && printTownMapViewportSurfaceId
        && printTownMapViewportSurfaceId !== printTownMapManifestState.activeSurfaceId
    );
    const printTownMapSurfacePending = Boolean(
        TOWN_MAP_PROOF_ENABLED
        && (
            printTownMapManifestState.status === 'loading'
            || (
                printTownMapManifestState.status === 'ready'
                && printTownMapManifestState.sourceType === 'index'
                && (
                    printTownMapManifestState.activeManifestStatus === 'loading'
                    || printTownMapSurfaceResolving
                )
            )
        )
    );
    const printTownMapOverviewViewportSurface = useMemo(() => {
        if (
            !TOWN_MAP_OVERVIEW_ENABLED
            || printTownMapOverviewManifestState.status !== 'ready'
            || printTownMapOverviewManifestState.sourceType !== 'index'
            || !printTownMapOverviewManifestState.index
        ) {
            return null;
        }
        return selectFixedTownSurfaceForViewport(
            printTownMapOverviewManifestState.index,
            townMapViewportBounds,
            townMapCoveragePoints,
        );
    }, [
        printTownMapOverviewManifestState.index,
        printTownMapOverviewManifestState.sourceType,
        printTownMapOverviewManifestState.status,
        townMapCoveragePoints,
        townMapViewportBounds,
    ]);
    const printTownMapOverviewViewportSurfaceId = printTownMapOverviewViewportSurface?.id || '';
    const printTownMapOverviewSurfaceResolving = Boolean(
        TOWN_MAP_OVERVIEW_ENABLED
        && printTownMapOverviewManifestState.status === 'ready'
        && printTownMapOverviewManifestState.sourceType === 'index'
        && printTownMapOverviewViewportSurfaceId
        && printTownMapOverviewViewportSurfaceId !== printTownMapOverviewManifestState.activeSurfaceId
    );
    const printTownMapOverviewSurfacePending = Boolean(
        TOWN_MAP_OVERVIEW_ENABLED
        && (
            printTownMapOverviewManifestState.status === 'loading'
            || (
                printTownMapOverviewManifestState.status === 'ready'
                && printTownMapOverviewManifestState.sourceType === 'index'
                && (
                    printTownMapOverviewManifestState.activeManifestStatus === 'loading'
                    || printTownMapOverviewSurfaceResolving
                )
            )
        )
    );
    const printTownMapOverviewOutsidePointCount = useMemo(() => {
        if (
            !printTownMapOverviewManifestState.index
            && !printTownMapOverviewManifestState.manifest
        ) {
            return 0;
        }
        return townMapCoveragePoints.filter((point) => (
            !isTownMapPointCoveredByState(point, printTownMapOverviewManifestState)
        )).length;
    }, [printTownMapOverviewManifestState, townMapCoveragePoints]);
    const printTownMapOverviewAvailable = Boolean(
        TOWN_MAP_OVERVIEW_ENABLED
        && printTownMapOverviewAssetBaseUrl
        && printTownMapOverviewManifestState.status === 'ready'
        && printTownMapOverviewManifestState.manifest
        && printTownMapOverviewManifestState.activeManifestStatus === 'ready'
        && !printTownMapOverviewSurfaceResolving
        && townMapCoveragePoints.length
        && printTownMapOverviewOutsidePointCount === 0
    );
    const printTownMapOutsidePointCount = useMemo(() => {
        if (!printTownMapManifestState.index && !printTownMapManifestState.manifest) return 0;
        return townMapCoveragePoints.filter((point) => (
            !isTownMapPointCoveredByState(point, printTownMapManifestState)
        )).length;
    }, [printTownMapManifestState, townMapCoveragePoints]);
    const printTownMapAvailable = Boolean(
        TOWN_MAP_PROOF_ENABLED
        && printTownMapAssetBaseUrl
        && printTownMapManifestState.status === 'ready'
        && printTownMapManifestState.manifest
        && printTownMapManifestState.activeManifestStatus === 'ready'
        && !printTownMapSurfaceResolving
        && townMapCoveragePoints.length
        && printTownMapOutsidePointCount === 0
    );

    const handleBasemapModeChange = useCallback((nextMode) => {
        if (nextMode === 'live') {
            setTownMapFallbackReason('');
            if (mapStudioRuntimeSnapshot) {
                mapStudioControllerRef.current?.patchDesign(
                    { basemap: { detailMode: 'live' } },
                    { enterDesign: true },
                );
            }
            return;
        }
        if (nextMode !== 'town') return;
        if (!townMapAvailable && !townMapOverviewAvailable) {
            return;
        }
        setTownMapFallbackReason('');
        if (mapStudioRuntimeSnapshot) {
            mapStudioControllerRef.current?.patchDesign(
                { basemap: { detailMode: 'auto' } },
                { enterDesign: true },
            );
            return;
        }
        setBasemapMode('auto');
    }, [mapStudioRuntimeSnapshot, townMapAvailable, townMapOverviewAvailable]);

    const handleFixedTownSurfaceFallback = useCallback(({ reason } = {}) => {
        if (!mapStudioRuntimeSnapshot) setBasemapMode('live');
        setTownMapFallbackReason(reason || 'surface-unavailable');
    }, [mapStudioRuntimeSnapshot]);

    const retryTownMapManifests = useCallback(() => {
        setTownMapFallbackReason('');
        setTownMapManifestReloadVersion((current) => current + 1);
    }, []);

    const renderTownMapModeControl = useCallback(({
        mode = 'live',
        townAvailable: activeTownMapAvailable = false,
        townPending = false,
        townViewportEligible = true,
        townZoomEligible = false,
        zoom = null,
        fallbackReason = '',
        surfaceTier = '',
        onModeChange,
        controlVariant = 'overlay',
    } = {}) => {
        const usingOverview = surfaceTier
            ? surfaceTier === 'overview'
            : resolveFixedTownSurfaceTier({
                zoom,
                nativeMinZoom: FIXED_TOWN_SURFACE_MIN_ZOOM,
                overviewConfigured: TOWN_MAP_OVERVIEW_ENABLED,
            }) === 'overview';
        const activeManifestState = usingOverview
            ? townMapOverviewManifestState
            : townMapManifestState;
        const activeAssetBaseUrl = usingOverview
            ? townMapOverviewAssetBaseUrl
            : townMapAssetBaseUrl;
        const activeManifestError = isTownMapManifestStateError(activeManifestState);
        const activeManifestLoading = isTownMapManifestStateLoading(activeManifestState);
        const activeStatus = activeManifestLoading
            ? {
                message: 'Preparing the detailed map…',
                compactMessage: 'Loading detailed…',
            }
            : activeManifestError || !activeAssetBaseUrl
                ? {
                    message: 'Detailed map is unavailable. The regular map is still shown.',
                    compactMessage: 'Detailed unavailable',
                }
                : townMapFallbackReason
                    ? {
                        message: 'Detailed map could not load. The regular map is still shown.',
                        compactMessage: 'Detailed unavailable',
                    }
                    : { message: '', compactMessage: '' };
        const townUnavailableMessage = interactiveBasemapMode === 'auto'
            && activeTownMapAvailable
            && townViewportEligible
            && !townZoomEligible
            ? `Zoom in to level ${FIXED_TOWN_SURFACE_MIN_ZOOM}. Detailed map will turn on automatically.`
            : '';
        const townUnavailableCompactMessage = townUnavailableMessage
            ? `Zoom in to ${FIXED_TOWN_SURFACE_MIN_ZOOM} for Detailed.`
            : '';
        const viewportStatusMessage = !townViewportEligible && townMapAvailable
            ? 'Detailed map is not ready for this area. The regular map is still shown here.'
            : '';
        const compactViewportStatusMessage = viewportStatusMessage
            ? 'Outside Detailed area'
            : '';
        const pendingStatusMessage = townPending
            ? 'Loading detailed map…'
            : activeStatus.message;
        const pendingCompactStatusMessage = townPending
            ? 'Loading detailed…'
            : activeStatus.compactMessage;
        const fallbackStatusMessage = fallbackReason === 'outside-surface'
            ? 'Detailed map is not ready for this area. The regular map is still shown here.'
            : 'Detailed map could not load. The regular map is still shown.';
        const statusMessage = fallbackReason
            ? fallbackStatusMessage
            : (viewportStatusMessage || pendingStatusMessage);
        const compactStatusMessage = fallbackReason
            ? (fallbackReason === 'outside-surface' ? 'Outside Detailed area' : 'Detailed unavailable')
            : (compactViewportStatusMessage || pendingCompactStatusMessage);
        return (
            <TownMapModeControl
                mode={mode}
                townAvailable={activeTownMapAvailable && townViewportEligible && townZoomEligible}
                statusMessage={statusMessage}
                compactStatusMessage={compactStatusMessage}
                townUnavailableMessage={townUnavailableMessage}
                townUnavailableCompactMessage={townUnavailableCompactMessage}
                onModeChange={onModeChange}
                retryLabel={activeManifestError ? 'Retry detailed map' : ''}
                onRetry={retryTownMapManifests}
                variant={controlVariant}
            />
        );
    }, [
        interactiveBasemapMode,
        retryTownMapManifests,
        townMapAssetBaseUrl,
        townMapFallbackReason,
        townMapManifestState,
        townMapOverviewAssetBaseUrl,
        townMapOverviewManifestState,
    ]);
    const mapModeControl = TOWN_MAP_PROOF_ENABLED ? renderTownMapModeControl : null;
    const renderPrintTownMapModeControl = useCallback(({
        mode = 'live',
        townAvailable: activeTownMapAvailable = false,
        townPending = false,
        townZoomEligible = false,
        zoom = null,
        fallbackReason = '',
        surfaceTier = '',
        onModeChange,
        controlVariant = 'overlay',
    } = {}) => {
        const usingOverview = surfaceTier
            ? surfaceTier === 'overview'
            : resolveFixedTownSurfaceTier({
                zoom,
                nativeMinZoom: FIXED_TOWN_SURFACE_MIN_ZOOM,
                overviewConfigured: TOWN_MAP_OVERVIEW_ENABLED,
            }) === 'overview';
        const activeManifestState = usingOverview
            ? printTownMapOverviewManifestState
            : printTownMapManifestState;
        const activeAssetBaseUrl = usingOverview
            ? printTownMapOverviewAssetBaseUrl
            : printTownMapAssetBaseUrl;
        const activeOutsidePointCount = usingOverview
            ? printTownMapOverviewOutsidePointCount
            : printTownMapOutsidePointCount;
        const activeManifestError = isTownMapManifestStateError(activeManifestState);
        const wantsDetailed = printMapState.basemapMode === 'auto';
        const townUnavailableMessage = wantsDetailed && activeTownMapAvailable && !townZoomEligible
            ? `Zoom in to level ${FIXED_TOWN_SURFACE_MIN_ZOOM}. Detailed map will turn on automatically.`
            : '';
        const unavailable = activeManifestError
            || !activeAssetBaseUrl
            || activeOutsidePointCount > 0
            || fallbackReason;
        const statusMessage = unavailable
            ? (activeOutsidePointCount > 0
                ? 'Some places are outside the detailed map area. The regular map is still shown.'
                : 'Detailed map is unavailable. The regular map is still shown.')
            : (townPending ? 'Loading detailed map…' : '');
        const compactStatusMessage = unavailable
            ? statusMessage
            : (townPending ? 'Loading detailed…' : '');
        const canRequestDetailed = activeTownMapAvailable || townPending;
        const handleModeChange = (nextMode) => {
            setPrintMapState((current) => ({
                ...current,
                basemapMode: nextMode === 'town' ? 'auto' : 'live',
            }));
            onModeChange?.(nextMode);
        };
        return (
            <TownMapModeControl
                mode={mode}
                townAvailable={activeTownMapAvailable && townZoomEligible}
                statusMessage={statusMessage}
                compactStatusMessage={compactStatusMessage}
                townUnavailableMessage={townUnavailableMessage}
                townUnavailableCompactMessage={townUnavailableMessage ? `Zoom in to ${FIXED_TOWN_SURFACE_MIN_ZOOM} for Detailed.` : ''}
                onModeChange={handleModeChange}
                onUnavailableTownSelect={() => {
                    if (!canRequestDetailed) return;
                    setPrintMapState((current) => ({ ...current, basemapMode: 'auto' }));
                }}
                retryLabel={activeManifestError ? 'Retry detailed map' : ''}
                onRetry={retryTownMapManifests}
                variant={controlVariant}
            />
        );
    }, [
        printMapState.basemapMode,
        printTownMapAssetBaseUrl,
        printTownMapManifestState,
        printTownMapOverviewAssetBaseUrl,
        printTownMapOverviewManifestState,
        printTownMapOverviewOutsidePointCount,
        printTownMapOutsidePointCount,
        retryTownMapManifests,
    ]);
    const printMapModeControl = TOWN_MAP_PROOF_ENABLED ? renderPrintTownMapModeControl : null;

    const clearMapSelection = useCallback((options = {}) => {
        const preserveTownMapFocusSurface = Boolean(options?.preserveTownMapFocusSurface);
        if (pendingFocusFrameRef.current !== null) {
            window.cancelAnimationFrame(pendingFocusFrameRef.current);
            pendingFocusFrameRef.current = null;
        }
        if (townMapFocusSurfaceClearTimerRef.current !== null) {
            window.clearTimeout(townMapFocusSurfaceClearTimerRef.current);
            townMapFocusSurfaceClearTimerRef.current = null;
        }
        if (!preserveTownMapFocusSurface) {
            setTownMapFocusSurfaceId('');
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

    function openCategoryOrder() {
        if (categoryOrderOptions.length < 1) return;
        setCategoryOrderError('');
        setCategoryOrderOpen(true);
    }

    async function handleUpdateCategoryOrder({ categoryOrder, categoryShapes }) {
        if (!directory || categoryOrderSubmitting) return;
        setCategoryOrderSubmitting(true);
        setCategoryOrderError('');
        try {
            await api.updateMyMapCategoryOrder(directory.id, { categoryOrder });
            if (mapStudioRuntimeSnapshot) {
                mapStudioControllerRef.current?.patchDesign({
                    pins: { categoryShapes },
                }, { enterDesign: true });
            }
            const refreshedDirectory = await loadMap();
            if (!refreshedDirectory) {
                setCategoryOrderError(t('failedLoadMap'));
                return;
            }
            setCategoryOrderOpen(false);
        } catch (err) {
            console.error(err);
            setCategoryOrderError(err.message || t('failedUpdateCategoryOrder'));
        } finally {
            setCategoryOrderSubmitting(false);
        }
    }

    async function handleManageAssets({ assets }) {
        if (!directory || mapAssetMutationInFlightRef.current) return;
        mapAssetMutationInFlightRef.current = true;
        setAddSubmitting(true);
        setAddError('');
        try {
            const { targetKeys, toAdd, toRemove } = buildMyMapAssetMutationPlan(
                directory.assets,
                assets,
            );
            await Promise.allSettled([
                ...toAdd.map((asset) => api.addMyMapAsset(directory.id, asset)),
                ...toRemove.map((asset) => api.removeMyMapAsset(directory.id, asset.resourceType, asset.resourceId))
            ]);

            const refreshedDirectory = await loadMap();
            if (!refreshedDirectory) {
                setAddReady(false);
                setAddError(t('failedLoadMap'));
                return;
            }

            setAddReady(true);
            if (!isMyMapAssetSelectionReconciled(refreshedDirectory.assets, targetKeys)) {
                setAddError(t('failedUpdateMapResources'));
                return;
            }

            setAddOpen(false);
        } catch (err) {
            console.error(err);
            setAddError(err.message || t('failedUpdateMapResources'));
        } finally {
            mapAssetMutationInFlightRef.current = false;
            setAddSubmitting(false);
        }
    }

    async function openManageAssets() {
        if (addLoading || addSubmitting) return;
        setPersonalPlacePickerActive(false);
        setAddError('');
        setAddReady(false);
        setAddOpen(true);
        setAddLoading(true);
        const refreshedDirectory = await loadMap();
        setAddLoading(false);
        if (!refreshedDirectory) {
            setAddError(t('failedLoadMap'));
            return;
        }
        setAddReady(true);
    }

    function openPersonalPlacePicker() {
        if (interactiveAnnotationEditorOpen) {
            printAnnotations.saveNow();
            setInteractiveAnnotationEditorOpen(false);
        }
        if (personalPlacePickerActive) {
            setPersonalPlacePickerActive(false);
            setPersonalPlaceError('');
            return;
        }
        setAddOpen(false);
        setEditOpen(false);
        setShareOpen(false);
        setPersonalPlaceModalOpen(false);
        setPersonalPlaceDraft(null);
        setPersonalPlaceError('');
        setPersonalPlaceChooserError('');
        clearMapSelection();
        setPersonalPlaceChooserOpen(true);
    }

    function startCreatingPersonalPlaceOnMap() {
        setPersonalPlaceChooserOpen(false);
        setPersonalPlaceChooserError('');
        setPersonalPlacePickerActive(true);
    }

    function closePersonalPlaceModal() {
        if (personalPlaceSubmitting) return;
        setPersonalPlaceModalOpen(false);
        setPersonalPlaceDraft(null);
        setPersonalPlaceError('');
    }

    function handlePersonalPlaceMapClick({ lat, lng } = {}) {
        if (!personalPlacePickerActive) return;
        setPersonalPlaceDraft({
            id: null,
            name: '',
            logoUrl: '',
            categoryLabel: '',
            address: '',
            postalCode: '',
            lat,
            lng,
        });
        setPersonalPlaceError('');
        setPersonalPlacePickerActive(false);
        setPersonalPlaceModalOpen(true);
    }

    function handleEditPersonalPlace(row) {
        if (!row) return;
        setPersonalPlacePickerActive(false);
        setPersonalPlaceError('');
        setPersonalPlaceDraft({
            id: row.personalPlaceId || row.resourceId,
            name: row.name || '',
            logoUrl: row.logoUrl || '',
            categoryId: row.categoryId || row.personalPlaceCategory?.id || null,
            category: row.personalPlaceCategory || null,
            categoryLabel: row.subCategory || row.categoryLabel || '',
            address: row.address || '',
            postalCode: row.postalCode || '',
            lat: row.lat ?? row.placeLat ?? null,
            lng: row.lng ?? row.placeLng ?? null,
        });
        setPersonalPlaceModalOpen(true);
    }

    async function handleSavePersonalPlace(values) {
        if (!directory || personalPlaceMutationInFlightRef.current) return;
        personalPlaceMutationInFlightRef.current = true;
        setPersonalPlaceSubmitting(true);
        setPersonalPlaceError('');
        setActionError('');
        const editing = Boolean(values?.id);
        try {
            if (editing) {
                await api.updateMyMapPersonalPlace(directory.id, values.id, values);
            } else {
                await api.createMyMapPersonalPlace(directory.id, values);
            }
            setPersonalPlaceModalOpen(false);
            setPersonalPlaceDraft(null);
            setPersonalPlaceActionStatus({
                phase: 'pending',
                message: t('personalPlaceUpdatingMap'),
            });
            const refreshed = await loadMap();
            if (!refreshed) {
                setPersonalPlaceActionStatus(null);
                setActionError(t('failedLoadMap'));
                return;
            }
            setPersonalPlaceActionStatus({
                phase: 'success',
                message: t(editing ? 'personalPlaceUpdated' : 'personalPlaceAddedToMap'),
            });
        } catch (err) {
            console.error(err);
            setPersonalPlaceActionStatus(null);
            setPersonalPlaceError(err.message || t('personalPlaceSaveFailed'));
        } finally {
            personalPlaceMutationInFlightRef.current = false;
            setPersonalPlaceSubmitting(false);
        }
    }

    async function handleAttachPersonalPlaces(personalPlaceIds) {
        if (
            !directory
            || personalPlaceMutationInFlightRef.current
            || !Array.isArray(personalPlaceIds)
            || personalPlaceIds.length === 0
        ) return;
        personalPlaceMutationInFlightRef.current = true;
        setPersonalPlaceChooserSubmitting(true);
        setPersonalPlaceChooserError('');
        setActionError('');
        try {
            await Promise.all(personalPlaceIds.map((personalPlaceId) => (
                api.attachMyMapPersonalPlace(directory.id, personalPlaceId)
            )));
            setPersonalPlaceChooserOpen(false);
            setPersonalPlaceActionStatus({
                phase: 'pending',
                message: t('personalPlaceUpdatingMap'),
            });
            const refreshed = await loadMap();
            if (!refreshed) {
                setPersonalPlaceActionStatus(null);
                setActionError(t('failedLoadMap'));
                return;
            }
            setPersonalPlaceActionStatus({
                phase: 'success',
                message: t(personalPlaceIds.length === 1
                    ? 'personalPlaceAddedToMap'
                    : 'personalPlacesAddedToMap'),
            });
        } catch (err) {
            console.error(err);
            setPersonalPlaceActionStatus(null);
            setPersonalPlaceChooserError(err.message || 'Failed to add personal places to this map.');
        } finally {
            personalPlaceMutationInFlightRef.current = false;
            setPersonalPlaceChooserSubmitting(false);
        }
    }

    async function handleCreatePersonalPlaceCategory(values) {
        setPersonalPlaceCategoryBusy(true);
        setPersonalPlaceCategoryError('');
        try {
            const created = await api.createPersonalPlaceCategory(values);
            setPersonalPlaceCategories((current) => [...current, created]);
        } catch (err) {
            console.error(err);
            setPersonalPlaceCategoryError(err.message || 'Failed to create category.');
        } finally {
            setPersonalPlaceCategoryBusy(false);
        }
    }

    async function handleUpdatePersonalPlaceCategory(categoryId, values) {
        setPersonalPlaceCategoryBusy(true);
        setPersonalPlaceCategoryError('');
        try {
            const updated = await api.updatePersonalPlaceCategory(categoryId, values);
            setPersonalPlaceCategories((current) => current.map((category) => (
                category.id === updated.id ? updated : category
            )));
            setPersonalPlacesLibrary((current) => current.map((place) => (
                place.categoryId === updated.id
                    ? { ...place, categoryLabel: updated.name, category: updated }
                    : place
            )));
            await loadMap();
        } catch (err) {
            console.error(err);
            setPersonalPlaceCategoryError(err.message || 'Failed to update category.');
        } finally {
            setPersonalPlaceCategoryBusy(false);
        }
    }

    async function handleRemoveResource(row) {
        if (!directory) return false;
        const personalPlace = row?.resourceType === 'personal_place';
        if (personalPlace && personalPlaceMutationInFlightRef.current) return false;
        if (!personalPlace && mapCardRemovalInFlightRef.current) return false;
        if (personalPlace) {
            personalPlaceMutationInFlightRef.current = true;
            setPersonalPlaceActionStatus({
                phase: 'pending',
                message: t('personalPlaceRemovingFromMap'),
            });
        } else {
            mapCardRemovalInFlightRef.current = true;
            const confirmed = await requestConfirmation({
                title: t('removeMapResourceTitle'),
                message: t('removeMapResourceMessage', { name: row?.name || t('resource') }),
                details: [t('removeMapResourceDetail')],
                tone: 'danger',
                confirmLabel: t('removeFromMap'),
                cancelLabel: t('cancel'),
            });
            if (!confirmed) {
                mapCardRemovalInFlightRef.current = false;
                return false;
            }
        }
        setActionError('');
        try {
            if (personalPlace) {
                await api.deleteMyMapPersonalPlace(directory.id, row.personalPlaceId || row.resourceId);
            } else {
                await api.removeMyMapAsset(directory.id, row.resourceType, row.resourceId);
            }
            if (personalPlace) {
                setPersonalPlaceActionStatus({
                    phase: 'pending',
                    message: t('personalPlaceUpdatingMap'),
                });
            }
            const refreshed = await loadMap();
            if (!refreshed) {
                if (personalPlace) setPersonalPlaceActionStatus(null);
                setActionError(t('failedLoadMap'));
                return false;
            }
            if (personalPlace) {
                setPersonalPlaceActionStatus({
                    phase: 'success',
                    message: t('personalPlaceRemovedFromMap'),
                });
            }
            return true;
        } catch (err) {
            console.error(err);
            if (personalPlace) setPersonalPlaceActionStatus(null);
            setActionError(err.message || (personalPlace ? t('personalPlaceDeleteFailed') : t('failedRemoveMapResource')));
            return false;
        } finally {
            if (personalPlace) personalPlaceMutationInFlightRef.current = false;
            if (!personalPlace) mapCardRemovalInFlightRef.current = false;
        }
    }

    async function handlePublishShare(options = {}) {
        if (!directory) return false;
        if (mapStudioRuntimeSnapshot?.ownerDirty || mapStudioRuntimeSnapshot?.designDirty) {
            setShareError(t('mapStudioSaveBeforeShare'));
            return false;
        }
        setShareSubmitting(true);
        setShareError('');
        try {
            if (typeof options?.includeAnnotations === 'boolean') {
                printAnnotations.replaceAnnotations((current) => current.map((annotation) => ({
                    ...annotation,
                    isShared: options.includeAnnotations,
                })), { recordHistory: false });
            }
            const annotationsReadyForShare = await printAnnotations.flushPendingChanges();
            if (!annotationsReadyForShare) {
                setShareError(t('failedPublishShare'));
                return false;
            }
            await api.publishMyMapShare(directory.id, mapStudioRuntimeSnapshot?.documentRevision > 0
                ? { studioViewId: mapStudioRuntimeSnapshot.activeViewId }
                : {});
            await loadMap();
            return true;
        } catch (err) {
            console.error(err);
            setShareError(err.message || t('failedPublishShare'));
            return false;
        } finally {
            setShareSubmitting(false);
        }
    }

    async function handleUpdateResourceNotes(row, notes, options = {}) {
        if (row?.resourceType === 'personal_place') return null;
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

    function handleEditResourceShortDescription(row) {
        if (!row) return;
        setShortDescriptionError('');
        setShortDescriptionRow(row);
    }

    function closeResourceShortDescription() {
        if (shortDescriptionSubmitting) return;
        setShortDescriptionRow(null);
        setShortDescriptionError('');
    }

    async function handleSaveResourceShortDescription(descriptorPatch) {
        if (!directory || !shortDescriptionRow) return;
        setShortDescriptionSubmitting(true);
        setShortDescriptionError('');
        try {
            const updated = shortDescriptionRow.resourceType === 'personal_place'
                ? await api.updateMyMapPersonalPlaceShortDescriptor(
                    directory.id,
                    shortDescriptionRow.personalPlaceId || shortDescriptionRow.resourceId,
                    descriptorPatch
                )
                : await api.updateMyMapAssetShortDescriptor(
                    directory.id,
                    shortDescriptionRow.resourceType,
                    shortDescriptionRow.resourceId,
                    descriptorPatch
                );
            setDirectory((current) => applyResourceShortDescriptorToDirectory(
                current,
                shortDescriptionRow.resourceType,
                shortDescriptionRow.resourceId,
                {
                    shortDescriptor: updated?.shortDescriptor ?? descriptorPatch.shortDescriptor,
                    shortDescriptorTextColor: updated?.shortDescriptorTextColor ?? null,
                    shortDescriptorHighlightColor: updated?.shortDescriptorHighlightColor ?? null,
                    shortDescriptors: updated?.shortDescriptors ?? descriptorPatch.shortDescriptors ?? [],
                }
            ));
            setShortDescriptionRow(null);
        } catch (err) {
            console.error(err);
            setShortDescriptionError(err.message || 'Failed to update short description.');
        } finally {
            setShortDescriptionSubmitting(false);
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
            setShareError(err.message || t('failedUnpublishShare'));
        } finally {
            setShareSubmitting(false);
        }
    }

    async function handleUpdateEmbed(settings) {
        if (!directory) return false;
        setShareSubmitting(true);
        setShareError('');
        try {
            await api.updateMyMapEmbed(directory.id, settings);
            const refreshed = await loadMap();
            return refreshed !== false;
        } catch (err) {
            console.error(err);
            setShareError(err.message || t('failed'));
            return false;
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
        clearMapSelection({ preserveTownMapFocusSurface: true });
        let nextTownMapFocusSurfaceId = '';
        if (
            TOWN_MAP_PROOF_ENABLED
            && mapFocusPlaceKeys.length <= 1
            && townMapManifestState.status === 'ready'
            && townMapManifestState.sourceType === 'index'
            && townMapManifestState.index
            && interactiveBasemapMode !== 'live'
        ) {
            const focusKeys = [
                singleFocusPlaceKey,
                resolvedPlaceKey,
                placeKey,
                ...mapFocusPlaceKeys.map((key) => ownerPresentation.groupKeyByPlaceKey?.[key] || key),
            ].filter(Boolean).map((key) => String(key));
            const focusKeySet = new Set(focusKeys);
            const focusPin = (ownerPresentation.pins || []).find((pin) => {
                if (!pin) return false;
                if (focusKeySet.has(String(pin.placeKey))) return true;
                return (pin.memberPlaceKeys || []).some((key) => focusKeySet.has(String(key)));
            });
            const focusSurface = focusPin
                ? selectFixedTownSurfaceForViewport(
                    townMapManifestState.index,
                    null,
                    [{ id: focusPin.placeKey, lat: focusPin.lat, lng: focusPin.lng }],
                )
                : null;
            nextTownMapFocusSurfaceId = focusSurface?.id || '';
        }
        flushSync(() => {
            setTownMapFocusSurfaceId(nextTownMapFocusSurfaceId);
        });
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
        if (interactiveAnnotationEditorOpen) {
            printAnnotations.saveNow();
            setInteractiveAnnotationEditorOpen(false);
        }
        const studioSnapshot = mapStudioRuntimeSnapshot?.design
            ? {
                id: mapStudioRuntimeSnapshot.activeViewId,
                name: mapStudioRuntimeSnapshot.activeViewName,
                design: mapStudioRuntimeSnapshot.design,
                designDirty: Boolean(mapStudioRuntimeSnapshot.designDirty),
            }
            : null;
        pendingPrintStudioViewRef.current = studioSnapshot;
        setActivePrintStudioView(studioSnapshot);
        setPrintStudioLoadError('');
        setPrintMapState(studioSnapshot
            ? buildMapStudioPrintState(
                studioSnapshot.design,
                createMapStudioExportSettings(),
            )
            : createOwnerPrintMapState(mapStyle, OWNER_PRINT_BASEMAP_OPTIONS));
        setPrintAnnotationEditorOpen(false);
        setPrintShortDescriptionMode(false);
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('view', 'print');
        if (studioSnapshot) nextParams.set('studioView', studioSnapshot.id);
        else nextParams.delete('studioView');
        setSearchParams(nextParams);
    }

    function toggleInteractiveAnnotationEditor() {
        if (!canEditPrintAnnotations || !printAnnotationsReady) return;
        if (interactiveAnnotationEditorOpen) {
            printAnnotations.saveNow();
            setInteractiveAnnotationEditorOpen(false);
            return;
        }
        setPersonalPlacePickerActive(false);
        setInteractiveShortDescriptionMode(false);
        setResourceRemovalMode(false);
        printAnnotations.reload();
        setInteractiveAnnotationEditorOpen(true);
    }

    function toggleInteractiveShortDescription() {
        if (interactiveAnnotationEditorOpen) {
            printAnnotations.saveNow();
            setInteractiveAnnotationEditorOpen(false);
        }
        setResourceRemovalMode(false);
        setInteractiveShortDescriptionMode((current) => !current);
    }

    function toggleResourceRemovalMode() {
        if (!resourceRemovalMode) {
            if (interactiveAnnotationEditorOpen) {
                printAnnotations.saveNow();
                setInteractiveAnnotationEditorOpen(false);
            }
            setInteractiveShortDescriptionMode(false);
        }
        setResourceRemovalMode((current) => !current);
    }

    function openMapDetailsEditor() {
        setEditError('');
        setEditOpen(true);
    }

    function openMapShare() {
        setShareError('');
        setShareOpen(true);
    }

    function openMapStudioLayoutSettings() {
        mapStudioControllerRef.current?.openLayoutSettings();
    }

    function closePrintView() {
        printAnnotations.saveNow();
        setPrintAnnotationEditorOpen(false);
        setPrintShortDescriptionMode(false);
        setActivePrintStudioView(null);
        setPrintStudioLoadError('');
        pendingPrintStudioViewRef.current = null;
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('view');
        nextParams.delete('studioView');
        setSearchParams(nextParams);
    }

    function togglePrintAnnotationEditor() {
        if (!printAnnotationsReady) return;
        if (printAnnotationEditorOpen) {
            setPrintAnnotationEditorOpen(false);
            return;
        }

        printAnnotations.reload();
        setPrintMapState((current) => ({
            ...current,
            annotationLayer: PRINT_MAP_ANNOTATION_LAYER_SHOW,
            ...(!isFullMapPrintLayout ? {
                layoutPreset: PRINT_MAP_LAYOUT_FULL,
            } : {}),
        }));
        setPrintAnnotationEditorOpen(true);
    }

    if (loading || (directory && directoryCacheKeyRef.current !== currentMapCacheKey)) {
        return (
            <div className="min-h-[calc(100vh-4rem)] bg-slate-50" data-route-cache-version={MY_MAP_ROUTE_CACHE_VERSION}>
                <div className="mx-auto w-full max-w-[1800px] px-4 py-6 sm:px-6 xl:px-10 2xl:px-14">
                    <MapDetailLoadingState />
                </div>
            </div>
        );
    }

    if (error || !directory) {
        return (
            <div className="min-h-[calc(100vh-4rem)] bg-slate-50" data-route-cache-version={MY_MAP_ROUTE_CACHE_VERSION}>
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

    const ownerToolbarActionProps = {
        onArrangeCategories: openCategoryOrder,
        categoryCount: categoryOrderOptions.length,
        onAddPersonalPlace: openPersonalPlacePicker,
        personalPlacePickerActive,
        onToggleShortDescription: toggleInteractiveShortDescription,
        shortDescriptionMode: interactiveShortDescriptionMode,
        onToggleAnnotations: toggleInteractiveAnnotationEditor,
        annotationEditing: interactiveAnnotationEditorOpen,
        canEditAnnotations: canEditPrintAnnotations,
        annotationsReady: printAnnotationsReady,
        onToggleResourceRemoval: toggleResourceRemovalMode,
        resourceRemovalMode,
        onEditLayout: openMapStudioLayoutSettings,
        editLayoutDisabled: !mapStudioRuntimeSnapshot,
        onEditDetails: openMapDetailsEditor,
        onOpenPrintView: openPrintView,
        onOpenShare: openMapShare,
        renderPdfExportButton,
    };
    const ownerMapStudioPanel = (
        <MapStudioViewsPanel
            ref={mapStudioControllerRef}
            mapId={mapId}
            defaultMapStyle={mapStyle}
            defaultDetailMode={basemapMode}
            resourceLayerCatalog={mapStudioResourceLayerCatalog}
            annotationLayerCatalog={printAnnotations.annotations.map((annotation, index) => ({
                id: annotation.id,
                label: String(annotation.text || '').trim()
                    || `${String(annotation.type || 'Annotation').replace(/-/g, ' ')} ${index + 1}`,
            }))}
            onOwnerSessionChange={handleOwnerMapStudioSessionChange}
        />
    );
    const ownerMapStudioRuntime = mapStudioInteractiveModel ? {
        ...mapStudioInteractiveModel,
        layoutSignature: `v2-map:${mapStudioLayoutSignature}`,
        heightResetKey: mapStudioRuntimeSnapshot.activeViewId,
        mapStyleDescription: t('mapStudioMapColourScope'),
        onMapStyleChange: handleMapStudioMapStyleChange,
        onMapViewStateChange: handleInteractiveMapViewStateChange,
    } : null;
    const studioMapHeight = mapStudioInteractiveModel?.layout?.mapHeight || 'standard';
    const classicMapStudioMapProps = {
        layoutSignature: `classic-map:${mapStudioLayoutSignature}`,
        mapStyleOverride: mapStudioInteractiveModel?.directoryMap?.mapStyleOverride ?? null,
        onMapStyleOverrideChange: mapStudioInteractiveModel
            ? handleMapStudioMapStyleChange
            : null,
        mapStyleDescription: mapStudioInteractiveModel
            ? t('mapStudioMapColourScope')
            : undefined,
        mapViewState: mapStudioInteractiveModel?.directoryMap?.mapViewState ?? null,
        markerScale: mapStudioInteractiveModel?.directoryMap?.markerScale ?? 1,
        printBadgeScale: mapStudioInteractiveModel?.directoryMap?.markerScale ?? 1,
        pinBadgeMode: mapStudioInteractiveModel?.directoryMap?.pinBadgeMode ?? 'count',
        pinCategoryIconMode: mapStudioInteractiveModel?.directoryMap?.pinCategoryIconMode ?? 'auto',
        clusterMarkerMode: mapStudioInteractiveModel?.directoryMap?.clusterMarkerMode ?? 'bubble',
        numberedPinShapesByCategory: mapStudioInteractiveModel?.directoryMap?.numberedPinShapesByCategory ?? {},
        showPins: mapStudioInteractiveModel?.resourceLayer?.visible ?? true,
        onMapViewStateChange: mapStudioInteractiveModel
            ? handleInteractiveMapViewStateChange
            : null,
    };
    const classicMarkerMode = mapStudioInteractiveModel?.directoryMap?.markerMode || 'number';

    if (isPrintView) {
        return (
            <div className="min-h-screen bg-white" data-route-cache-version={MY_MAP_ROUTE_CACHE_VERSION}>
                <div
                    className="sticky top-[56px] z-[1150] border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur print:hidden sm:top-[64px]"
                    data-owner-print-toolbar="true"
                >
                    <div className="relative flex w-full flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
                        <div
                            className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-start"
                            data-print-toolbar-actions="true"
                        >
                            <button
                                type="button"
                                onClick={closePrintView}
                                className="btn-ghost min-h-11 w-full justify-center border border-slate-200 px-3 text-xs text-slate-700 sm:w-auto sm:text-sm"
                            >
                                <ArrowLeft size={16} />
                                {t('backToInteractiveView')}
                            </button>
                            {!activePrintStudioView ? (<>
                            <button
                                type="button"
                                onClick={() => {
                                    setPrintAnnotationEditorOpen(false);
                                    openCategoryOrder();
                                }}
                                disabled={categoryOrderOptions.length < 2}
                                className="btn-ghost min-h-11 w-full justify-center border border-slate-200 px-3 text-xs text-slate-700 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto sm:text-sm"
                                data-print-category-order-trigger="true"
                            >
                                <ListOrdered size={16} aria-hidden="true" />
                                {t('arrangeCategories')}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setPrintAnnotationEditorOpen(false);
                                    openPersonalPlacePicker();
                                }}
                                className={`btn-ghost min-h-11 w-full justify-center border px-3 text-xs sm:w-auto sm:text-sm ${
                                    personalPlacePickerActive
                                        ? 'border-brand-600 bg-brand-50 text-brand-800'
                                        : 'border-slate-200 text-slate-700'
                                }`}
                                aria-pressed={personalPlacePickerActive}
                                data-print-personal-place-trigger="true"
                            >
                                <MapPin size={16} aria-hidden="true" />
                                {personalPlacePickerActive ? t('cancelAddPersonalPlace') : t('addPersonalPlace')}
                            </button>
                            {canEditPrintAnnotations ? (
                                <button
                                    type="button"
                                    onClick={togglePrintAnnotationEditor}
                                    disabled={!printAnnotationsReady}
                                    className={`btn-ghost min-h-11 w-full justify-center border px-3 text-xs sm:w-auto sm:text-sm ${
                                        printAnnotationEditorOpen
                                            ? 'border-brand-600 bg-brand-50 text-brand-800'
                                            : 'border-slate-200 text-slate-700'
                                    } disabled:cursor-wait disabled:opacity-45`}
                                    aria-pressed={printAnnotationEditorOpen}
                                    title={isFullMapPrintLayout
                                        ? 'Annotate the full map'
                                        : 'Open Full map and annotate'}
                                    data-print-annotation-trigger="true"
                                    data-print-annotation-full-map-only="true"
                                    data-print-annotation-auto-full-map="true"
                                >
                                    <PenLine size={16} />
                                    Annotate
                                </button>
                            ) : null}
                            <button
                                type="button"
                                onClick={() => {
                                    setPrintAnnotationEditorOpen(false);
                                    setPrintShortDescriptionMode((current) => !current);
                                }}
                                className={`btn-ghost min-h-11 w-full justify-center border px-3 text-xs sm:w-auto sm:text-sm ${
                                    printShortDescriptionMode
                                        ? 'border-brand-600 bg-brand-50 text-brand-800'
                                        : 'border-slate-200 text-slate-700'
                                }`}
                                aria-pressed={printShortDescriptionMode}
                                data-print-short-description-trigger="true"
                            >
                                <AlignLeft size={16} aria-hidden="true" />
                                {t('addShortDescription')}
                            </button>
                            </>) : null}
                            <Suspense fallback={(
                                <span className="btn-ghost min-h-11 w-full justify-center border border-slate-200 px-3 text-xs text-slate-500 sm:w-auto sm:text-sm">
                                    {t('loadingPage')}
                                </span>
                            )}>
                                <MapImageExportButton
                                    directory={directory}
                                    activeAnchor={activeAnchor}
                                    shareUrl={printQrDirectoryUrl}
                                    printMapState={printMapState}
                                    fixedTownSurfaceManifest={printTownMapManifestState.manifest}
                                    fixedTownAssetBaseUrl={printTownMapAssetBaseUrl}
                                    fixedTownSurfaceAvailable={printTownMapAvailable}
                                    fixedTownSurfacePending={printTownMapSurfacePending}
                                    fixedTownSurfaceMinZoom={FIXED_TOWN_SURFACE_MIN_ZOOM}
                                    fixedTownOverviewSurfaceManifest={printTownMapOverviewManifestState.manifest}
                                    fixedTownOverviewAssetBaseUrl={printTownMapOverviewAssetBaseUrl}
                                    fixedTownOverviewSurfaceAvailable={printTownMapOverviewAvailable}
                                    fixedTownOverviewSurfacePending={printTownMapOverviewSurfacePending}
                                    printAnnotations={printAnnotations.annotations}
                                    deferPreparation={printAnnotationEditorOpen}
                                    disabled={Boolean(printStudioViewId && !activePrintStudioView)}
                                    className="min-h-11 w-full px-3 text-xs sm:w-auto sm:text-sm"
                                />
                            </Suspense>
                        </div>
                        <p className="w-full text-left text-sm font-semibold text-slate-600 lg:ml-auto lg:w-auto lg:text-right">
                            {activePrintStudioView
                                ? t('mapStudioExportingView', {
                                    name: activePrintStudioView.name,
                                    status: activePrintStudioView.designDirty
                                        ? t('mapStudioUnsavedPreviewStatus')
                                        : '',
                                })
                                : 'Your saved image will match this preview.'}
                        </p>
                        {actionError ? (
                            <p role="alert" className="w-full text-sm font-semibold text-red-700">
                                {actionError}
                            </p>
                        ) : null}
                        {printStudioLoadError ? (
                            <p role="alert" className="w-full text-sm font-semibold text-red-700">
                                {printStudioLoadError}
                            </p>
                        ) : null}
                        {canEditPrintAnnotations && !isFullMapPrintLayout ? (
                            <p
                                className="w-full text-xs font-semibold text-slate-500"
                                data-print-annotation-full-map-help="true"
                            >
                                Annotations appear in every layout. Editing opens in Full map.
                            </p>
                        ) : null}
                    </div>
                </div>

                <div className="w-full h-full overflow-auto">
                    <DirectoryPrintView
                        directory={directory}
                        mode="owner"
                        generatedAt={new Date()}
                        activeAnchor={activeAnchor}
                        shareUrl={printQrDirectoryUrl}
                        footerNote={directory.share?.isShared ? t('openSharedLinkForInteractiveMap') : ''}
                        className="w-full"
                        printMapState={printMapState}
                        onPrintMapStateChange={setPrintMapState}
                        mapModeControl={activePrintStudioView ? null : printMapModeControl}
                        fixedTownSurfaceManifest={printTownMapManifestState.manifest}
                        fixedTownAssetBaseUrl={printTownMapAssetBaseUrl}
                        fixedTownSurfaceAvailable={printTownMapAvailable}
                        fixedTownSurfacePending={printTownMapSurfacePending}
                        fixedTownSurfaceMinZoom={FIXED_TOWN_SURFACE_MIN_ZOOM}
                        fixedTownOverviewSurfaceManifest={printTownMapOverviewManifestState.manifest}
                        fixedTownOverviewAssetBaseUrl={printTownMapOverviewAssetBaseUrl}
                        fixedTownOverviewSurfaceAvailable={printTownMapOverviewAvailable}
                        fixedTownOverviewSurfacePending={printTownMapOverviewSurfacePending}
                        onFixedTownSurfaceViewportChange={setTownMapViewportBounds}
                        printAnnotations={printAnnotations.annotations}
                        annotationEditing={!activePrintStudioView && printAnnotationEditorOpen
                            && canEditPrintAnnotations
                            && isFullMapPrintLayout}
                        annotationStatus={printAnnotations.status}
                        annotationError={printAnnotations.error}
                        onPrintAnnotationsChange={printAnnotations.replaceAnnotations}
                        onSavePrintAnnotations={printAnnotations.saveNow}
                        onUndoPrintAnnotations={printAnnotations.undo}
                        onRedoPrintAnnotations={printAnnotations.redo}
                        canUndoPrintAnnotations={printAnnotations.canUndo}
                        canRedoPrintAnnotations={printAnnotations.canRedo}
                        onReloadPrintAnnotations={printAnnotations.reload}
                        onCloseAnnotationEditor={() => setPrintAnnotationEditorOpen(false)}
                        mapLayersEnabled={!activePrintStudioView && canEditPrintAnnotations && isFullMapPrintLayout}
                        onEditResourceShortDescription={printShortDescriptionMode
                            ? handleEditResourceShortDescription
                            : null}
                        personalPlacePickerActive={personalPlacePickerActive}
                        onPersonalPlaceMapClick={handlePersonalPlaceMapClick}
                        personalPlaceSurfaceStatus={personalPlaceMapSurfaceStatus}
                        onEditPersonalPlace={handleEditPersonalPlace}
                        onRemovePersonalPlace={handleRemoveResource}
                        mapStudioDesignLocked={Boolean(activePrintStudioView)}
                    />
                </div>

                <MyMapCategoryOrderModal
                    open={categoryOrderOpen}
                    categories={categoryOrderOptions}
                    initialOrder={directory.categoryOrder}
                    initialCategoryShapes={mapStudioRuntimeSnapshot?.design?.pins?.categoryShapes}
                    submitting={categoryOrderSubmitting}
                    error={categoryOrderError}
                    onClose={() => {
                        if (categoryOrderSubmitting) return;
                        setCategoryOrderOpen(false);
                        setCategoryOrderError('');
                    }}
                    onSubmit={handleUpdateCategoryOrder}
                />

                <MapAssetShortDescriptionModal
                    open={Boolean(shortDescriptionRow)}
                    row={shortDescriptionRow}
                    submitting={shortDescriptionSubmitting}
                    error={shortDescriptionError}
                    onClose={closeResourceShortDescription}
                    onSubmit={handleSaveResourceShortDescription}
                />

                <AddPersonalPlaceChooserModal
                    open={personalPlaceChooserOpen}
                    mapId={directory.id}
                    places={personalPlacesLibrary}
                    submitting={personalPlaceChooserSubmitting}
                    error={personalPlaceChooserError}
                    onClose={() => {
                        if (personalPlaceChooserSubmitting) return;
                        setPersonalPlaceChooserOpen(false);
                        setPersonalPlaceChooserError('');
                    }}
                    onAttach={handleAttachPersonalPlaces}
                    onCreateNew={startCreatingPersonalPlaceOnMap}
                />

                <PersonalPlaceEditorModal
                    open={personalPlaceModalOpen}
                    draft={personalPlaceDraft}
                    categories={personalPlaceCategories}
                    submitting={personalPlaceSubmitting}
                    error={personalPlaceError}
                    onClose={closePersonalPlaceModal}
                    onManageCategories={() => setPersonalPlaceCategoryManagerOpen(true)}
                    onSubmit={handleSavePersonalPlace}
                />

                <PersonalPlaceCategoryManagerModal
                    open={personalPlaceCategoryManagerOpen}
                    categories={personalPlaceCategories}
                    busy={personalPlaceCategoryBusy}
                    error={personalPlaceCategoryError}
                    onClose={() => {
                        if (personalPlaceCategoryBusy) return;
                        setPersonalPlaceCategoryManagerOpen(false);
                        setPersonalPlaceCategoryError('');
                    }}
                    onCreate={handleCreatePersonalPlaceCategory}
                    onUpdate={handleUpdatePersonalPlaceCategory}
                />
            </div>
        );
    }

    if (isV2View) {
        return (
            <>
                <MyMapV2PreviewScaffold
                    directory={mapStudioFilteredDirectory}
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
                    suspendMapInteraction={directoryMapInteractionSuspended}
                    onViewOnMap={handleViewOnMap}
                    onViewSection={handleViewSection}
                    onRemoveResource={resourceRemovalMode ? handleRemoveResource : null}
                    onEditPersonalPlace={handleEditPersonalPlace}
                    onEditResourceShortDescription={interactiveShortDescriptionMode
                        ? handleEditResourceShortDescription
                        : null}
                    onUpdateResourceNotes={handleUpdateResourceNotes}
                    onMapClick={personalPlacePickerActive ? handlePersonalPlaceMapClick : null}
                    onHoverPlaceStart={handleMapHoverStart}
                    onHoverPlaceEnd={handleMapHoverEnd}
                    onHoverClusterStart={handleMapClusterHoverStart}
                    onHoverClusterEnd={handleMapClusterHoverEnd}
                    onClusterSelect={handleMapClusterSelect}
                    onFocusHandled={handleMapFocusHandled}
                    onResetView={clearMapSelection}
                    mapOverlay={ownerInteractiveAnnotationOverlay}
                    mapSurfaceOverlay={interactiveAnnotationEditor.surfaceOverlay}
                    toolbar={useDesktopOwnerLayout ? (
                        <OwnerHeader
                            directory={directory}
                            query={query}
                            onQueryChange={setQuery}
                            anchorState={anchorState}
                            actionError={actionError}
                            onAddAssets={openManageAssets}
                            {...ownerToolbarActionProps}
                        />
                    ) : (
                        <MyMapMobileControls
                            directory={directory}
                            query={query}
                            onQueryChange={setQuery}
                            anchorState={anchorState}
                            onAddAssets={openManageAssets}
                            {...ownerToolbarActionProps}
                            compactOverlay
                        />
                    )}
                    studioPanel={ownerMapStudioPanel}
                    emptyLabel={query ? t('noMapPlacesMatchSearch') : t('mapNoPlacesYet')}
                    emptyState={(
                        <EmptyOwnerDirectory
                            onAddAssets={openManageAssets}
                            onAddPersonalPlace={openPersonalPlacePicker}
                        />
                    )}
                    mapMinZoom={TOWN_MAP_PROOF_ENABLED ? CAREAROUND_BASEMAP_MIN_NATIVE_ZOOM : undefined}
                    showZoomLevelCounter={TOWN_MAP_PROOF_ENABLED}
                    minimumZoomCenter={TOWN_MAP_PROOF_ENABLED ? TOWN_MAP_PROOF_MINIMUM_ZOOM_CENTER : null}
                    lockMinimumZoomCamera={TOWN_MAP_PROOF_ENABLED}
                    basemapMode={interactiveBasemapMode}
                    fixedTownSurfaceManifest={townMapManifestState.manifest}
                    fixedTownAssetBaseUrl={townMapAssetBaseUrl}
                    fixedTownSurfaceAvailable={townMapAvailable}
                    fixedTownSurfacePending={townMapSurfacePending}
                    fixedTownSurfaceMinZoom={FIXED_TOWN_SURFACE_MIN_ZOOM}
                    fixedTownOverviewSurfaceManifest={townMapOverviewManifestState.manifest}
                    fixedTownOverviewAssetBaseUrl={townMapOverviewAssetBaseUrl}
                    fixedTownOverviewSurfaceAvailable={townMapOverviewAvailable}
                    fixedTownOverviewSurfacePending={townMapOverviewSurfacePending}
                    fixedTownSurfaceGrayscale={false}
                    fixedTownSurfaceLockMinZoom={false}
                    fixedTownSurfaceFallbackBelowMinZoom={false}
                    fixedTownSurfaceFallbackScope="local"
                    fixedTownSurfaceUseOverviewRecovery
                    onBasemapModeChange={handleBasemapModeChange}
                    onFixedTownSurfaceFallback={handleFixedTownSurfaceFallback}
                    onFixedTownSurfaceViewportChange={setTownMapViewportBounds}
                    mapModeControl={mapModeControl}
                    preserveMobileMapFrameInFlow={TOWN_MAP_PROOF_ENABLED}
                    mapSurfaceStatus={personalPlaceMapSurfaceStatus}
                    mapStudioRuntime={ownerMapStudioRuntime}
                />

                <CreateMapModal
                    isOpen={addOpen}
                    mode="manage-assets"
                    savedAssets={savedAssets}
                    initialAssetKeys={existingAssetKeyList}
                    loading={addLoading || savedAssetsLoading}
                    interactionDisabled={!addReady || Boolean(savedAssetsLoadError)}
                    submitting={addSubmitting}
                    error={addError || savedAssetsLoadError}
                    onClose={() => {
                        if (addLoading || addSubmitting) return;
                        setAddOpen(false);
                        setAddReady(false);
                        setAddError('');
                    }}
                    onSubmit={handleManageAssets}
                />

                <MyMapCategoryOrderModal
                    open={categoryOrderOpen}
                    categories={categoryOrderOptions}
                    initialOrder={directory.categoryOrder}
                    initialCategoryShapes={mapStudioRuntimeSnapshot?.design?.pins?.categoryShapes}
                    submitting={categoryOrderSubmitting}
                    error={categoryOrderError}
                    onClose={() => {
                        if (categoryOrderSubmitting) return;
                        setCategoryOrderOpen(false);
                        setCategoryOrderError('');
                    }}
                    onSubmit={handleUpdateCategoryOrder}
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
                    onUpdateEmbed={handleUpdateEmbed}
                    annotations={printAnnotations.annotations}
                    annotationsReady={printAnnotationsReady}
                />

                <AddPersonalPlaceChooserModal
                    open={personalPlaceChooserOpen}
                    mapId={directory.id}
                    places={personalPlacesLibrary}
                    submitting={personalPlaceChooserSubmitting}
                    error={personalPlaceChooserError}
                    onClose={() => {
                        if (personalPlaceChooserSubmitting) return;
                        setPersonalPlaceChooserOpen(false);
                        setPersonalPlaceChooserError('');
                    }}
                    onAttach={handleAttachPersonalPlaces}
                    onCreateNew={startCreatingPersonalPlaceOnMap}
                />

                <PersonalPlaceEditorModal
                    open={personalPlaceModalOpen}
                    draft={personalPlaceDraft}
                    categories={personalPlaceCategories}
                    submitting={personalPlaceSubmitting}
                    error={personalPlaceError}
                    onClose={closePersonalPlaceModal}
                    onManageCategories={() => setPersonalPlaceCategoryManagerOpen(true)}
                    onSubmit={handleSavePersonalPlace}
                />

                <MapAssetShortDescriptionModal
                    open={Boolean(shortDescriptionRow)}
                    row={shortDescriptionRow}
                    submitting={shortDescriptionSubmitting}
                    error={shortDescriptionError}
                    onClose={closeResourceShortDescription}
                    onSubmit={handleSaveResourceShortDescription}
                />

                <PersonalPlaceCategoryManagerModal
                    open={personalPlaceCategoryManagerOpen}
                    categories={personalPlaceCategories}
                    busy={personalPlaceCategoryBusy}
                    error={personalPlaceCategoryError}
                    onClose={() => {
                        if (personalPlaceCategoryBusy) return;
                        setPersonalPlaceCategoryManagerOpen(false);
                        setPersonalPlaceCategoryError('');
                    }}
                    onCreate={handleCreatePersonalPlaceCategory}
                    onUpdate={handleUpdatePersonalPlaceCategory}
                />
                {confirmDialog}
            </>
        );
    }

    return (
        <>
            <div className="min-h-[calc(100vh-4rem)] bg-slate-50" data-route-cache-version={MY_MAP_ROUTE_CACHE_VERSION}>
                {!useDesktopOwnerLayout ? (
                        <MyMapMobileControls
                            directory={directory}
                            query={query}
                            onQueryChange={setQuery}
                            anchorState={anchorState}
                            onAddAssets={openManageAssets}
                            {...ownerToolbarActionProps}
                        />
                ) : null}

                <div className="mx-auto w-full max-w-[1800px] space-y-4 px-4 py-4 sm:px-6 sm:py-6 xl:px-10 2xl:px-14 xl:space-y-5">
                    {useDesktopOwnerLayout ? (
                        <div data-map-studio-top-row="true">
                            {ownerMapStudioPanel}
                        </div>
                    ) : null}

                    {useDesktopOwnerLayout ? (
                        <div>
                            <OwnerHeader
                                directory={directory}
                                query={query}
                                onQueryChange={setQuery}
                                anchorState={anchorState}
                                actionError={actionError}
                                onAddAssets={openManageAssets}
                                {...ownerToolbarActionProps}
                            />
                        </div>
                    ) : null}

                    {!useDesktopOwnerLayout ? ownerMapStudioPanel : null}

                    {useDesktopOwnerLayout ? (
                        <div
                            ref={desktopSelectionSnapRef}
                            aria-hidden="true"
                            className="h-px -mt-px scroll-mt-[56px] sm:scroll-mt-[64px]"
                        />
                    ) : null}

                    {mapStudioFilteredDirectory.summary.resourceCount === 0 ? (
                        <div className="space-y-4">
                            {personalPlacePickerActive || interactiveAnnotationEditorOpen ? (
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
                                    onClusterSelect={handleMapClusterSelect}
                                    onFocusHandled={handleMapFocusHandled}
                                    onResetView={clearMapSelection}
                                    onMapClick={personalPlacePickerActive ? handlePersonalPlaceMapClick : null}
                                    interactive
                                    {...classicMapStudioMapProps}
                                    markerMode={classicMarkerMode}
                                    placeNumberByKey={interactivePresentation.placeNumberByKey}
                                    emptyLabel={t('personalPlaceMapHint')}
                                    mapHeightClassName={resolveClassicMapHeightClass(studioMapHeight, 'desktop', true)}
                                    mapMinZoom={TOWN_MAP_PROOF_ENABLED ? CAREAROUND_BASEMAP_MIN_NATIVE_ZOOM : undefined}
                                    showZoomLevelCounter={TOWN_MAP_PROOF_ENABLED}
                                    minimumZoomCenter={TOWN_MAP_PROOF_ENABLED ? TOWN_MAP_PROOF_MINIMUM_ZOOM_CENTER : null}
                                    lockMinimumZoomCamera={TOWN_MAP_PROOF_ENABLED}
                                    basemapMode={interactiveBasemapMode}
                                    fixedTownSurfaceManifest={townMapManifestState.manifest}
                                    fixedTownAssetBaseUrl={townMapAssetBaseUrl}
                                    fixedTownSurfaceAvailable={townMapAvailable}
                                    fixedTownSurfacePending={townMapSurfacePending}
                                    fixedTownSurfaceMinZoom={FIXED_TOWN_SURFACE_MIN_ZOOM}
                                    fixedTownOverviewSurfaceManifest={townMapOverviewManifestState.manifest}
                                    fixedTownOverviewAssetBaseUrl={townMapOverviewAssetBaseUrl}
                                    fixedTownOverviewSurfaceAvailable={townMapOverviewAvailable}
                                    fixedTownOverviewSurfacePending={townMapOverviewSurfacePending}
                                    fixedTownSurfaceGrayscale={false}
                                    fixedTownSurfaceLockMinZoom={false}
                                    fixedTownSurfaceFallbackBelowMinZoom={false}
                                    fixedTownSurfaceFallbackScope="local"
                                    fixedTownSurfaceUseOverviewRecovery
                                    onBasemapModeChange={handleBasemapModeChange}
                                    onFixedTownSurfaceFallback={handleFixedTownSurfaceFallback}
                                    onFixedTownSurfaceViewportChange={setTownMapViewportBounds}
                                    mapModeControl={mapModeControl}
                                    mapOverlay={ownerInteractiveAnnotationOverlay}
                                    surfaceOverlay={interactiveAnnotationEditor.surfaceOverlay}
                                    surfaceStatus={personalPlaceMapSurfaceStatus}
                                />
                            ) : null}
                            <EmptyOwnerDirectory
                                onAddAssets={openManageAssets}
                                onAddPersonalPlace={openPersonalPlacePicker}
                            />
                        </div>
                    ) : (
                        <>
                            <SharedMapDirectoryList
                                presentation={interactivePresentation}
                                mode="owner"
                                layout={useDesktopOwnerLayout ? 'desktop' : 'responsive'}
                                onViewOnMap={handleViewOnMap}
                                onHoverPlaceStart={handleMapHoverStart}
                                onHoverPlaceEnd={handleMapHoverEnd}
                                onRemoveResource={resourceRemovalMode ? handleRemoveResource : null}
                                onEditPersonalPlace={handleEditPersonalPlace}
                                onEditResourceShortDescription={interactiveShortDescriptionMode
                                    ? handleEditResourceShortDescription
                                    : null}
                                onUpdateResourceNotes={handleUpdateResourceNotes}
                                highlightPlaceKey={activePlaceKey}
                                highlightPlaceKeys={activePlaceKeys}
                                selectionPlaceKey={highlightPlaceKey || selectedClusterPlaceKeys[0] || null}
                                selectionScrollRequest={selectionScrollRequest}
                                printLabelDetail={mapStudioInteractiveModel?.labels?.detail}
                                resourcePanelPlacement={mapStudioInteractiveModel?.layout?.resourcePanel}
                                interactiveLayoutPreset={mapStudioInteractiveModel?.layout?.preset}
                                interactiveMapSide={mapStudioInteractiveModel?.layout?.mapSide}
                                interactiveMapWidth={mapStudioInteractiveModel?.layout?.mapWidth}
                                interactiveResourceColumnCount={mapStudioInteractiveModel?.layout?.resourceColumnCount}
                                interactiveSideResourceColumnCount={mapStudioInteractiveModel?.layout?.sideResourceColumnCount}
                                cardBadgeMode={mapStudioInteractiveModel?.cardIdentity?.mode || 'number'}
                                showInteractiveNumberBadges={Boolean(mapStudioInteractiveModel?.cardIdentity?.showNumberBadge)}
                                numberedPinShapesByCategory={mapStudioInteractiveModel?.cardIdentity?.numberedPinShapesByCategory}
                                showDesktopHoverLogo
                                preserveMobileMapFrameInFlow={TOWN_MAP_PROOF_ENABLED}
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
                                        onMapClick={personalPlacePickerActive ? handlePersonalPlaceMapClick : null}
                                        interactive={!directoryMapInteractionSuspended}
                                        {...classicMapStudioMapProps}
                                        markerMode={classicMarkerMode}
                                        placeNumberByKey={interactivePresentation.placeNumberByKey}
                                        emptyLabel={query ? t('noMapPlacesMatchSearch') : t('mapNoPlacesYet')}
                                        mapHeightClassName={resolveClassicMapHeightClass(studioMapHeight, 'desktop')}
                                        mapMinZoom={TOWN_MAP_PROOF_ENABLED ? CAREAROUND_BASEMAP_MIN_NATIVE_ZOOM : undefined}
                                        showZoomLevelCounter={TOWN_MAP_PROOF_ENABLED}
                                        minimumZoomCenter={TOWN_MAP_PROOF_ENABLED ? TOWN_MAP_PROOF_MINIMUM_ZOOM_CENTER : null}
                                        lockMinimumZoomCamera={TOWN_MAP_PROOF_ENABLED}
                                        basemapMode={interactiveBasemapMode}
                                        fixedTownSurfaceManifest={townMapManifestState.manifest}
                                        fixedTownAssetBaseUrl={townMapAssetBaseUrl}
                                        fixedTownSurfaceAvailable={townMapAvailable}
                                        fixedTownSurfacePending={townMapSurfacePending}
                                        fixedTownSurfaceMinZoom={FIXED_TOWN_SURFACE_MIN_ZOOM}
                                        fixedTownOverviewSurfaceManifest={townMapOverviewManifestState.manifest}
                                        fixedTownOverviewAssetBaseUrl={townMapOverviewAssetBaseUrl}
                                        fixedTownOverviewSurfaceAvailable={townMapOverviewAvailable}
                                        fixedTownOverviewSurfacePending={townMapOverviewSurfacePending}
                                        fixedTownSurfaceGrayscale={false}
                                        fixedTownSurfaceLockMinZoom={false}
                                        fixedTownSurfaceFallbackBelowMinZoom={false}
                                        fixedTownSurfaceFallbackScope="local"
                                        fixedTownSurfaceUseOverviewRecovery
                                        onBasemapModeChange={handleBasemapModeChange}
                                        onFixedTownSurfaceFallback={handleFixedTownSurfaceFallback}
                                        onFixedTownSurfaceViewportChange={setTownMapViewportBounds}
                                        mapModeControl={mapModeControl}
                                        mapOverlay={ownerInteractiveAnnotationOverlay}
                                        surfaceOverlay={interactiveAnnotationEditor.surfaceOverlay}
                                        surfaceStatus={personalPlaceMapSurfaceStatus}
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
                                        onMapClick={personalPlacePickerActive ? handlePersonalPlaceMapClick : null}
                                        interactive={!directoryMapInteractionSuspended}
                                        {...classicMapStudioMapProps}
                                        markerMode={classicMarkerMode}
                                        placeNumberByKey={interactivePresentation.placeNumberByKey}
                                        emptyLabel={query ? t('noMapPlacesMatchSearch') : t('mapNoPlacesYet')}
                                        mapHeightClassName={resolveClassicMapHeightClass(studioMapHeight, 'mobile')}
                                        mapMinZoom={TOWN_MAP_PROOF_ENABLED ? CAREAROUND_BASEMAP_MIN_NATIVE_ZOOM : undefined}
                                        showZoomLevelCounter={TOWN_MAP_PROOF_ENABLED}
                                        minimumZoomCenter={TOWN_MAP_PROOF_ENABLED ? TOWN_MAP_PROOF_MINIMUM_ZOOM_CENTER : null}
                                        lockMinimumZoomCamera={TOWN_MAP_PROOF_ENABLED}
                                        basemapMode={interactiveBasemapMode}
                                        fixedTownSurfaceManifest={townMapManifestState.manifest}
                                        fixedTownAssetBaseUrl={townMapAssetBaseUrl}
                                        fixedTownSurfaceAvailable={townMapAvailable}
                                        fixedTownSurfacePending={townMapSurfacePending}
                                        fixedTownSurfaceMinZoom={FIXED_TOWN_SURFACE_MIN_ZOOM}
                                        fixedTownOverviewSurfaceManifest={townMapOverviewManifestState.manifest}
                                        fixedTownOverviewAssetBaseUrl={townMapOverviewAssetBaseUrl}
                                        fixedTownOverviewSurfaceAvailable={townMapOverviewAvailable}
                                        fixedTownOverviewSurfacePending={townMapOverviewSurfacePending}
                                        fixedTownSurfaceGrayscale={false}
                                        fixedTownSurfaceLockMinZoom={false}
                                        fixedTownSurfaceFallbackBelowMinZoom={false}
                                        fixedTownSurfaceFallbackScope="local"
                                        fixedTownSurfaceUseOverviewRecovery
                                        onBasemapModeChange={handleBasemapModeChange}
                                        onFixedTownSurfaceFallback={handleFixedTownSurfaceFallback}
                                        onFixedTownSurfaceViewportChange={setTownMapViewportBounds}
                                        mapModeControl={mapModeControl}
                                        mapOverlay={ownerInteractiveAnnotationOverlay}
                                        surfaceOverlay={interactiveAnnotationEditor.surfaceOverlay}
                                        surfaceStatus={personalPlaceMapSurfaceStatus}
                                    />
                                )}
                                mobileMapStickyClassName="sticky top-[56px] sm:top-[64px] z-[1090] -mx-4 bg-slate-50 px-4 pb-5 shadow-[0_18px_28px_-24px_rgba(15,23,42,0.45)] isolate"
                            />
                        </>
                    )}
                </div>
            </div>

            <CreateMapModal
                isOpen={addOpen}
                mode="manage-assets"
                savedAssets={savedAssets}
                initialAssetKeys={existingAssetKeyList}
                loading={addLoading || savedAssetsLoading}
                interactionDisabled={!addReady || Boolean(savedAssetsLoadError)}
                submitting={addSubmitting}
                error={addError || savedAssetsLoadError}
                onClose={() => {
                    if (addLoading || addSubmitting) return;
                    setAddOpen(false);
                    setAddReady(false);
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
                onUpdateEmbed={handleUpdateEmbed}
                annotations={printAnnotations.annotations}
                annotationsReady={printAnnotationsReady}
            />

            <AddPersonalPlaceChooserModal
                open={personalPlaceChooserOpen}
                mapId={directory.id}
                places={personalPlacesLibrary}
                submitting={personalPlaceChooserSubmitting}
                error={personalPlaceChooserError}
                onClose={() => {
                    if (personalPlaceChooserSubmitting) return;
                    setPersonalPlaceChooserOpen(false);
                    setPersonalPlaceChooserError('');
                }}
                onAttach={handleAttachPersonalPlaces}
                onCreateNew={startCreatingPersonalPlaceOnMap}
            />

            <PersonalPlaceEditorModal
                open={personalPlaceModalOpen}
                draft={personalPlaceDraft}
                categories={personalPlaceCategories}
                submitting={personalPlaceSubmitting}
                error={personalPlaceError}
                onClose={closePersonalPlaceModal}
                onManageCategories={() => setPersonalPlaceCategoryManagerOpen(true)}
                onSubmit={handleSavePersonalPlace}
            />

            <MapAssetShortDescriptionModal
                open={Boolean(shortDescriptionRow)}
                row={shortDescriptionRow}
                submitting={shortDescriptionSubmitting}
                error={shortDescriptionError}
                onClose={closeResourceShortDescription}
                onSubmit={handleSaveResourceShortDescription}
            />

            <PersonalPlaceCategoryManagerModal
                open={personalPlaceCategoryManagerOpen}
                categories={personalPlaceCategories}
                busy={personalPlaceCategoryBusy}
                error={personalPlaceCategoryError}
                onClose={() => {
                    if (personalPlaceCategoryBusy) return;
                    setPersonalPlaceCategoryManagerOpen(false);
                    setPersonalPlaceCategoryError('');
                }}
                onCreate={handleCreatePersonalPlaceCategory}
                onUpdate={handleUpdatePersonalPlaceCategory}
            />
            {confirmDialog}
        </>
    );
}
