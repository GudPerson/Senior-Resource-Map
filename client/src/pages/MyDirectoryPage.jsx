import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bookmark, ListChecks, Map as MapIcon, MapPinned, RefreshCw, Search, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import CreateMapModal from '../components/CreateMapModal.jsx';
import MyMapCard from '../components/MyMapCard.jsx';
import MyMapsEmptyState from '../components/MyMapsEmptyState.jsx';
import RenameMapModal from '../components/RenameMapModal.jsx';
import SavedAssetCard from '../components/SavedAssetCard.jsx';
import SavedAssetsEmptyState from '../components/SavedAssetsEmptyState.jsx';
import PersonalPlacesSection from '../components/personalPlaces/PersonalPlacesSection.jsx';
import MobileBottomSheet from '../components/mobile/MobileBottomSheet.jsx';
import { useConfirmDialog } from '../components/ConfirmDialog.jsx';
import { DASHBOARD_DESKTOP_SIDEBAR_CLASS_NAME, DashboardMobileNavigation, DashboardSidebar } from '../components/dashboard/DashboardNavigation.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import { useSavedAssets } from '../hooks/useSavedAssets.js';
import { api } from '../lib/api.js';
import { fetchMyMapsWithResilience, getMyMapsListStatus } from '../lib/myMapsLoading.js';
import {
    SAVED_ASSET_MAP_USAGE_FILTERS,
    filterSavedAssetsByMapUsage,
    getSavedAssetMapUsageCount,
    selectUnusedSavedAssets,
    summarizeSavedAssetRemoval,
} from '../lib/savedAssetBulkManagement.js';
import { buildSavedAssetKey } from '../lib/savedAssets.js';

const DIRECTORY_SECTIONS = {
    saved: 'saved-assets',
    maps: 'my-maps',
    places: 'my-places',
};

function getSortOptions(t) {
    return [
        { value: 'recent', label: t('recentlySaved') },
        { value: 'name-asc', label: t('nameAZ') },
        { value: 'name-desc', label: t('nameZA') },
    ];
}

function getMapSortOptions(t) {
    return [
        { value: 'recent', label: t('recentlyUpdated') },
        { value: 'name-asc', label: t('nameAZ') },
        { value: 'name-desc', label: t('nameZA') },
    ];
}

function getMapUsageFilterOptions(t) {
    return [
        { value: SAVED_ASSET_MAP_USAGE_FILTERS.all, label: t('allSavedResources') },
        { value: SAVED_ASSET_MAP_USAGE_FILTERS.used, label: t('usedInMyMapsFilter') },
        { value: SAVED_ASSET_MAP_USAGE_FILTERS.unused, label: t('notUsedInMyMapsFilter') },
    ];
}

function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
}

function sortAssets(items, sortOrder) {
    const copy = [...items];

    if (sortOrder === 'name-asc') {
        return copy.sort((a, b) => a.name.localeCompare(b.name));
    }

    if (sortOrder === 'name-desc') {
        return copy.sort((a, b) => b.name.localeCompare(a.name));
    }

    return copy.sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
    });
}

function sortMaps(items, sortOrder) {
    const copy = [...items];

    if (sortOrder === 'name-asc') {
        return copy.sort((a, b) => a.name.localeCompare(b.name));
    }

    if (sortOrder === 'name-desc') {
        return copy.sort((a, b) => b.name.localeCompare(a.name));
    }

    return copy.sort((a, b) => {
        const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return bTime - aTime;
    });
}

function formatSectionLabel(section, t) {
    if (section === DIRECTORY_SECTIONS.maps) return t('myMaps');
    if (section === DIRECTORY_SECTIONS.places) return 'My Places';
    return t('savedResources');
}

function parseDirectorySection(value) {
    return Object.values(DIRECTORY_SECTIONS).includes(value)
        ? value
        : DIRECTORY_SECTIONS.saved;
}

