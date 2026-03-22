import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Navigation, Trash2 } from 'lucide-react';

import { useAuth } from '../contexts/AuthContext.jsx';
import { useSavedAssets } from '../hooks/useSavedAssets.js';
import ResourceRowIcon from './ResourceRowIcon.jsx';

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

function useResponsiveDirectoryLayout(enabled) {
    const [isDesktop, setIsDesktop] = useState(() => (
        typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : true
    ));

    useEffect(() => {
        if (!enabled || typeof window === 'undefined') {
            return undefined;
        }

        const mediaQuery = window.matchMedia('(min-width: 1024px)');
        const handleChange = (event) => setIsDesktop(event.matches);

        setIsDesktop(mediaQuery.matches);
        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        }

        mediaQuery.addListener(handleChange);
        return () => mediaQuery.removeListener(handleChange);
    }, [enabled]);

    return isDesktop;
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
        } catch (error) {
            console.error(error);
        }
    }

    if (saved) {
        return <span className="text-sm font-semibold text-brand-700">Saved</span>;
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

function DirectoryResourceRow({
    row,
    place,
    mode,
    interactive,
    canSaveResources,
    onRemoveResource,
}) {
    return (
        <div className={`flex items-start gap-3 rounded-[20px] border border-slate-200 bg-white ${interactive ? 'p-4 shadow-sm' : 'p-3.5'}`}>
            <ResourceRowIcon
                resourceType={row.resourceType}
                bucket={row.bucket}
                subCategory={row.subCategory}
                className={interactive ? undefined : 'h-10 w-10 rounded-xl'}
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
                        <p className={`mt-2 font-bold leading-snug text-slate-900 ${interactive ? 'text-base' : 'text-sm'}`}>{row.name}</p>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                            <span>{row.resourceType === 'hard' ? 'Place' : 'Offering'}</span>
                            {row.bucket ? <span>{row.bucket}</span> : null}
                        </div>
                        {row.descriptor ? (
                            <p className={`mt-2 leading-6 text-slate-500 ${interactive ? 'text-sm' : 'text-xs'}`}>{row.descriptor}</p>
                        ) : null}
                    </div>

                    {interactive ? (
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
                    ) : null}
                </div>

                {interactive ? (
                    <div className="mt-3 flex flex-wrap gap-4 text-sm font-semibold">
                        {row.detailPath && row.status !== 'unavailable' ? (
                            <Link to={row.detailPath} className="text-brand-700 transition hover:text-brand-800">
                                View details
                            </Link>
                        ) : (
                            <span className="text-slate-400">View details unavailable</span>
                        )}
                    </div>
                ) : null}
            </div>
        </div>
    );
}

function DirectoryPlaceGroupCard({
    group,
    mode,
    interactive,
    onViewOnMap,
    onRemoveResource,
    canSaveResources,
    highlighted,
    sectionRef,
}) {
    return (
        <section
            ref={sectionRef}
            className={`rounded-[28px] border bg-white p-5 shadow-sm transition ${interactive ? '' : 'break-inside-avoid'} ${
                highlighted ? 'border-brand-300 ring-2 ring-brand-100' : 'border-slate-200'
            }`}
        >
            <div className="flex flex-col gap-4 border-b border-slate-100 pb-4">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-brand-700 text-sm font-black text-white shadow-sm">
                        {group.number}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                                <h3 className="text-lg font-bold leading-tight text-slate-900">{group.name}</h3>
                                {group.shortLocationLine ? (
                                    <p className="mt-1 text-sm leading-6 text-slate-500">{group.shortLocationLine}</p>
                                ) : null}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                {group.distanceLabel ? (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                                        <Navigation size={12} />
                                        {group.distanceLabel}
                                    </span>
                                ) : null}
                                <span className="inline-flex rounded-full border border-brand-100 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
                                    {group.curatedCount} {group.curatedCount === 1 ? 'resource' : 'resources'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {interactive ? (
                    <div className="flex justify-end">
                        <button
                            type="button"
                            onClick={() => onViewOnMap?.(group.placeKey)}
                            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-200 hover:text-brand-700"
                        >
                            View on map
                        </button>
                    </div>
                ) : null}
            </div>

            <div className="mt-4 space-y-3">
                {group.rows.map((row) => (
                    <DirectoryResourceRow
                        key={row.rowKey}
                        row={row}
                        place={group}
                        mode={mode}
                        interactive={interactive}
                        canSaveResources={canSaveResources}
                        onRemoveResource={onRemoveResource}
                    />
                ))}
            </div>
        </section>
    );
}

function DirectoryUnmappedRow({ row, interactive, mode, canSaveResources, onRemoveResource }) {
    const place = useMemo(() => ({
        address: row.locationLabel || row.contextLabel || row.placeName || '',
        lat: null,
        lng: null,
    }), [row.contextLabel, row.locationLabel, row.placeName]);

    return (
        <div className={`flex items-start gap-3 rounded-[20px] border border-slate-200 bg-white ${interactive ? 'p-4 shadow-sm' : 'p-3.5'}`}>
            <ResourceRowIcon
                resourceType={row.resourceType}
                bucket={row.bucket}
                subCategory={row.subCategory}
                className={interactive ? undefined : 'h-10 w-10 rounded-xl'}
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
                            <StatusBadge status={row.status || 'list_only'} />
                            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                Not shown on map
                            </span>
                        </div>
                        <p className={`mt-2 font-bold leading-snug text-slate-900 ${interactive ? 'text-base' : 'text-sm'}`}>{row.name}</p>
                        {row.contextLabel ? (
                            <p className={`mt-1 text-slate-500 ${interactive ? 'text-sm' : 'text-xs'}`}>{row.contextLabel}</p>
                        ) : null}
                        {row.locationLabel ? (
                            <p className={`mt-1 text-slate-400 ${interactive ? 'text-sm' : 'text-xs'}`}>{row.locationLabel}</p>
                        ) : null}
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                            <span>{row.resourceType === 'hard' ? 'Place' : 'Offering'}</span>
                            {row.bucket ? <span>{row.bucket}</span> : null}
                        </div>
                        {row.descriptor ? (
                            <p className={`mt-2 leading-6 text-slate-500 ${interactive ? 'text-sm' : 'text-xs'}`}>{row.descriptor}</p>
                        ) : null}
                    </div>

                    {interactive ? (
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
                    ) : null}
                </div>

                {interactive ? (
                    <div className="mt-3 flex flex-wrap gap-4 text-sm font-semibold">
                        {row.detailPath && row.status !== 'unavailable' ? (
                            <Link to={row.detailPath} className="text-brand-700 transition hover:text-brand-800">
                                View details
                            </Link>
                        ) : (
                            <span className="text-slate-400">View details unavailable</span>
                        )}
                    </div>
                ) : null}
            </div>
        </div>
    );
}

function DirectoryGroupColumn({
    groups,
    mode,
    interactive,
    onViewOnMap,
    onRemoveResource,
    canSaveResources,
    highlightPlaceKey,
    sectionRefs,
    preserveSlot = false,
}) {
    if (!groups.length) {
        return preserveSlot ? <div aria-hidden="true" className="min-h-px" /> : null;
    }

    return (
        <div className="space-y-4">
            {groups.map((group) => (
                <DirectoryPlaceGroupCard
                    key={group.placeKey}
                    group={group}
                    mode={mode}
                    interactive={interactive}
                    onViewOnMap={onViewOnMap}
                    onRemoveResource={onRemoveResource}
                    canSaveResources={canSaveResources}
                    highlighted={highlightPlaceKey === group.placeKey}
                    sectionRef={(node) => {
                        if (node) {
                            sectionRefs.current[group.placeKey] = node;
                        }
                    }}
                />
            ))}
        </div>
    );
}

function DirectoryUnmappedSection({
    rows,
    interactive,
    mode,
    canSaveResources,
    onRemoveResource,
}) {
    if (!rows.length) {
        return null;
    }

    return (
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="border-b border-slate-100 pb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Unmapped resources</p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Resources not shown on map</h2>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">
                    These offerings belong in the directory but do not have a real mappable host location.
                </p>
            </div>

            <div className="mt-4 space-y-3">
                {rows.map((row) => (
                    <DirectoryUnmappedRow
                        key={row.rowKey}
                        row={row}
                        interactive={interactive}
                        mode={mode}
                        canSaveResources={canSaveResources}
                        onRemoveResource={onRemoveResource}
                    />
                ))}
            </div>
        </section>
    );
}

export default function SharedMapDirectoryList({
    presentation,
    mode = 'shared',
    layout = 'responsive',
    renderDesktopMap = null,
    renderMobileMap = null,
    onViewOnMap,
    onRemoveResource,
    highlightPlaceKey = null,
    canSaveResources = true,
    className = '',
    desktopGridClassName = 'lg:grid-cols-[minmax(0,1fr)_minmax(340px,520px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_minmax(420px,560px)_minmax(0,1fr)]',
    desktopMapWrapperClassName = '',
}) {
    const sectionRefs = useRef({});
    const [flashPlaceKey, setFlashPlaceKey] = useState(null);
    const isDesktop = useResponsiveDirectoryLayout(layout === 'responsive');
    const resolvedLayout = layout === 'responsive'
        ? (isDesktop ? 'desktop' : 'mobile')
        : layout;
    const mappedGroups = presentation?.mappedGroups || [];
    const leftGroups = presentation?.leftGroups || [];
    const rightGroups = presentation?.rightGroups || [];
    const unmappedRows = presentation?.unmappedRows || [];
    const interactive = layout !== 'print';

    useEffect(() => {
        if (!highlightPlaceKey || !interactive) return undefined;

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
    }, [highlightPlaceKey, interactive]);

    if (!mappedGroups.length && !unmappedRows.length) {
        return (
            <div className={`rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center text-sm text-slate-500 ${className}`}>
                No places or resources match this directory search.
            </div>
        );
    }

    if (resolvedLayout === 'mobile') {
        return (
            <div className={`space-y-4 ${className}`}>
                {renderMobileMap ? (
                    <div className="sticky top-3 z-20 bg-slate-50 pb-2">
                        {renderMobileMap()}
                    </div>
                ) : null}

                <DirectoryGroupColumn
                    groups={mappedGroups}
                    mode={mode}
                    interactive
                    onViewOnMap={onViewOnMap}
                    onRemoveResource={onRemoveResource}
                    canSaveResources={canSaveResources}
                    highlightPlaceKey={flashPlaceKey}
                    sectionRefs={sectionRefs}
                />

                <DirectoryUnmappedSection
                    rows={unmappedRows}
                    interactive
                    mode={mode}
                    canSaveResources={canSaveResources}
                    onRemoveResource={onRemoveResource}
                />
            </div>
        );
    }

    return (
        <div className={`space-y-6 ${className}`}>
            <div className={`grid gap-5 ${desktopGridClassName}`}>
                <DirectoryGroupColumn
                    groups={leftGroups}
                    mode={mode}
                    interactive={interactive}
                    onViewOnMap={onViewOnMap}
                    onRemoveResource={onRemoveResource}
                    canSaveResources={canSaveResources}
                    highlightPlaceKey={flashPlaceKey}
                    sectionRefs={sectionRefs}
                    preserveSlot
                />

                <div className={`${interactive ? 'lg:sticky lg:top-6' : ''} ${desktopMapWrapperClassName}`.trim()}>
                    {renderDesktopMap?.()}
                </div>

                <DirectoryGroupColumn
                    groups={rightGroups}
                    mode={mode}
                    interactive={interactive}
                    onViewOnMap={onViewOnMap}
                    onRemoveResource={onRemoveResource}
                    canSaveResources={canSaveResources}
                    highlightPlaceKey={flashPlaceKey}
                    sectionRefs={sectionRefs}
                    preserveSlot
                />
            </div>

            <DirectoryUnmappedSection
                rows={unmappedRows}
                interactive={interactive}
                mode={mode}
                canSaveResources={canSaveResources}
                onRemoveResource={onRemoveResource}
            />
        </div>
    );
}
