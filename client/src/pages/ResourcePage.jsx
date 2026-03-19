import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Building2, CalendarDays, MapPin, Clock, ArrowLeft, Navigation, Phone } from 'lucide-react';
import { getDistance } from '../lib/geo.js';
import SaveAssetButton from '../components/SaveAssetButton.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import {
    GEOLOCATION_OPTIONS,
    getSearchLocationLabel,
    loadSearchLocation,
    saveSearchLocation,
} from '../lib/searchLocation.js';
import { SOFT_ASSET_BUCKETS, groupSoftAssetsByBucket, summarizeSoftAssetBuckets } from '../lib/softAssetBuckets.js';

const TagBadge = ({ tag }) => (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold border border-slate-300">
        #{tag}
    </span>
);

const LinkifiedText = ({ text }) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return (
        <>
            {parts.map((part, i) => {
                if (part.match(urlRegex)) {
                    return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline break-all" onClick={e => e.stopPropagation()}>{part}</a>;
                }
                return part;
            })}
        </>
    );
};

function hasValidCoordinates(value) {
    return Number.isFinite(Number.parseFloat(value?.lat)) && Number.isFinite(Number.parseFloat(value?.lng));
}

function formatDistance(distance) {
    if (!Number.isFinite(distance)) return null;
    return distance < 1 ? `${Math.round(distance * 1000)}m away` : `${distance.toFixed(1)}km away`;
}