function SavedAssetsLoadingState() {
    return (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
                <div
                    key={index}
                    className="animate-pulse rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                    <div className="h-6 w-36 rounded-full bg-slate-100" />
                    <div className="mt-4 h-6 w-3/4 rounded bg-slate-100" />
                    <div className="mt-3 h-16 rounded-2xl bg-slate-100" />
                    <div className="mt-4 flex gap-2">
                        <div className="h-11 flex-1 rounded-xl bg-slate-100" />
                        <div className="h-11 flex-1 rounded-xl bg-slate-100" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function MyMapsLoadingState() {
    return (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 2 }).map((_, index) => (
                <div
                    key={index}
                    className="animate-pulse rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                    <div className="h-6 w-24 rounded-full bg-slate-100" />
                    <div className="mt-4 h-6 w-3/5 rounded bg-slate-100" />
                    <div className="mt-3 h-12 rounded-2xl bg-slate-100" />
                    <div className="mt-4 flex gap-2">
                        <div className="h-11 flex-1 rounded-xl bg-slate-100" />
                        <div className="h-11 flex-1 rounded-xl bg-slate-100" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function MyMapsLoadErrorState({ message, onRetry, retrying = false }) {
    const { t } = useLocale();
    return (
        <div className="rounded-3xl border border-dashed border-amber-200 bg-amber-50 px-6 py-14 text-center">
            <p className="text-lg font-semibold text-amber-900">{message || t('failedLoadMaps')}</p>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-amber-800/85">
                {t('myMapsLoadRetryHelp')}
            </p>
            <button
                type="button"
                onClick={onRetry}
                disabled={retrying}
                className="btn-primary mx-auto mt-5 justify-center disabled:cursor-not-allowed disabled:opacity-60"
            >
                <RefreshCw size={16} className={retrying ? 'animate-spin' : ''} />
                {retrying ? t('loadingResources') : t('phoneLoginTryAgainButton')}
            </button>
        </div>
    );
}

function SavedAssetsLoadErrorState({ message, onRetry, retrying = false }) {
    const { t } = useLocale();
    return (
        <div className="rounded-3xl border border-dashed border-amber-200 bg-amber-50 px-6 py-14 text-center">
            <p className="text-lg font-semibold text-amber-900">{t('savedResourcesLoadFailedTitle')}</p>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-amber-800/85">
                {message || t('savedResourcesLoadFailedHelp')}
            </p>
            <button
                type="button"
                onClick={onRetry}
                disabled={retrying}
                className="btn-primary mx-auto mt-5 justify-center disabled:cursor-not-allowed disabled:opacity-60"
            >
                <RefreshCw size={16} className={retrying ? 'animate-spin' : ''} />
                {retrying ? t('loadingResources') : t('savedResourcesLoadFailedAction')}
            </button>
        </div>
    );
}

function DirectoryTabs({ activeSection, onSelect }) {
    const { t } = useLocale();
    return (
        <div className="mt-6 inline-flex max-w-full flex-wrap rounded-2xl bg-slate-100 p-1.5 shadow-inner">
            {[
                { value: DIRECTORY_SECTIONS.saved, label: t('savedResources'), icon: Bookmark },
                { value: DIRECTORY_SECTIONS.maps, label: t('myMaps'), icon: MapIcon },
                { value: DIRECTORY_SECTIONS.places, label: 'My Places', icon: MapPinned },
            ].map((tab) => {
                const active = activeSection === tab.value;
                const Icon = tab.icon;
                return (
                    <button
                        key={tab.value}
                        type="button"
                        onClick={() => onSelect(tab.value)}
                        className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition-all duration-200 sm:px-5 ${
                            active
                                ? 'bg-white text-brand-700 shadow-sm ring-1 ring-slate-200'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <Icon size={18} strokeWidth={active ? 2.5 : 2} />
                        {tab.label}
                    </button>
                );
            })}
        </div>
    );
}

export default function MyDirectoryPage() {
    const { user, logout, isImpersonating } = useAuth();
    const { t } = useLocale();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { confirm: requestConfirmation, confirmDialog } = useConfirmDialog();
    const {
        savedAssets,
        savedAssetsLoading,
        savedAssetsLoadError,
        bulkPending: savedAssetsBulkPending,
        bulkRemoveUnusedSavedAssets,
        refreshSavedAssets,
        toggleSavedAsset,
        isSavedAssetPending,
    } = useSavedAssets();

    const initialSection = parseDirectorySection(searchParams.get('section'));

    const [activeSection, setActiveSection] = useState(initialSection);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState('recent');
    const [mapUsageFilter, setMapUsageFilter] = useState(SAVED_ASSET_MAP_USAGE_FILTERS.all);
    const [mapUsageByAssetKey, setMapUsageByAssetKey] = useState(new Map());
    const [mapUsageLoading, setMapUsageLoading] = useState(false);
    const [mapUsageLoaded, setMapUsageLoaded] = useState(false);
    const [mapUsageError, setMapUsageError] = useState('');
    const [savedSelectionMode, setSavedSelectionMode] = useState(false);
    const [selectedSavedAssetKeys, setSelectedSavedAssetKeys] = useState(new Set());
    const [bulkRemovalNotice, setBulkRemovalNotice] = useState('');
    const [mapSearchTerm, setMapSearchTerm] = useState('');
    const [mapSortOrder, setMapSortOrder] = useState('recent');
    const [actionError, setActionError] = useState('');
    const [maps, setMaps] = useState([]);
    const [mapsLoading, setMapsLoading] = useState(false);
    const [mapsLoaded, setMapsLoaded] = useState(false);
    const [mapsError, setMapsError] = useState('');
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [createSubmitting, setCreateSubmitting] = useState(false);
    const [createError, setCreateError] = useState('');
    const [renameTarget, setRenameTarget] = useState(null);
    const [renameSubmitting, setRenameSubmitting] = useState(false);
    const [renameError, setRenameError] = useState('');
    const [duplicatingMapId, setDuplicatingMapId] = useState(null);
    const [deletingMapId, setDeletingMapId] = useState(null);
    const [mobileSavedControlsOpen, setMobileSavedControlsOpen] = useState(false);
    const [mobileMapControlsOpen, setMobileMapControlsOpen] = useState(false);
    const isCompactDirectory = useMediaQuery('(max-width: 1023px)');
    const sortOptions = useMemo(() => getSortOptions(t), [t]);
    const mapSortOptions = useMemo(() => getMapSortOptions(t), [t]);
    const mapUsageFilterOptions = useMemo(() => getMapUsageFilterOptions(t), [t]);

    useEffect(() => {
        const nextSection = parseDirectorySection(searchParams.get('section'));
        setActiveSection(nextSection);
    }, [searchParams]);

    const normalizedQuery = normalizeText(searchTerm);

    const mapUsageReady = mapUsageLoaded && !mapUsageError;

    const filteredAssets = useMemo(() => {
        const searchMatches = normalizedQuery
            ? savedAssets.filter((asset) => {
                const haystack = [
                    asset.name,
                    asset.subCategory,
                    asset.address,
                    asset.resourceType === 'hard' ? 'place' : 'offering',
                ]
                    .map(normalizeText)
                    .join(' ');

                return haystack.includes(normalizedQuery);
            })
            : savedAssets;
        const usageMatches = mapUsageReady
            ? filterSavedAssetsByMapUsage(searchMatches, mapUsageByAssetKey, mapUsageFilter)
            : mapUsageFilter === SAVED_ASSET_MAP_USAGE_FILTERS.all
                ? searchMatches
                : [];

        return sortAssets(usageMatches, sortOrder);
    }, [mapUsageByAssetKey, mapUsageFilter, mapUsageReady, normalizedQuery, savedAssets, sortOrder]);

    const totalSavedCount = savedAssets.length;
    const hasSavedAssets = totalSavedCount > 0;
    const hasSearch = Boolean(normalizedQuery);
    const hasMapUsageFilter = mapUsageFilter !== SAVED_ASSET_MAP_USAGE_FILTERS.all;
    const hasSavedAssetFilters = hasSearch || hasMapUsageFilter;
    const hasResults = filteredAssets.length > 0;
    const visibleUnusedAssets = useMemo(
        () => selectUnusedSavedAssets(filteredAssets, mapUsageByAssetKey),
        [filteredAssets, mapUsageByAssetKey],
    );
    const selectedSavedAssets = useMemo(() => (
        visibleUnusedAssets.filter((asset) => (
            selectedSavedAssetKeys.has(buildSavedAssetKey(asset.resourceType, asset.resourceId))
        ))
    ), [selectedSavedAssetKeys, visibleUnusedAssets]);
    const normalizedMapQuery = normalizeText(mapSearchTerm);
    const filteredMaps = useMemo(() => {
        const matches = normalizedMapQuery
            ? maps.filter((map) => {
                const haystack = [map.name, map.description]
                    .map(normalizeText)
                    .join(' ');
                return haystack.includes(normalizedMapQuery);
            })
            : maps;

        return sortMaps(matches, mapSortOrder);
    }, [mapSortOrder, maps, normalizedMapQuery]);
    const hasMapSearch = Boolean(normalizedMapQuery);
    const hasFilteredMaps = filteredMaps.length > 0;
    const mapsListStatus = getMyMapsListStatus({
        mapsLoading,
        mapsLoaded,
        mapsError,
        mapCount: maps.length,
    });

    const loadSavedAssetMapUsage = useCallback(async () => {
        setMapUsageLoading(true);
        setMapUsageError('');
        try {
            const response = await api.getSavedAssetMapUsage();
            const usageItems = Array.isArray(response?.items) ? response.items : [];
            setMapUsageByAssetKey(new Map(usageItems.map((item) => [
                item.assetKey || buildSavedAssetKey(item.resourceType, item.resourceId),
                item,
            ])));
            setMapUsageLoaded(true);
            return usageItems;
        } catch (err) {
            console.error(err);
            setMapUsageError(err.message || t('myMapUsageLoadFailed'));
            setMapUsageLoaded(true);
            return [];
        } finally {
            setMapUsageLoading(false);
        }
    }, [t]);

    useEffect(() => {
        if (activeSection !== DIRECTORY_SECTIONS.saved || mapUsageLoaded || mapUsageLoading) return;
        void loadSavedAssetMapUsage();
    }, [activeSection, loadSavedAssetMapUsage, mapUsageLoaded, mapUsageLoading]);

    useEffect(() => {
        if (!mapUsageReady) return;
        const savedKeys = new Set(savedAssets.map((asset) => buildSavedAssetKey(asset.resourceType, asset.resourceId)));
        const protectedKeys = new Set(
            savedAssets
                .filter((asset) => getSavedAssetMapUsageCount(asset, mapUsageByAssetKey) > 0)
                .map((asset) => buildSavedAssetKey(asset.resourceType, asset.resourceId)),
        );
        setSelectedSavedAssetKeys((current) => new Set(
            [...current].filter((assetKey) => savedKeys.has(assetKey) && !protectedKeys.has(assetKey)),
        ));
    }, [mapUsageByAssetKey, mapUsageReady, savedAssets]);

    const loadMaps = useCallback(async () => {
        setMapsLoading(true);
        setMapsError('');
        try {
            const items = await fetchMyMapsWithResilience(() => api.getMyMaps());
            setMaps(Array.isArray(items) ? items : []);
            setMapsLoaded(true);
            return items;
        } catch (err) {
            console.error(err);
            setMapsError(err.message || t('failedLoadMaps'));
            setMapsLoaded(false);
            return [];
        } finally {
            setMapsLoading(false);
        }
    }, [t]);

    useEffect(() => {
        if (activeSection !== DIRECTORY_SECTIONS.maps || mapsLoaded) return;
        loadMaps();
    }, [activeSection, loadMaps, mapsLoaded]);

    async function handleRemove(asset) {
        if (!mapUsageReady) {
            setActionError(t('myMapUsageRequiredForRemoval'));
            return;
        }

        const mapUsageCount = getSavedAssetMapUsageCount(asset, mapUsageByAssetKey);
        const details = [];
        if (mapUsageCount > 0) {
            details.push(t('removeMappedSavedResourceWarning', {
                count: mapUsageCount,
                label: mapUsageCount === 1 ? t('map') : t('maps'),
            }));
        }
        if (asset.resourceType === 'soft') {
            details.push(t('removeSavedOfferingCalendarWarning'));
        }

        const confirmed = await requestConfirmation({
            title: t('removeSavedResourceConfirmTitle'),
            message: t('removeSavedResourceConfirmMessage', {
                name: asset.name || t('savedResourceFallbackName'),
            }),
            details,
            confirmLabel: t('removeFromMyDirectory'),
            loadingLabel: t('removing'),
            tone: mapUsageCount > 0 ? 'warning' : 'danger',
        });
        if (!confirmed) return;

        setActionError('');
        setBulkRemovalNotice('');

        try {
            await toggleSavedAsset(asset.resourceType, asset.resourceId, {
                name: asset.name,
                subCategory: asset.subCategory,
                address: asset.address,
                lat: asset.lat,
                lng: asset.lng,
                detailPath: asset.detailPath,
            });
        } catch (err) {
            setActionError(err.message || t('failedRemoveSavedResource'));
        }
    }

    function cancelSavedSelection() {
        setSavedSelectionMode(false);
        setSelectedSavedAssetKeys(new Set());
    }

    function beginSavedSelection() {
        if (!mapUsageReady || visibleUnusedAssets.length === 0) return;
        setMapUsageFilter(SAVED_ASSET_MAP_USAGE_FILTERS.unused);
        setSelectedSavedAssetKeys(new Set());
        setBulkRemovalNotice('');
        setActionError('');
        setSavedSelectionMode(true);
    }

    function handleSavedAssetSelection(asset, selected) {
        if (getSavedAssetMapUsageCount(asset, mapUsageByAssetKey) > 0) return;
        const assetKey = buildSavedAssetKey(asset.resourceType, asset.resourceId);
        setSelectedSavedAssetKeys((current) => {
            const next = new Set(current);
            if (selected) {
                next.add(assetKey);
            } else {
                next.delete(assetKey);
            }
            return next;
        });
    }

    function selectAllVisibleUnusedAssets() {
        setSelectedSavedAssetKeys(new Set(visibleUnusedAssets.map((asset) => (
            buildSavedAssetKey(asset.resourceType, asset.resourceId)
        ))));
    }

    async function handleBulkRemoveSavedAssets() {
        if (!mapUsageReady || selectedSavedAssets.length === 0 || savedAssetsBulkPending) return;
        const impact = summarizeSavedAssetRemoval(selectedSavedAssets);
        const details = [t('bulkRemoveMyMapProtection')];
        if (impact.offeringCount > 0) {
            details.push(t('bulkRemoveSavedOfferingCalendarWarning', { count: impact.offeringCount }));
        }

        const confirmed = await requestConfirmation({
            title: t('bulkRemoveSavedResourcesTitle'),
            message: t('bulkRemoveSavedResourcesMessage', { count: impact.resourceCount }),
            details,
            confirmLabel: t('bulkRemoveSavedResourcesAction', { count: impact.resourceCount }),
            loadingLabel: t('removing'),
            tone: 'danger',
        });
        if (!confirmed) return;

        setActionError('');
        setBulkRemovalNotice('');
        try {
            const result = await bulkRemoveUnusedSavedAssets(selectedSavedAssets);
            if (!result) return;

            if (result.protectedCount > 0) {
                setBulkRemovalNotice(t('bulkRemoveSavedResourcesProtectedResult', {
                    removed: result.removedCount,
                    protected: result.protectedCount,
                }));
            } else {
                setBulkRemovalNotice(t('bulkRemoveSavedResourcesResult', { count: result.removedCount }));
            }
            cancelSavedSelection();
            await loadSavedAssetMapUsage();
        } catch (err) {
            console.error(err);
            setActionError(err.message || t('bulkRemoveSavedResourcesFailed'));
        }
    }

    function switchSection(section) {
        cancelSavedSelection();
        const next = new URLSearchParams(searchParams);
        if (section === DIRECTORY_SECTIONS.saved) {
            next.delete('section');
        } else {
            next.set('section', section);
        }
        setSearchParams(next, { replace: true });
    }

    async function handleCreateMap({ name, assets }) {
        setCreateSubmitting(true);
        setCreateError('');
        try {
            const created = await api.createMyMap({ name, assets });
            setCreateModalOpen(false);
            setMapsLoaded(false);
            setMaps((items) => [created, ...items]);
            navigate(`/my-directory/maps/${created.id}`);
        } catch (err) {
            console.error(err);
            setCreateError(err.message || t('failedCreateMap'));
        } finally {
            setCreateSubmitting(false);
        }
    }

    async function handleSaveCreateCatalogAsset(asset) {
        const key = `${asset.resourceType}-${asset.resourceId}`;
        const existing = savedAssets.find((savedAsset) => (
            `${savedAsset.resourceType}-${savedAsset.resourceId}` === key
        ));
        if (existing) return existing;

        const result = await toggleSavedAsset(
            asset.resourceType,
            asset.resourceId,
            asset,
        );
        if (!result?.saved || !result?.item) {
            throw new Error(t('failedSaveResourceFromMap'));
        }
        return result.item;
    }

    async function handleRenameMap(name) {
        if (!renameTarget) return;
        setRenameSubmitting(true);
        setRenameError('');
        try {
            const updated = await api.updateMyMap(renameTarget.id, { name });
            setMaps((items) => items.map((item) => (
                item.id === updated.id
                    ? { ...item, ...updated }
                    : item
            )));
            setRenameTarget(null);
        } catch (err) {
            console.error(err);
            setRenameError(err.message || t('failedRenameMap'));
        } finally {
            setRenameSubmitting(false);
        }
    }

    async function handleDuplicateMap(map) {
        setDuplicatingMapId(map.id);
        setMapsError('');
        try {
            const copied = await api.duplicateMyMap(map.id);
            setMaps((items) => [copied, ...items.filter((item) => item.id !== copied.id)]);
            navigate(`/my-directory/maps/${copied.id}`);
        } catch (err) {
            console.error(err);
            setMapsError(err.message || t('failedDuplicateMap'));
        } finally {
            setDuplicatingMapId(null);
        }
    }

    async function handleDeleteMap(map) {
        const confirmed = await requestConfirmation({
            title: t('delete'),
            message: t('deleteMapConfirm', { name: map.name }),
            confirmLabel: t('delete'),
            loadingLabel: `${t('delete')}...`,
            tone: 'danger',
        });
        if (!confirmed) return;

        setDeletingMapId(map.id);
        setMapsError('');
        try {
            await api.deleteMyMap(map.id);
            setMaps((items) => items.filter((item) => item.id !== map.id));
        } catch (err) {
            console.error(err);
            setMapsError(err.message || t('failedDeleteMap'));
        } finally {
            setDeletingMapId(null);
        }
    }

    const sectionLabel = formatSectionLabel(activeSection, t);

    async function handleLogout() {
        const impersonationExit = isImpersonating;
        await logout();
        navigate(impersonationExit ? '/dashboard' : '/');
    }

    return (
        <>
            {confirmDialog}

            <div className="flex min-h-[calc(100vh-4rem)] bg-slate-50">
                <aside className={DASHBOARD_DESKTOP_SIDEBAR_CLASS_NAME}>
                    <DashboardSidebar
                        isImpersonating={isImpersonating}
                        onLogout={handleLogout}
                        user={user}
                    />
                </aside>

                <main className="flex-1 overflow-auto">
                    <DashboardMobileNavigation
                        isImpersonating={isImpersonating}
                        onLogout={handleLogout}
                        sectionContextLabel={t('myDirectory')}
                        sectionLabel={sectionLabel}
                        user={user}
                    />
                    <div className="mx-auto w-full max-w-[1680px] px-4 py-8 sm:px-6 lg:px-8 2xl:px-10">
                        <header className={`mb-6 border border-slate-200 bg-white shadow-sm ${isCompactDirectory ? 'rounded-[28px] px-4 py-5' : 'rounded-3xl px-5 py-6 sm:px-6'}`}>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">{sectionLabel}</p>
                            <h1 className={`mt-2 font-bold tracking-tight text-slate-900 ${isCompactDirectory ? 'text-[1.9rem]' : 'text-3xl'}`}>{t('myDirectory')}</h1>
                            <p className={`mt-2 max-w-2xl text-slate-500 ${isCompactDirectory ? 'text-[13px] leading-6' : 'text-sm'}`}>
                                {activeSection === DIRECTORY_SECTIONS.maps
                                    ? t('directoryMapsIntro')
                                    : activeSection === DIRECTORY_SECTIONS.places
                                        ? 'Private places you can reuse across more than one map.'
                                        : t('directorySavedIntro')}
                            </p>
                            <DirectoryTabs activeSection={activeSection} onSelect={switchSection} />
                        </header>

                        {activeSection === DIRECTORY_SECTIONS.saved ? (
                            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                                <div className="mb-4 flex items-center justify-between gap-3 lg:hidden">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">{t('savedResources')}</p>
                                        <p className="mt-1 text-sm font-semibold text-slate-600">
                                            {t('savedResourcesCount', { count: totalSavedCount, label: totalSavedCount === 1 ? t('resource') : t('resources') })}
                                            {hasSavedAssetFilters ? ` • ${t('matchingCount', { count: filteredAssets.length })}` : ''}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setMobileSavedControlsOpen(true)}
                                        className="btn-ghost min-h-[44px] justify-center px-4 text-sm"
                                    >
                                        <SlidersHorizontal size={16} />
                                        {t('refine')}
                                    </button>
                                </div>

                                <div className="hidden border-b border-slate-100 pb-5 lg:flex lg:flex-row lg:items-end lg:justify-between lg:gap-4">
                                    <div className="min-w-0 flex-1">
                                        <label htmlFor="saved-assets-search" className="block text-sm font-semibold text-slate-700">
                                            {t('searchSavedResources')}
                                        </label>
                                        <div className="relative mt-2">
                                            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                id="saved-assets-search"
                                                type="search"
                                                value={searchTerm}
                                                onChange={(event) => setSearchTerm(event.target.value)}
                                                placeholder={t('searchSavedResourcesPlaceholder')}
                                                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-12 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                                            />
                                            {searchTerm ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setSearchTerm('')}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                                                    aria-label={t('clearSearch')}
                                                >
                                                    <X size={16} />
                                                </button>
                                            ) : null}
                                        </div>
                                    </div>

                                    <div className="w-full lg:w-56">
                                        <label htmlFor="saved-assets-map-usage" className="block text-sm font-semibold text-slate-700">
                                            {t('myMapUsage')}
                                        </label>
                                        <div className="relative mt-2">
                                            <MapPinned size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <select
                                                id="saved-assets-map-usage"
                                                value={mapUsageFilter}
                                                onChange={(event) => {
                                                    setMapUsageFilter(event.target.value);
                                                    setSelectedSavedAssetKeys(new Set());
                                                }}
                                                disabled={!mapUsageReady}
                                                className="w-full appearance-none rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:cursor-wait disabled:opacity-60"
                                            >
                                                {mapUsageFilterOptions.map((option) => (
                                                    <option key={option.value} value={option.value}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="w-full lg:w-56">
                                        <label htmlFor="saved-assets-sort" className="block text-sm font-semibold text-slate-700">
                                            {t('sort')}
                                        </label>
                                        <div className="relative mt-2">
                                            <SlidersHorizontal size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <select
                                                id="saved-assets-sort"
                                                value={sortOrder}
                                                onChange={(event) => setSortOrder(event.target.value)}
                                                className="w-full appearance-none rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                                            >
                                                {sortOptions.map((option) => (
                                                    <option key={option.value} value={option.value}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-sm font-medium text-slate-600">
                                        {t('savedResourcesCount', { count: totalSavedCount, label: totalSavedCount === 1 ? t('resource') : t('resources') })}
                                        {hasSavedAssetFilters ? ` • ${t('matchingCount', { count: filteredAssets.length })}` : ''}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {bulkRemovalNotice ? (
                                            <p className="text-sm font-semibold text-teal-700" role="status">{bulkRemovalNotice}</p>
                                        ) : null}
                                        {actionError ? (
                                            <p className="text-sm font-medium text-red-600" role="alert">{actionError}</p>
                                        ) : null}
                                        {!savedSelectionMode && hasSavedAssets ? (
                                            <button
                                                type="button"
                                                onClick={beginSavedSelection}
                                                disabled={!mapUsageReady || visibleUnusedAssets.length === 0 || savedAssetsBulkPending}
                                                className="btn-ghost min-h-[44px] justify-center border border-slate-200 px-4 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                <ListChecks size={16} />
                                                {t('selectToRemove')}
                                            </button>
                                        ) : null}
                                    </div>
                                </div>

                                {mapUsageLoading ? (
                                    <p className="mb-4 text-sm font-medium text-slate-500" role="status">{t('loadingMyMapUsage')}</p>
                                ) : mapUsageError ? (
                                    <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between" role="alert">
                                        <span>{mapUsageError} {t('bulkRemovalPaused')}</span>
                                        <button type="button" onClick={loadSavedAssetMapUsage} className="btn-ghost min-h-[40px] justify-center px-3 text-sm">
                                            <RefreshCw size={15} />
                                            {t('retry')}
                                        </button>
                                    </div>
                                ) : null}

                                {savedSelectionMode ? (
                                    <div className="sticky bottom-4 z-30 mb-4 flex flex-col gap-3 rounded-2xl border border-brand-200 bg-white/95 p-3 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:justify-between" role="region" aria-label={t('bulkRemoveSavedResourcesTitle')}>
                                        <div>
                                            <p className="text-sm font-bold text-slate-900">
                                                {t('selectedSavedResourcesCount', { count: selectedSavedAssets.length })}
                                            </p>
                                            <p className="mt-0.5 text-xs text-slate-500">{t('myMapResourcesProtectedHelp')}</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <button type="button" onClick={selectAllVisibleUnusedAssets} disabled={visibleUnusedAssets.length === 0 || savedAssetsBulkPending} className="btn-ghost min-h-[42px] justify-center px-3 text-sm">
                                                {t('selectAllShown')}
                                            </button>
                                            <button type="button" onClick={() => setSelectedSavedAssetKeys(new Set())} disabled={selectedSavedAssets.length === 0 || savedAssetsBulkPending} className="btn-ghost min-h-[42px] justify-center px-3 text-sm">
                                                {t('clearSelection')}
                                            </button>
                                            <button type="button" onClick={cancelSavedSelection} disabled={savedAssetsBulkPending} className="btn-ghost min-h-[42px] justify-center px-3 text-sm">
                                                {t('cancel')}
                                            </button>
                                            <button type="button" onClick={handleBulkRemoveSavedAssets} disabled={selectedSavedAssets.length === 0 || savedAssetsBulkPending} className="btn-danger min-h-[42px] justify-center px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60">
                                                <Trash2 size={15} />
                                                {savedAssetsBulkPending ? t('removing') : t('bulkRemoveSavedResourcesAction', { count: selectedSavedAssets.length })}
                                            </button>
                                        </div>
                                    </div>
                                ) : null}

                                {savedAssetsLoading && !hasSavedAssets ? (
                                    <SavedAssetsLoadingState />
                                ) : savedAssetsLoadError && !hasSavedAssets ? (
                                    <SavedAssetsLoadErrorState
                                        message={savedAssetsLoadError}
                                        onRetry={refreshSavedAssets}
                                        retrying={savedAssetsLoading}
                                    />
                                ) : !hasSavedAssets ? (
                                    <SavedAssetsEmptyState mode="empty" />
                                ) : !hasResults ? (
                                    <SavedAssetsEmptyState
                                        hasActiveFilters={hasSavedAssetFilters}
                                        mode="no-results"
                                        onClearFilters={() => {
                                            setSearchTerm('');
                                            setMapUsageFilter(SAVED_ASSET_MAP_USAGE_FILTERS.all);
                                            setSelectedSavedAssetKeys(new Set());
                                        }}
                                        searchTerm={searchTerm}
                                        onClearSearch={() => setSearchTerm('')}
                                    />
                                ) : (
                                    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                                        {filteredAssets.map((asset) => (
                                            <SavedAssetCard
                                                key={asset.assetKey || `${asset.resourceType}-${asset.resourceId}`}
                                                asset={asset}
                                                mapUsageCount={getSavedAssetMapUsageCount(asset, mapUsageByAssetKey)}
                                                mapUsageKnown={mapUsageReady}
                                                removing={isSavedAssetPending(asset.resourceType, asset.resourceId) || savedAssetsBulkPending}
                                                onRemove={handleRemove}
                                                onSelectionChange={handleSavedAssetSelection}
                                                selected={selectedSavedAssetKeys.has(buildSavedAssetKey(asset.resourceType, asset.resourceId))}
                                                selectionDisabled={getSavedAssetMapUsageCount(asset, mapUsageByAssetKey) > 0}
                                                selectionMode={savedSelectionMode}
                                            />
                                        ))}
                                    </div>
                                )}
                            </section>
                        ) : activeSection === DIRECTORY_SECTIONS.maps ? (
                            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                                <div className="mb-4 flex items-center justify-between gap-3 lg:hidden">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">{t('myMaps')}</p>
                                        <p className="mt-1 text-sm font-semibold text-slate-600">
                                            {maps.length} {maps.length === 1 ? t('map') : t('maps')}
                                            {hasMapSearch ? ` • ${t('matchingCount', { count: filteredMaps.length })}` : ''}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setMobileMapControlsOpen(true)}
                                        className="btn-ghost min-h-[44px] justify-center px-4 text-sm"
                                    >
                                        <SlidersHorizontal size={16} />
                                        {t('refine')}
                                    </button>
                                </div>

                                <div className="flex flex-col gap-4 border-b border-slate-100 pb-5">
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-700">{t('mapsBuiltFromSaved')}</p>
                                            <p className="mt-1 text-sm text-slate-500">
                                                {t('mapsBuiltFromSavedHelp')}
                                            </p>
                                        </div>
                                        <button type="button" onClick={() => setCreateModalOpen(true)} className="btn-primary justify-center">
                                            {t('createMap')}
                                        </button>
                                    </div>

                                    <div className="hidden gap-4 lg:flex lg:flex-row lg:items-end">
                                        <div className="min-w-0 flex-1">
                                            <label htmlFor="my-maps-search" className="block text-sm font-semibold text-slate-700">
                                                {t('searchMaps')}
                                            </label>
                                            <div className="relative mt-2">
                                                <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input
                                                    id="my-maps-search"
                                                    type="search"
                                                    value={mapSearchTerm}
                                                    onChange={(event) => setMapSearchTerm(event.target.value)}
                                                    placeholder={t('searchMapsPlaceholder')}
                                                    className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-12 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                                                />
                                                {mapSearchTerm ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setMapSearchTerm('')}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                                                        aria-label={t('clearMapSearch')}
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                ) : null}
                                            </div>
                                        </div>

                                        <div className="w-full lg:w-56">
                                            <label htmlFor="my-maps-sort" className="block text-sm font-semibold text-slate-700">
                                            {t('sort')}
                                            </label>
                                            <div className="relative mt-2">
                                                <SlidersHorizontal size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <select
                                                    id="my-maps-sort"
                                                    value={mapSortOrder}
                                                    onChange={(event) => setMapSortOrder(event.target.value)}
                                                    className="w-full appearance-none rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                                                >
                                                    {mapSortOptions.map((option) => (
                                                        <option key={option.value} value={option.value}>
                                                            {option.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-sm font-medium text-slate-600">
                                        {maps.length} {maps.length === 1 ? t('map') : t('maps')}
                                        {hasMapSearch ? ` • ${t('matchingCount', { count: filteredMaps.length })}` : ''}
                                    </p>
                                    {mapsError ? (
                                        <p className="text-sm font-medium text-red-600">{mapsError}</p>
                                    ) : null}
                                </div>

                                {mapsListStatus === 'loading' ? (
                                    <MyMapsLoadingState />
                                ) : mapsListStatus === 'load-error' ? (
                                    <MyMapsLoadErrorState
                                        message={mapsError}
                                        onRetry={loadMaps}
                                        retrying={mapsLoading}
                                    />
                                ) : mapsListStatus === 'empty' ? (
                                    <MyMapsEmptyState hasSavedAssets={hasSavedAssets} onCreate={() => setCreateModalOpen(true)} />
                                ) : !hasFilteredMaps ? (
                                    <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center">
                                        <p className="text-lg font-semibold text-slate-700">{t('noMapsMatchTitle')}</p>
                                        <p className="mt-2 text-sm text-slate-500">{t('noMapsMatchDescription')}</p>
                                        <button type="button" onClick={() => setMapSearchTerm('')} className="btn-ghost mt-5">
                                            {t('clearSearch')}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                        {filteredMaps.map((map) => (
                                            <MyMapCard
                                                key={map.id}
                                                map={map}
                                                duplicating={duplicatingMapId === map.id}
                                                deleting={deletingMapId === map.id}
                                                onDuplicate={handleDuplicateMap}
                                                onRename={(item) => {
                                                    setRenameError('');
                                                    setRenameTarget(item);
                                                }}
                                                onDelete={handleDeleteMap}
                                            />
                                        ))}
                                    </div>
                                )}
                            </section>
                        ) : (
                            <PersonalPlacesSection />
                        )}
                    </div>
                </main>
            </div>

            <CreateMapModal
                isOpen={createModalOpen}
                mode="create"
                savedAssets={savedAssets}
                submitting={createSubmitting}
                error={createError}
                allowCatalogSearch
                onSaveCatalogAsset={handleSaveCreateCatalogAsset}
                onClose={() => {
                    if (createSubmitting) return;
                    setCreateModalOpen(false);
                    setCreateError('');
                }}
                onSubmit={handleCreateMap}
            />

            <RenameMapModal
                isOpen={Boolean(renameTarget)}
                map={renameTarget}
                submitting={renameSubmitting}
                error={renameError}
                onClose={() => {
                    if (renameSubmitting) return;
                    setRenameTarget(null);
                    setRenameError('');
                }}
                onSubmit={handleRenameMap}
            />

            <MobileBottomSheet
                open={activeSection === DIRECTORY_SECTIONS.saved && mobileSavedControlsOpen}
                onOpenChange={setMobileSavedControlsOpen}
                title={t('filterSavedResources')}
                description={t('filterSavedResourcesDescription')}
                headerActions={(
                    <button type="button" onClick={() => setMobileSavedControlsOpen(false)} className="btn-ghost px-3 py-2 text-[13px] leading-none whitespace-nowrap">
                        {t('done')}
                    </button>
                )}
            >
                <div className="space-y-4 pb-2">
                    <div>
                        <label htmlFor="saved-assets-search-mobile" className="block text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--color-text-muted)' }}>
                            {t('searchSavedResources')}
                        </label>
                        <div className="relative mt-2">
                            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                id="saved-assets-search-mobile"
                                type="search"
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                placeholder={t('searchSavedResourcesPlaceholder')}
                                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-12 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                            />
                            {searchTerm ? (
                                <button
                                    type="button"
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                                    aria-label={t('clearSearch')}
                                >
                                    <X size={16} />
                                </button>
                            ) : null}
                        </div>
                    </div>

                    <div>
                        <label htmlFor="saved-assets-map-usage-mobile" className="block text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--color-text-muted)' }}>
                            {t('myMapUsage')}
                        </label>
                        <div className="relative mt-2">
                            <MapPinned size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <select
                                id="saved-assets-map-usage-mobile"
                                value={mapUsageFilter}
                                onChange={(event) => {
                                    setMapUsageFilter(event.target.value);
                                    setSelectedSavedAssetKeys(new Set());
                                }}
                                disabled={!mapUsageReady}
                                className="w-full appearance-none rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:cursor-wait disabled:opacity-60"
                            >
                                {mapUsageFilterOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label htmlFor="saved-assets-sort-mobile" className="block text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--color-text-muted)' }}>
                            {t('sort')}
                        </label>
                        <div className="relative mt-2">
                            <SlidersHorizontal size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <select
                                id="saved-assets-sort-mobile"
                                value={sortOrder}
                                onChange={(event) => setSortOrder(event.target.value)}
                                className="w-full appearance-none rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                            >
                                    {sortOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </MobileBottomSheet>

            <MobileBottomSheet
                open={activeSection === DIRECTORY_SECTIONS.maps && mobileMapControlsOpen}
                onOpenChange={setMobileMapControlsOpen}
                title={t('refineMaps')}
                description={t('refineMapsDescription')}
                headerActions={(
                    <button type="button" onClick={() => setMobileMapControlsOpen(false)} className="btn-ghost px-3 py-2 text-[13px] leading-none whitespace-nowrap">
                        {t('done')}
                    </button>
                )}
            >
                <div className="space-y-4 pb-2">
                    <div>
                        <label htmlFor="my-maps-search-mobile" className="block text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--color-text-muted)' }}>
                            {t('searchMaps')}
                        </label>
                        <div className="relative mt-2">
                            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                id="my-maps-search-mobile"
                                type="search"
                                value={mapSearchTerm}
                                onChange={(event) => setMapSearchTerm(event.target.value)}
                                placeholder={t('searchMapsPlaceholder')}
                                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-12 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                            />
                            {mapSearchTerm ? (
                                <button
                                    type="button"
                                    onClick={() => setMapSearchTerm('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                                    aria-label={t('clearMapSearch')}
                                >
                                    <X size={16} />
                                </button>
                            ) : null}
                        </div>
                    </div>

                    <div>
                        <label htmlFor="my-maps-sort-mobile" className="block text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--color-text-muted)' }}>
                            {t('sort')}
                        </label>
                        <div className="relative mt-2">
                            <SlidersHorizontal size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <select
                                id="my-maps-sort-mobile"
                                value={mapSortOrder}
                                onChange={(event) => setMapSortOrder(event.target.value)}
                                className="w-full appearance-none rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                            >
                                    {mapSortOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </MobileBottomSheet>
        </>
    );
}
