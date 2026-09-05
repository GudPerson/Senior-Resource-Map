import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Layers3, RotateCcw, Search, X } from 'lucide-react';
import { useParams } from 'react-router-dom';

import DirectoryMap from '../components/DirectoryMap.jsx';
import CompactResourcePreviewCard, {
    COMPACT_RESOURCE_DETAIL_ACTION_CLASSNAME,
} from '../components/CompactResourcePreviewCard.jsx';
import { FIXED_TOWN_SURFACE_MIN_ZOOM } from '../components/FixedTownSurfaceLayer.jsx';
import PrintAnnotationLayer from '../components/PrintAnnotationLayer.jsx';
import BrandLockup from '../components/layout/BrandLockup.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { useEmbeddedDetailedMap } from '../hooks/useEmbeddedDetailedMap.js';
import { fetchEmbeddedMap } from '../lib/embedMapApi.js';
import { normalizePrintAnnotations } from '../lib/printAnnotations.js';
import {
    buildEmbedCategoryOptions,
    buildEmbeddedMapRuntime,
    buildEmbeddedMapPresentation,
    findEmbedPreviewGroups,
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

function SharedLocationChooser({ groups, onSelect }) {
    const { t } = useLocale();
    const resourceCount = groups.reduce((total, group) => total + (group?.rows?.length || 0), 0);

    return (
        <div>
            <div className="border-b border-slate-100 px-3 pb-3 pr-12 pt-2 sm:px-2 sm:pt-1">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-700">
                    <Layers3 size={14} aria-hidden="true" />
                    {t('embedMapSharedLocation')}
                </div>
                <p className="mt-1 text-base font-extrabold text-slate-950">
                    {t('embedMapResourcesAtLocation', { count: resourceCount })}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{t('embedMapChooseResource')}</p>
            </div>

            <div className="space-y-2 pt-2">
                {groups.map((group) => {
                    const previewRow = group?.rows?.[0] || {};
                    const iconUrl = group?.categoryIconUrl
                        || previewRow.mapCategoryIconUrl
                        || previewRow.categoryIconUrl
                        || previewRow.logoUrl
                        || null;
                    const address = group?.shortLocationLine || group?.address || previewRow.address || '';

                    return (
                        <button
                            key={group.placeKey}
                            type="button"
                            onClick={() => onSelect(group.placeKey)}
                            className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-left shadow-sm transition-[border-color,background-color,transform] duration-150 ease-out hover:border-brand-200 hover:bg-brand-50/50 active:scale-[0.98]"
                        >
                            <span
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm"
                                style={iconUrl ? undefined : { backgroundColor: group?.categoryColor || '#0f766e' }}
                            >
                                {iconUrl ? <img src={iconUrl} alt="" className="h-7 w-7 object-contain" draggable="false" /> : null}
                            </span>
                            <span className="min-w-0 flex-1">
                                {group?.categoryLabel ? (
                                    <span className="block truncate text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
                                        {group.categoryLabel}
                                    </span>
                                ) : null}
                                <span className="mt-0.5 block text-sm font-extrabold leading-5 text-slate-900">{group.name}</span>
                                {address ? <span className="mt-0.5 block text-xs leading-4 text-slate-500">{address}</span> : null}
                            </span>
                            <ChevronRight size={17} className="shrink-0 text-slate-400" aria-hidden="true" />
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function ResourcePreview({ groups, selectedMemberPlaceKey, fullMapUrl, onSelectMember, onBack, onClose }) {
    const { t } = useLocale();
    const selectedGroup = groups.find((group) => String(group?.placeKey || '') === String(selectedMemberPlaceKey || '')) || null;
    const showChooser = groups.length > 1 && !selectedGroup;
    const group = selectedGroup || groups[0] || null;
    const rows = group?.rows || [];

    return (
        <section className="absolute inset-x-3 bottom-3 z-[1100] max-h-[calc(100%-1.5rem)] overflow-y-auto rounded-[22px] border border-slate-200 bg-white/95 p-2 shadow-xl backdrop-blur sm:inset-x-auto sm:bottom-4 sm:left-4 sm:max-h-[48%] sm:w-[min(400px,calc(100%-2rem))] sm:p-3">
            <button
                type="button"
                onClick={onClose}
                className="absolute right-2 top-2 z-10 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 sm:right-3 sm:top-3"
                aria-label={t('close')}
            >
                <X size={18} />
            </button>

            {showChooser ? (
                <SharedLocationChooser groups={groups} onSelect={onSelectMember} />
            ) : (
                <>
                    {groups.length > 1 ? (
                        <button
                            type="button"
                            onClick={onBack}
                            className="mb-2 inline-flex min-h-11 items-center gap-1 rounded-xl px-2 pr-12 text-sm font-bold text-brand-700 transition-[background-color,transform] duration-150 ease-out hover:bg-brand-50 active:scale-[0.98]"
                        >
                            <ChevronLeft size={17} aria-hidden="true" />
                            {t('embedMapBackToLocation')}
                        </button>
                    ) : null}

                    <div className="space-y-2">
                        {rows.slice(0, 4).map((row) => (
                            <CompactResourcePreviewCard
                                key={row.rowKey || row.assetKey || `${row.resourceType}:${row.resourceId}`}
                                group={group}
                                row={row}
                                framed={rows.length > 1}
                                reserveCloseSpace
                                detailAction={row.detailPath ? (
                                    <a
                                        href={row.detailPath}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={COMPACT_RESOURCE_DETAIL_ACTION_CLASSNAME}
                                    >
                                        {t('embedMapOpenResource')} <ExternalLink size={12} />
                                    </a>
                                ) : null}
                            />
                        ))}
                    </div>
                </>
            )}

            {!showChooser && rows.length > 4 ? (
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
    const [selectedMemberPlaceKey, setSelectedMemberPlaceKey] = useState('');
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
    const selectedGroups = useMemo(() => (
        findEmbedPreviewGroups(presentation, selectedPlaceKey)
    ), [presentation, selectedPlaceKey]);
    const listOnlyCount = useMemo(() => getEmbedListOnlyResourceCount(directory), [directory]);
    const mappedResourceCount = useMemo(() => (
        (presentation?.mappedGroups || []).reduce((total, group) => total + (group.rows?.length || 0), 0)
    ), [presentation?.mappedGroups]);
    const fullMapUrl = useMemo(() => buildFullMapUrl(directory, token), [directory, token]);
    const embeddedMapRuntime = useMemo(() => (
        buildEmbeddedMapRuntime(directory?.embeddedPresentation)
    ), [directory?.embeddedPresentation]);
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
        setSelectedMemberPlaceKey('');
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
        setSelectedMemberPlaceKey('');
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
                                setSelectedMemberPlaceKey('');
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
                                setSelectedMemberPlaceKey('');
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
                    onViewSection={(placeKey) => {
                        setSelectedPlaceKey(String(placeKey || ''));
                        setSelectedMemberPlaceKey('');
                    }}
                    markerMode={embeddedMapRuntime.markerMode}
                    markerScale={embeddedMapRuntime.markerScale}
                    printBadgeScale={embeddedMapRuntime.printBadgeScale}
                    pinBadgeMode={embeddedMapRuntime.pinBadgeMode}
                    pinCategoryIconMode={embeddedMapRuntime.pinCategoryIconMode}
                    clusterMarkerMode={embeddedMapRuntime.clusterMarkerMode}
                    showPins={embeddedMapRuntime.pinsVisible}
                    placeNumberByKey={presentation.placeNumberByKey}
                    showPopup={false}
                    showMapStyleControl={false}
                    mapStyleOverride={embeddedMapRuntime.mapStyle}
                    basemapMode={embeddedMapRuntime.detailMode === 'live'
                        ? 'live'
                        : detailedMap.enabled ? 'auto' : 'live'}
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
                    mapOverlay={embeddedMapRuntime.annotationsVisible ? sharedAnnotationOverlay : null}
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

                {selectedGroups.length ? (
                    <ResourcePreview
                        groups={selectedGroups}
                        selectedMemberPlaceKey={selectedMemberPlaceKey}
                        fullMapUrl={fullMapUrl}
                        onSelectMember={setSelectedMemberPlaceKey}
                        onBack={() => setSelectedMemberPlaceKey('')}
                        onClose={() => {
                            setSelectedPlaceKey('');
                            setSelectedMemberPlaceKey('');
                        }}
                    />
                ) : null}
            </section>

            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 sm:px-4 sm:py-2.5">
                {!selectedGroups.length ? <span>{t('embedMapSelectResource')}</span> : null}
                <span className="ml-auto flex flex-wrap items-center justify-end gap-3">
                    {listOnlyCount > 0 ? (
                        <a href={fullMapUrl} target="_blank" rel="noreferrer" className="font-semibold text-brand-700 hover:underline">
                            {t('embedMapListOnlyNotice', { count: listOnlyCount })}
                        </a>
                    ) : null}
                    <a href={fullMapUrl} target="_blank" rel="noreferrer" className={`${listOnlyCount > 0 ? 'hidden sm:inline' : ''} font-bold text-slate-700 hover:text-brand-700`}>
                        {t('embedMapPoweredBy')}
                    </a>
                </span>
            </footer>
        </main>
    );
}
