import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, CalendarDays, Clock, MapPin, Navigation, Phone } from 'lucide-react';

import { getDistance } from '../lib/geo.js';
import {
    SOFT_ASSET_BUCKETS,
    groupSoftAssetsByBucket,
    summarizeSoftAssetBuckets,
} from '../lib/softAssetBuckets.js';
import { formatAvailabilityLabel, normalizeAvailabilityCount, normalizeAvailabilityUnit } from '../lib/availability.js';
import { OFFERING_ACCESS } from '../lib/eligibility.js';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import OfferingAccessNotice from './OfferingAccessNotice.jsx';

function TagBadge({ tag }) {
    return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold border border-slate-300">
            #{tag}
        </span>
    );
}

function LinkifiedText({ text }) {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return (
        <>
            {parts.map((part, index) => {
                if (part.match(urlRegex)) {
                    return (
                        <a
                            key={index}
                            href={part}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-600 hover:underline break-all"
                            onClick={(event) => event.stopPropagation()}
                        >
                            {part}
                        </a>
                    );
                }
                return part;
            })}
        </>
    );
}

function hasValidCoordinates(value) {
    return Number.isFinite(Number.parseFloat(value?.lat)) && Number.isFinite(Number.parseFloat(value?.lng));
}

function formatDistance(distance) {
    if (!Number.isFinite(distance)) return null;
    return distance < 1 ? `${Math.round(distance * 1000)}m away` : `${distance.toFixed(1)}km away`;
}

