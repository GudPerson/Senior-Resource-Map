import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext.jsx';
import { useSavedAssets } from '../hooks/useSavedAssets.js';
import { Trash2 } from 'lucide-react';
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

function MapLegend({ mobile = false }) {
    return (
        <div className={`flex items-center justify-between border border-slate-200 bg-white px-4 py-2 text-[16px] font-bold text-slate-600 isolate ${
            mobile
                ? 'rounded-b-xl mt-0'
                : 'rounded-xl mt-4 shadow-sm backdrop-blur-sm'
        }`}>
            <div className="flex items-center gap-1.5">
                <div className="h-[0.9em] w-[0.9em] rounded-full border border-white bg-[#0f766e] shadow-sm" />
                <span>Single</span>
            </div>
            <div className="flex items-center gap-1.5">
                <div className="flex h-[1.1em] w-[1.1em] items-center justify-center rounded-lg bg-[#0f766e] text-[0.7em] font-black text-white shadow-sm">1</div>
                <span>Resource #</span>
            </div>
            <div className="flex items-center gap-1.5">
                <div className="flex -space-x-1.5">
                    <div className="h-[0.9em] w-[0.9em] rounded-full border border-white bg-blue-500 shadow-sm" />
                    <div className="h-[0.9em] w-[0.9em] rounded-full border border-white bg-pink-500 shadow-sm" />
                    <div className="h-[0.9em] w-[0.9em] rounded-full border border-white bg-orange-500 shadow-sm" />
                </div>
                <span>Clusters</span>
            </div>
        </div>
    );
}

const DIRECTORY_DESKTOP_LAYOUT_MIN_WIDTH = 1280;

