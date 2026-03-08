import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Building2, CalendarDays, Heart, MapPin, Clock, Navigation } from 'lucide-react';

function hasValidCoordinates(value) {
    return Number.isFinite(Number.parseFloat(value?.lat)) && Number.isFinite(Number.parseFloat(value?.lng));
}

function getLinkedLocations(asset) {
    if (!asset) return [];
    if (Array.isArray(asset.locations) && asset.locations.length > 0) return asset.locations;
    if (asset.location) return [asset.location];
    return [];
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

export const AssetCard = React.memo(({ asset, type, onClick, isSelected, subCatColors = {}, isFavorite, onToggleFavorite, isLoggedIn, onTagClick, onCategoryClick }) => {
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
            className="card relative group flex flex-col cursor-pointer transition-all overflow-hidden"
            style={{
                borderWidth: '2px',
                borderColor: isSelected ? 'var(--color-brand)' : 'var(--color-border)',
                background: isSelected
                    ? 'linear-gradient(180deg, rgba(231,248,244,0.98) 0%, rgba(255,255,255,0.96) 100%)'
                    : 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,252,251,0.94) 100%)',
            }}
            onClick={() => setIsExpanded(!isExpanded)}
        >
            <div
                className="pointer-events-none absolute inset-x-0 top-0 h-16"
                style={{
                    background: 'linear-gradient(180deg, rgba(15,163,154,0.08) 0%, transparent 100%)',
                }}
            />

            {/* Distance badge */}
            {asset._distance !== undefined && asset._distance !== null && (
                <div
                    className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-xs font-bold z-10 text-white"
                    style={{ backgroundColor: 'var(--color-brand-strong)', border: '2px solid var(--color-surface)' }}
                >
                    {asset._distance < 1 ? `${Math.round(asset._distance * 1000)}m` : `${asset._distance.toFixed(1)}km`}
                </div>
            )}

            {/* Category + Favorite row */}
            <div className="flex items-center justify-between gap-2 mb-2">
                <div
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${onCategoryClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                    style={{
                        color: catColor,
                        backgroundColor: `${catColor}15`,
                        border: `1px solid ${catColor}30`,
                    }}
                    onClick={onCategoryClick ? (e) => { e.stopPropagation(); onCategoryClick(asset.subCategory) } : undefined}
                >
                    {isHard ? <Building2 size={14} /> : <CalendarDays size={14} />}
                    {asset.subCategory || (isHard ? 'Place' : 'Offering')}
                </div>
                {isLoggedIn && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onToggleFavorite(asset.id, type); }}
                        className="p-1.5 -m-1 rounded-full transition-colors flex-shrink-0"
                        style={{ backgroundColor: isFavorite ? '#fff1ef' : 'transparent' }}
                    >
                        <Heart size={18} className={isFavorite ? 'fill-red-500 text-red-500' : ''} style={!isFavorite ? { color: 'var(--color-text-muted)' } : {}} />
                    </button>
                )}
            </div>

            {/* Title row */}
            <div
                className="flex items-center gap-2.5 mb-1.5 group/title"
                onClick={(e) => { e.stopPropagation(); navigate(`/resource/${type}/${asset.id}`); }}
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
                <p className={`text-sm mb-3 leading-relaxed ${!isExpanded ? 'line-clamp-2' : ''}`} style={{ color: 'var(--color-text-secondary)' }}>
                    <LinkifiedText text={asset.description} />
                </p>
            )}

            {/* Info section */}
            <div className="space-y-1.5 pt-3 mt-auto" style={{ borderTop: '1px solid var(--color-border)' }}>
                {(isHard ? Boolean(address) : locationCount > 0) && (
                    <div
                        className={`flex items-start gap-2 text-sm font-medium p-1 -mx-1 rounded-lg transition-colors ${onClick ? 'cursor-pointer' : ''}`}
                        style={{ color: 'var(--color-text-secondary)' }}
                        onClick={(e) => {
                            if (onClick) {
                                e.stopPropagation();
                                onClick();
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

            <div className="mt-3 flex items-center gap-2">
                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        onClick?.();
                    }}
                    className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition-colors hover:bg-slate-50"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                >
                    <MapPin size={15} style={{ color: 'var(--color-brand)' }} />
                    Inspect
                </button>
                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        navigate(`/resource/${type}/${asset.id}`);
                    }}
                    className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-strong) 100%)' }}
                >
                    Details
                    <ArrowUpRight size={15} />
                </button>
            </div>
        </article>
    );
});
