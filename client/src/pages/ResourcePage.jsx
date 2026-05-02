import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { ArrowLeft } from 'lucide-react';
import SaveAssetButton from '../components/SaveAssetButton.jsx';
import ResourceDetailContent from '../components/ResourceDetailContent.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import {
    buildCurrentAppPath,
    getDocumentMapReferrerPath,
    hardNavigate,
    normalizeMapReturnPath,
    openResourceDetail,
} from '../lib/appNavigation.js';
import {
    GEOLOCATION_OPTIONS,
    getSearchLocationLabel,
    loadSearchLocation,
    saveSearchLocation,
} from '../lib/searchLocation.js';
import { useLocale } from '../contexts/LocaleContext.jsx';

export default function ResourcePage() {
    const { type, id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();
    const [asset, setAsset] = useState(null);
    const [subCatColors, setSubCatColors] = useState({});
    const [loading, setLoading] = useState(true);
    const [sortOrigin, setSortOrigin] = useState(() => loadSearchLocation());
    const [activeSoftBucket, setActiveSoftBucket] = useState('Programmes');
    const isMobile = useMediaQuery('(max-width: 639px)');
    const { t } = useLocale();

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

    useLayoutEffect(() => {
        if (typeof window === 'undefined') return;
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
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
    const currentPath = buildCurrentAppPath(location);
    const mapReturnPath = useMemo(() => (
        normalizeMapReturnPath(searchParams.get('returnTo'), currentPath)
            || getDocumentMapReferrerPath(currentPath)
    ), [currentPath, searchParams]);
    const savedAssetSummary = !asset ? null : {
        name: asset.name,
        subCategory: asset.subCategory,
        address: isHard ? asset?.address || null : asset?.location?.address || asset?.locations?.[0]?.address || null,
        lat: isHard ? asset?.lat : asset?.location?.lat || asset?.locations?.[0]?.lat,
        lng: isHard ? asset?.lng : asset?.location?.lng || asset?.locations?.[0]?.lng,
        detailPath: `/resource/${type}/${asset.id}`,
    };

    function handleReturn() {
        if (mapReturnPath) {
            hardNavigate(mapReturnPath, navigate);
            return;
        }

        if (typeof window !== 'undefined' && window.history.length <= 1) {
            navigate('/discover', { replace: true });
            return;
        }

        navigate(-1);
    }

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--page-gradient)' }}>
            <div className="w-12 h-12 border-4 border-slate-200 border-t-brand-600 rounded-full animate-spin" />
        </div>;
    }

    if (!asset) {
        return <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: 'var(--page-gradient)' }}>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">{t('resourceNotFound')}</h2>
            <button onClick={() => navigate('/discover')} className="text-brand-600 font-bold hover:underline">{t('backToDiscover')}</button>
        </div>;
    }

    return (
        <div className="min-h-[calc(100vh-4rem)] pb-20" style={{ background: 'var(--page-gradient)' }}>
            {/* Header / Banner */}
            <div className="sticky top-[56px] z-40 border-b shadow-sm sm:top-[64px]" style={{ backgroundColor: 'rgba(255,255,255,0.94)', borderColor: 'var(--color-border)', backdropFilter: 'blur(16px)' }}>
                <div className={`max-w-4xl mx-auto flex items-center gap-3 px-4 ${isMobile ? 'py-2.5' : 'py-3'}`}>
                    <button onClick={handleReturn} className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-700 transition" aria-label={t('back')}>
                        <ArrowLeft size={isMobile ? 20 : 24} />
                    </button>
                    <div className="min-w-0 flex-1">
                        <p className={`truncate font-bold text-slate-900 ${isMobile ? 'text-lg leading-tight' : 'text-xl'}`}>{asset.name}</p>
                        {isMobile ? (
                            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                {type === 'hard' ? t('placeDetails') : t('offeringDetails')}
                            </p>
                        ) : null}
                    </div>
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

            <main className={`max-w-4xl mx-auto px-4 ${isMobile ? 'py-4' : 'py-6'}`}>
                <ResourceDetailContent
                    asset={asset}
                    onNavigateToResource={(resourceType, resourceId) => openResourceDetail(resourceType, resourceId, navigate)}
                    sortOrigin={sortOrigin}
                    sortOriginLabel={sortOrigin ? getSearchLocationLabel(sortOrigin) : null}
                    subCatColors={subCatColors}
                    type={type}
                />
            </main>
        </div>
    );
}