export default function ResourcePage() {
    const { type, id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [asset, setAsset] = useState(null);
    const [subCatColors, setSubCatColors] = useState({});
    const [loading, setLoading] = useState(true);
    const [sortOrigin, setSortOrigin] = useState(() => loadSearchLocation());
    const [activeSoftBucket, setActiveSoftBucket] = useState('Programmes');

    useEffect(() => {
        const fetchAsset = async () => {
            setLoading(true);
            try {
                const [data, subcats] = await Promise.all([
                    type === 'hard' ? api.getHardAsset(id) : api.getSoftAsset(id),
                    api.getSubCategories().catch(() => [])
                ]);
                const colors = {};
                subcats.forEach(sc => { colors[sc.name] = sc.color || '#94a3b8'; });
                setSubCatColors(colors);
                setAsset(data);
            } catch (err) {
                console.error('Failed to load asset', err);
            } finally {
                setLoading(false);
            }
        };
        fetchAsset();
    }, [type, id]);

    useEffect(() => {
        if (type !== 'soft') return undefined;
        if (sortOrigin) return undefined;
        if (typeof navigator === 'undefined' || !navigator.geolocation) return undefined;

        let cancelled = false;
        navigator.geolocation.getCurrentPosition(
            (position) => {
                if (cancelled) return;
                const nextOrigin = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    source: 'geolocation',
                    updatedAt: Date.now(),
                };
                setSortOrigin(nextOrigin);
                saveSearchLocation(nextOrigin);
            },
            () => {},
            GEOLOCATION_OPTIONS,
        );

        return () => {
            cancelled = true;
        };
    }, [type, sortOrigin]);

    const isHard = type === 'hard';
    const softLocations = useMemo(() => {
        if (isHard || !asset) return [];

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
                    ? getDistance(sortOrigin.lat, sortOrigin.lng, Number.parseFloat(location.lat), Number.parseFloat(location.lng))
                    : null,
            }))
            .sort((a, b) => {
                if (a._distance === null) return 1;
                if (b._distance === null) return -1;
                return a._distance - b._distance;
            });
    }, [asset, isHard, sortOrigin]);

    const primaryLocation = !asset ? null : (isHard ? asset : (softLocations[0] || asset.location || null));
    const primaryAddress = isHard ? asset?.address : primaryLocation?.address;
    const phone = asset?.phone || primaryLocation?.phone;
    const availablePlaceCount = isHard ? 0 : softLocations.length;
    const relatedSoftAssetGroups = useMemo(() => (
        isHard ? groupSoftAssetsByBucket(asset?.softAssets || []) : { Programmes: [], Services: [], Promotions: [] }
    ), [asset?.softAssets, isHard]);
    const relatedSoftAssetCounts = useMemo(() => (
        isHard ? summarizeSoftAssetBuckets(asset?.softAssets || []) : { Programmes: 0, Services: 0, Promotions: 0 }
    ), [asset?.softAssets, isHard]);
    const hasDirectionsTarget = isHard
        ? Boolean(asset && (asset.address || hasValidCoordinates(asset)))
        : Boolean(primaryLocation && (primaryLocation.address || hasValidCoordinates(primaryLocation)));
    const savedAssetSummary = !asset ? null : {
        name: asset.name,
        subCategory: asset.subCategory,
        address: primaryAddress || null,
        lat: isHard ? asset?.lat : primaryLocation?.lat,
        lng: isHard ? asset?.lng : primaryLocation?.lng,
        detailPath: `/resource/${type}/${asset.id}`,
    };

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

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--page-gradient)' }}>
            <div className="w-12 h-12 border-4 border-slate-200 border-t-brand-600 rounded-full animate-spin" />
        </div>;
    }

    if (!asset) {
        return <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: 'var(--page-gradient)' }}>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Resource not found</h2>
            <button onClick={() => navigate('/discover')} className="text-brand-600 font-bold hover:underline">Return to Discover</button>
        </div>;
    }

    return (
        <div className="min-h-[calc(100vh-4rem)] pb-20" style={{ background: 'var(--page-gradient)' }}>
            {/* Header / Banner */}
            <div className="sticky top-0 z-10 border-b shadow-sm" style={{ backgroundColor: 'rgba(255,255,255,0.9)', borderColor: 'var(--color-border)', backdropFilter: 'blur(16px)' }}>
                <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-700 transition">
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="text-xl font-bold text-slate-900 truncate flex-1">{asset.name}</h1>
                    {user ? (
                        <SaveAssetButton
                            resourceId={asset.id}
                            resourceType={type}
                            summary={savedAssetSummary}
                            variant="inspector"
                        />
                    ) : null}
                </div>
            </div>

            <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
                {(asset.bannerUrl || asset.logoUrl) && (
                    <div className={`w-full ${asset.bannerUrl ? 'h-64 sm:h-80' : 'h-32 sm:h-48'} rounded-[28px] border overflow-hidden flex items-center justify-center p-4 shadow-sm relative`} style={{ backgroundColor: 'rgba(255,255,255,0.88)', borderColor: 'var(--color-border)' }}>
                        {asset.bannerUrl ? (
                            <img src={asset.bannerUrl} alt="Banner" className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                            <img src={asset.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                        )}
                    </div>
                )}

                <div className="rounded-[28px] border p-6 sm:p-8 shadow-sm" style={{ backgroundColor: 'rgba(255,255,255,0.88)', borderColor: 'var(--color-border)' }}>
                    <div className="flex flex-col sm:flex-row items-start gap-4 mb-4">
                        {asset.logoUrl && asset.bannerUrl && (
                            <img src={asset.logoUrl} alt="Logo" className="w-20 h-20 rounded-2xl border object-contain bg-white flex-shrink-0" style={{ borderColor: 'var(--color-border)' }} />
                        )}
                        <div>
                            <div
                                className="inline-flex items-center gap-1.5 px-3 py-1 mb-3 rounded-full bg-white text-sm font-bold border shadow-sm"
                                style={{ color: subCatColors[asset.subCategory] || '#334155', borderColor: 'var(--color-border)' }}
                            >
                                {isHard ? <Building2 size={16} /> : <CalendarDays size={16} />}
                                {asset.subCategory || (isHard ? 'Place' : 'Offering')}
                            </div>
                            <h1 className="text-3xl font-bold text-slate-900 leading-tight">{asset.name}</h1>
                            {!isHard && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold border" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand-strong)', borderColor: 'var(--color-border)' }}>
                                            Available in {availablePlaceCount} {availablePlaceCount === 1 ? 'place' : 'places'}
                                        </span>
                                    {sortOrigin && (
                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border" style={{ backgroundColor: 'var(--color-badge-bg)', color: 'var(--color-text-secondary)', borderColor: 'var(--color-border)' }}>
                                            Sorted nearest to {getSearchLocationLabel(sortOrigin)}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-4 text-slate-600 text-lg leading-relaxed mt-6">
                        {asset.description ? (
                            <p className="whitespace-pre-wrap"><LinkifiedText text={asset.description} /></p>
                        ) : (
                            <p className="italic text-slate-400">No description provided.</p>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-8 pt-6 border-t border-slate-200">
                        {isHard && primaryAddress && (
                            <div className="flex items-start gap-3">
                                <div className="p-2.5 bg-brand-50 rounded-xl text-brand-600 shrink-0"><MapPin size={22} /></div>
                                <div>
                                    <p className="font-bold text-slate-900 mb-1">Address</p>
                                    <p className="text-slate-700">{primaryAddress}</p>
                                </div>
                            </div>
                        )}
                        {!isHard && softLocations.length > 0 && (
                            softLocations.map((loc, idx) => (
                                <div key={loc.id || idx} className="flex items-start gap-3">
                                    <div className="p-2.5 bg-brand-50 rounded-xl text-brand-600 shrink-0"><MapPin size={22} /></div>
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                            <p className="font-bold text-slate-900">Place: {loc.name}</p>
                                            {loc._distance !== undefined && loc._distance !== null && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200">
                                                    {formatDistance(loc._distance)}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-slate-700">{loc.address}</p>
                                        <div className="flex items-center gap-4 mt-2 border-t border-slate-100 pt-2">
                                            <button onClick={() => navigate(`/resource/hard/${loc.id}`)} className="text-brand-600 text-sm font-bold hover:underline block">View Details</button>
                                            <button onClick={() => handleDirections(loc)} className="text-brand-600 text-sm font-bold hover:underline flex items-center gap-1"><Navigation size={14} /> Directions</button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                        {!isHard && softLocations.length === 0 && (
                            <div className="flex items-start gap-3">
                                <div className="p-2.5 bg-slate-100 rounded-xl text-slate-500 shrink-0"><MapPin size={22} /></div>
                                <div>
                                    <p className="font-bold text-slate-900 mb-1">Linked Places</p>
                                    <p className="text-slate-700">This offering does not have any linked places yet.</p>
                                </div>
                            </div>
                        )}
                        {(asset.schedule || asset.hours) && (
                            <div className="flex items-start gap-3">
                                <div className="p-2.5 bg-brand-50 rounded-xl text-brand-600 shrink-0"><Clock size={22} /></div>
                                <div>
                                    <p className="font-bold text-slate-900 mb-1">{isHard ? 'Operating Hours' : 'Schedule'}</p>
                                    <p className="text-slate-700">{asset.schedule || asset.hours}</p>
                                </div>
                            </div>
                        )}
                        {phone && (
                            <div className="flex items-start gap-3">
                                <div className="p-2.5 bg-brand-50 rounded-xl text-brand-600 shrink-0"><Phone size={22} /></div>
                                <div>
                                    <p className="font-bold text-slate-900 mb-1">Contact</p>
                                    <p className="text-slate-700">{phone}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {asset.tags && asset.tags.length > 0 && (
                        <div className="mt-8 pt-6 border-t border-slate-200">
                            <h3 className="font-bold text-slate-900 mb-3 text-sm uppercase tracking-wider">Tags</h3>
                            <div className="flex flex-wrap gap-2">
                                {asset.tags.map(t => <TagBadge key={t} tag={t} />)}
                            </div>
                        </div>
                    )}

                    {hasDirectionsTarget && (
                        <div className="mt-8">
                            <button
                                onClick={() => handleDirections()}
                                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-white font-bold transition shadow-sm text-lg"
                                style={{ background: 'linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-strong) 100%)' }}
                            >
                                <Navigation size={20} />
                                {isHard ? 'Get Directions (Google Maps)' : 'Get Directions to Nearest Place'}
                            </button>
                        </div>
                    )}
                </div>

                {/* Soft assets related to this hard asset */}
                {isHard && asset.softAssets && asset.softAssets.length > 0 && (
                    <div className="rounded-[28px] border p-4 shadow-sm sm:p-6" style={{ backgroundColor: 'rgba(255,255,255,0.88)', borderColor: 'var(--color-border)' }}>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Available Offerings & Resources</h2>
                                <p className="mt-1 text-sm text-slate-500">
                                    Browse by bucket instead of one long mixed list.
                                </p>
                            </div>
                            <div className="grid w-full grid-cols-3 gap-2 sm:min-w-[320px] sm:w-auto">
                                {SOFT_ASSET_BUCKETS.map((bucket) => (
                                    <button
                                        key={bucket}
                                        type="button"
                                        onClick={() => setActiveSoftBucket(bucket)}
                                        className="rounded-2xl border px-2.5 py-2 text-left transition-colors sm:px-3"
                                        style={{
                                            borderColor: activeSoftBucket === bucket ? 'var(--color-brand)' : 'var(--color-border)',
                                            backgroundColor: activeSoftBucket === bucket ? 'color-mix(in srgb, var(--color-brand-light) 45%, white)' : 'white',
                                        }}
                                    >
                                        <div className="text-base font-extrabold leading-none sm:text-lg" style={{ color: 'var(--color-text)' }}>
                                            {relatedSoftAssetCounts[bucket]}
                                        </div>
                                        <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] sm:text-xs sm:tracking-[0.12em]" style={{ color: activeSoftBucket === bucket ? 'var(--color-brand)' : 'var(--color-text-muted)' }}>
                                            {bucket}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="mt-6 grid gap-4">
                            {relatedSoftAssetGroups[activeSoftBucket].length > 0 ? relatedSoftAssetGroups[activeSoftBucket].map(sa => (
                                <div key={sa.id}
                                    onClick={() => navigate(`/resource/soft/${sa.id}`)}
                                    className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-brand-500 hover:shadow-md sm:gap-4 sm:p-4"
                                >
                                    {sa.logoUrl ? (
                                        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white p-1 sm:h-14 sm:w-14">
                                            <img src={sa.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                                        </div>
                                    ) : (
                                        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg border border-brand-100 bg-brand-50 text-brand-600 sm:h-14 sm:w-14">
                                            <CalendarDays size={24} />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="line-clamp-2 text-base font-bold leading-tight text-slate-900 sm:text-lg">{sa.name}</h3>
                                        {sa.schedule && (
                                            <p className="mt-1 flex items-center gap-1 text-xs text-slate-500 sm:text-sm">
                                                <Clock size={14} /> {sa.schedule}
                                            </p>
                                        )}
                                        {sa.description && (
                                            <p className="mt-2 line-clamp-2 text-xs text-slate-600 sm:text-sm"><LinkifiedText text={sa.description} /></p>
                                        )}
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
                )}
            </main>
        </div>
    );
}
