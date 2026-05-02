import { useEffect, useMemo, useState } from 'react';
import { Map, Search, X } from 'lucide-react';

import { buildSavedAssetKey } from '../lib/savedAssets.js';
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
    submitting = false,
    error = '',
    onClose,
    onSubmit,
}) {
    const { t } = useLocale();
    const [name, setName] = useState('');
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('all');
    const [selectedKeys, setSelectedKeys] = useState(new Set());
    const [validationError, setValidationError] = useState('');

    const isCreateMode = mode === 'create';
    const initialKeysSet = useMemo(() => new Set(initialAssetKeys), [initialAssetKeys]);

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

    useEffect(() => {
        if (!isOpen) return;
        setName('');
        setQuery('');
        setFilter('all');
        setValidationError('');
        setSelectedKeys(new Set(initialKeysSet));
    }, [isOpen, initialKeysSet]);

    if (!isOpen) return null;

    const hasSelectableAssets = savedAssets.length > 0;
    const selectedAssets = savedAssets.filter((asset) => selectedKeys.has(buildSavedAssetKey(asset.resourceType, asset.resourceId)));
    const canSubmit = !submitting
        && (isCreateMode ? (Boolean(name.trim()) && selectedAssets.length > 0) : true);

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
                next.add(key);
                if (asset.resourceType === 'soft') {
                    // Try to auto-select corresponding Places using IDs or address fallback
                    let hostIds = asset.hostHardAssetIds || (asset.hostHardAssetId ? [asset.hostHardAssetId] : []);
                    if (hostIds.length === 0 && asset.address) {
                        const matchedPlaces = savedAssets.filter(p => p.resourceType === 'hard' && p.address && p.address.trim() === asset.address.trim());
                        hostIds = matchedPlaces.map(p => p.resourceId);
                    }
                    if (hostIds.length > 0) {
                        hostIds.forEach(hostId => {
                            const hostKey = buildSavedAssetKey('hard', hostId);
                            if (savedAssets.some(a => buildSavedAssetKey(a.resourceType, a.resourceId) === hostKey)) {
                                next.add(hostKey);
                            }
                        });
                    }
                }
            }
            return next;
        });
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

    return (
        <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-3xl rounded-[28px] border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-start justify-between border-b border-slate-100 px-5 py-5 sm:px-6">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
                            {isCreateMode ? t('createMap') : t('chooseMapResources')}
                        </p>
                        <h2 className="mt-2 text-2xl font-bold text-slate-900">
                            {isCreateMode ? t('createMapFromSaved') : t('chooseWhatStaysInMap')}
                        </h2>
                        <p className="mt-2 text-sm text-slate-500">
                            {isCreateMode
                                ? t('pickSavedResourcesTogether')
                                : t('tickSavedResourcesIncluded')}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                        aria-label={t('close')}
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="px-5 py-5 sm:px-6">
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
                                placeholder={t('mapNamePlaceholder')}
                                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                                maxLength={255}
                                autoFocus
                            />
                        </div>
                    ) : null}

                    <div className="mb-4">
                        <label htmlFor="create-map-search" className="block text-sm font-semibold text-slate-700">
                            {t('chooseSavedResources')}
                        </label>
                        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
                            <div className="relative flex-1">
                                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    id="create-map-search"
                                    type="search"
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder={t('searchYourSavedResources')}
                                    className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                                />
                            </div>
                            <div className="flex h-11 items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-1">
                                {['all', 'hard', 'soft'].map((f) => (
                                    <button
                                        key={f}
                                        type="button"
                                        onClick={() => setFilter(f)}
                                        className={`flex-1 rounded-lg px-4 py-1.5 text-xs font-semibold capitalize transition ${filter === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        {f === 'hard' ? t('placeType') : f === 'soft' ? t('offeringType') : t('all')}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {!hasSelectableAssets ? (
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
                    ) : filteredAssets.length === 0 ? (
                        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
                            <h3 className="text-lg font-bold text-slate-900">{t('noSavedResultsTitle')}</h3>
                            <p className="mt-2 text-sm text-slate-500">{t('tryAnotherSearchOrClear')}</p>
                        </div>
                    ) : (
                        <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
                            {filteredAssets.map((asset) => {
                                const key = buildSavedAssetKey(asset.resourceType, asset.resourceId);
                                const checked = selectedKeys.has(key);

                                return (
                                    <label
                                        key={key}
                                        data-testid={`create-map-row-${key}`}
                                        className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition ${checked ? 'border-brand-300 bg-brand-50/60' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => toggleAsset(asset)}
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
                        </div>
                    )}

                    {validationError ? (
                        <p className="mt-4 text-sm font-medium text-red-600">{validationError}</p>
                    ) : error ? (
                        <p className="mt-4 text-sm font-medium text-red-600">{error}</p>
                    ) : null}

                    <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-slate-500">
                            {t('selectedResourcesCount', {
                                count: selectedAssets.length,
                                label: selectedAssets.length === 1 ? t('resourceSelected') : t('resourcesSelected'),
                            })}
                        </p>
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <button type="button" onClick={onClose} className="btn-ghost justify-center">
                                {t('cancel')}
                            </button>
                            <button
                                type="submit"
                                disabled={!canSubmit}
                                className="btn-primary justify-center disabled:cursor-not-allowed disabled:opacity-60"
                                data-testid="create-map-submit"
                            >
                                {submitting ? (isCreateMode ? t('creating') : t('saving')) : (isCreateMode ? t('createMap') : t('updateMap'))}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
