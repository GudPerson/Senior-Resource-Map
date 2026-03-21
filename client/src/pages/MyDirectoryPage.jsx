import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import CreateMapModal from '../components/CreateMapModal.jsx';
import MyMapCard from '../components/MyMapCard.jsx';
import MyMapsEmptyState from '../components/MyMapsEmptyState.jsx';
import RenameMapModal from '../components/RenameMapModal.jsx';
import SavedAssetCard from '../components/SavedAssetCard.jsx';
import SavedAssetsEmptyState from '../components/SavedAssetsEmptyState.jsx';
import { DashboardMobileNavigation } from '../components/dashboard/DashboardNavigation.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useSavedAssets } from '../hooks/useSavedAssets.js';
import { api } from '../lib/api.js';

const SORT_OPTIONS = [
    { value: 'recent', label: 'Recently saved' },
    { value: 'name-asc', label: 'Name A-Z' },
    { value: 'name-desc', label: 'Name Z-A' },
];

const DIRECTORY_SECTIONS = {
    saved: 'saved-assets',
    maps: 'my-maps',
};

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

function formatSectionLabel(section) {
    return section === DIRECTORY_SECTIONS.maps ? 'My Maps' : 'Saved Assets';
}

function SavedAssetsLoadingState() {
    return (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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

function DirectoryTabs({ activeSection, onSelect }) {
    return (
        <div className="mt-4 flex flex-wrap gap-2">
            {[
                { value: DIRECTORY_SECTIONS.saved, label: 'Saved Assets' },
                { value: DIRECTORY_SECTIONS.maps, label: 'My Maps' },
            ].map((tab) => {
                const active = activeSection === tab.value;
                return (
                    <button
                        key={tab.value}
                        type="button"
                        onClick={() => onSelect(tab.value)}
                        className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                            active
                                ? 'bg-brand-600 text-white shadow-sm'
                                : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                        }`}
                    >
                        {tab.label}
                    </button>
                );
            })}
        </div>
    );
}

export default function MyDirectoryPage() {
    const { user, logout, isImpersonating } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const {
        savedAssets,
        savedAssetsLoading,
        toggleSavedAsset,
        isSavedAssetPending,
    } = useSavedAssets();

    const initialSection = searchParams.get('section') === DIRECTORY_SECTIONS.maps
        ? DIRECTORY_SECTIONS.maps
        : DIRECTORY_SECTIONS.saved;

    const [activeSection, setActiveSection] = useState(initialSection);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState('recent');
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
    const [deletingMapId, setDeletingMapId] = useState(null);

    useEffect(() => {
        const nextSection = searchParams.get('section') === DIRECTORY_SECTIONS.maps
            ? DIRECTORY_SECTIONS.maps
            : DIRECTORY_SECTIONS.saved;
        setActiveSection(nextSection);
    }, [searchParams]);

    const normalizedQuery = normalizeText(searchTerm);

    const filteredAssets = useMemo(() => {
        const matches = normalizedQuery
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

        return sortAssets(matches, sortOrder);
    }, [normalizedQuery, savedAssets, sortOrder]);

    const totalSavedCount = savedAssets.length;
    const hasSavedAssets = totalSavedCount > 0;
    const hasSearch = Boolean(normalizedQuery);
    const hasResults = filteredAssets.length > 0;

    const loadMaps = useCallback(async () => {
        setMapsLoading(true);
        setMapsError('');
        try {
            const items = await api.getMyMaps();
            setMaps(Array.isArray(items) ? items : []);
            setMapsLoaded(true);
            return items;
        } catch (err) {
            console.error(err);
            setMapsError(err.message || 'Failed to load your maps.');
            setMapsLoaded(true);
            return [];
        } finally {
            setMapsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (activeSection !== DIRECTORY_SECTIONS.maps || mapsLoaded) return;
        loadMaps();
    }, [activeSection, loadMaps, mapsLoaded]);

    async function handleRemove(asset) {
        setActionError('');

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
            setActionError(err.message || 'Failed to remove this saved asset.');
        }
    }

    function switchSection(section) {
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
            setCreateError(err.message || 'Failed to create your map.');
        } finally {
            setCreateSubmitting(false);
        }
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
            setRenameError(err.message || 'Failed to rename this map.');
        } finally {
            setRenameSubmitting(false);
        }
    }

    async function handleDeleteMap(map) {
        const confirmed = window.confirm(`Delete "${map.name}"? This removes the map and its asset list.`);
        if (!confirmed) return;

        setDeletingMapId(map.id);
        setMapsError('');
        try {
            await api.deleteMyMap(map.id);
            setMaps((items) => items.filter((item) => item.id !== map.id));
        } catch (err) {
            console.error(err);
            setMapsError(err.message || 'Failed to delete this map.');
        } finally {
            setDeletingMapId(null);
        }
    }

    const sectionLabel = formatSectionLabel(activeSection);

    async function handleLogout() {
        const impersonationExit = isImpersonating;
        await logout();
        navigate(impersonationExit ? '/dashboard' : '/');
    }

    return (
        <>
            <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
                <DashboardMobileNavigation
                    isImpersonating={isImpersonating}
                    onLogout={handleLogout}
                    sectionContextLabel="My Directory"
                    sectionLabel={sectionLabel}
                    user={user}
                />
                <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
                    <header className="mb-6 rounded-3xl border border-slate-200 bg-white px-5 py-6 shadow-sm sm:px-6">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">{sectionLabel}</p>
                        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">My Directory</h1>
                        <p className="mt-2 max-w-2xl text-sm text-slate-500">
                            {activeSection === DIRECTORY_SECTIONS.maps
                                ? 'Your private maps built from saved assets.'
                                : 'Your saved resources in one place.'}
                        </p>
                        <DirectoryTabs activeSection={activeSection} onSelect={switchSection} />
                    </header>

                    {activeSection === DIRECTORY_SECTIONS.saved ? (
                        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                            <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-end lg:justify-between">
                                <div className="min-w-0 flex-1">
                                    <label htmlFor="saved-assets-search" className="block text-sm font-semibold text-slate-700">
                                        Search saved assets
                                    </label>
                                    <div className="relative mt-2">
                                        <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            id="saved-assets-search"
                                            type="search"
                                            value={searchTerm}
                                            onChange={(event) => setSearchTerm(event.target.value)}
                                            placeholder="Search by name, category, address, or type"
                                            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-12 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                                        />
                                        {searchTerm ? (
                                            <button
                                                type="button"
                                                onClick={() => setSearchTerm('')}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                                                aria-label="Clear search"
                                            >
                                                <X size={16} />
                                            </button>
                                        ) : null}
                                    </div>
                                </div>

                                <div className="w-full lg:w-56">
                                    <label htmlFor="saved-assets-sort" className="block text-sm font-semibold text-slate-700">
                                        Sort
                                    </label>
                                    <div className="relative mt-2">
                                        <SlidersHorizontal size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <select
                                            id="saved-assets-sort"
                                            value={sortOrder}
                                            onChange={(event) => setSortOrder(event.target.value)}
                                            className="w-full appearance-none rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                                        >
                                            {SORT_OPTIONS.map((option) => (
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
                                    {totalSavedCount} saved {totalSavedCount === 1 ? 'asset' : 'assets'}
                                    {hasSearch ? ` • ${filteredAssets.length} matching` : ''}
                                </p>
                                {actionError ? (
                                    <p className="text-sm font-medium text-red-600">{actionError}</p>
                                ) : null}
                            </div>

                            {savedAssetsLoading && !hasSavedAssets ? (
                                <SavedAssetsLoadingState />
                            ) : !hasSavedAssets ? (
                                <SavedAssetsEmptyState mode="empty" />
                            ) : !hasResults ? (
                                <SavedAssetsEmptyState
                                    mode="no-results"
                                    searchTerm={searchTerm}
                                    onClearSearch={() => setSearchTerm('')}
                                />
                            ) : (
                                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                    {filteredAssets.map((asset) => (
                                        <SavedAssetCard
                                            key={asset.assetKey || `${asset.resourceType}-${asset.resourceId}`}
                                            asset={asset}
                                            removing={isSavedAssetPending(asset.resourceType, asset.resourceId)}
                                            onRemove={handleRemove}
                                        />
                                    ))}
                                </div>
                            )}
                        </section>
                    ) : (
                        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                            <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-end sm:justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-slate-700">Private maps built from your saved assets</p>
                                    <p className="mt-1 text-sm text-slate-500">
                                        Keep related resources together in named maps you can revisit later.
                                    </p>
                                </div>
                                <button type="button" onClick={() => setCreateModalOpen(true)} className="btn-primary justify-center">
                                    Create My Map
                                </button>
                            </div>

                            <div className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-sm font-medium text-slate-600">
                                    {maps.length} {maps.length === 1 ? 'map' : 'maps'}
                                </p>
                                {mapsError ? (
                                    <p className="text-sm font-medium text-red-600">{mapsError}</p>
                                ) : null}
                            </div>

                            {mapsLoading && !mapsLoaded ? (
                                <MyMapsLoadingState />
                            ) : maps.length === 0 ? (
                                <MyMapsEmptyState hasSavedAssets={hasSavedAssets} onCreate={() => setCreateModalOpen(true)} />
                            ) : (
                                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                    {maps.map((map) => (
                                        <MyMapCard
                                            key={map.id}
                                            map={map}
                                            deleting={deletingMapId === map.id}
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
                    )}
                </div>
            </div>

            <CreateMapModal
                isOpen={createModalOpen}
                mode="create"
                savedAssets={savedAssets}
                submitting={createSubmitting}
                error={createError}
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
        </>
    );
}
