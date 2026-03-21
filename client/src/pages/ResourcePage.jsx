import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { ArrowLeft } from 'lucide-react';
import SaveAssetButton from '../components/SaveAssetButton.jsx';
import ResourceDetailContent from '../components/ResourceDetailContent.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import {
    GEOLOCATION_OPTIONS,
    getSearchLocationLabel,
    loadSearchLocation,
    saveSearchLocation,
} from '../lib/searchLocation.js';

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
    const savedAssetSummary = !asset ? null : {
        name: asset.name,
        subCategory: asset.subCategory,
        address: isHard ? asset?.address || null : asset?.location?.address || asset?.locations?.[0]?.address || null,
        lat: isHard ? asset?.lat : asset?.location?.lat || asset?.locations?.[0]?.lat,
        lng: isHard ? asset?.lng : asset?.location?.lng || asset?.locations?.[0]?.lng,
        detailPath: `/resource/${type}/${asset.id}`,
    };

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

            <main className="max-w-4xl mx-auto px-4 py-6">
                <ResourceDetailContent
                    asset={asset}
                    onNavigateToResource={(resourceType, resourceId) => navigate(`/resource/${resourceType}/${resourceId}`)}
                    sortOrigin={sortOrigin}
                    sortOriginLabel={sortOrigin ? getSearchLocationLabel(sortOrigin) : null}
                    subCatColors={subCatColors}
                    type={type}
                />
            </main>
        </div>
    );
}
