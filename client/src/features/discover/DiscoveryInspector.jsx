import {
    ArrowRight,
    Building2,
    CalendarDays,
    Clock,
    MapPin,
    Navigation,
    X,
} from 'lucide-react';
import { getDistance } from '../../lib/geo.js';
import { SOFT_ASSET_BUCKETS, summarizeSoftAssetBuckets } from '../../lib/softAssetBuckets.js';
import { LinkifiedText, TagBadge } from '../../components/AssetCard.jsx';
import SaveAssetButton from '../../components/SaveAssetButton.jsx';
import { getAssetLocations, getBestLocation, hasValidCoordinates } from './discoverUtils.js';

function formatDistance(distance) {
    if (!Number.isFinite(distance)) return null;
    return distance < 1 ? `${Math.round(distance * 1000)}m away` : `${distance.toFixed(1)}km away`;
}

function openDirections(target) {
    if (!target) return;

    const lat = Number.parseFloat(target.lat);
    const lng = Number.parseFloat(target.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank', 'noopener,noreferrer');
        return;
    }

    if (target.address) {
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(target.address)}`, '_blank', 'noopener,noreferrer');
    }
}

function buildSortedLocations(asset, userLocation) {
    const locations = getAssetLocations(asset);
    if (!userLocation) return locations;

    return [...locations]
        .map((location) => ({
            ...location,
            _distance: hasValidCoordinates(location)
                ? getDistance(userLocation.lat, userLocation.lng, Number.parseFloat(location.lat), Number.parseFloat(location.lng))
                : null,
        }))
        .sort((left, right) => {
            if (left._distance === null) return 1;
            if (right._distance === null) return -1;
            return left._distance - right._distance;
        });
}

export function DiscoveryInspector({
    asset,
    onClose,
    onOpenResourcePage,
    onTagClick,
    subCatColors,
    userLocation,
}) {
    if (!asset) {
        return (
            <div className="pointer-events-none absolute top-5 right-5 z-[450] w-[320px]">
                <div
                    className="pointer-events-auto rounded-[24px] border px-5 py-4 shadow-xl backdrop-blur"
                    style={{
                        backgroundColor: 'color-mix(in srgb, var(--color-surface) 92%, transparent)',
                        borderColor: 'var(--color-border)',
                    }}
                >
                    <p className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                        Select a saved place
                    </p>
                    <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                        Saved pins open here so you can inspect the place while keeping your browse list on the left.
                    </p>
                </div>
            </div>
        );
    }

    const isHard = asset._type === 'hard';
    const color = subCatColors[asset.subCategory] || '#64748b';
    const locations = buildSortedLocations(asset, userLocation);
    const primaryLocation = isHard
        ? asset
        : (asset._displayLocation || getBestLocation(asset, userLocation) || locations[0] || null);
    const distance = Number.isFinite(asset._distance)
        ? asset._distance
        : (userLocation && hasValidCoordinates(primaryLocation)
            ? getDistance(userLocation.lat, userLocation.lng, Number.parseFloat(primaryLocation.lat), Number.parseFloat(primaryLocation.lng))
            : null);
    const hasDirectionsTarget = primaryLocation && (primaryLocation.address || hasValidCoordinates(primaryLocation));
    const topLocations = isHard ? [] : locations.slice(0, 3);
    const relatedSoftAssetCounts = isHard ? summarizeSoftAssetBuckets(asset.softAssets || []) : null;
    const savedAssetSummary = {
        name: asset.name,
        subCategory: asset.subCategory,
        address: primaryLocation?.address || null,
        lat: isHard ? asset.lat : primaryLocation?.lat,
        lng: isHard ? asset.lng : primaryLocation?.lng,
        detailPath: `/resource/${asset._type}/${asset.id}`,
    };

    return (
        <div className="pointer-events-none absolute inset-y-5 right-5 z-[450] w-[380px] max-w-[calc(100%-2.5rem)]">
            <aside
                className="pointer-events-auto flex h-full flex-col overflow-hidden rounded-[28px] border shadow-2xl backdrop-blur"
                style={{
                    backgroundColor: 'color-mix(in srgb, var(--color-surface) 94%, transparent)',
                    borderColor: 'var(--color-border)',
                }}
            >
                <div
                    className="flex items-start justify-between gap-4 border-b px-5 py-4"
                    style={{ borderColor: 'var(--color-border)' }}
                >
                    <div className="min-w-0">
                        <div
                            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold"
                            style={{
                                color,
                                backgroundColor: `${color}14`,
                                border: `1px solid ${color}2e`,
                            }}
                        >
                            {isHard ? <Building2 size={14} /> : <CalendarDays size={14} />}
                            {asset.subCategory || (isHard ? 'Place' : 'Offering')}
                        </div>
                        <h2 className="mt-3 text-xl font-extrabold leading-tight" style={{ color: 'var(--color-text)' }}>
                            {asset.name}
                        </h2>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold">
                            {!isHard && (
                                <span
                                    className="rounded-full px-2.5 py-1"
                                    style={{
                                        backgroundColor: 'var(--color-brand-light)',
                                        color: 'var(--color-brand)',
                                        border: '1px solid var(--color-border)',
                                    }}
                                >
                                    Available in {locations.length} {locations.length === 1 ? 'place' : 'places'}
                                </span>
                            )}
                            {distance !== null && (
                                <span
                                    className="rounded-full px-2.5 py-1"
                                    style={{
                                        backgroundColor: 'var(--color-badge-bg)',
                                        color: 'var(--color-text-secondary)',
                                        border: '1px solid var(--color-border)',
                                    }}
                                >
                                    {formatDistance(distance)}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <SaveAssetButton
                            resourceId={asset.id}
                            resourceType={asset._type}
                            summary={savedAssetSummary}
                            variant="inspector"
                        />
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors hover:bg-slate-50"
                            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                            aria-label="Close inspector"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
                    {asset.logoUrl && (
                        <div
                            className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border p-2"
                            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                        >
                            <img src={asset.logoUrl} alt="" className="max-h-full max-w-full object-contain" />
                        </div>
                    )}

                    <div className="space-y-3">
                        <p className="text-sm font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--color-text-muted)' }}>
                            Summary
                        </p>
                        {asset.description ? (
                            <p className="text-sm leading-7" style={{ color: 'var(--color-text-secondary)' }}>
                                <LinkifiedText text={asset.description} />
                            </p>
                        ) : (
                            <p className="text-sm italic" style={{ color: 'var(--color-text-muted)' }}>
                                No description provided yet.
                            </p>
                        )}
                    </div>

                    {isHard && (
                        <div className="space-y-3">
                            <p className="text-sm font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--color-text-muted)' }}>
                                Available Here
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                                {SOFT_ASSET_BUCKETS.map((bucket) => (
                                    <div
                                        key={bucket}
                                        className="rounded-2xl border px-3 py-3"
                                        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
                                    >
                                        <div className="text-lg font-extrabold leading-none" style={{ color: 'var(--color-text)' }}>
                                            {relatedSoftAssetCounts?.[bucket] || 0}
                                        </div>
                                        <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--color-text-muted)' }}>
                                            {bucket}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="space-y-3">
                        {primaryLocation?.address && (
                            <div
                                className="flex items-start gap-3 rounded-2xl border px-4 py-3"
                                style={{ borderColor: 'var(--color-border)' }}
                            >
                                <MapPin size={18} className="mt-0.5 shrink-0" style={{ color: 'var(--color-brand)' }} />
                                <div className="min-w-0">
                                    <p className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                                        {isHard ? 'Address' : 'Nearest place'}
                                    </p>
                                    <p className="mt-1 text-sm leading-6" style={{ color: 'var(--color-text-secondary)' }}>
                                        {primaryLocation.address}
                                    </p>
                                </div>
                            </div>
                        )}

                        {(asset.schedule || asset.hours) && (
                            <div
                                className="flex items-start gap-3 rounded-2xl border px-4 py-3"
                                style={{ borderColor: 'var(--color-border)' }}
                            >
                                <Clock size={18} className="mt-0.5 shrink-0" style={{ color: 'var(--color-brand)' }} />
                                <div className="min-w-0">
                                    <p className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                                        {isHard ? 'Operating hours' : 'Schedule'}
                                    </p>
                                    <p className="mt-1 text-sm leading-6" style={{ color: 'var(--color-text-secondary)' }}>
                                        {asset.schedule || asset.hours}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {!isHard && topLocations.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--color-text-muted)' }}>
                                    Linked Places
                                </p>
                                {locations.length > topLocations.length && (
                                    <span className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                                        +{locations.length - topLocations.length} more
                                    </span>
                                )}
                            </div>

                            <div className="space-y-2">
                                {topLocations.map((location) => (
                                    <div
                                        key={location.id || `${location.lat}-${location.lng}`}
                                        className="rounded-2xl border px-4 py-3"
                                        style={{ borderColor: 'var(--color-border)' }}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                                                    {location.name || 'Linked place'}
                                                </p>
                                                {location.address && (
                                                    <p className="mt-1 text-sm leading-6" style={{ color: 'var(--color-text-secondary)' }}>
                                                        {location.address}
                                                    </p>
                                                )}
                                            </div>
                                            {location._distance !== null && location._distance !== undefined && (
                                                <span
                                                    className="shrink-0 rounded-full px-2 py-1 text-xs font-bold"
                                                    style={{
                                                        backgroundColor: 'var(--color-badge-bg)',
                                                        color: 'var(--color-text-secondary)',
                                                        border: '1px solid var(--color-border)',
                                                    }}
                                                >
                                                    {formatDistance(location._distance)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {asset.tags?.length > 0 && (
                        <div className="space-y-3">
                            <p className="text-sm font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--color-text-muted)' }}>
                                Tags
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {asset.tags.map((tag) => (
                                    <TagBadge key={tag} tag={tag} onClick={onTagClick ? () => onTagClick(tag) : undefined} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div
                    className="grid grid-cols-1 gap-3 border-t px-5 py-4"
                    style={{ borderColor: 'var(--color-border)' }}
                >
                    <button
                        type="button"
                        onClick={() => onOpenResourcePage(asset)}
                        className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-white transition-all hover:shadow-md"
                        style={{ backgroundColor: 'var(--color-brand)' }}
                    >
                        View full page
                        <ArrowRight size={16} />
                    </button>
                    {hasDirectionsTarget && (
                        <button
                            type="button"
                            onClick={() => openDirections(primaryLocation)}
                            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold transition-colors hover:bg-slate-50"
                            style={{
                                borderColor: 'var(--color-border)',
                                color: 'var(--color-text)',
                                backgroundColor: 'var(--color-surface)',
                            }}
                        >
                            <Navigation size={16} style={{ color: 'var(--color-brand)' }} />
                            {isHard ? 'Get directions' : 'Directions to nearest place'}
                        </button>
                    )}
                </div>
            </aside>
        </div>
    );
}
