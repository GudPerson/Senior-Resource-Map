import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Building2, CalendarDays, MapPin, Clock, ArrowLeft, Navigation, Phone } from 'lucide-react';

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

export default function ResourcePage() {
    const { type, id } = useParams();
    const navigate = useNavigate();
    const [asset, setAsset] = useState(null);
    const [subCatColors, setSubCatColors] = useState({});
    const [loading, setLoading] = useState(true);

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

    if (loading) {
        return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="w-12 h-12 border-4 border-slate-200 border-t-brand-600 rounded-full animate-spin" />
        </div>;
    }

    if (!asset) {
        return <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Resource not found</h2>
            <button onClick={() => navigate('/discover')} className="text-brand-600 font-bold hover:underline">Return to Discover</button>
        </div>;
    }

    const isHard = type === 'hard';
    const primaryAddress = isHard ? asset.address : asset.locations?.[0]?.address || asset.location?.address;
    const phone = asset.phone || (asset.locations?.[0]?.phone || asset.location?.phone);

    const handleDirections = (customLocation = null) => {
        const target = customLocation || (isHard ? asset : (asset.locations?.[0] || asset.location));
        if (!target) return;

        const lat = target.lat;
        const lng = target.lng;
        if (lat && lng) {
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank', 'noopener,noreferrer');
        } else if (target.address) {
            window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(target.address)}`, '_blank', 'noopener,noreferrer');
        }
    };

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-slate-50 pb-20">
            {/* Header / Banner */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-700 transition">
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="text-xl font-bold text-slate-900 truncate">{asset.name}</h1>
                </div>
            </div>

            <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
                {(asset.bannerUrl || asset.logoUrl) && (
                    <div className={`w-full ${asset.bannerUrl ? 'h-64 sm:h-80' : 'h-32 sm:h-48'} bg-white rounded-2xl border border-slate-200 overflow-hidden flex items-center justify-center p-4 shadow-sm relative`}>
                        {asset.bannerUrl ? (
                            <img src={asset.bannerUrl} alt="Banner" className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                            <img src={asset.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                        )}
                    </div>
                )}

                <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
                    <div className="flex flex-col sm:flex-row items-start gap-4 mb-4">
                        {asset.logoUrl && asset.bannerUrl && (
                            <img src={asset.logoUrl} alt="Logo" className="w-20 h-20 rounded-xl border border-slate-200 object-contain bg-white flex-shrink-0" />
                        )}
                        <div>
                            <div
                                className="inline-flex items-center gap-1.5 px-3 py-1 mb-3 rounded-lg bg-white text-sm font-bold border border-slate-200 shadow-sm"
                                style={{ color: subCatColors[asset.subCategory] || '#334155' }}
                            >
                                {isHard ? <Building2 size={16} /> : <CalendarDays size={16} />}
                                {asset.subCategory || (isHard ? 'Place' : 'Offering')}
                            </div>
                            <h1 className="text-3xl font-bold text-slate-900 leading-tight">{asset.name}</h1>
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
                        {!isHard && asset.locations && asset.locations.length > 0 && (
                            asset.locations.map((loc, idx) => (
                                <div key={loc.id || idx} className="flex items-start gap-3">
                                    <div className="p-2.5 bg-brand-50 rounded-xl text-brand-600 shrink-0"><MapPin size={22} /></div>
                                    <div>
                                        <p className="font-bold text-slate-900 mb-1">Place: {loc.name}</p>
                                        <p className="text-slate-700">{loc.address}</p>
                                        <div className="flex items-center gap-4 mt-2 border-t border-slate-100 pt-2">
                                            <button onClick={() => navigate(`/resource/hard/${loc.id}`)} className="text-brand-600 text-sm font-bold hover:underline block">View Details</button>
                                            <button onClick={() => handleDirections(loc)} className="text-brand-600 text-sm font-bold hover:underline flex items-center gap-1"><Navigation size={14} /> Directions</button>
                                        </div>
                                    </div>
                                </div>
                            ))
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

                    <div className="mt-8">
                        <button
                            onClick={handleDirections}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-brand-600 text-white font-bold hover:bg-brand-700 transition shadow-sm text-lg"
                        >
                            <Navigation size={20} />
                            Get Directions (Google Maps)
                        </button>
                    </div>
                </div>

                {/* Soft assets related to this hard asset */}
                {isHard && asset.softAssets && asset.softAssets.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <h2 className="text-2xl font-bold text-slate-900 mb-4">Available Offerings & Resources</h2>
                        <div className="grid gap-4">
                            {asset.softAssets.map(sa => (
                                <div key={sa.id}
                                    onClick={() => navigate(`/resource/soft/${sa.id}`)}
                                    className="p-4 rounded-xl border border-slate-200 hover:border-brand-500 hover:shadow-md cursor-pointer transition flex items-start gap-4 bg-white"
                                >
                                    {sa.logoUrl ? (
                                        <div className="w-14 h-14 flex-shrink-0 bg-white rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden p-1">
                                            <img src={sa.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                                        </div>
                                    ) : (
                                        <div className="w-14 h-14 flex-shrink-0 bg-brand-50 rounded-lg flex items-center justify-center text-brand-600 border border-brand-100">
                                            <CalendarDays size={24} />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-lg text-slate-900 leading-tight truncate">{sa.name}</h3>
                                        {sa.schedule && (
                                            <p className="text-slate-500 text-sm mt-1 flex items-center gap-1">
                                                <Clock size={14} /> {sa.schedule}
                                            </p>
                                        )}
                                        {sa.description && (
                                            <p className="text-slate-600 text-sm mt-2 line-clamp-1"><LinkifiedText text={sa.description} /></p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
