import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, RotateCcw, Search, X } from 'lucide-react';
import { useParams } from 'react-router-dom';

import DirectoryMap from '../components/DirectoryMap.jsx';
import { FIXED_TOWN_SURFACE_MIN_ZOOM } from '../components/FixedTownSurfaceLayer.jsx';
import PrintAnnotationLayer from '../components/PrintAnnotationLayer.jsx';
import BrandLockup from '../components/layout/BrandLockup.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { useEmbeddedDetailedMap } from '../hooks/useEmbeddedDetailedMap.js';
import { fetchEmbeddedMap } from '../lib/embedMapApi.js';
import { normalizePrintAnnotations } from '../lib/printAnnotations.js';
import {
    buildEmbedCategoryOptions,
    buildEmbeddedMapPresentation,
    findEmbedPreviewGroup,
    getEmbedListOnlyResourceCount,
} from '../lib/embedMapPresentation.js';

function useCoarsePointer() {
    const [coarsePointer, setCoarsePointer] = useState(() => (
        typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
    ));

    useEffect(() => {
        const media = window.matchMedia?.('(pointer: coarse)');
        if (!media) return undefined;
        const handleChange = (event) => setCoarsePointer(event.matches);
        setCoarsePointer(media.matches);
        media.addEventListener?.('change', handleChange);
        return () => media.removeEventListener?.('change', handleChange);
    }, []);

    return coarsePointer;
}

function buildFullMapUrl(directory, token) {
    const path = directory?.share?.sharePath || `/shared/maps/${encodeURIComponent(token || '')}`;
    if (typeof window === 'undefined') return path;
    return new URL(path, window.location.origin).toString();
}

function MappedResourceCount({ count }) {
    const { t } = useLocale();
    return (
        <span className="whitespace-nowrap rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-800">
            <span className="sm:hidden">{t('embedMapResultsCompact', { count })}</span>
            <span className="hidden sm:inline">{t('embedMapResults', { count })}</span>
        </span>
    );
}

function EmbeddedMapUnavailable({ retryable, onRetry }) {
    const { t } = useLocale();
    return (
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-8">
            <section className="w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
                <BrandLockup compact className="justify-center" />
                <h1 className="mt-6 text-2xl font-extrabold text-slate-950">{t('embedMapUnavailable')}</h1>
                <p className="mt-3 text-sm leading-6 text-slate-600">{t('embedMapUnavailableHelp')}</p>
                {retryable ? (
                    <button type="button" onClick={onRetry} className="btn-primary mt-6 min-h-11 justify-center">
                        {t('embedMapRetry')}
                    </button>
                ) : null}
            </section>
        </main>
    );
}

function ResourcePreviewLogo({ row }) {
    const imageUrls = [row?.logoUrl, row?.mapCategoryIconUrl, row?.categoryIconUrl]
        .map((value) => String(value || '').trim())
        .filter((value, index, values) => value && values.indexOf(value) === index);
    const imageSignature = imageUrls.join('|');
    const [failedImageCount, setFailedImageCount] = useState(0);

    useEffect(() => {
        setFailedImageCount(0);
    }, [imageSignature]);

    const imageUrl = imageUrls[failedImageCount] || '';
    const fallbackLabel = String(row?.name || '').trim().slice(0, 1).toUpperCase() || 'C';

    return (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-sm font-extrabold text-slate-500">
            {imageUrl ? (
                <img
                    src={imageUrl}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-contain p-1"
                    onError={() => setFailedImageCount((current) => current + 1)}
                />
            ) : fallbackLabel}
        </span>
    );
}

