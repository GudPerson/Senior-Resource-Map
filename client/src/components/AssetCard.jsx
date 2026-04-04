import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Building2, CalendarDays, MapPin, Clock, Navigation } from 'lucide-react';
import { SOFT_ASSET_BUCKETS, summarizeSoftAssetBuckets } from '../lib/softAssetBuckets.js';
import { openResourceDetail } from '../lib/appNavigation.js';
import SaveAssetButton from './SaveAssetButton.jsx';

function hasValidCoordinates(value) {
    return Number.isFinite(Number.parseFloat(value?.lat)) && Number.isFinite(Number.parseFloat(value?.lng));
}

function getLinkedLocations(asset) {
    if (!asset) return [];
    if (Array.isArray(asset.locations) && asset.locations.length > 0) return asset.locations;
    if (asset.location) return [asset.location];
    return [];
}

function normalizeAvailabilityCount(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return parsed;
}

export const TagBadge = ({ tag, onClick }) => (
    <span
        onClick={onClick}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${onClick ? 'cursor-pointer' : ''}`}
        style={{
            backgroundColor: 'var(--color-badge-bg)',
            color: 'var(--color-badge-text)',
            border: '1px solid var(--color-border)',
        }}
    >
        #{tag}
    </span>
);

export const LinkifiedText = ({ text }) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return (
        <>
            {parts.map((part, i) => {
                if (part.match(urlRegex)) {
                    return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="hover:underline break-all" style={{ color: 'var(--color-brand)' }} onClick={e => e.stopPropagation()}>{part}</a>;
                }
                return part;
            })}
        </>
    );
};

export const AssetCard = React.memo(({
    asset,
    type,
    onCardClickAction,
    onCardHoverEnd,
    onCardHoverStart,
    onLocationClick,
    isSelected,
    showDetailsButton = true,
    subCatColors = {},
    onTagClick,
    onCategoryClick,
}) => {
    const isHard = type === 'hard';
    const linkedLocations = isHard ? [] : getLinkedLocations(asset);
    const displayLocation = isHard ? asset : (asset._displayLocation || linkedLocations[0] || null);
    const locationCount = isHard ? (asset.address ? 1 : 0) : linkedLocations.length;
    const address = isHard ? asset.address : displayLocation?.address;
    const hasDirectionsTarget = isHard
        ? Boolean(asset.address || hasValidCoordinates(asset))
        : Boolean(displayLocation && (displayLocation.address || hasValidCoordinates(displayLocation)));
    const [isExpanded, setIsExpanded] = useState(false);
    const navigate = useNavigate();
    const softAssetCounts = isHard ? summarizeSoftAssetBuckets(asset.softAssets || []) : null;
    const showExpandedDescription = isExpanded || isSelected;
    const availabilityEnabled = !isHard && Boolean(asset.availabilityEnabled);
    const availabilityCount = normalizeAvailabilityCount(asset.availabilityCount);
    const savedAssetSummary = {
        name: asset.name,
        subCategory: asset.subCategory,
        address,
        lat: isHard ? asset.lat : displayLocation?.lat,
        lng: isHard ? asset.lng : displayLocation?.lng,
        detailPath: `/resource/${type}/${asset.id}`,
    };

    const handleDirections = (e) => {
        e.stopPropagation();
        const target = isHard ? asset : displayLocation;
        const lat = Number.parseFloat(target?.lat);
        const lng = Number.parseFloat(target?.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank', 'noopener,noreferrer');
        } else if (target?.address) {
            window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(target.address)}`, '_blank', 'noopener,noreferrer');
        }
    };

    const catColor = subCatColors[asset.subCategory] || '#64748b';

    return (
        <article
            className="asset-card card relative group flex flex-col cursor-pointer transition-all overflow-hidden"
            style={{
                borderWidth: '2px',
                borderColor: isSelected ? 'var(--color-brand)' : 'var(--color-border)',
                background: isSelected
                    ? 'linear-gradient(180deg, rgba(231,248,244,0.98) 0%, rgba(255,255,255,0.96) 100%)'
                    : 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,252,251,0.94) 100%)',
            }}
            onMouseEnter={onCardHoverStart}
            onMouseLeave={onCardHoverEnd}
            onClick={() => {
                if (onCardClickAction) {
                    onCardClickAction();
                    return;
                }
                setIsExpanded(!isExpanded);
            }}
        >
            <div
                className="pointer-events-none absolute inset-x-0 top-0 h-16"
                style={{
                    background: 'linear-gradient(180deg, rgba(15,163,154,0.08) 0%, transparent 100%)',
                }}
            />

            {/* Category + Favorite row */}
            <div className="flex items-start justify-between gap-3 mb-2">
                <div
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${onCategoryClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                    style={{
                        color: '#0f172a',
                        backgroundColor: `${catColor}1c`,
                        border: `1px solid ${catColor}35`,
                    }}
                    onClick={onCategoryClick ? (e) => { e.stopPropagation(); onCategoryClick(asset.subCategory) } : undefined}
                >
                    {isHard ? <Building2 size={14} className="opacity-80" style={{ color: catColor }} /> : <CalendarDays size={14} className="opacity-80" style={{ color: catColor }} />}
                    {asset.subCategory || (isHard ? 'Place' : 'Offering')}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {asset._distance !== undefined && asset._distance !== null && (
                        <div
                            className="px-2 py-0.5 rounded-full text-xs font-bold text-white shadow-sm"
                            style={{ backgroundColor: '#0fa39a', border: '1px solid var(--color-surface)' }}
                        >
                            {asset._distance < 1 ? `${Math.round(asset._distance * 1000)}m` : `${asset._distance.toFixed(1)}km`}
                        </div>
                    )}
                    <SaveAssetButton
                        resourceId={asset.id}
                        resourceType={type}
                        summary={savedAssetSummary}
                        variant="card"
                    />
                </div>
            </div>

            {/* Title row */}
            <div
                className="flex items-center gap-2.5 mb-1.5 group/title"
                onClick={(e) => {
                    e.stopPropagation();
                    openResourceDetail(type, asset.id, navigate);
                }}
            >
                {asset.logoUrl && (
                    <div className="w-10 h-10 flex-shrink-0 rounded-lg overflow-hidden p-0.5 flex items-center justify-center" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                        <img src={asset.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                    </div>
                )}
                <h2 className="text-[1.05rem] font-bold leading-snug hover:underline transition-colors" style={{ color: 'var(--color-text)' }}>
                    {asset.name}
                </h2>
            </div>

            {/* Description */}
            {asset.description && (
                <p className={`text-sm mb-3 leading-relaxed ${!showExpandedDescription ? 'line-clamp-2' : ''}`} style={{ color: 'var(--color-text-secondary)' }}>
                    <LinkifiedText text={asset.description} />
                </p>
            )}

            {availabilityEnabled ? (
                <div className="mb-3">
                    <span
                        className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-extrabold uppercase tracking-[0.12em]"
                        style={{
                            borderColor: 'var(--color-brand-light)',
                            backgroundColor: 'color-mix(in srgb, var(--color-brand-light) 55%, white)',
                            color: 'var(--color-brand-strong)',
                        }}
                    >
                        {availabilityCount} available
                    </span>
                </div>
            ) : null}

            {/* Info section */}
            <div className="space-y-1.5 pt-3 mt-auto" style={{ borderTop: '1px solid var(--color-border)' }}>
                {(isHard ? Boolean(address) : locationCount > 0) && (
                    <div
                        className={`flex items-start gap-2 text-sm font-medium p-1 -mx-1 rounded-lg transition-colors ${onLocationClick ? 'cursor-zoom-in hover:bg-slate-50' : ''}`}
                        style={{ color: 'var(--color-text-secondary)' }}
                        onClick={(e) => {
                            if (onLocationClick) {
                                e.stopPropagation();
                                onLocationClick();
                            }
                        }}
                    >
                        <MapPin size={15} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--color-brand)' }} />
                        <div className="min-w-0">
                            <div>{isHard ? address : `Available in ${locationCount} ${locationCount === 1 ? 'place' : 'places'}`}</div>
                            {!isHard && displayLocation?.address && (
                                <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                                    {asset._distance !== undefined && asset._distance !== null && locationCount > 1 ? `Nearest: ${displayLocation.address}` : displayLocation.address}
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {(asset.schedule || asset.hours) && (
                    <div className="flex items-start gap-2 text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                        <Clock size={15} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--color-brand)' }} />
                        <span>{asset.schedule || asset.hours}</span>
                    </div>
                )}
                {asset.tags && asset.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-2">
                        {asset.tags.map(t => (
                            <TagBadge
                                key={t}
                                tag={t}
                                onClick={onTagClick ? (e) => { e.stopPropagation(); onTagClick(t) } : undefined}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Banner */}
            {asset.bannerUrl && (
                <div className="relative w-full h-28 mt-3 rounded-xl overflow-hidden flex items-center justify-center" style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                    <img src={asset.bannerUrl} alt="Banner" className="w-full h-full object-cover rounded-lg" />
                </div>
            )}

            {/* Get Directions button */}
            {hasDirectionsTarget && (
                <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
                    <button
                        onClick={handleDirections}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl font-bold transition-all text-sm hover:shadow-sm active:scale-[0.98]"
                        style={{ backgroundColor: 'var(--color-badge-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}
                    >
                        <Navigation size={14} style={{ color: 'var(--color-brand)' }} />
                        Get Directions
                    </button>
                </div>
            )}

            {isHard && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                    {SOFT_ASSET_BUCKETS.map((bucket) => (
                        <div
                            key={bucket}
                            className="asset-card__bucket rounded-xl border px-3 py-2 text-center"
                            style={{
                                borderColor: 'var(--color-border)',
                                backgroundColor: 'color-mix(in srgb, var(--color-surface) 88%, var(--color-brand-light) 12%)',
                            }}
                        >
                            <div className="asset-card__bucket-count font-extrabold leading-none" style={{ color: 'var(--color-text)' }}>
                                {softAssetCounts?.[bucket] || 0}
                            </div>
                            <div className="asset-card__bucket-label mt-1 font-bold uppercase" style={{ color: 'var(--color-text-muted)' }}>
                                {bucket}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showDetailsButton ? (
                <div className="mt-3">
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            openResourceDetail(type, asset.id, navigate);
                        }}
                        className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-white"
                        style={{ background: 'linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-strong) 100%)' }}
                    >
                        Details
                        <ArrowUpRight size={15} />
                    </button>
                </div>
            ) : null}
        </article>
    );
});
