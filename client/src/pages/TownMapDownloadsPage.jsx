import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Download, MapPinned, RefreshCw, Search, Wifi, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import TownMapDownloadCard from '../components/townMaps/TownMapDownloadCard.jsx';
import {
    DASHBOARD_DESKTOP_SIDEBAR_CLASS_NAME,
    DashboardMobileNavigation,
    DashboardSidebar,
} from '../components/dashboard/DashboardNavigation.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import {
    fetchTownMapDownloadCatalogue,
    getTownMapDownloadCatalogueUrl,
    preflightTownMapDownload,
    resolveTownMapAssetUrl,
} from '../lib/townMapDownloads.js';

function CatalogueLoadingState() {
    return (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="animate-pulse rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                    <div className="aspect-[10/7] rounded-2xl bg-slate-100" />
                    <div className="mt-4 h-4 w-16 rounded bg-slate-100" />
                    <div className="mt-2 h-6 w-3/4 rounded bg-slate-100" />
                    <div className="mt-4 h-24 rounded-2xl bg-slate-100" />
                </div>
            ))}
        </div>
    );
}

function CatalogueUnavailable({ onRetry }) {
    const { t } = useLocale();
    return (
        <div role="alert" className="rounded-3xl border border-dashed border-amber-200 bg-amber-50 px-6 py-14 text-center">
            <MapPinned size={34} className="mx-auto text-amber-700" aria-hidden="true" />
            <h2 className="mt-4 text-xl font-bold text-amber-950">{t('townMapsUnavailableTitle')}</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-amber-900/80">
                {t('townMapsUnavailableHelp')}
            </p>
            <button type="button" onClick={onRetry} className="btn-primary mx-auto mt-5 justify-center">
                <RefreshCw size={17} aria-hidden="true" />
                {t('townMapsTryAgain')}
            </button>
        </div>
    );
}

