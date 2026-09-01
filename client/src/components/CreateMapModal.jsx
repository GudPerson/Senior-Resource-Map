import { useEffect, useId, useMemo, useState } from 'react';
import { Heart, LoaderCircle, Map, RefreshCw, Search, X } from 'lucide-react';

import { api } from '../lib/api.js';
import { buildSavedAssetKey } from '../lib/savedAssets.js';
import { handleModalKeyboardEvent } from '../lib/modalKeyboard.js';
import {
    filterManageMapResourceCatalog,
    loadManageMapResourceCatalog,
    MANAGE_MAP_CATALOG_MIN_QUERY_LENGTH,
} from '../lib/manageMapResourceCatalog.js';
import { useLocale } from '../contexts/LocaleContext.jsx';

const EMPTY_ASSET_KEYS = [];

function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
}

function typeLabel(resourceType, t) {
    return resourceType === 'hard' ? t('placeType') : t('offeringType');
}

export default function CreateMapModal({
    isOpen,
    mode = 'create',
    savedAssets = [],
    initialAssetKeys = EMPTY_ASSET_KEYS,
    loading = false,
    interactionDisabled = false,
    submitting = false,
    error = '',
    allowCatalogSearch = false,
    onSaveCatalogAsset = null,
    onClose,
    onSubmit,
}) {
    const { t } = useLocale();
    const [name, setName] = useState('');
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('all');
    const [selectedKeys, setSelectedKeys] = useState(new Set());
    const [validationError, setValidationError] = useState('');
    const [catalogAssets, setCatalogAssets] = useState([]);
    const [catalogStatus, setCatalogStatus] = useState('idle');
    const [catalogLoadVersion, setCatalogLoadVersion] = useState(0);
    const [catalogActionError, setCatalogActionError] = useState('');
    const [catalogSavingKeys, setCatalogSavingKeys] = useState(new Set());
    const titleId = useId();

    const isCreateMode = mode === 'create';
    const busy = loading || submitting;
    const canSearchCatalog = allowCatalogSearch && typeof onSaveCatalogAsset === 'function';
    const catalogActionBusy = catalogSavingKeys.size > 0;
    const dialogBusy = busy || catalogActionBusy;
    const normalizedQuery = normalizeText(query);
    const initialAssetKeySignature = useMemo(() => JSON.stringify(
        [...new Set(initialAssetKeys.map((key) => String(key)))].sort(),
    ), [initialAssetKeys]);

    const filteredAssets = useMemo(() => {
        let assets = savedAssets;

        if (filter !== 'all') {
            assets = assets.filter(a => a.resourceType === filter);
        }

        const normalized = normalizeText(query);
        if (!normalized) return assets;

        return assets.filter((asset) => (
            [asset.name, asset.subCategory, asset.address, typeLabel(asset.resourceType, t)]
                .map(normalizeText)
                .join(' ')
                .includes(normalized)
        ));
    }, [query, filter, savedAssets, t]);
    const savedAssetKeys = useMemo(() => new Set(
        savedAssets.map((asset) => buildSavedAssetKey(asset.resourceType, asset.resourceId)),
    ), [savedAssets]);
    const catalogMatches = useMemo(() => filterManageMapResourceCatalog({
        catalog: catalogAssets,
        query,
        filter,
        savedAssetKeys,
    }), [catalogAssets, filter, query, savedAssetKeys]);
    const catalogSearchActive = canSearchCatalog
        && normalizedQuery.length >= MANAGE_MAP_CATALOG_MIN_QUERY_LENGTH;

    useEffect(() => {
        if (!isOpen) return;
        setName('');
        setQuery('');
        setFilter('all');
        setValidationError('');
        setCatalogAssets([]);
        setCatalogStatus('idle');
        setCatalogLoadVersion(0);
        setCatalogActionError('');
        setCatalogSavingKeys(new Set());
        setSelectedKeys(new Set(JSON.parse(initialAssetKeySignature)));
    }, [isOpen, initialAssetKeySignature]);

    useEffect(() => {
        if (!isOpen || !catalogSearchActive || catalogStatus !== 'idle') return;

        setCatalogStatus('loading');
        setCatalogActionError('');
        setCatalogLoadVersion((current) => current + 1);
    }, [catalogSearchActive, catalogStatus, isOpen]);

    useEffect(() => {
        if (!isOpen || catalogLoadVersion === 0) return undefined;

        let active = true;

        loadManageMapResourceCatalog({
            getDiscoveryCache: api.getDiscoveryCache,
            getHardAssets: api.getHardAssets,
            getSoftAssets: api.getSoftAssets,
        })
            .then((assets) => {
                if (!active) return;
                setCatalogAssets(assets);
                setCatalogStatus('ready');
            })
            .catch((catalogError) => {
                console.error(catalogError);
                if (!active) return;
                setCatalogStatus('error');
                setCatalogActionError('');
            });

        return () => {
            active = false;
        };
    }, [catalogLoadVersion, isOpen]);

    if (!isOpen) return null;

    const hasSelectableAssets = savedAssets.length > 0;
    const selectedAssets = savedAssets.filter((asset) => selectedKeys.has(buildSavedAssetKey(asset.resourceType, asset.resourceId)));
    const canSubmit = !dialogBusy
        && !interactionDisabled
        && (isCreateMode ? (Boolean(name.trim()) && selectedAssets.length > 0) : true);

    function addAssetAndHostsToSelection(currentKeys, asset, availableAssets) {
        const next = new Set(currentKeys);
        const key = buildSavedAssetKey(asset.resourceType, asset.resourceId);
        next.add(key);

        if (asset.resourceType !== 'soft') return next;

        let hostIds = asset.hostHardAssetIds || (asset.hostHardAssetId ? [asset.hostHardAssetId] : []);
        if (hostIds.length === 0 && asset.address) {
            hostIds = availableAssets
                .filter((candidate) => (
                    candidate.resourceType === 'hard'
                    && candidate.address
                    && candidate.address.trim() === asset.address.trim()
                ))
                .map((candidate) => candidate.resourceId);
        }

        hostIds.forEach((hostId) => {
            const hostKey = buildSavedAssetKey('hard', hostId);
            if (availableAssets.some((candidate) => (
                buildSavedAssetKey(candidate.resourceType, candidate.resourceId) === hostKey
            ))) {
                next.add(hostKey);
            }
        });

        return next;
    }

    function toggleAsset(asset) {
        setValidationError('');
        const key = buildSavedAssetKey(asset.resourceType, asset.resourceId);

        if (selectedKeys.has(key) && asset.resourceType === 'hard') {
            const hasCheckedOfferings = savedAssets.some(
                a => {
                    if (a.resourceType !== 'soft' || !selectedKeys.has(buildSavedAssetKey(a.resourceType, a.resourceId))) return false;
                    
                    // Fallback to address-matching if the backend data is stale or cached
                    let hostIds = a.hostHardAssetIds || (a.hostHardAssetId ? [a.hostHardAssetId] : []);
                    if (hostIds.length === 0 && a.address && asset.address) {
                        if (a.address.trim() === asset.address.trim()) {
                            hostIds = [asset.resourceId];
                        }
                    }
                    return hostIds.includes(asset.resourceId);
                }
            );
            
            if (hasCheckedOfferings) {
                setValidationError(t('keepPlaceSelected', { name: asset.name }));
                return;
            }
        }

        setSelectedKeys((current) => {
            const next = new Set(current);
            if (next.has(key)) {
                next.delete(key);
            } else {
                return addAssetAndHostsToSelection(next, asset, savedAssets);
            }
            return next;
        });
    }

    async function handleSaveAndAddCatalogAsset(asset) {
        const key = buildSavedAssetKey(asset.resourceType, asset.resourceId);
        if (catalogSavingKeys.has(key)) return;

        setCatalogActionError('');
        setCatalogSavingKeys((current) => new Set(current).add(key));
        try {
            const savedAsset = await onSaveCatalogAsset(asset);
            if (!savedAsset) throw new Error(t('failedSaveResourceFromMap'));
            setSelectedKeys((current) => addAssetAndHostsToSelection(
                current,
                savedAsset,
                [...savedAssets, savedAsset],
            ));
        } catch (saveError) {
            console.error(saveError);
            setCatalogActionError(t('failedSaveResourceFromMap'));
        } finally {
            setCatalogSavingKeys((current) => {
                const next = new Set(current);
                next.delete(key);
                return next;
            });
        }
    }

    function retryCatalogLoad() {
        setCatalogActionError('');
        setCatalogStatus('loading');
        setCatalogLoadVersion((current) => current + 1);
    }

    async function handleSubmit(event) {
        event.preventDefault();
        if (!canSubmit) return;

        await onSubmit?.({
            name: name.trim(),
            assets: selectedAssets.map((asset) => ({
                resourceType: asset.resourceType,
                resourceId: asset.resourceId,
            })),
        });
    }

    function handleDialogKeyDown(event) {
        handleModalKeyboardEvent(event, {
            onEscape: dialogBusy ? null : onClose,
        });
    }

    return (
        <div role="presentation" className="fixed inset-0 z-[1400] flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onKeyDown={handleDialogKeyDown}
                className="flex max-h-[calc(100svh-0.75rem)] w-full max-w-3xl flex-col overflow-hidden rounded-t-[28px] border border-slate-200 bg-white shadow-2xl sm:max-h-[calc(100svh-2rem)] sm:rounded-[28px]"
            >
                <div className="flex shrink-0 items-start justify-between border-b border-slate-100 px-5 py-5 sm:px-6">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
                            {isCreateMode ? t('createMap') : t('chooseMapResources')}
                        </p>
                        <h2 id={titleId} className="mt-2 text-2xl font-bold text-slate-900">
                            {isCreateMode
                                ? (canSearchCatalog ? t('createMapWithResources') : t('createMapFromSaved'))
                                : t('chooseWhatStaysInMap')}
                        </h2>
                        <p className="mt-2 text-sm text-slate-500">
                            {isCreateMode
                                ? (canSearchCatalog ? t('pickSavedOrFindResourcesTogether') : t('pickSavedResourcesTogether'))
                                : t('tickSavedResourcesIncluded')}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={dialogBusy}
                        className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={t('close')}
                    >
                        <X size={20} />
                    </button>
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-5 sm:px-6 sm:pb-5"
                    aria-busy={dialogBusy}
                >
                    {busy ? (
                        <div
                            role="status"
                            aria-live="polite"
                            className="mb-5 flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-900"
                            data-testid="create-map-loading-status"
                        >
                            <LoaderCircle size={18} className="flex-shrink-0 animate-spin" aria-hidden="true" />
                            <span>{submitting ? t('saving') : t('loadingResources')}</span>
                        </div>
                    ) : null}

                    {isCreateMode ? (
                        <div className="mb-5">
                            <label htmlFor="create-map-name" className="block text-sm font-semibold text-slate-700">
                                {t('mapName')}
                            </label>
                            <input
                                id="create-map-name"
                                type="text"
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                disabled={dialogBusy || interactionDisabled}
                                placeholder={t('mapNamePlaceholder')}
                                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                                maxLength={255}
                                autoFocus
                            />
                        </div>
                    ) : null}

                    <div className="mb-4 shrink-0">
                        <label htmlFor="create-map-search" className="block text-sm font-semibold text-slate-700">
                            {canSearchCatalog ? t('searchSavedAndAllResources') : t('chooseSavedResources')}
                        </label>
                        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
                            <div className="relative flex-1">
                                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    id="create-map-search"
                                    type="search"
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    disabled={dialogBusy || interactionDisabled}
                                    placeholder={canSearchCatalog ? t('searchSavedAndAllResourcesPlaceholder') : t('searchYourSavedResources')}
                                    className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                                />
                            </div>
                            <div className="flex h-11 items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-1">
                                {['all', 'hard', 'soft'].map((f) => (
                                    <button
                                        key={f}
                                        type="button"
                                        onClick={() => setFilter(f)}
                                        disabled={dialogBusy || interactionDisabled}
                                        className={`flex-1 rounded-lg px-4 py-1.5 text-xs font-semibold capitalize transition ${filter === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        {f === 'hard' ? t('placeType') : f === 'soft' ? t('offeringType') : t('all')}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {!hasSelectableAssets && !canSearchCatalog ? (
                        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
                                <Map size={24} />
                            </div>
                            <h3 className="mt-4 text-lg font-bold text-slate-900">{t('noSavedResourcesTitle')}</h3>
                            <p className="mt-2 text-sm text-slate-500">
                                {isCreateMode
                                    ? t('noSavedResourcesForMapCreate')
                                    : t('noSavedResourcesForMapManage')}
                            </p>
                        </div>
                    ) : (
                        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 sm:max-h-[360px]">
                            {filteredAssets.map((asset) => {
                                const key = buildSavedAssetKey(asset.resourceType, asset.resourceId);
                                const checked = selectedKeys.has(key);

                                return (
                                    <label
                                        key={key}
                                        data-testid={`create-map-row-${key}`}
                                        className={`flex items-start gap-3 rounded-2xl border px-4 py-3 transition ${dialogBusy || interactionDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${checked ? 'border-brand-300 bg-brand-50/60' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => toggleAsset(asset)}
                                            disabled={dialogBusy || interactionDisabled}
                                            className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                            data-testid={`create-map-asset-${key}`}
                                        />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="inline-flex rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                                                    {typeLabel(asset.resourceType, t)}
                                                </span>
                                                {asset.subCategory ? (
                                                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                                        {asset.subCategory}
                                                    </span>
                                                ) : null}
                                                <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                                    {t('resourceNumber', { id: asset.resourceId })}
                                                </span>
                                                {asset.status === 'unavailable' ? (
                                                    <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                                                        {t('noLongerAvailable')}
                                                    </span>
                                                ) : !asset.hasCoordinates ? (
                                                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                                        {t('notShownOnMap')}
                                                    </span>
                                                ) : null}
                                            </div>
                                            <p className="mt-2 text-sm font-semibold text-slate-900">{asset.name}</p>
                                            <p className="mt-1 text-sm text-slate-500">
                                                {asset.address || t('locationDetailsUnavailable')}
                                            </p>
                                        </div>
                                    </label>
                                );
                            })}

                            {!canSearchCatalog && filteredAssets.length === 0 ? (
                                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
                                    <h3 className="text-lg font-bold text-slate-900">{t('noSavedResultsTitle')}</h3>
                                    <p className="mt-2 text-sm text-slate-500">{t('tryAnotherSearchOrClear')}</p>
                                </div>
                            ) : null}

                            {canSearchCatalog && !catalogSearchActive ? (
                                <div className="rounded-2xl border border-dashed border-brand-200 bg-brand-50/50 px-4 py-4" data-testid="manage-map-catalog-search-hint">
                                    <div className="flex items-start gap-3">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand-700 shadow-sm">
                                            <Search size={18} aria-hidden="true" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-slate-900">{t('findMoreResourcesForMap')}</h3>
                                            <p className="mt-1 text-sm text-slate-600">
                                                {t('findMoreResourcesForMapHelp', { count: MANAGE_MAP_CATALOG_MIN_QUERY_LENGTH })}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : null}

                            {canSearchCatalog && catalogSearchActive && catalogStatus === 'loading' ? (
                                <div
                                    role="status"
                                    aria-live="polite"
                                    className="flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-4 text-sm font-semibold text-brand-900"
                                    data-testid="manage-map-catalog-loading"
                                >
                                    <LoaderCircle size={18} className="shrink-0 animate-spin" aria-hidden="true" />
                                    <span>{t('searchingAllResources')}</span>
                                </div>
                            ) : null}

                            {canSearchCatalog && catalogSearchActive && catalogStatus === 'error' ? (
                                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4" role="alert">
                                    <p className="text-sm font-semibold text-red-700">{catalogActionError || t('failedLoadResourceCatalog')}</p>
                                    <button
                                        type="button"
                                        onClick={retryCatalogLoad}
                                        className="btn-ghost mt-3 justify-center"
                                    >
                                        <RefreshCw size={16} aria-hidden="true" />
                                        {t('tryAgain')}
                                    </button>
                                </div>
                            ) : null}

                            {canSearchCatalog && catalogSearchActive && catalogStatus === 'ready' && catalogMatches.length > 0 ? (
                                <section className="space-y-3" aria-labelledby={`${titleId}-catalog-results`}>
                                    <div className="flex items-center justify-between gap-3 px-1 pt-1">
                                        <h3 id={`${titleId}-catalog-results`} className="text-sm font-bold text-slate-900">
                                            {t('availableToSaveAndAdd')}
                                        </h3>
                                        <span className="text-xs font-semibold text-slate-500">
                                            {t('resultsCount', { count: catalogMatches.length })}
                                        </span>
                                    </div>
                                    {catalogMatches.map((asset) => {
                                        const key = buildSavedAssetKey(asset.resourceType, asset.resourceId);
                                        const saving = catalogSavingKeys.has(key);

                                        return (
                                            <article
                                                key={key}
                                                className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
                                                data-testid={`manage-map-catalog-row-${key}`}
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="inline-flex rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                                                            {typeLabel(asset.resourceType, t)}
                                                        </span>
                                                        {asset.subCategory ? (
                                                            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                                                {asset.subCategory}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    <p className="mt-2 text-sm font-semibold text-slate-900">{asset.name}</p>
                                                    <p className="mt-1 text-sm text-slate-500">
                                                        {asset.address || t('locationDetailsUnavailable')}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleSaveAndAddCatalogAsset(asset)}
                                                    disabled={dialogBusy || interactionDisabled}
                                                    className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-bold text-brand-800 transition hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-60"
                                                    data-testid={`manage-map-save-add-${key}`}
                                                >
                                                    {saving ? (
                                                        <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
                                                    ) : (
                                                        <Heart size={16} aria-hidden="true" />
                                                    )}
                                                    <span>{saving ? t('saving') : t('saveAndAdd')}</span>
                                                </button>
                                            </article>
                                        );
                                    })}
                                </section>
                            ) : null}

                            {canSearchCatalog
                                && catalogSearchActive
                                && catalogStatus === 'ready'
                                && filteredAssets.length === 0
                                && catalogMatches.length === 0 ? (
                                    <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
                                        <h3 className="text-lg font-bold text-slate-900">{t('noResourceCatalogResultsTitle')}</h3>
                                        <p className="mt-2 text-sm text-slate-500">{t('tryAnotherSearchOrClear')}</p>
                                    </div>
                                ) : null}
                        </div>
                    )}

                    {validationError ? (
                        <p className="mt-4 text-sm font-medium text-red-600">{validationError}</p>
                    ) : catalogActionError && catalogStatus !== 'error' ? (
                        <p className="mt-4 text-sm font-medium text-red-600">{catalogActionError}</p>
                    ) : error ? (
                        <p className="mt-4 text-sm font-medium text-red-600">{error}</p>
                    ) : null}

                    <div className="mt-5 flex shrink-0 flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-slate-500">
                            {t('selectedResourcesCount', {
                                count: selectedAssets.length,
                                label: selectedAssets.length === 1 ? t('resourceSelected') : t('resourcesSelected'),
                            })}
                        </p>
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={dialogBusy}
                                className="btn-ghost justify-center disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                type="submit"
                                disabled={!canSubmit}
                                className="btn-primary justify-center disabled:cursor-not-allowed disabled:opacity-60"
                                data-testid="create-map-submit"
                            >
                                {busy ? (
                                    <>
                                        <LoaderCircle size={17} className="animate-spin" aria-hidden="true" />
                                        <span>{submitting ? (isCreateMode ? t('creating') : t('saving')) : t('loadingResources')}</span>
                                    </>
                                ) : (isCreateMode ? t('createMap') : t('updateMap'))}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
