import { useEffect, useMemo, useState } from 'react';
import { Clock, ExternalLink, Globe2, Phone, RotateCcw, Search, X } from 'lucide-react';
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
    buildEmbedResourcePreviewDetails,
    buildEmbeddedMapPresentation,
    findEmbedPreviewGroup,
    getEmbedListOnlyResourceCount,
} from '../lib/embedMapPresentation.js';
import { getSocialLinkEntries } from '../lib/socialLinks.js';

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
        <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white text-base font-extrabold text-slate-500 shadow-sm sm:h-14 sm:w-14 sm:rounded-2xl">
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

function normalizeContactHref(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    if (/^[a-z][a-z\d+.-]*:/i.test(text) && !/^https?:\/\//i.test(text)) return '';
    const candidate = /^https?:\/\//i.test(text) ? text : `https://${text}`;
    try {
        const url = new URL(candidate);
        return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
            ? url.toString()
            : '';
    } catch {
        return '';
    }
}

function normalizeContactPhone(value) {
    const label = String(value || '').replace(/\s+/g, ' ').trim();
    if (!label || !/\d/.test(label)) return null;
    const dialValue = label.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
    return dialValue.replace(/\D/g, '').length >= 3
        ? { label, href: `tel:${dialValue}` }
        : null;
}

const SOCIAL_ICON_BUTTON_CLASSES = {
    facebook: 'border-[#1877f2] bg-[#1877f2] text-white hover:border-[#145dbd] hover:bg-[#145dbd]',
    instagram: 'border-transparent bg-[radial-gradient(circle_at_30%_110%,#ffdc80_0%,#fcaf45_24%,#f77737_42%,#e1306c_62%,#833ab4_100%)] text-white hover:brightness-95',
    tiktok: 'border-slate-900 bg-slate-950 text-white hover:bg-slate-800',
    youtube: 'border-[#ff0000] bg-[#ff0000] text-white hover:border-[#cc0000] hover:bg-[#cc0000]',
    linkedin: 'border-[#0a66c2] bg-[#0a66c2] text-white hover:border-[#084d93] hover:bg-[#084d93]',
};

function EmbedSocialPlatformIcon({ platform, size = 19 }) {
    const commonProps = {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'currentColor',
        'aria-hidden': 'true',
        focusable: 'false',
        className: 'shrink-0',
    };

    switch (platform) {
        case 'facebook':
            return <svg {...commonProps}><path d="M14.1 8.8h2.3V5.3c-.4-.1-1.7-.2-3.2-.2-3.2 0-5.3 1.9-5.3 5.5v3.1H4.5v3.9h3.4V24h4.1v-6.4h3.4l.5-3.9H12v-2.7c0-1.1.3-2.1 2.1-2.1Z" /></svg>;
        case 'instagram':
            return <svg {...commonProps}><path d="M7.1 2.2h9.8c2.7 0 4.9 2.2 4.9 4.9v9.8c0 2.7-2.2 4.9-4.9 4.9H7.1c-2.7 0-4.9-2.2-4.9-4.9V7.1c0-2.7 2.2-4.9 4.9-4.9Zm0 1.9c-1.7 0-3 1.3-3 3v9.8c0 1.7 1.3 3 3 3h9.8c1.7 0 3-1.3 3-3V7.1c0-1.7-1.3-3-3-3H7.1Zm4.9 3.3a4.6 4.6 0 1 1 0 9.2 4.6 4.6 0 0 1 0-9.2Zm0 1.9a2.7 2.7 0 1 0 0 5.4 2.7 2.7 0 0 0 0-5.4Zm5.1-2.6a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2Z" /></svg>;
        case 'tiktok':
            return <svg {...commonProps}><path d="M15.4 2.5c.3 2.5 1.7 4.1 4.1 4.3v3.4c-1.4.1-2.7-.3-4-1.1v6.3c0 3.2-2.1 5.6-5.3 5.6-3 0-5.4-2.1-5.4-5.1 0-3.5 3.4-6.1 6.8-5.1v3.5c-1.5-.5-3.3.3-3.3 1.9 0 1.1.9 1.8 1.9 1.8 1.2 0 1.9-.7 1.9-2.2V2.5h3.3Z" /></svg>;
        case 'youtube':
            return <svg {...commonProps}><path d="M21.6 7.1a3 3 0 0 0-2.1-2.1C17.7 4.5 12 4.5 12 4.5s-5.7 0-7.5.5a3 3 0 0 0-2.1 2.1C1.9 9 1.9 12 1.9 12s0 3 .5 4.9a3 3 0 0 0 2.1 2.1c1.8.5 7.5.5 7.5.5s5.7 0 7.5-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-4.9.5-4.9s0-3-.5-4.9ZM10 15.3V8.7l5.8 3.3L10 15.3Z" /></svg>;
        case 'linkedin':
            return <svg {...commonProps}><path d="M5.1 8.7h3.8v12.1H5.1V8.7Zm1.9-5.9a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4Zm4.2 5.9h3.6v1.7h.1c.5-.9 1.7-2 3.6-2 3.9 0 4.6 2.5 4.6 5.8v6.6h-3.8v-5.9c0-1.4 0-3.2-2-3.2s-2.3 1.5-2.3 3.1v6h-3.8V8.7Z" /></svg>;
        default:
            return <Globe2 size={size} aria-hidden="true" className="shrink-0" />;
    }
}

function ResourceContactLinks({ row, detailPath }) {
    const { t } = useLocale();
    const websiteHref = normalizeContactHref(row?.website);
    const contactPhone = normalizeContactPhone(row?.contactPhone);
    const socialEntries = getSocialLinkEntries(row?.socialLinks)
        .map((entry) => ({ ...entry, url: normalizeContactHref(entry.url) }))
        .filter((entry) => entry.url);

    if (!websiteHref && !contactPhone && socialEntries.length === 0 && !detailPath) return null;

    return (
        <div className="flex flex-wrap items-center gap-2">
            {websiteHref ? (
                <a
                    href={websiteHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t('website')}
                    title={t('website')}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-brand-700 transition hover:border-brand-300 hover:bg-brand-100 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:ring-offset-2"
                >
                    <Globe2 size={19} aria-hidden="true" />
                    <span className="sr-only">{t('website')}</span>
                </a>
            ) : null}
            {contactPhone ? (
                <a
                    href={contactPhone.href}
                    aria-label={`${t('contact')}: ${contactPhone.label}`}
                    className="inline-flex min-h-11 items-center gap-1.5 px-1 text-xs font-bold text-brand-700 hover:underline focus:outline-none focus:ring-2 focus:ring-brand-300 focus:ring-offset-2"
                >
                    <Phone size={14} /> {contactPhone.label}
                </a>
            ) : null}
            {socialEntries.map((entry) => (
                <a
                    key={entry.key}
                    href={entry.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${t('openExternalLink')} ${entry.label}`}
                    title={entry.label}
                    className={`inline-flex h-11 w-11 items-center justify-center rounded-full border shadow-sm transition focus:outline-none focus:ring-2 focus:ring-brand-300 focus:ring-offset-2 ${SOCIAL_ICON_BUTTON_CLASSES[entry.key] || 'border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:text-brand-700'}`}
                >
                    <EmbedSocialPlatformIcon platform={entry.key} />
                    <span className="sr-only">{entry.label}</span>
                </a>
            ))}
            {detailPath ? (
                <a
                    href={detailPath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto inline-flex min-h-11 items-center gap-1 text-xs font-bold text-brand-700 hover:underline focus:outline-none focus:ring-2 focus:ring-brand-300 focus:ring-offset-2"
                >
                    {t('embedMapOpenResource')} <ExternalLink size={12} />
                </a>
            ) : null}
        </div>
    );
}

function ResourcePreview({ group, fullMapUrl, onClose }) {
    const { t } = useLocale();
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

            <div className="space-y-2">
                {rows.slice(0, 4).map((row) => {
                    const preview = buildEmbedResourcePreviewDetails(group, row);
                    return (
                        <article
                            key={row.rowKey || row.assetKey || `${row.resourceType}:${row.resourceId}`}
                            className={`text-sm ${rows.length > 1 ? 'rounded-2xl border border-slate-200 p-2 sm:p-3' : ''}`}
                        >
                            <div className="flex items-start gap-2 pr-10 sm:gap-3 sm:pr-11">
                                <ResourcePreviewLogo row={row} />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-extrabold leading-4 text-slate-950 sm:leading-5">{preview.name}</p>
                                    {preview.address ? (
                                        <p className="mt-0.5 break-words text-xs leading-4 text-slate-500 sm:mt-1 sm:leading-5">{preview.address}</p>
                                    ) : null}
                                </div>
                            </div>

                            {preview.openProgrammeServiceCount > 0 ? (
                                <span className="mt-1.5 inline-flex rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-bold text-brand-800 sm:mt-2">
                                    {t('embedMapOpenProgrammeServiceCount', {
                                        count: preview.openProgrammeServiceCount,
                                    })}
                                </span>
                            ) : null}

                            {preview.scheduleText && row.status !== 'unavailable' ? (
                                <div className="mt-1.5 flex min-h-9 items-center gap-2 rounded-xl bg-slate-50 p-2 sm:mt-2 sm:items-start">
                                    <Clock size={17} aria-hidden="true" className="shrink-0 text-brand-700 sm:mt-0.5" />
                                    <div className="min-w-0">
                                        <p className="hidden text-[10px] font-extrabold uppercase tracking-wide text-slate-500 sm:block">
                                            {t(preview.scheduleLabelKey)}
                                        </p>
                                        <p className="whitespace-pre-line break-words text-xs leading-4 text-slate-700 sm:mt-0.5 sm:leading-5">
                                            {preview.scheduleText}
                                        </p>
                                    </div>
                                </div>
                            ) : null}

                            {row.status !== 'unavailable' ? (
                                <div className="mt-1 sm:mt-1.5">
                                    <ResourceContactLinks row={row} detailPath={row.detailPath} />
                                </div>
                            ) : null}
                        </article>
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

            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 sm:px-4 sm:py-2.5">
                {!selectedGroup ? <span>{t('embedMapSelectResource')}</span> : null}
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
