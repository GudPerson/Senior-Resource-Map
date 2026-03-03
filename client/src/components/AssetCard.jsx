import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, CalendarDays, Heart, MapPin, Clock, Navigation, ChevronDown } from 'lucide-react';

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
    const address = isHard ? asset.address : asset.location?.address;
    const [isExpanded, setIsExpanded] = useState(false);
    const navigate = useNavigate();

    const handleDirections = (e) => {
        e.stopPropagation();
        const lat = isHard ? asset.lat : asset.location?.lat;
        const lng = isHard ? asset.lng : asset.location?.lng;
        if (lat && lng) {
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank', 'noopener,noreferrer');
        } else if (address) {
            window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank', 'noopener,noreferrer');
        }
    };

    const catColor = subCatColors[asset.subCategory] || '#64748b';

    return (
        <article
            className="card relative group flex flex-col cursor-pointer transition-all"
            style={{
                borderWidth: '2px',
                borderColor: isSelected ? 'var(--color-brand)' : 'var(--color-border)',
                backgroundColor: isSelected ? 'var(--color-brand-light)' : 'var(--color-surface)',
            }}
            onClick={() => setIsExpanded(!isExpanded)}
        >
            {/* Distance badge */}
            {asset._distance !== undefined && asset._distance !== null && (
                <div
                    className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-xs font-bold z-10 text-white"
                    style={{ backgroundColor: 'var(--color-brand)', border: '2px solid var(--color-surface)' }}
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
                        className="p-1 -m-1 rounded-full transition-colors flex-shrink-0"
                        style={{ backgroundColor: isFavorite ? '#fef2f230' : 'transparent' }}
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
                <h2 className="text-base font-bold leading-snug hover:underline transition-colors" style={{ color: 'var(--color-text)' }}>
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
                {address && (
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
                        <span>{isHard ? address : `Held at: ${address}`}</span>
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
        </article>
    );
});