export default function TownMapDownloadsPage() {
    const { user, logout, isImpersonating } = useAuth();
    const { t } = useLocale();
    const navigate = useNavigate();
    const catalogueUrl = useMemo(() => getTownMapDownloadCatalogueUrl(), []);
    const [catalogue, setCatalogue] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadFailed, setLoadFailed] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const [query, setQuery] = useState('');
    const [downloadingKey, setDownloadingKey] = useState('');
    const [downloadError, setDownloadError] = useState('');

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setLoadFailed(false);
        fetchTownMapDownloadCatalogue({ url: catalogueUrl, signal: controller.signal })
            .then((nextCatalogue) => {
                setCatalogue(nextCatalogue);
                setLoadFailed(false);
            })
            .catch((error) => {
                if (error?.name === 'AbortError') return;
                console.error('Town-map catalogue failed to load:', error);
                setCatalogue(null);
                setLoadFailed(true);
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });
        return () => controller.abort();
    }, [catalogueUrl, retryCount]);

    const normalizedQuery = query.trim().toLocaleLowerCase();
    const maps = useMemo(() => {
        if (!catalogue) return [];
        if (!normalizedQuery) return catalogue.maps;
        return catalogue.maps.filter((map) => [map.code, map.name, ...map.planningAreas]
            .join(' ')
            .toLocaleLowerCase()
            .includes(normalizedQuery));
    }, [catalogue, normalizedQuery]);

    const handleDownload = useCallback(async (map, file, format) => {
        const key = `${map.code}:${format}`;
        setDownloadingKey(key);
        setDownloadError('');
        try {
            await preflightTownMapDownload(file, {
                runtimeUrl: resolveTownMapAssetUrl(file.url, catalogueUrl),
            });
        } catch (error) {
            console.error('Town-map download failed:', error);
            setDownloadError(t('townMapsDownloadFailed', { format, name: map.name }));
        } finally {
            setDownloadingKey('');
        }
    }, [catalogueUrl, t]);

    async function handleLogout() {
        const impersonationExit = isImpersonating;
        await logout();
        navigate(impersonationExit ? '/dashboard' : '/');
    }

    return (
        <div className="flex min-h-[calc(100vh-4rem)] bg-slate-50">
            <aside className={DASHBOARD_DESKTOP_SIDEBAR_CLASS_NAME}>
                <DashboardSidebar
                    isImpersonating={isImpersonating}
                    onLogout={handleLogout}
                    user={user}
                />
            </aside>

            <main className="min-w-0 flex-1 overflow-auto">
                <DashboardMobileNavigation
                    isImpersonating={isImpersonating}
                    onLogout={handleLogout}
                    sectionContextLabel={t('myDirectory')}
                    sectionLabel={t('townMapsTitle')}
                    user={user}
                />

                <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                    <header className="rounded-3xl border border-slate-200 bg-white px-5 py-6 shadow-sm sm:px-7 sm:py-7">
                        <Link to="/my-directory" className="inline-flex items-center gap-2 text-sm font-bold text-brand-700 hover:text-brand-800">
                            <ArrowLeft size={17} aria-hidden="true" />
                            {t('townMapsBackToDirectory')}
                        </Link>
                        <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                            <div className="max-w-3xl">
                                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-600">{t('townMapsEyebrow')}</p>
                                <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{t('townMapsTitle')}</h1>
                                <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
                                    {t('townMapsIntro')}
                                </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-3 rounded-2xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">
                                <Download size={20} aria-hidden="true" />
                                {t('townMapsCount', { count: 32 })}
                            </div>
                        </div>
                        <p className="mt-5 text-xs leading-5 text-slate-500">
                            OneMap (c) contributors | Singapore Land Authority
                        </p>
                    </header>

                    <div className="mt-5 flex gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4 text-sm leading-6 text-sky-950 md:hidden">
                        <Wifi size={21} className="mt-0.5 shrink-0" aria-hidden="true" />
                        <p><strong>{t('townMapsMobileDownloadTitle')}</strong> {t('townMapsMobileDownloadHelp')}</p>
                    </div>

                    <section className="mt-6" aria-labelledby="town-map-catalogue-heading">
                        <h2 id="town-map-catalogue-heading" className="sr-only">{t('townMapsCatalogueHeading')}</h2>
                        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                            <label htmlFor="town-map-search" className="block text-sm font-bold text-slate-800">
                                {t('townMapsSearchLabel')}
                            </label>
                            <div className="relative mt-2">
                                <Search size={19} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                                <input
                                    id="town-map-search"
                                    type="search"
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder={t('townMapsSearchPlaceholder')}
                                    className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-12 text-base text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                                />
                                {query ? (
                                    <button
                                        type="button"
                                        onClick={() => setQuery('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                                        aria-label={t('clearSearch')}
                                    >
                                        <X size={17} aria-hidden="true" />
                                    </button>
                                ) : null}
                            </div>
                            {!loading && catalogue ? (
                                <p className="mt-3 text-sm font-medium text-slate-500" aria-live="polite">
                                    {t('townMapsShowingCount', { shown: maps.length, total: catalogue.mapCount })}
                                </p>
                            ) : null}
                        </div>

                        {downloadError ? (
                            <div role="alert" className="mt-5 flex items-start justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
                                <p>{downloadError} {t('townMapsDownloadFailedHelp')}</p>
                                <button type="button" onClick={() => setDownloadError('')} className="shrink-0 rounded-full p-1 hover:bg-red-100" aria-label={t('close')}>
                                    <X size={17} aria-hidden="true" />
                                </button>
                            </div>
                        ) : null}

                        <div className="mt-6">
                            {loading ? (
                                <CatalogueLoadingState />
                            ) : loadFailed ? (
                                <CatalogueUnavailable onRetry={() => setRetryCount((value) => value + 1)} />
                            ) : maps.length === 0 ? (
                                <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
                                    <h2 className="text-xl font-bold text-slate-800">{t('townMapsNoResultsTitle')}</h2>
                                    <p className="mt-2 text-sm text-slate-500">{t('townMapsNoResultsHelp')}</p>
                                    <button type="button" onClick={() => setQuery('')} className="btn-ghost mx-auto mt-5 justify-center">
                                        {t('clearSearch')}
                                    </button>
                                </div>
                            ) : (
                                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                                    {maps.map((map) => (
                                        <TownMapDownloadCard
                                            key={map.code}
                                            catalogueUrl={catalogueUrl}
                                            downloadingKey={downloadingKey}
                                            map={map}
                                            onDownload={(file, format) => handleDownload(map, file, format)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}
