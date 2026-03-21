import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Trash2 } from 'lucide-react';

import { useAuth } from '../contexts/AuthContext.jsx';
import { useSavedAssets } from '../hooks/useSavedAssets.js';
import ResourceRowIcon from './ResourceRowIcon.jsx';

function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
}

function buildSearchHaystack(place, row) {
    return [
        place.name,
        place.address,
        row.name,
        row.subCategory,
        row.bucket,
        row.resourceType === 'hard' ? 'place' : 'offering',
    ]
        .map(normalizeText)
        .join(' ');
}

function filterPlaces(places, query) {
    const normalized = normalizeText(query);
    if (!normalized) return places;

    return places
        .map((place) => {
            const rows = place.rows.filter((row) => buildSearchHaystack(place, row).includes(normalized));
            if (!rows.length) return null;
            return {
                ...place,
                rows,
                curatedCount: rows.length,
            };
        })
        .filter(Boolean);
}

function StatusBadge({ status }) {
    if (status === 'unavailable') {
        return (
            <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                Unavailable
            </span>
        );
    }

    if (status === 'list_only') {
        return (
            <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                List only
            </span>
        );
    }

    return null;
}

function SaveResourceAction({ row, place, enabled = true }) {
    const { isAuth } = useAuth();
    const { isSaved, isSavedAssetPending, toggleSavedAsset } = useSavedAssets();

    if (!enabled || !isAuth || !row.saveEligible || row.status === 'unavailable') {
        return null;
    }

    const saved = isSaved(row.resourceType, row.resourceId);
    const pending = isSavedAssetPending(row.resourceType, row.resourceId);

    async function handleClick() {
        if (saved || pending) return;
        try {
            await toggleSavedAsset(row.resourceType, row.resourceId, {
                name: row.name,
                subCategory: row.subCategory,
                address: place.address,
                lat: place.lat,
                lng: place.lng,
                detailPath: row.detailPath,
            });
        } catch (err) {
            console.error(err);
        }
    }

    if (saved) {
        return (
            <span className="text-sm font-semibold text-brand-700">
                Saved
            </span>
        );
    }

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={pending}
            className="text-sm font-semibold text-brand-700 transition hover:text-brand-800 disabled:cursor-wait disabled:opacity-60"
        >
            {pending ? 'Saving…' : 'Save'}
        </button>
    );
}

