import { useEffect, useMemo, useState } from 'react';
import { Map, Search, X } from 'lucide-react';

import { buildSavedAssetKey } from '../lib/savedAssets.js';

function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
}

function typeLabel(resourceType) {
    return resourceType === 'hard' ? 'Place' : 'Offering';
}

export default function CreateMapModal({
    isOpen,
    mode = 'create',
    savedAssets = [],
    excludedAssetKeys = [],
    submitting = false,
    error = '',
    onClose,
    onSubmit,
}) {
    const [name, setName] = useState('');
    const [query, setQuery] = useState('');
    const [selectedKeys, setSelectedKeys] = useState(new Set());

    const isCreateMode = mode === 'create';
    const excludedKeysSet = useMemo(() => new Set(excludedAssetKeys), [excludedAssetKeys]);

    const selectableAssets = useMemo(
        () => savedAssets.filter((asset) => !excludedKeysSet.has(buildSavedAssetKey(asset.resourceType, asset.resourceId))),
        [excludedKeysSet, savedAssets]
    );

    const filteredAssets = useMemo(() => {
        const normalized = normalizeText(query);
        if (!normalized) return selectableAssets;

        return selectableAssets.filter((asset) => (
            [asset.name, asset.subCategory, asset.address, typeLabel(asset.resourceType)]
                .map(normalizeText)
                .join(' ')
                .includes(normalized)
        ));
    }, [query, selectableAssets]);

    useEffect(() => {
        if (!isOpen) return;
        setName('');
        setQuery('');
        setSelectedKeys(new Set());
    }, [isOpen, mode]);

    if (!isOpen) return null;

    const hasSelectableAssets = selectableAssets.length > 0;
    const selectedAssets = selectableAssets.filter((asset) => selectedKeys.has(buildSavedAssetKey(asset.resourceType, asset.resourceId)));
    const canSubmit = !submitting
        && (!isCreateMode || Boolean(name.trim()))
        && selectedAssets.length > 0;

    function toggleAsset(asset) {
        const key = buildSavedAssetKey(asset.resourceType, asset.resourceId);
        setSelectedKeys((current) => {
            const next = new Set(current);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
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
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-3xl rounded-[28px] border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-start justify-between border-b border-slate-100 px-5 py-5 sm:px-6">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
                            {isCreateMode ? 'Create My Map' : 'Add from Saved Assets'}
                        </p>
                        <h2 className="mt-2 text-2xl font-bold text-slate-900">
                            {isCreateMode ? 'Create a named map from saved assets' : 'Add saved assets to this map'}
                        </h2>
                        <p className="mt-2 text-sm text-slate-500">
                            {isCreateMode
                                ? 'Select the saved assets you want to group together.'
                                : 'Choose additional saved assets to include in this map.'}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="px-5 py-5 sm:px-6">
                    {isCreateMode ? (
                        <div className="mb-5">
                            <label htmlFor="create-map-name" className="block text-sm font-semibold text-slate-700">
                                Map name
                            </label>
                            <input
                                id="create-map-name"
                                type="text"
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                placeholder="For example, North-west support options"
                                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                                maxLength={255}
                                autoFocus
                            />
                        </div>
                    ) : null}

                    <div className="mb-4">
                        <label htmlFor="create-map-search" className="block text-sm font-semibold text-slate-700">
                            Select saved assets
                        </label>
                        <div className="relative mt-2">
                            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                id="create-map-search"
                                type="search"
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Search your saved assets"
                                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                            />
                        </div>
                    </div>

                    {!hasSelectableAssets ? (
                        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
                                <Map size={24} />
                            </div>
                            <h3 className="mt-4 text-lg font-bold text-slate-900">No saved assets available</h3>
                            <p className="mt-2 text-sm text-slate-500">
                                {isCreateMode
                                    ? 'Save assets from Discover first, then create a map from them.'
                                    : 'All of your current saved assets are already in this map, or you have no saved assets yet.'}
                            </p>
                        </div>
                    ) : filteredAssets.length === 0 ? (
                        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
                            <h3 className="text-lg font-bold text-slate-900">No saved assets match your search</h3>
                            <p className="mt-2 text-sm text-slate-500">Try a different search term to see more saved assets.</p>
                        </div>
                    ) : (
                        <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
                            {filteredAssets.map((asset) => {
                                const key = buildSavedAssetKey(asset.resourceType, asset.resourceId);
                                const checked = selectedKeys.has(key);

                                return (
                                    <label
                                        key={key}
                                        className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition ${checked ? 'border-brand-300 bg-brand-50/60' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => toggleAsset(asset)}
                                            className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="inline-flex rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                                                    {typeLabel(asset.resourceType)}
                                                </span>
                                                {asset.subCategory ? (
                                                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                                        {asset.subCategory}
                                                    </span>
                                                ) : null}
                                                {asset.status === 'unavailable' ? (
                                                    <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                                                        Unavailable
                                                    </span>
                                                ) : !asset.hasCoordinates ? (
                                                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                                        List only
                                                    </span>
                                                ) : null}
                                            </div>
                                            <p className="mt-2 text-sm font-semibold text-slate-900">{asset.name}</p>
                                            <p className="mt-1 text-sm text-slate-500">
                                                {asset.address || 'Location details are not available.'}
                                            </p>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    )}

                    {error ? (
                        <p className="mt-4 text-sm font-medium text-red-600">{error}</p>
                    ) : null}

                    <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-slate-500">
                            {selectedAssets.length} {selectedAssets.length === 1 ? 'asset selected' : 'assets selected'}
                        </p>
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <button type="button" onClick={onClose} className="btn-ghost justify-center">
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={!canSubmit}
                                className="btn-primary justify-center disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {submitting ? (isCreateMode ? 'Creating…' : 'Adding…') : (isCreateMode ? 'Create My Map' : 'Add to map')}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
