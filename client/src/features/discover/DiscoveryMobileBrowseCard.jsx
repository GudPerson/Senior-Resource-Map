import { MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import SaveAssetButton from '../../components/SaveAssetButton.jsx';
import { openResourceDetail } from '../../lib/appNavigation.js';

function formatDistance(distance) {
    if (!Number.isFinite(distance)) return null;
    return distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`;
}

function normalizeAvailabilityCount(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return parsed;
}

export function DiscoveryMobileBrowseCard({
    asset,
    isCompact = false,
    onCategoryClick,
    onLocationClick,
    subCatColors = {},
    type,
}) {
    const navigate = useNavigate();
    const isHard = type === 'hard';
    const catColor = subCatColors[asset.subCategory] || '#64748b';
    const displayLocation = isHard ? asset : asset._displayLocation;
    const totalLocationCount = isHard ? 1 : (asset._locationCount || 0);
    const otherLocationCount = !isHard && totalLocationCount > 1 ? totalLocationCount - 1 : 0;
    const categoryLabel = asset.subCategory || (isHard ? 'Place' : 'Offering');
    const availabilityEnabled = !isHard && Boolean(asset.availabilityEnabled);
    const availabilityCount = normalizeAvailabilityCount(asset.availabilityCount);
    const summaryAddress = isHard
        ? asset.address
        : (displayLocation?.address || `Available in ${asset._locationCount || 0} ${(asset._locationCount || 0) === 1 ? 'place' : 'places'}`);
    const handleOpenDetails = () => openResourceDetail(type, asset.id, navigate);
    const handleOpenDirections = () => {
        const target = isHard ? asset : displayLocation;
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
    };
    const hasDirectionsTarget = Boolean(
        (displayLocation && (displayLocation.address || (Number.isFinite(Number.parseFloat(displayLocation.lat)) && Number.isFinite(Number.parseFloat(displayLocation.lng)))))
        || (isHard && (asset.address || (Number.isFinite(Number.parseFloat(asset.lat)) && Number.isFinite(Number.parseFloat(asset.lng)))))
    );

    return (
        <article
            className={`cursor-pointer rounded-[22px] border shadow-sm transition-all ${isCompact ? 'p-2' : 'p-3'}`}
            onClick={handleOpenDetails}
            style={{
                borderColor: 'var(--color-border)',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,252,251,0.94) 100%)',
            }}
        >
            <div className={`flex items-start justify-between gap-2 ${isCompact ? '' : 'gap-3'}`}>
                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        onCategoryClick?.(asset.subCategory);
                    }}
                    className={`min-w-0 flex-1 rounded-full font-bold ${isCompact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1 text-[11px]'}`}
                    style={{
                        color: '#0f172a',
                        backgroundColor: `${catColor}1c`,
                        border: `1px solid ${catColor}2d`,
                    }}
                >
                    <span className="block truncate text-left leading-tight">{categoryLabel}</span>
                </button>

                <div className="flex shrink-0 items-center gap-2">
                    <div onClick={(event) => event.stopPropagation()}>
                        <SaveAssetButton
                            resourceId={asset.id}
                            resourceType={type}
                            summary={{
                                name: asset.name,
                                subCategory: asset.subCategory,
                                address: isHard ? asset.address : displayLocation?.address,
                                lat: isHard ? asset.lat : displayLocation?.lat,
                                lng: isHard ? asset.lng : displayLocation?.lng,
                                detailPath: `/resource/${type}/${asset.id}`,
                            }}
                            variant="card"
                            iconSize={16}
                        />
                    </div>
                </div>
            </div>

            <div className={`mt-3 flex items-start gap-2.5 ${isCompact ? 'gap-2' : ''}`}>
                {asset.logoUrl ? (
                    <div
                        className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white ${isCompact ? 'h-8 w-8 p-1' : 'h-9 w-9 p-1.5'}`}
                        style={{ borderColor: 'var(--color-border)' }}
                    >
                        <img
                            src={asset.logoUrl}
                            alt=""
                            className="max-h-full max-w-full object-contain"
                        />
                    </div>
                ) : null}
                <h2
                    className={`min-w-0 flex-1 ${isCompact ? 'line-clamp-4 text-[15px]' : 'line-clamp-4 text-base'} font-extrabold leading-snug`}
                    style={{ color: 'var(--color-text)' }}
                >
                    {asset.name}
                </h2>
            </div>

            {availabilityEnabled ? (
                <div className="mt-3">
                    <span
                        className={`inline-flex rounded-full border font-extrabold uppercase tracking-[0.12em] ${isCompact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1 text-[11px]'}`}
                        style={{
                            borderColor: 'var(--color-brand-light)',
                            backgroundColor: 'color-mix(in srgb, var(--color-brand-light) 60%, white)',
                            color: 'var(--color-brand-strong)',
                        }}
                    >
                        {availabilityCount} available
                    </span>
                </div>
            ) : null}

            <button
                type="button"
                disabled={!hasDirectionsTarget}
                onClick={(event) => {
                    event.stopPropagation();
                    if (onLocationClick) {
                        onLocationClick();
                        return;
                    }
                    if (hasDirectionsTarget) {
                        handleOpenDirections();
                    }
                }}
                className={`mt-3 flex w-full items-start gap-2 rounded-xl border text-left transition-all ${
                    onLocationClick || hasDirectionsTarget ? 'cursor-pointer' : 'cursor-default'
                } ${isCompact ? 'px-2.5 py-2 text-xs' : 'px-3 py-2 text-sm'}`}
                style={{
                    borderColor: 'var(--color-border)',
                    backgroundColor: onLocationClick || hasDirectionsTarget ? 'rgba(231,248,244,0.65)' : 'rgba(248,250,252,0.72)',
                    color: 'var(--color-text-secondary)',
                }}
            >
                <MapPin size={15} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--color-brand)' }} />
                <div className="relative min-w-0 flex-1">
                    {otherLocationCount > 0 && displayLocation?.address ? (
                        <p
                            className={`font-semibold tracking-[0.01em] ${isCompact ? 'mb-1 text-[11px] leading-relaxed' : 'mb-1 text-[12px] leading-relaxed'}`}
                            style={{ color: 'var(--color-brand-strong)' }}
                        >
                            Available in {otherLocationCount} other {otherLocationCount === 1 ? 'place' : 'places'}
                        </p>
                    ) : null}
                    <p className={`pr-10 ${isCompact ? 'line-clamp-2 text-[13px] leading-relaxed' : 'line-clamp-2 text-sm leading-relaxed'}`}>
                        {summaryAddress || 'Location details unavailable'}
                    </p>
                    {asset._distance !== undefined && asset._distance !== null ? (
                        <div className="absolute bottom-0 right-0">
                            <span
                                className={`inline-flex rounded-full font-bold text-white shadow-sm ${isCompact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'}`}
                                style={{ backgroundColor: '#0fa39a' }}
                            >
                                {formatDistance(asset._distance)}
                            </span>
                        </div>
                    ) : null}
                </div>
            </button>
        </article>
    );
}

export default DiscoveryMobileBrowseCard;