function DirectoryRow({ mode, place, row, onRemoveResource, canSaveResources }) {
    return (
        <div className="flex items-start gap-3 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <ResourceRowIcon
                resourceType={row.resourceType}
                bucket={row.bucket}
                subCategory={row.subCategory}
            />
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            {row.subCategory ? (
                                <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                    {row.subCategory}
                                </span>
                            ) : null}
                            <StatusBadge status={row.status} />
                        </div>
                        <p className="mt-2 text-base font-bold leading-snug text-slate-900">{row.name}</p>
                        {row.descriptor ? (
                            <p className="mt-1 text-sm text-slate-500">{row.descriptor}</p>
                        ) : null}
                    </div>

                    <div className="flex items-center gap-3">
                        {mode === 'shared' ? <SaveResourceAction row={row} place={place} enabled={canSaveResources} /> : null}
                        {mode === 'owner' ? (
                            <button
                                type="button"
                                onClick={() => onRemoveResource?.(row)}
                                className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 transition hover:text-red-600"
                            >
                                <Trash2 size={15} />
                                Remove
                            </button>
                        ) : null}
                    </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-4 text-sm font-semibold">
                    {row.detailPath && row.status !== 'unavailable' ? (
                        <Link to={row.detailPath} className="text-brand-700 transition hover:text-brand-800">
                            View details
                        </Link>
                    ) : (
                        <span className="text-slate-400">View details unavailable</span>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function SharedMapDirectoryList({
    places = [],
    totalResourceCount = 0,
    query = '',
    mode = 'shared',
    onViewOnMap,
    onRemoveResource,
    highlightPlaceKey = null,
    canSaveResources = true,
    className = '',
}) {
    const filteredPlaces = useMemo(() => filterPlaces(places, query), [places, query]);
    const isSearchActive = Boolean(normalizeText(query));
    const [expandedPlaceKeys, setExpandedPlaceKeys] = useState(new Set());
    const [flashPlaceKey, setFlashPlaceKey] = useState(null);
    const sectionRefs = useRef({});

    useEffect(() => {
        const nextExpanded = new Set();
        if (totalResourceCount <= 15) {
            places.forEach((place) => nextExpanded.add(place.placeKey));
        } else {
            places.forEach((place) => {
                if (place.rows.length <= 3) {
                    nextExpanded.add(place.placeKey);
                }
            });
        }
        setExpandedPlaceKeys(nextExpanded);
    }, [places, totalResourceCount]);

    useEffect(() => {
        if (!highlightPlaceKey) return;
        setExpandedPlaceKeys((current) => {
            const next = new Set(current);
            next.add(highlightPlaceKey);
            return next;
        });
        setFlashPlaceKey(highlightPlaceKey);
        const node = sectionRefs.current[highlightPlaceKey];
        if (node) {
            window.requestAnimationFrame(() => {
                node.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        }
        const timeoutId = window.setTimeout(() => setFlashPlaceKey((current) => (
            current === highlightPlaceKey ? null : current
        )), 1800);
        return () => window.clearTimeout(timeoutId);
    }, [highlightPlaceKey]);

    if (!filteredPlaces.length) {
        return (
            <div className={`rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center text-sm text-slate-500 ${className}`}>
                No places or resources match this directory search.
            </div>
        );
    }

    return (
        <div className={`space-y-5 ${className}`}>
            {filteredPlaces.map((place) => {
                const expanded = isSearchActive || expandedPlaceKeys.has(place.placeKey);
                const shouldTruncate = !isSearchActive && totalResourceCount > 15 && place.rows.length >= 4 && !expanded;
                const visibleRows = shouldTruncate ? place.rows.slice(0, 3) : place.rows;

                return (
                    <section
                        key={place.placeKey}
                        ref={(node) => {
                            if (node) {
                                sectionRefs.current[place.placeKey] = node;
                            }
                        }}
                        className={`rounded-[28px] border bg-white p-5 shadow-sm transition ${
                            flashPlaceKey === place.placeKey
                                ? 'border-brand-300 ring-2 ring-brand-100'
                                : 'border-slate-200'
                        }`}
                    >
                        <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                                <p className="text-xl font-bold text-slate-900">{place.name}</p>
                                {place.address ? (
                                    <p className="mt-1 text-sm leading-6 text-slate-500">{place.address}</p>
                                ) : null}
                                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700">
                                    <MapPin size={14} />
                                    {place.curatedCount} {place.curatedCount === 1 ? 'selected resource' : 'selected resources'}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => onViewOnMap?.(place.placeKey)}
                                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-200 hover:text-brand-700"
                            >
                                View on map
                            </button>
                        </div>

                        <div className="mt-4 space-y-3">
                            {visibleRows.map((row) => (
                                <DirectoryRow
                                    key={row.rowKey}
                                    mode={mode}
                                    place={place}
                                    row={row}
                                    onRemoveResource={onRemoveResource}
                                    canSaveResources={canSaveResources}
                                />
                            ))}
                        </div>

                        {shouldTruncate ? (
                            <button
                                type="button"
                                onClick={() => {
                                    setExpandedPlaceKeys((current) => {
                                        const next = new Set(current);
                                        next.add(place.placeKey);
                                        return next;
                                    });
                                }}
                                className="mt-4 inline-flex text-sm font-semibold text-brand-700 transition hover:text-brand-800"
                            >
                                Show all {place.rows.length} resources
                            </button>
                        ) : null}
                    </section>
                );
            })}
        </div>
    );
}