function useResponsiveDirectoryLayout(enabled) {
    const [isDesktop, setIsDesktop] = useState(() => (
        typeof window !== 'undefined'
            ? window.matchMedia(`(min-width: ${DIRECTORY_DESKTOP_LAYOUT_MIN_WIDTH}px)`).matches
            : true
    ));

    useEffect(() => {
        if (!enabled || typeof window === 'undefined') {
            return undefined;
        }

        const mediaQuery = window.matchMedia(`(min-width: ${DIRECTORY_DESKTOP_LAYOUT_MIN_WIDTH}px)`);
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

function getGroupDetailPath(group) {
    if (Number.isInteger(group?.placeId) && group.placeId > 0) {
        return `/resource/hard/${group.placeId}`;
    }

    return group?.rows?.find((row) => row.detailPath && row.status !== 'unavailable')?.detailPath || null;
}

function normalizeLabel(value) {
    return String(value || '').trim().toLowerCase();
}

function isRepeatedPrimaryRow(group, row) {
    return Boolean(normalizeLabel(group?.name)) && normalizeLabel(group?.name) === normalizeLabel(row?.name);
}

function getVisibleGroupRows(group) {
    return (group?.rows || []).filter((row) => !isRepeatedPrimaryRow(group, row));
}

function getGroupHoverLogoRow(group) {
    return (group?.rows || []).find((row) => row?.logoUrl);
}

function getSecondaryCategory(row) {
    return row?.subCategory || row?.bucket || (row?.resourceType === 'hard' ? 'Place' : 'Offering');
}

function DirectoryResourceRow({
    row,
    place,
    mode,
    interactive,
    compactInteractive = false,
    showDivider = false,
    canSaveResources,
    allowPrintLinks = false,
    compactPrint = false,
}) {
    const canOpenDetail = Boolean(row.detailPath) && row.status !== 'unavailable';
    const rowTitleClassName = interactive
        ? (compactInteractive ? 'text-[12px]' : 'text-[14px]')
        : (compactPrint ? 'text-[11px]' : 'text-[12px]');

    if (!interactive) {
        const printRowTitle = canOpenDetail && allowPrintLinks ? (
            <Link to={row.detailPath} className={`font-semibold leading-snug text-slate-800 transition hover:text-brand-700 ${rowTitleClassName}`}>
                {row.name}
            </Link>
        ) : (
            <p className={`font-semibold leading-snug text-slate-800 ${rowTitleClassName}`}>{row.name}</p>
        );

        return (
            <div className="border-b border-slate-100 pb-1 last:border-b-0 last:pb-0">
                <div className="flex items-center gap-1.5">
                    <span className="h-1 w-1 shrink-0 rounded-full bg-slate-300" aria-hidden="true" />
                    <div className="flex flex-wrap items-center gap-1.5">
                        {printRowTitle}
                        {row.status === 'unavailable' ? <StatusBadge status={row.status} /> : null}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={showDivider ? 'border-t border-slate-100 pt-1.5' : ''}>
            <div className={`flex items-start justify-between ${mode === 'shared' ? (compactInteractive ? 'gap-2' : 'gap-3') : ''}`}>
                <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2.5">
                        <span className="mt-[0.6em] h-1 w-1 flex-shrink-0 rounded-full bg-slate-300" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                            {canOpenDetail ? (
                                <Link to={row.detailPath} className={`block font-semibold leading-snug text-slate-800 transition hover:text-brand-700 ${rowTitleClassName}`}>
                                    {row.name}
                                </Link>
                            ) : (
                                <p className={`font-semibold leading-snug text-slate-800 ${rowTitleClassName}`}>{row.name}</p>
                            )}
                        </div>
                    </div>
                </div>
                {mode === 'shared' ? (
                    <div className="ml-2 flex flex-shrink-0 items-start">
                        <SaveResourceAction row={row} place={place} enabled={canSaveResources} />
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
    compactInteractive = false,
    onViewOnMap,
    onRemoveResource,
    canSaveResources,
    highlighted,
    sectionRef,
    allowPrintLinks = false,
    compactPrint = false,
    clusterColorData = null,
    showDesktopHoverLogo = false,
    logoRevealed = false,
}) {
    const placeDetailPath = getGroupDetailPath(group);
    const visibleRows = getVisibleGroupRows(group);

    if (!interactive) {
        const printPlaceTitle = placeDetailPath && allowPrintLinks ? (
            <Link to={placeDetailPath} className={`block font-bold leading-tight text-slate-900 transition hover:text-brand-700 ${compactPrint ? 'text-[15px]' : 'text-base'}`}>
                {group.name}
            </Link>
        ) : (
            <h3 className={`font-bold leading-tight text-slate-900 ${compactPrint ? 'text-[15px]' : 'text-base'}`}>{group.name}</h3>
        );

        return (
            <section
                ref={sectionRef}
                className={`break-inside-avoid rounded-[18px] border border-slate-200/90 bg-white/90 px-3 py-2.5 transition ${
                    highlighted ? 'border-brand-300 ring-2 ring-brand-100' : ''
                }`}
            >
                <div className="flex items-start gap-2.5">
                    <div 
                        className={`flex flex-shrink-0 items-center justify-center rounded-lg font-black text-white ${compactPrint ? 'h-7 w-7' : 'h-8 w-8'}`}
                        style={{ 
                            backgroundColor: clusterColorData ? clusterColorData.core : '#0f766e',
                            fontSize: String(group.number).length > 2 ? '11px' : (compactPrint ? '15px' : '17px'),
                            fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                            lineHeight: 1,
                        }}
                    >
                        {group.number}
                    </div>
                    <div className="min-w-0 flex-1">
                        {printPlaceTitle}
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                            {group.shortLocationLine ? (
                                <p className={`${compactPrint ? 'text-[10px]' : 'text-[11px]'} text-slate-500`}>{group.shortLocationLine}</p>
                            ) : null}
                            {group.distanceLabel ? (
                                <span className="inline-flex rounded-full border border-brand-200 bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-700">
                                    {group.distanceLabel}
                                </span>
                            ) : null}
                        </div>

                        {visibleRows.length ? (
                            <div className={`mt-1 ${compactPrint ? 'space-y-0.5' : 'space-y-1'}`}>
                                {visibleRows.map((row) => (
                                    <DirectoryResourceRow
                                        key={row.rowKey}
                                        row={row}
                                        place={group}
                                        mode={mode}
                                        interactive={false}
                                        canSaveResources={canSaveResources}
                                        allowPrintLinks={allowPrintLinks}
                                        compactPrint={compactPrint}
                                    />
                                ))}
                            </div>
                        ) : null}
                    </div>
                </div>
            </section>
        );
    }

    const interactivePlaceTitle = placeDetailPath ? (
        <Link to={placeDetailPath} className={`${compactInteractive ? 'text-[15px]' : 'text-[17px]'} font-bold leading-tight text-slate-900 transition hover:text-brand-700`}>
            {group.name}
        </Link>
    ) : (
        <h3 className={`${compactInteractive ? 'text-[15px]' : 'text-[17px]'} font-bold leading-tight text-slate-900`}>{group.name}</h3>
    );
    const hoverLogoRow = showDesktopHoverLogo ? getGroupHoverLogoRow(group) : null;

    const cardContent = (
        <>
            {hoverLogoRow?.logoUrl ? (
                <div
                    className={`pointer-events-none absolute z-20 flex items-center justify-center border border-slate-200 bg-white/95 shadow-xl shadow-slate-200/70 backdrop-blur-sm transition-all duration-300 ${
                        compactInteractive
                            ? 'left-3 top-3 h-8 w-8 rounded-lg p-0.5'
                            : 'left-4 top-4 h-9 w-9 rounded-xl p-0.5'
                    } ${
                        logoRevealed
                            ? 'opacity-100 scale-110'
                            : 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-110'
                    }`}
                    aria-hidden="true"
                >
                    <img
                        src={hoverLogoRow.logoUrl}
                        alt={hoverLogoRow.name || group.name}
                        className="h-full w-full object-contain"
                    />
                </div>
            ) : null}
            <div className={`flex items-start ${compactInteractive ? 'gap-2.5' : 'gap-3'}`}>
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); onViewOnMap?.(group.placeKey); }}
                    className={`relative z-10 flex flex-shrink-0 items-center justify-center font-black text-white shadow-sm transition hover:opacity-90 ${compactInteractive ? 'h-8 w-8 rounded-lg' : 'h-9 w-9 rounded-xl'}`}
                    style={{ 
                        backgroundColor: clusterColorData ? clusterColorData.core : '#0f766e',
                        fontSize: String(group.number).length > 2 ? '12px' : (compactInteractive ? '16px' : '18px'),
                        fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                        lineHeight: 1,
                    }}
                    aria-label={`View ${group.name} on map`}
                    title="View on map"
                >
                    {group.number}
                </button>
                <div className="min-w-0 flex-1">
                    {interactivePlaceTitle}
                    <div className={`flex flex-wrap items-center ${compactInteractive ? 'mt-0.5 gap-1.5' : 'mt-1 gap-2'}`}>
                        {group.shortLocationLine ? (
                            <p className={`${compactInteractive ? 'text-[11px]' : 'text-[12px]'} font-medium text-slate-500`}>{group.shortLocationLine}</p>
                        ) : null}
                        {group.distanceLabel ? (
                            <span className={`inline-flex rounded-full border border-brand-200 bg-brand-50 font-bold text-brand-700 ${compactInteractive ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'}`}>
                                {group.distanceLabel}
                            </span>
                        ) : null}
                    </div>

                    {visibleRows.length ? (
                        <div className={`border-t border-slate-100 ${compactInteractive ? 'mt-2 space-y-1.5 pt-2' : 'mt-3 space-y-2.5 pt-3'}`}>
                            {visibleRows.map((row, index) => (
                                <DirectoryResourceRow
                                    key={row.rowKey}
                                    row={row}
                                    place={group}
                                    mode={mode}
                                    interactive
                                    compactInteractive={compactInteractive}
                                    showDivider={compactInteractive && index > 0}
                                    canSaveResources={canSaveResources}
                                />
                            ))}
                        </div>
                    ) : null}
                </div>
            </div>
        </>
    );

    if (placeDetailPath) {
        return (
            <Link
                to={placeDetailPath}
                ref={sectionRef}
                className={`group relative block overflow-visible border border-slate-200 bg-white shadow-sm transition-all duration-300 cursor-pointer hover:shadow-md ${compactInteractive ? 'rounded-[20px] p-3' : 'rounded-[24px] p-4'} ${
                    highlighted ? 'selected-card-pulse ring-4 ring-brand-500/10 scale-[1.03] z-10 shadow-xl' : ''
                } scroll-mt-[62svh] lg:scroll-mt-6`}
            >
                {cardContent}
            </Link>
        );
    }

    return (
        <section
            ref={sectionRef}
            className={`group relative overflow-visible border border-slate-200 bg-white shadow-sm transition-all duration-300 ${compactInteractive ? 'rounded-[20px] p-3' : 'rounded-[24px] p-4'} ${
                highlighted ? 'selected-card-pulse ring-4 ring-brand-500/10 scale-[1.03] z-10 shadow-xl' : ''
            } scroll-mt-[62svh] lg:scroll-mt-6`}
        >
            {cardContent}
        </section>
    );
}

function DirectoryUnmappedRow({ row, interactive, mode, canSaveResources, onRemoveResource }) {
    const place = useMemo(() => ({
        address: row.locationLabel || row.contextLabel || row.placeName || '',
        lat: null,
        lng: null,
    }), [row.contextLabel, row.locationLabel, row.placeName]);

    if (!interactive) {
        const canOpenDetail = Boolean(row.detailPath) && row.status !== 'unavailable';

        return (
            <div className="border-b border-slate-200/80 pb-2 last:border-b-0 last:pb-0">
                <div className="flex items-start gap-2">
                    <span className="mt-[5px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-300" />
                    <div className="min-w-0 flex-1">
                        {canOpenDetail ? (
                            <Link to={row.detailPath} className="text-[12px] font-semibold leading-snug text-slate-800 transition hover:text-brand-700">
                                {row.name}
                            </Link>
                        ) : (
                            <p className="text-[12px] font-semibold leading-snug text-slate-800">{row.name}</p>
                        )}
                        {row.contextLabel ? <p className="mt-0.5 text-[10px] text-slate-500">{row.contextLabel}</p> : null}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-start gap-3 rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
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
                                <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-900">
                                    {row.subCategory}
                                </span>
                            ) : null}
                            <StatusBadge status={row.status || 'list_only'} />
                            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-900">
                                Not shown on map
                            </span>
                        </div>
                        {row.detailPath && row.status !== 'unavailable' ? (
                            <Link to={row.detailPath} className="mt-1.5 block text-base font-bold leading-snug text-slate-900 transition hover:text-brand-700">
                                {row.name}
                            </Link>
                        ) : (
                            <p className="mt-1.5 text-base font-bold leading-snug text-slate-900">{row.name}</p>
                        )}
                        {row.contextLabel ? (
                            <p className="mt-1 text-sm text-slate-500">{row.contextLabel}</p>
                        ) : null}
                        {row.locationLabel ? (
                            <p className="mt-1 text-sm text-slate-400">{row.locationLabel}</p>
                        ) : null}
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                            <span>{row.resourceType === 'hard' ? 'Place' : 'Offering'}</span>
                            {row.bucket ? <span>{row.bucket}</span> : null}
                        </div>
                        {row.descriptor ? (
                            <p className="mt-1.5 text-sm leading-6 text-slate-500">{row.descriptor}</p>
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
    compactInteractive = false,
    onViewOnMap,
    onRemoveResource,
    canSaveResources,
    highlightPlaceKey,
    highlightPlaceKeys = [],
    sectionRefs,
    preserveSlot = false,
    allowPrintLinks = false,
    compactPrint = false,
    clusterMapping = {},
    showDesktopHoverLogo = false,
    logoRevealPlaceKey = null,
}) {
    if (!groups.length) {
        return preserveSlot ? <div aria-hidden="true" className="min-h-px" /> : null;
    }

    return (
        <div className={interactive ? (compactInteractive ? 'space-y-3' : 'space-y-4') : (compactPrint ? 'space-y-1.5' : 'space-y-2')}>
            {groups.map((group) => (
                <DirectoryPlaceGroupCard
                    key={group.placeKey}
                    group={group}
                    mode={mode}
                    interactive={interactive}
                    compactInteractive={compactInteractive}
                    onViewOnMap={onViewOnMap}
                    onRemoveResource={onRemoveResource}
                    canSaveResources={canSaveResources}
                    highlighted={highlightPlaceKey === group.placeKey || highlightPlaceKeys.includes(group.placeKey)}
                    allowPrintLinks={allowPrintLinks}
                    compactPrint={compactPrint}
                    clusterColorData={clusterMapping[group.placeKey] || null}
                    showDesktopHoverLogo={showDesktopHoverLogo}
                    logoRevealed={logoRevealPlaceKey === group.placeKey}
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
        <section className={`border border-slate-200 ${interactive ? 'rounded-[28px] bg-white p-5 shadow-sm sm:p-6' : 'rounded-[30px] bg-slate-50/70 p-5 shadow-none sm:p-6'}`}>
            <div className={`border-b ${interactive ? 'border-slate-100 pb-4' : 'border-slate-200/80 pb-3'}`}>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Unmapped resources</p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Resources not shown on map</h2>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">
                    These offerings belong in the directory but do not have a real mappable host location.
                </p>
            </div>

            <div className={`mt-4 ${interactive ? 'space-y-3' : 'space-y-2.5'}`}>
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
    highlightPlaceKeys = [],
    canSaveResources = true,
    className = '',
    desktopGridClassName = 'lg:grid-cols-[minmax(0,1fr)_minmax(340px,520px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_minmax(420px,560px)_minmax(0,1fr)]',
    desktopMapWrapperClassName = '',
    mobileMapStickyClassName = 'sticky top-3 z-20 bg-slate-50 pb-2',
    allowPrintLinks = false,
    autoScrollToHighlight = true,
    showDesktopHoverLogo = false,
}) {
    const sectionRefs = useRef({});
    const [flashPlaceKey, setFlashPlaceKey] = useState(null);
    const [clusterMapping, setClusterMapping] = useState({});
    const isDesktop = useResponsiveDirectoryLayout(layout === 'responsive');
    const resolvedLayout = layout === 'responsive'
        ? (isDesktop ? 'desktop' : 'mobile')
        : layout;
    const mappedGroups = presentation?.mappedGroups || [];
    const leftGroups = presentation?.leftGroups || [];
    const rightGroups = presentation?.rightGroups || [];
    const unmappedRows = presentation?.unmappedRows || [];
    const interactive = layout !== 'print';
    const compactPrint = !interactive && (
        mappedGroups.length >= 7
        || mappedGroups.reduce((count, group) => count + group.rows.length, 0) >= 10
    );
    const interactiveRowCount = mappedGroups.reduce((count, group) => count + getVisibleGroupRows(group).length, 0);
    const compactInteractiveDesktop = interactive
        && resolvedLayout === 'desktop'
        && (mappedGroups.length >= 7 || interactiveRowCount >= 9);
    const logoRevealPlaceKey = showDesktopHoverLogo
        ? (highlightPlaceKey || (highlightPlaceKeys.length === 1 ? highlightPlaceKeys[0] : null))
        : null;

    useEffect(() => {
        if (!interactive) return undefined;

        if (!highlightPlaceKey) {
            setFlashPlaceKey(null);
            return undefined;
        }

        setFlashPlaceKey(highlightPlaceKey);
        if (!autoScrollToHighlight) return undefined;

        const node = sectionRefs.current[highlightPlaceKey];
        if (node) {
            window.requestAnimationFrame(() => {
                node.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        }
        // No timeout — flashPlaceKey stays set permanently until the next selection.
    }, [autoScrollToHighlight, highlightPlaceKey, interactive]);

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
                    <div className={`${mobileMapStickyClassName} disable-font-scaling`}>
                        {React.cloneElement(renderMobileMap(), { onClusterChange: setClusterMapping })}
                        <MapLegend mobile />
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
                    highlightPlaceKeys={highlightPlaceKeys}
                    sectionRefs={sectionRefs}
                    clusterMapping={clusterMapping}
                    showDesktopHoverLogo={showDesktopHoverLogo}
                    logoRevealPlaceKey={logoRevealPlaceKey}
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
                    compactInteractive={compactInteractiveDesktop}
                    onViewOnMap={onViewOnMap}
                    onRemoveResource={onRemoveResource}
                    canSaveResources={canSaveResources}
                    highlightPlaceKey={flashPlaceKey}
                    highlightPlaceKeys={highlightPlaceKeys}
                    sectionRefs={sectionRefs}
                    preserveSlot
                    allowPrintLinks={allowPrintLinks}
                    compactPrint={compactPrint}
                    clusterMapping={clusterMapping}
                    showDesktopHoverLogo={showDesktopHoverLogo}
                    logoRevealPlaceKey={logoRevealPlaceKey}
                />

                <div className={`${interactive ? 'lg:sticky lg:top-6' : ''} ${desktopMapWrapperClassName}`.trim()}>
                    {renderDesktopMap ? React.cloneElement(renderDesktopMap(), { onClusterChange: setClusterMapping }) : null}
                    {resolvedLayout !== 'print' && <MapLegend />}
                </div>

                <DirectoryGroupColumn
                    groups={rightGroups}
                    mode={mode}
                    interactive={interactive}
                    compactInteractive={compactInteractiveDesktop}
                    onViewOnMap={onViewOnMap}
                    onRemoveResource={onRemoveResource}
                    canSaveResources={canSaveResources}
                    highlightPlaceKey={flashPlaceKey}
                    highlightPlaceKeys={highlightPlaceKeys}
                    sectionRefs={sectionRefs}
                    preserveSlot
                    allowPrintLinks={allowPrintLinks}
                    compactPrint={compactPrint}
                    clusterMapping={clusterMapping}
                    showDesktopHoverLogo={showDesktopHoverLogo}
                    logoRevealPlaceKey={logoRevealPlaceKey}
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