function ResourcePreview({ group, fullMapUrl, onClose }) {
    const { t } = useLocale();
    const rows = group?.rows || [];

    return (
        <section className="absolute inset-x-3 bottom-3 z-[500] max-h-[42%] overflow-y-auto rounded-[22px] border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur sm:inset-x-auto sm:bottom-4 sm:left-4 sm:w-[min(380px,calc(100%-2rem))]">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-base font-extrabold text-slate-950">{group?.name}</p>
                    {group?.shortLocationLine || group?.address ? (
                        <p className="mt-1 text-xs leading-5 text-slate-500">{group.shortLocationLine || group.address}</p>
                    ) : null}
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
                    aria-label={t('close')}
                >
                    <X size={18} />
                </button>
            </div>

            <div className="mt-3 space-y-2">
                {rows.slice(0, 4).map((row) => {
                    const content = (
                        <span className="flex items-start gap-3">
                            <ResourcePreviewLogo row={row} />
                            <span className="min-w-0 flex-1">
                                <span className="block font-bold text-slate-900">{row.name}</span>
                                <span className="mt-0.5 block text-xs text-slate-500">{row.mapSubCategory || row.subCategory || row.bucket || ''}</span>
                            </span>
                        </span>
                    );
                    return row.detailPath && row.status !== 'unavailable' ? (
                        <a
                            key={row.rowKey || row.assetKey || `${row.resourceType}:${row.resourceId}`}
                            href={row.detailPath}
                            target="_blank"
                            rel="noreferrer"
                            className="block rounded-2xl border border-slate-200 px-3 py-2.5 text-sm transition hover:border-brand-200 hover:bg-brand-50"
                        >
                            {content}
                            <span className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-brand-700">
                                {t('embedMapOpenResource')} <ExternalLink size={12} />
                            </span>
                        </a>
                    ) : (
                        <div
                            key={row.rowKey || row.assetKey || `${row.resourceType}:${row.resourceId}`}
                            className="rounded-2xl border border-slate-200 px-3 py-2.5 text-sm"
                        >
                            {content}
                        </div>
                    );
                })}
            </div>

            {rows.length > 4 ? (
                <a href={fullMapUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-brand-700">
                    {t('openFullMap')} <ExternalLink size={14} />
                </a>
            ) : null}
        </section>
    );
}

export default function EmbeddedMapPage() {
    const { token } = useParams();
    const { t } = useLocale();
    const coarsePointer = useCoarsePointer();
    const [loadAttempt, setLoadAttempt] = useState(0);
    const [state, setState] = useState({ status: 'loading', directory: null, error: null });
    const [query, setQuery] = useState('');
    const [selectedCategoryKeys, setSelectedCategoryKeys] = useState([]);
    const [selectedPlaceKey, setSelectedPlaceKey] = useState('');
    const [mapResetKey, setMapResetKey] = useState(0);
    const [touchInteractionEnabled, setTouchInteractionEnabled] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setState({ status: 'loading', directory: null, error: null });
        fetchEmbeddedMap(token)
            .then((directory) => {
                if (!cancelled) setState({ status: 'ready', directory, error: null });
            })
            .catch((error) => {
                if (!cancelled) setState({ status: 'error', directory: null, error });
            });
        return () => {
            cancelled = true;
        };
    }, [loadAttempt, token]);

    useEffect(() => {
        if (!touchInteractionEnabled) return undefined;
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') setTouchInteractionEnabled(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [touchInteractionEnabled]);

    const directory = state.directory;
    const categories = useMemo(() => buildEmbedCategoryOptions(directory), [directory]);
    const presentation = useMemo(() => buildEmbeddedMapPresentation(directory, {
        query,
        selectedCategoryKeys,
    }), [directory, query, selectedCategoryKeys]);
    const selectedGroup = useMemo(() => (
        findEmbedPreviewGroup(presentation, selectedPlaceKey)
    ), [presentation, selectedPlaceKey]);
    const listOnlyCount = useMemo(() => getEmbedListOnlyResourceCount(directory), [directory]);
    const mappedResourceCount = useMemo(() => (
        (presentation?.mappedGroups || []).reduce((total, group) => total + (group.rows?.length || 0), 0)
    ), [presentation?.mappedGroups]);
    const fullMapUrl = useMemo(() => buildFullMapUrl(directory, token), [directory, token]);
    const detailedMap = useEmbeddedDetailedMap(presentation.pins);
    const sharedAnnotations = useMemo(() => (
        normalizePrintAnnotations(directory?.printAnnotations)
    ), [directory?.printAnnotations]);
    const sharedAnnotationOverlay = useMemo(() => (
        sharedAnnotations.length ? (
            <PrintAnnotationLayer annotations={sharedAnnotations} editable={false} />
        ) : null
    ), [sharedAnnotations]);

    if (state.status === 'loading') {
        return (
            <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 text-sm font-semibold text-slate-600">
                {t('embedMapLoading')}
            </main>
        );
    }
    if (state.status === 'error') {
        return (
            <EmbeddedMapUnavailable
                retryable={state.error?.status !== 404}
                onRetry={() => setLoadAttempt((current) => current + 1)}
            />
        );
    }

    function toggleCategory(categoryKey) {
        setSelectedPlaceKey('');
        setSelectedCategoryKeys((current) => (
            current.includes(categoryKey)
                ? current.filter((key) => key !== categoryKey)
                : [...current, categoryKey]
        ));
    }

    function resetMap() {
        setQuery('');
        setSelectedCategoryKeys([]);
        setSelectedPlaceKey('');
        setMapResetKey((current) => current + 1);
    }

    return (
        <main className="flex h-screen min-h-[400px] flex-col overflow-hidden bg-slate-50 text-slate-950">
            <div className="embedded-map-height-warning fixed inset-0 z-[2000] items-center justify-center bg-slate-950/80 p-5 text-center">
                <p className="max-w-sm rounded-2xl bg-white p-5 text-sm font-bold leading-6 text-slate-900 shadow-xl">
                    {t('embedMapHeightTooSmall')}
                </p>
            </div>
            <header className="border-b border-slate-200 bg-white px-3 py-3 sm:px-4">
                <div className="flex flex-wrap items-center gap-3">
                    <BrandLockup compact className="mr-auto" />
                    <MappedResourceCount count={mappedResourceCount} />
                    <a
                        href={fullMapUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    >
                        {t('openFullMap')} <ExternalLink size={15} />
                    </a>
                </div>
                <h1 className="mt-3 truncate text-lg font-extrabold sm:text-xl">{directory.name}</h1>
                <div className="mt-3 flex gap-2">
                    <label className="relative min-w-0 flex-1">
                        <span className="sr-only">{t('embedMapSearchPlaceholder')}</span>
                        <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            value={query}
                            onChange={(event) => {
                                setQuery(event.target.value);
                                setSelectedPlaceKey('');
                            }}
                            placeholder={t('embedMapSearchPlaceholder')}
                            className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                        />
                    </label>
                    <button
                        type="button"
                        onClick={resetMap}
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        aria-label={t('mapResetView')}
                        title={t('mapResetView')}
                    >
                        <RotateCcw size={17} />
                    </button>
                </div>
                {categories.length ? (
                    <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label={t('embedAllCategories')}>
                        <button
                            type="button"
                            onClick={() => {
                                setSelectedCategoryKeys([]);
                                setSelectedPlaceKey('');
                            }}
                            className={`min-h-11 shrink-0 rounded-full border px-4 text-xs font-bold ${selectedCategoryKeys.length === 0 ? 'border-brand-600 bg-brand-700 text-white' : 'border-slate-200 bg-white text-slate-700'}`}
                        >
                            {t('embedAllCategories')}
                        </button>
                        {categories.map((category) => {
                            const selected = selectedCategoryKeys.includes(category.key);
                            return (
                                <button
                                    key={category.key}
                                    type="button"
                                    onClick={() => toggleCategory(category.key)}
                                    aria-pressed={selected}
                                    className={`min-h-11 shrink-0 rounded-full border px-4 text-xs font-bold ${selected ? 'border-brand-600 bg-brand-700 text-white' : 'border-slate-200 bg-white text-slate-700'}`}
                                >
                                    {category.label}
                                </button>
                            );
                        })}
                    </div>
                ) : null}
            </header>

            <section className="relative min-h-0 flex-1 overflow-hidden bg-white">
                <DirectoryMap
                    key={`embed-map-${mapResetKey}`}
                    pins={presentation.pins}
                    onViewSection={(placeKey) => setSelectedPlaceKey(String(placeKey || ''))}
                    markerMode="category-bubble"
                    pinBadgeMode="none"
                    pinCategoryIconMode="none"
                    clusterMarkerMode="bubble"
                    placeNumberByKey={presentation.placeNumberByKey}
                    showPopup={false}
                    showMapStyleControl={false}
                    mapStyleOverride="default"
                    basemapMode={detailedMap.enabled ? 'auto' : 'live'}
                    fixedTownSurfaceManifest={detailedMap.native.manifest}
                    fixedTownAssetBaseUrl={detailedMap.native.assetBaseUrl}
                    fixedTownSurfaceAvailable={detailedMap.native.available}
                    fixedTownSurfacePending={detailedMap.native.pending}
                    fixedTownSurfaceMinZoom={FIXED_TOWN_SURFACE_MIN_ZOOM}
                    fixedTownOverviewSurfaceManifest={detailedMap.overview.manifest}
                    fixedTownOverviewAssetBaseUrl={detailedMap.overview.assetBaseUrl}
                    fixedTownOverviewSurfaceAvailable={detailedMap.overview.available}
                    fixedTownOverviewSurfacePending={detailedMap.overview.pending}
                    fixedTownSurfaceLockMinZoom={false}
                    fixedTownSurfaceFallbackBelowMinZoom
                    fixedTownSurfaceFallbackScope="local"
                    onFixedTownSurfaceViewportChange={detailedMap.setViewportBounds}
                    mapOverlay={sharedAnnotationOverlay}
                    mapHeightClassName="h-full"
                    layoutSignature={`embedded-map-${mapResetKey}`}
                    emptyLabel={t('sharedMapNoMappablePlacesYet')}
                />

                {coarsePointer && !touchInteractionEnabled ? (
                    <button
                        type="button"
                        onClick={() => setTouchInteractionEnabled(true)}
                        className="absolute inset-0 z-[450] flex items-center justify-center bg-slate-950/10 px-5 text-center backdrop-blur-[1px]"
                    >
                        <span className="rounded-2xl bg-white px-5 py-4 text-sm font-extrabold text-slate-900 shadow-xl">
                            {t('embedMapEnableInteraction')}
                            <span className="mt-1 block text-xs font-medium text-slate-500">{t('embedMapInteractionHelp')}</span>
                        </span>
                    </button>
                ) : null}

                {coarsePointer && touchInteractionEnabled ? (
                    <button
                        type="button"
                        onClick={() => setTouchInteractionEnabled(false)}
                        className="absolute left-3 top-3 z-[500] min-h-11 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white shadow-lg"
                    >
                        {t('done')}
                    </button>
                ) : null}

                {selectedGroup ? (
                    <ResourcePreview
                        group={selectedGroup}
                        fullMapUrl={fullMapUrl}
                        onClose={() => setSelectedPlaceKey('')}
                    />
                ) : null}
            </section>

            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-500">
                <span>{selectedGroup ? selectedGroup.name : t('embedMapSelectResource')}</span>
                <span className="flex flex-wrap items-center justify-end gap-3">
                    {listOnlyCount > 0 ? (
                        <a href={fullMapUrl} target="_blank" rel="noreferrer" className="font-semibold text-brand-700 hover:underline">
                            {t('embedMapListOnlyNotice', { count: listOnlyCount })}
                        </a>
                    ) : null}
                    <a href={fullMapUrl} target="_blank" rel="noreferrer" className="font-bold text-slate-700 hover:text-brand-700">
                        {t('embedMapPoweredBy')}
                    </a>
                </span>
            </footer>
        </main>
    );
}
