import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapPinned, Pencil, Plus, Search, Settings2, Trash2, X } from 'lucide-react';

import { api } from '../../lib/api.js';
import { PersonalPlaceCategoryIcon } from '../../lib/personalPlaceCategories.jsx';
import { useConfirmDialog } from '../ConfirmDialog.jsx';
import PersonalPlaceCategoryManagerModal from './PersonalPlaceCategoryManagerModal.jsx';
import PersonalPlaceEditorModal from './PersonalPlaceEditorModal.jsx';

function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
}

export default function PersonalPlacesSection() {
    const { confirm: requestConfirmation, confirmDialog } = useConfirmDialog();
    const [places, setPlaces] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [editorDraft, setEditorDraft] = useState(undefined);
    const [editorBusy, setEditorBusy] = useState(false);
    const [editorError, setEditorError] = useState('');
    const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
    const [categoryBusy, setCategoryBusy] = useState(false);
    const [categoryError, setCategoryError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [nextPlaces, nextCategories] = await Promise.all([
                api.getPersonalPlaces(),
                api.getPersonalPlaceCategories(),
            ]);
            setPlaces(Array.isArray(nextPlaces) ? nextPlaces : []);
            setCategories(Array.isArray(nextCategories) ? nextCategories : []);
        } catch (loadError) {
            console.error(loadError);
            setError(loadError.message || 'Failed to load My Places.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const filteredPlaces = useMemo(() => {
        const normalizedQuery = normalizeText(query);
        return places.filter((place) => {
            if (categoryFilter && String(place.categoryId || '') !== categoryFilter) return false;
            if (!normalizedQuery) return true;
            return [
                place.name,
                place.categoryLabel,
                place.address,
                place.postalCode,
                place.note,
            ].some((value) => normalizeText(value).includes(normalizedQuery));
        });
    }, [categoryFilter, places, query]);

    async function handleSavePlace(values) {
        setEditorBusy(true);
        setEditorError('');
        try {
            const saved = values.id
                ? await api.updatePersonalPlace(values.id, values)
                : await api.createPersonalPlace(values);
            setPlaces((current) => values.id
                ? current.map((place) => (place.id === saved.id ? saved : place))
                : [saved, ...current]);
            setEditorDraft(undefined);
        } catch (saveError) {
            console.error(saveError);
            setEditorError(saveError.message || 'Failed to save personal place.');
        } finally {
            setEditorBusy(false);
        }
    }

    async function handleDeletePlace(place) {
        const mapCount = place.mapIds?.length || 0;
        const confirmed = await requestConfirmation({
            title: 'Delete personal place',
            message: mapCount > 0
                ? `"${place.name}" will be removed from My Places and ${mapCount} ${mapCount === 1 ? 'map' : 'maps'}.`
                : `"${place.name}" will be permanently removed from My Places.`,
            confirmLabel: 'Delete everywhere',
            loadingLabel: 'Deleting...',
            tone: 'danger',
        });
        if (!confirmed) return;

        setError('');
        try {
            await api.deletePersonalPlace(place.id);
            setPlaces((current) => current.filter((item) => item.id !== place.id));
        } catch (deleteError) {
            console.error(deleteError);
            setError(deleteError.message || 'Failed to delete personal place.');
        }
    }

    async function handleCreateCategory(values) {
        setCategoryBusy(true);
        setCategoryError('');
        try {
            const created = await api.createPersonalPlaceCategory(values);
            setCategories((current) => [...current, created]);
        } catch (categorySaveError) {
            console.error(categorySaveError);
            setCategoryError(categorySaveError.message || 'Failed to create category.');
        } finally {
            setCategoryBusy(false);
        }
    }

    async function handleUpdateCategory(categoryId, values) {
        setCategoryBusy(true);
        setCategoryError('');
        try {
            const updated = await api.updatePersonalPlaceCategory(categoryId, values);
            setCategories((current) => current.map((category) => (
                category.id === updated.id ? updated : category
            )));
            setPlaces((current) => current.map((place) => (
                place.categoryId === updated.id
                    ? {
                        ...place,
                        categoryLabel: updated.name,
                        category: updated,
                    }
                    : place
            )));
        } catch (categorySaveError) {
            console.error(categorySaveError);
            setCategoryError(categorySaveError.message || 'Failed to update category.');
        } finally {
            setCategoryBusy(false);
        }
    }

    return (
        <>
            {confirmDialog}
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-4 border-b border-slate-100 pb-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="text-sm font-semibold text-slate-700">Private places you can reuse across your maps</p>
                            <p className="mt-1 text-sm text-slate-500">A place stays in this library when you remove it from one map.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => setCategoryManagerOpen(true)} className="btn-ghost min-h-11 justify-center border border-slate-200 px-4">
                                <Settings2 size={16} />
                                Categories
                            </button>
                            <button type="button" onClick={() => { setEditorError(''); setEditorDraft(null); }} className="btn-primary min-h-11 justify-center px-4">
                                <Plus size={16} />
                                Add personal place
                            </button>
                        </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                        <div className="relative">
                            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="search"
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Search My Places"
                                className="input-field min-h-11 w-full pl-10 pr-11"
                            />
                            {query ? (
                                <button type="button" onClick={() => setQuery('')} className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Clear search">
                                    <X size={16} />
                                </button>
                            ) : null}
                        </div>
                        <select
                            value={categoryFilter}
                            onChange={(event) => setCategoryFilter(event.target.value)}
                            className="input-field min-h-11"
                            aria-label="Filter by category"
                        >
                            <option value="">All categories</option>
                            {categories.filter((category) => !category.isArchived).map((category) => (
                                <option key={category.id} value={category.id}>{category.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-3 py-4">
                    <p className="text-sm font-medium text-slate-600">
                        {places.length} {places.length === 1 ? 'personal place' : 'personal places'}
                        {query || categoryFilter ? ` · ${filteredPlaces.length} matching` : ''}
                    </p>
                    {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
                </div>

                {loading ? (
                    <div className="grid gap-3 md:grid-cols-2">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <div key={index} className="h-28 animate-pulse rounded-lg bg-slate-100" />
                        ))}
                    </div>
                ) : places.length === 0 ? (
                    <div className="border-y border-dashed border-slate-200 px-5 py-14 text-center">
                        <MapPinned size={34} className="mx-auto text-brand-600" />
                        <h2 className="mt-4 text-lg font-bold text-slate-900">Your reusable place library is empty</h2>
                        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">Add a shop, pickup point, landmark, or other useful non-care place.</p>
                        <button type="button" onClick={() => setEditorDraft(null)} className="btn-primary mx-auto mt-5">
                            <Plus size={16} />
                            Add personal place
                        </button>
                    </div>
                ) : filteredPlaces.length === 0 ? (
                    <div className="border-y border-dashed border-slate-200 px-5 py-14 text-center">
                        <p className="text-lg font-bold text-slate-800">No personal places match</p>
                        <button type="button" onClick={() => { setQuery(''); setCategoryFilter(''); }} className="btn-ghost mt-4">Clear filters</button>
                    </div>
                ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                        {filteredPlaces.map((place) => {
                            const category = place.category || categories.find((item) => item.id === place.categoryId);
                            const mapCount = place.mapIds?.length || 0;
                            return (
                                <article key={place.id} className="flex min-w-0 items-start gap-3 rounded-lg border border-slate-200 p-4 shadow-sm">
                                    <span
                                        className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-white"
                                        style={{ backgroundColor: category?.color || '#475569' }}
                                    >
                                        <PersonalPlaceCategoryIcon iconKey={category?.iconKey} size={19} />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="truncate text-sm font-black text-slate-900">{place.name}</h3>
                                        <p className="mt-1 truncate text-xs font-semibold text-slate-500">
                                            {place.categoryLabel || 'Personal place'}
                                            {place.address ? ` · ${place.address}` : ''}
                                        </p>
                                        <p className="mt-2 text-xs font-bold text-brand-700">
                                            {mapCount === 0 ? 'Not on a map yet' : `Used in ${mapCount} ${mapCount === 1 ? 'map' : 'maps'}`}
                                        </p>
                                    </div>
                                    <div className="flex flex-shrink-0 gap-1">
                                        <button type="button" onClick={() => { setEditorError(''); setEditorDraft(place); }} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-brand-700" aria-label={`Edit ${place.name}`} title="Edit">
                                            <Pencil size={16} />
                                        </button>
                                        <button type="button" onClick={() => handleDeletePlace(place)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700" aria-label={`Delete ${place.name}`} title="Delete everywhere">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>

            <PersonalPlaceEditorModal
                open={editorDraft !== undefined}
                draft={editorDraft}
                categories={categories}
                submitting={editorBusy}
                error={editorError}
                onClose={() => {
                    if (editorBusy) return;
                    setEditorDraft(undefined);
                }}
                onManageCategories={() => setCategoryManagerOpen(true)}
                onSubmit={handleSavePlace}
            />

            <PersonalPlaceCategoryManagerModal
                open={categoryManagerOpen}
                categories={categories}
                busy={categoryBusy}
                error={categoryError}
                onClose={() => {
                    if (categoryBusy) return;
                    setCategoryManagerOpen(false);
                    setCategoryError('');
                }}
                onCreate={handleCreateCategory}
                onUpdate={handleUpdateCategory}
            />
        </>
    );
}