export default function ResourceDetailContent({
    asset,
    className = '',
    containerWidth = null,
    layoutMode = 'page',
    onNavigateToResource,
    sortOrigin = null,
    sortOriginLabel = null,
    subCatColors = {},
    type,
}) {
    const [activeSoftBucket, setActiveSoftBucket] = useState('Programmes');
    const isPhone = useMediaQuery('(max-width: 639px)');

    if (!asset) return null;

    const isHard = type === 'hard';
    const isEmbeddedPane = layoutMode === 'pane';
    const isCompact = isEmbeddedPane ? (containerWidth ?? 0) <= 560 : isPhone;
    const rootSpacingClass = isCompact ? 'space-y-5' : 'space-y-6';
    const heroClass = asset.bannerUrl
        ? (isCompact ? 'h-48' : 'h-64 sm:h-80')
        : (isCompact ? 'h-28' : 'h-32 sm:h-48');
    const detailCardClass = isCompact ? 'rounded-[24px] border p-5 shadow-sm' : 'rounded-[28px] border p-6 shadow-sm sm:p-8';
    const introLayoutClass = isCompact ? 'flex flex-col items-start gap-3 mb-4' : 'flex flex-col sm:flex-row items-start gap-4 mb-4';
    const introTitleClass = isCompact ? 'text-[2rem] font-bold text-slate-900 leading-tight' : 'text-3xl font-bold text-slate-900 leading-tight';
    const copyClass = isCompact ? 'space-y-4 text-slate-600 text-base leading-relaxed mt-5' : 'space-y-4 text-slate-600 text-lg leading-relaxed mt-6';
    const infoGridClass = isCompact ? 'grid grid-cols-1 gap-5 mt-7 pt-5 border-t border-slate-200' : 'grid grid-cols-1 sm:grid-cols-2 gap-6 mt-8 pt-6 border-t border-slate-200';
    const directionsButtonClass = isCompact
        ? 'w-full flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-white font-bold transition shadow-sm text-base'
        : 'w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-white font-bold transition shadow-sm text-lg';
    const relatedCardClass = isCompact
        ? 'rounded-[24px] border p-4 shadow-sm'
        : 'rounded-[28px] border p-4 shadow-sm sm:p-6';
    const relatedHeaderClass = isCompact
        ? 'flex flex-col gap-4'
        : 'flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between';
    const bucketGridClass = isCompact
        ? 'grid w-full grid-cols-1 gap-2'
        : 'grid w-full grid-cols-3 gap-2 sm:min-w-[320px] sm:w-auto';
    const bucketButtonClass = isCompact
        ? 'rounded-2xl border px-3 py-3 text-left transition-colors'
        : 'rounded-2xl border px-2.5 py-2 text-left transition-colors sm:px-3';
    const relatedItemClass = isCompact
        ? 'flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-brand-500 hover:shadow-md cursor-pointer'
        : 'flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-brand-500 hover:shadow-md sm:gap-4 sm:p-4 cursor-pointer';

    const softLocations = useMemo(() => {
        if (isHard) return [];

        const locations = Array.isArray(asset.locations) && asset.locations.length > 0
            ? asset.locations
            : (asset.location ? [asset.location] : []);

        if (!sortOrigin) {
            return locations;
        }

        return [...locations]
            .map((location) => ({
                ...location,
                _distance: hasValidCoordinates(location)
                    ? getDistance(
                        sortOrigin.lat,
                        sortOrigin.lng,
                        Number.parseFloat(location.lat),
                        Number.parseFloat(location.lng),
                    )
                    : null,
            }))
            .sort((left, right) => {
                if (left._distance === null) return 1;
                if (right._distance === null) return -1;
                return left._distance - right._distance;
            });
    }, [asset, isHard, sortOrigin]);

    const primaryLocation = isHard ? asset : (softLocations[0] || asset.location || null);
    const primaryAddress = isHard ? asset?.address : primaryLocation?.address;
    const phone = asset?.phone || primaryLocation?.phone;
    const availablePlaceCount = isHard ? 0 : softLocations.length;
    const availabilityEnabled = !isHard && Boolean(asset.availabilityEnabled);
    const availabilityCount = normalizeAvailabilityCount(asset.availabilityCount);
    const availabilityUnit = normalizeAvailabilityUnit(asset.availabilityUnit);
    const access = !isHard ? (asset.access || OFFERING_ACCESS.GRANTED) : null;
    const relatedSoftAssetGroups = useMemo(() => (
        isHard ? groupSoftAssetsByBucket(asset?.softAssets || []) : { Programmes: [], Services: [], Promotions: [] }
    ), [asset?.softAssets, isHard]);
    const relatedSoftAssetCounts = useMemo(() => (
        isHard ? summarizeSoftAssetBuckets(asset?.softAssets || []) : { Programmes: 0, Services: 0, Promotions: 0 }
    ), [asset?.softAssets, isHard]);
    const hasDirectionsTarget = isHard
        ? Boolean(asset && (asset.address || hasValidCoordinates(asset)))
        : Boolean(primaryLocation && (primaryLocation.address || hasValidCoordinates(primaryLocation)));

    useEffect(() => {
        if (!isHard) return;
        const nextBucket = SOFT_ASSET_BUCKETS.find((bucket) => relatedSoftAssetCounts[bucket] > 0) || 'Programmes';
        setActiveSoftBucket(nextBucket);
    }, [isHard, relatedSoftAssetCounts]);

    const handleDirections = useCallback((customLocation = null) => {
        const target = customLocation || (isHard ? asset : primaryLocation);
        if (!target) return;

        const lat = Number.parseFloat(target.lat);
        const lng = Number.parseFloat(target.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank', 'noopener,noreferrer');
        } else if (target.address) {
            window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(target.address)}`, '_blank', 'noopener,noreferrer');
        }
    }, [asset, isHard, primaryLocation]);

    return (
        <div className={`${rootSpacingClass} ${className}`}>
            {(asset.bannerUrl || asset.logoUrl) && (
                <div
                    className={`w-full ${heroClass} ${isCompact ? 'rounded-[24px]' : 'rounded-[28px]'} border overflow-hidden flex items-center justify-center p-4 shadow-sm relative`}
                    style={{ backgroundColor: 'rgba(255,255,255,0.88)', borderColor: 'var(--color-border)' }}
                >
                    {asset.bannerUrl ? (
                        <img src={asset.bannerUrl} alt="Banner" className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                        <img src={asset.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                    )}
                </div>
            )}

            <div
                className={detailCardClass}
                style={{ backgroundColor: 'rgba(255,255,255,0.88)', borderColor: 'var(--color-border)' }}
            >
                <div className={introLayoutClass}>
                    {asset.logoUrl && asset.bannerUrl ? (
                        <img
                            src={asset.logoUrl}
                            alt="Logo"
                            className="w-20 h-20 rounded-2xl border object-contain bg-white flex-shrink-0"
                            style={{ borderColor: 'var(--color-border)' }}
                        />
                    ) : null}
                    <div>
                        <div
                            className="inline-flex items-center gap-1.5 px-3 py-1 mb-3 rounded-full bg-white text-sm font-bold border shadow-sm"
                            style={{ color: subCatColors[asset.subCategory] || '#334155', borderColor: 'var(--color-border)' }}
                        >
                            {isHard ? <Building2 size={16} /> : <CalendarDays size={16} />}
                            {asset.subCategory || (isHard ? 'Place' : 'Offering')}
                        </div>
                        <h1 className={introTitleClass}>{asset.name}</h1>
                        {!isHard ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                                <span
                                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold border"
                                    style={{
                                        backgroundColor: 'var(--color-brand-light)',
                                        color: 'var(--color-brand-strong)',
                                        borderColor: 'var(--color-border)',
                                    }}
                                >
                                    Available in {availablePlaceCount} {availablePlaceCount === 1 ? 'place' : 'places'}
                                </span>
                                {availabilityEnabled ? (
                                    <span
                                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold border"
                                        style={{
                                            backgroundColor: 'color-mix(in srgb, var(--color-brand-light) 60%, white)',
                                            color: 'var(--color-brand-strong)',
                                            borderColor: 'var(--color-border)',
                                        }}
                                    >
                                        {formatAvailabilityLabel(availabilityCount, availabilityUnit)}
                                    </span>
                                ) : null}
                                {sortOriginLabel ? (
                                    <span
                                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border"
                                        style={{
                                            backgroundColor: 'var(--color-badge-bg)',
                                            color: 'var(--color-text-secondary)',
                                            borderColor: 'var(--color-border)',
                                        }}
                                    >
                                        Sorted nearest to {sortOriginLabel}
                                    </span>
                                ) : null}
                            </div>
                        ) : null}

                        {!isHard ? (
                            <OfferingAccessNotice
                                access={access}
                                missingProfileFields={asset.missingProfileFields}
                                className="mt-4"
                            />
                        ) : null}
                    </div>
                </div>

                <div className={copyClass}>
                    {asset.description ? (
                        <p className="whitespace-pre-wrap"><LinkifiedText text={asset.description} /></p>
                    ) : (
                        <p className="italic text-slate-400">No description provided.</p>
                    )}
                </div>

                <div className={infoGridClass}>
                    {isHard && primaryAddress ? (
                        <div className="flex items-start gap-3">
                            <div className="p-2.5 bg-brand-50 rounded-xl text-brand-600 shrink-0"><MapPin size={22} /></div>
                            <div>
                                <p className="font-bold text-slate-900 mb-1">Address</p>
                                <p className="text-slate-700">{primaryAddress}</p>
                            </div>
                        </div>
                    ) : null}

                    {!isHard && softLocations.length > 0 ? (
                        softLocations.map((location, index) => (
                            <div key={location.id || index} className="flex items-start gap-3">
                                <div className="p-2.5 bg-brand-50 rounded-xl text-brand-600 shrink-0"><MapPin size={22} /></div>
                                <div>
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                        <p className="font-bold text-slate-900">Place: {location.name}</p>
                                        {location._distance !== undefined && location._distance !== null ? (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200">
                                                {formatDistance(location._distance)}
                                            </span>
                                        ) : null}
                                    </div>
                                    <p className="text-slate-700">{location.address}</p>
                                    <div className="flex items-center gap-4 mt-2 border-t border-slate-100 pt-2">
                                        {Number.isInteger(location.id) ? (
                                            <button
                                                type="button"
                                                onClick={() => onNavigateToResource?.('hard', location.id)}
                                                className="text-brand-600 text-sm font-bold hover:underline block"
                                            >
                                                View Details
                                            </button>
                                        ) : null}
                                        <button
                                            type="button"
                                            onClick={() => handleDirections(location)}
                                            className="text-brand-600 text-sm font-bold hover:underline flex items-center gap-1"
                                        >
                                            <Navigation size={14} />
                                            Directions
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : null}

                    {!isHard && softLocations.length === 0 ? (
                        <div className="flex items-start gap-3">
                            <div className="p-2.5 bg-slate-100 rounded-xl text-slate-500 shrink-0"><MapPin size={22} /></div>
                            <div>
                                <p className="font-bold text-slate-900 mb-1">Linked Places</p>
                                <p className="text-slate-700">This offering does not have any linked places yet.</p>
                            </div>
                        </div>
                    ) : null}

                    {(asset.schedule || asset.hours) ? (
                        <div className="flex items-start gap-3">
                            <div className="p-2.5 bg-brand-50 rounded-xl text-brand-600 shrink-0"><Clock size={22} /></div>
                            <div>
                                <p className="font-bold text-slate-900 mb-1">{isHard ? 'Operating Hours' : 'Schedule'}</p>
                                <p className="text-slate-700">{asset.schedule || asset.hours}</p>
                            </div>
                        </div>
                    ) : null}

                    {phone ? (
                        <div className="flex items-start gap-3">
                            <div className="p-2.5 bg-brand-50 rounded-xl text-brand-600 shrink-0"><Phone size={22} /></div>
                            <div>
                                <p className="font-bold text-slate-900 mb-1">Contact</p>
                                <p className="text-slate-700">{phone}</p>
                            </div>
                        </div>
                    ) : null}
                </div>

                {asset.tags && asset.tags.length > 0 ? (
                    <div className="mt-8 pt-6 border-t border-slate-200">
                        <h3 className="font-bold text-slate-900 mb-3 text-sm uppercase tracking-wider">Tags</h3>
                        <div className="flex flex-wrap gap-2">
                            {asset.tags.map((tag) => <TagBadge key={tag} tag={tag} />)}
                        </div>
                    </div>
                ) : null}

                {hasDirectionsTarget ? (
                    <div className="mt-8">
                        <button
                            type="button"
                            onClick={() => handleDirections()}
                            className={directionsButtonClass}
                            style={{ background: 'linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-strong) 100%)' }}
                        >
                            <Navigation size={20} />
                            {isHard ? 'Get Directions (Google Maps)' : 'Get Directions to Nearest Place'}
                        </button>
                    </div>
                ) : null}
            </div>

            {isHard && asset.softAssets && asset.softAssets.length > 0 ? (
                <div
                    className={relatedCardClass}
                    style={{ backgroundColor: 'rgba(255,255,255,0.88)', borderColor: 'var(--color-border)' }}
                >
                    <div className={relatedHeaderClass}>
                        <div>
                            <h2 className={isCompact ? 'text-2xl font-bold text-slate-900 leading-tight' : 'text-xl font-bold text-slate-900 sm:text-2xl'}>Available Offerings & Resources</h2>
                            <p className="mt-1 text-sm text-slate-500">
                                Browse by bucket instead of one long mixed list.
                            </p>
                        </div>
                        <div className={bucketGridClass}>
                            {SOFT_ASSET_BUCKETS.map((bucket) => (
                                <button
                                    key={bucket}
                                    type="button"
                                    onClick={() => setActiveSoftBucket(bucket)}
                                    className={bucketButtonClass}
                                    style={{
                                        borderColor: activeSoftBucket === bucket ? 'var(--color-brand)' : 'var(--color-border)',
                                        backgroundColor: activeSoftBucket === bucket ? 'color-mix(in srgb, var(--color-brand-light) 45%, white)' : 'white',
                                    }}
                                >
                                    <div className={isCompact ? 'text-2xl font-extrabold leading-none' : 'text-base font-extrabold leading-none sm:text-lg'} style={{ color: 'var(--color-text)' }}>
                                        {relatedSoftAssetCounts[bucket]}
                                    </div>
                                    <div
                                        className={isCompact ? 'mt-1 text-xs font-bold uppercase tracking-[0.12em]' : 'mt-1 text-[10px] font-bold uppercase tracking-[0.1em] sm:text-xs sm:tracking-[0.12em]'}
                                        style={{ color: activeSoftBucket === bucket ? 'var(--color-brand)' : 'var(--color-text-muted)' }}
                                    >
                                        {bucket}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="mt-6 grid gap-4">
                        {relatedSoftAssetGroups[activeSoftBucket].length > 0 ? relatedSoftAssetGroups[activeSoftBucket].map((softAsset) => (
                            <div
                                key={softAsset.id}
                                onClick={() => onNavigateToResource?.('soft', softAsset.id)}
                                className={relatedItemClass}
                            >
                                {softAsset.logoUrl ? (
                                    <div className={isCompact ? 'flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white p-1' : 'flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white p-1 sm:h-14 sm:w-14'}>
                                        <img src={softAsset.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                                    </div>
                                ) : (
                                    <div className={isCompact ? 'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg border border-brand-100 bg-brand-50 text-brand-600' : 'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg border border-brand-100 bg-brand-50 text-brand-600 sm:h-14 sm:w-14'}>
                                        <CalendarDays size={24} />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <h3 className={isCompact ? 'line-clamp-3 text-lg font-bold leading-tight text-slate-900' : 'line-clamp-2 text-base font-bold leading-tight text-slate-900 sm:text-lg'}>{softAsset.name}</h3>
                                    {softAsset.schedule ? (
                                        <p className={isCompact ? 'mt-1 flex items-center gap-1 text-sm text-slate-500' : 'mt-1 flex items-center gap-1 text-xs text-slate-500 sm:text-sm'}>
                                            <Clock size={14} /> {softAsset.schedule}
                                        </p>
                                    ) : null}
                                    {softAsset.description ? (
                                        <p className={isCompact ? 'mt-2 line-clamp-3 text-sm text-slate-600' : 'mt-2 line-clamp-2 text-xs text-slate-600 sm:text-sm'}><LinkifiedText text={softAsset.description} /></p>
                                    ) : null}
                                </div>
                            </div>
                        )) : (
                            <div
                                className="rounded-2xl border border-dashed px-5 py-8 text-center"
                                style={{ borderColor: 'var(--color-border)', backgroundColor: 'rgba(248,252,251,0.82)' }}
                            >
                                <p className="text-base font-bold text-slate-900">No {activeSoftBucket.toLowerCase()} here yet</p>
                                <p className="mt-1 text-sm text-slate-500">
                                    Switch tabs to check the other soft-asset buckets.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
