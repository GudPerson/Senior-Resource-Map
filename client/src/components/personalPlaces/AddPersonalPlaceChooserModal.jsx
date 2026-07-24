import { useEffect, useMemo, useState } from 'react';
import { Check, MapPin, Plus, Search, X } from 'lucide-react';

import ResourceRowIcon from '../ResourceRowIcon.jsx';

function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
}

export default function AddPersonalPlaceChooserModal({
    open,
    mapId,
    places = [],
    submitting = false,
    error = '',
    onClose,
    onAttach,
    onCreateNew,
}) {
    const [query, setQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);

    useEffect(() => {
        if (!open) return;
        setQuery('');
        setSelectedIds([]);
    }, [open]);

    const availablePlaces = useMemo(() => {
        const normalizedQuery = normalizeText(query);
        return places.filter((place) => {
            if ((place.mapIds || []).some((id) => Number(id) === Number(mapId))) return false;
            if (!normalizedQuery) return true;
            return [place.name, place.categoryLabel, place.address, place.postalCode, place.shortDescription]
                .some((value) => normalizeText(value).includes(normalizedQuery));
        });
    }, [mapId, places, query]);

    if (!open) return null;

    function togglePlace(placeId) {
        setSelectedIds((current) => current.includes(placeId)
            ? current.filter((id) => id !== placeId)
            : [...current, placeId]);
    }

    return (
        <div className="fixed inset-0 z-[1350] flex items-end bg-slate-950/45 sm:items-center sm:justify-center sm:p-6" role="presentation" onClick={() => { if (!submitting) onClose?.(); }}>
            <section
                className="flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:max-w-2xl sm:rounded-[28px]"
                role="dialog"
                aria-modal="true"
                aria-label="Add personal place to map"
                aria-busy={submitting}
                onClick={(event) => event.stopPropagation()}
            >
                <header className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                        <MapPin size={19} />
                    </span>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-base font-black text-slate-900">Add personal place</h2>
                        <p className="mt-0.5 text-xs font-semibold text-slate-500">Reuse a place from My Places or create a new one on this map.</p>
                    </div>
                    <button type="button" onClick={onClose} disabled={submitting} className="inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100" aria-label="Close">
                        <X size={19} />
                    </button>
                </header>

                <div className="flex gap-2 border-b border-slate-100 p-4">
                    <div className="relative min-w-0 flex-1">
                        <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search My Places"
                            disabled={submitting}
                            className="input-field min-h-11 w-full pl-10"
                        />
                    </div>
                    <button type="button" onClick={onCreateNew} disabled={submitting} className="btn-ghost min-h-11 flex-shrink-0 justify-center border border-slate-200 px-4 disabled:opacity-50">
                        <Plus size={16} />
                        Create new
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                    {availablePlaces.length === 0 ? (
                        <div className="border-y border-dashed border-slate-200 py-12 text-center">
                            <p className="text-base font-bold text-slate-800">
                                {places.length === 0 ? 'My Places is empty' : 'No reusable places available'}
                            </p>
                            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                                {places.length === 0
                                    ? 'Create a personal place by choosing a point on this map.'
                                    : 'Every matching place is already on this map.'}
                            </p>
                            <button type="button" onClick={onCreateNew} disabled={submitting} className="btn-primary mx-auto mt-5 disabled:opacity-50">
                                <Plus size={16} />
                                Create new
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {availablePlaces.map((place) => {
                                const selected = selectedIds.includes(place.id);
                                return (
                                    <button
                                        key={place.id}
                                        type="button"
                                        onClick={() => togglePlace(place.id)}
                                        disabled={submitting}
                                        className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${
                                            selected
                                                ? 'border-brand-400 bg-brand-50 ring-2 ring-brand-100'
                                                : 'border-slate-200 bg-white hover:border-brand-200'
                                        } disabled:cursor-wait disabled:opacity-70`}
                                    >
                                        <ResourceRowIcon
                                            resourceType="personal_place"
                                            logoUrl={place.logoUrl}
                                            alt={`${place.name} image`}
                                            className="h-10 w-10 rounded-lg"
                                        />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-black text-slate-900">{place.name}</span>
                                            <span className="mt-0.5 block truncate text-xs font-semibold text-slate-500">
                                                {place.categoryLabel || 'Personal place'}{place.address ? ` · ${place.address}` : ''}
                                            </span>
                                            {place.shortDescription ? (
                                                <span className="mt-1 block line-clamp-2 text-xs text-slate-600">
                                                    {place.shortDescription}
                                                </span>
                                            ) : null}
                                        </span>
                                        <span className={`inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border ${selected ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 text-transparent'}`}>
                                            <Check size={15} />
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    {error ? <p className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}
                </div>

                <footer className="flex items-center justify-between gap-3 border-t border-slate-100 p-4">
                    <p className="text-sm font-semibold text-slate-500" aria-live="polite">
                        {submitting ? 'Adding selected places to your map...' : `${selectedIds.length} selected`}
                    </p>
                    <button type="button" onClick={() => onAttach?.(selectedIds)} disabled={selectedIds.length === 0 || submitting} className="btn-primary min-h-11 px-5 disabled:opacity-50">
                        {submitting ? 'Adding...' : 'Add to this map'}
                    </button>
                </footer>
            </section>
        </div>
    );
}
