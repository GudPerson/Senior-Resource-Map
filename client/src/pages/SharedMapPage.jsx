import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Drawer } from 'vaul';
import { ArrowLeft, ArrowRight, CopyPlus, Languages, LogIn, Menu, Printer, Search, Sparkles, X } from 'lucide-react';

import DirectoryDistanceControls from '../components/DirectoryDistanceControls.jsx';
import DirectoryMap from '../components/DirectoryMap.jsx';
import DirectoryPrintView from '../components/DirectoryPrintView.jsx';
import DirectorySearchBar from '../components/DirectorySearchBar.jsx';
import SharedMapDirectoryList from '../components/SharedMapDirectoryList.jsx';
import BrandLockup from '../components/layout/BrandLockup.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import { api } from '../lib/api.js';
import { buildDirectoryPresentation, buildDirectoryShareUrl } from '../lib/directoryPresentation.js';
import { DEFAULT_LOCALE } from '../lib/i18n.js';
import { applySharedNoteTranslationsToDirectory } from '../lib/mapNotes.js';
import { useDirectoryDistanceAnchor } from '../hooks/useDirectoryDistanceAnchor.js';
import { buildCurrentAppPath, buildLoginPathWithMapReturn, buildOwnerMyMapPathFromSharedDirectory } from '../lib/appNavigation.js';

const SHARED_MAP_V2_DESKTOP_MAP_HEIGHT_CLASS = 'h-[48vh] min-h-[440px] max-h-[700px]';
const SHARED_MAP_V2_MOBILE_MAP_HEIGHT_CLASS = 'h-[34svh] min-h-[260px] max-h-[390px]';
const SHARED_MAP_V2_DESKTOP_GRID_CLASS = 'lg:gap-4 lg:grid-cols-[minmax(230px,0.78fr)_minmax(430px,1.32fr)_minmax(240px,0.84fr)] xl:gap-5 xl:grid-cols-[minmax(320px,0.85fr)_minmax(620px,1.45fr)_minmax(360px,0.95fr)] 2xl:grid-cols-[minmax(360px,0.9fr)_minmax(760px,1.55fr)_minmax(400px,1fr)]';
const SHARED_MAP_V2_FIT_PADDING_BOTTOM_RIGHT = [44, 24];

function normalizeCategoryMetaKey(value) {
    return String(value || '').trim().toLowerCase();
}

function buildSubCategoryMetaLookup(subcategories = []) {
    const lookup = new Map();

    (Array.isArray(subcategories) ? subcategories : []).forEach((subcategory) => {
        const key = normalizeCategoryMetaKey(subcategory?.name);
        if (!key) return;
        lookup.set(key, {
            color: subcategory?.color || null,
            iconUrl: subcategory?.iconUrl || null,
        });
    });

    return lookup;
}

function applySubCategoryMetaToRow(row, lookup) {
    if (!row || !lookup.size) return row;
    const categoryMeta = lookup.get(normalizeCategoryMetaKey(row.iconKey || row.subCategory));
    const mapCategoryMeta = lookup.get(normalizeCategoryMetaKey(row.mapIconKey || row.mapSubCategory || row.mapCategoryLabel));
    if (!categoryMeta && !mapCategoryMeta) return row;
    const nextCategoryColor = row.categoryColor || categoryMeta?.color || null;
    const nextCategoryIconUrl = row.categoryIconUrl || categoryMeta?.iconUrl || null;
    const nextMapCategoryColor = row.mapCategoryColor || mapCategoryMeta?.color || null;
    const nextMapCategoryIconUrl = row.mapCategoryIconUrl || mapCategoryMeta?.iconUrl || null;

    if (
        nextCategoryColor === (row.categoryColor || null)
        && nextCategoryIconUrl === (row.categoryIconUrl || null)
        && nextMapCategoryColor === (row.mapCategoryColor || null)
        && nextMapCategoryIconUrl === (row.mapCategoryIconUrl || null)
    ) {
        return row;
    }

    return {
        ...row,
        categoryColor: nextCategoryColor,
        categoryIconUrl: nextCategoryIconUrl,
        ...(row.mapSubCategory || row.mapCategoryLabel || row.mapIconKey ? {
            mapCategoryColor: nextMapCategoryColor,
            mapCategoryIconUrl: nextMapCategoryIconUrl,
        } : {}),
    };
}

function applySubCategoryMetaToDirectory(directory, subcategories = []) {
    if (!directory) return directory;
    const lookup = buildSubCategoryMetaLookup(subcategories);
    if (!lookup.size) return directory;

    return {
        ...directory,
        assets: (directory.assets || []).map((asset) => applySubCategoryMetaToRow(asset, lookup)),
        places: (directory.places || []).map((place) => ({
            ...place,
            rows: (place.rows || []).map((row) => applySubCategoryMetaToRow(row, lookup)),
        })),
    };
}

function UnavailableState({ message }) {
    const { t } = useLocale();
    return (
        <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-12 sm:px-6 lg:px-8">
            <div className="w-full rounded-[32px] border border-slate-200 bg-white p-8 text-center shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">{t('sharedMap')}</p>
                <h1 className="mt-3 text-3xl font-bold text-slate-900">{t('sharedMapUnavailableTitle')}</h1>
                <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-500">
                    {message || t('sharedMapUnavailableDefault')}
                </p>
                <div className="mt-6 flex justify-center">
                    <Link to="/discover" className="btn-primary justify-center">
                        {t('exploreCareAround')}
                        <ArrowRight size={16} />
                    </Link>
                </div>
            </div>
        </div>
    );
}

function SharedMapLanguageSelect({ compact = false, translatingNotes = false }) {
    const { locale, locales, setLocale, t } = useLocale();

    return (
        <label className={`flex ${compact ? 'flex-col items-stretch gap-1.5' : 'items-center gap-2'} text-xs font-bold text-slate-600`}>
            <span className="inline-flex items-center gap-1.5">
                <Languages size={14} className="text-brand-700" />
                {t('noteLanguage')}
            </span>
            <span className={compact ? 'space-y-1' : 'flex items-center gap-2'}>
                <select
                    value={locale}
                    onChange={(event) => setLocale(event.target.value)}
                    className={`${compact ? 'h-11 w-full' : 'h-11 min-w-[150px]'} rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100`}
                    aria-label={t('noteLanguage')}
                    title={t('noteLanguage')}
                >
                    {locales.map((item) => (
                        <option key={item.code} value={item.code}>
                            {item.label}
                        </option>
                    ))}
                </select>
                {translatingNotes ? (
                    <span className="block text-[11px] font-semibold text-brand-700">
                        {t('translatingNotes')}
                    </span>
                ) : null}
            </span>
        </label>
    );
}

function DirectoryHeader({ directory, isAuth, isOwner, copying, copyError, onCopyToMyMaps, onOpenPrintView, noteTranslationLoading, loginPath = '/login' }) {
    const { t } = useLocale();
    return (
        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                    <span className="inline-flex rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">
                        {t('sharedMap')}
                    </span>
                    <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                        {directory.name}
                    </h1>
                    {directory.description ? (
                        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
                            {directory.description}
                        </p>
                    ) : null}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
                    <SharedMapLanguageSelect translatingNotes={noteTranslationLoading} />
                    <button
                        type="button"
                        onClick={onOpenPrintView}
                        className="btn-ghost justify-center border border-slate-200 text-slate-700"
                    >
                        <Printer size={16} />
                        {t('printFriendlyView')}
                    </button>
                    {!isOwner && isAuth ? (
                        <button
                            type="button"
                            onClick={onCopyToMyMaps}
                            disabled={copying}
                            className="btn-primary justify-center self-start disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <CopyPlus size={16} />
                            {copying ? t('copying') : t('copyToMyMaps')}
                        </button>
                    ) : null}
                </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{t('curatedResources')}</p>
                    <p className="mt-1 text-2xl font-extrabold text-slate-900">{directory.summary.resourceCount}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{t('places')}</p>
                    <p className="mt-1 text-2xl font-extrabold text-slate-900">{directory.summary.placeCount}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{t('mode')}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">{t('viewOnlyMap')}</p>
                </div>
            </div>

            {!isAuth ? (
                <div className="mt-6 flex flex-col gap-3 rounded-[24px] border border-brand-100 bg-brand-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-sm font-semibold text-brand-800">{t('signInToSaveSharedTitle')}</p>
                        <p className="mt-1 text-sm text-brand-700">{t('signInToSaveSharedDescription')}</p>
                    </div>
                    <Link to={loginPath} className="btn-primary justify-center">
                        <LogIn size={16} />
                        {t('signIn')}
                    </Link>
                </div>
            ) : null}

            {isOwner ? (
                <p className="mt-5 text-sm font-medium text-slate-500">
                    {t('ownerViewingPublicShared')}
                </p>
            ) : null}

            {copyError ? (
                <p className="mt-4 text-sm font-medium text-red-600">{copyError}</p>
            ) : null}
        </div>
    );
}

function SharedMapMobileControls({
    directory,
    query,
    onQueryChange,
    anchorState,
    isAuth,
    isOwner,
    copying,
    copyError,
    onCopyToMyMaps,
    onOpenPrintView,
    noteTranslationLoading,
    loginPath = '/login',
}) {
    const [open, setOpen] = useState(false);
    const { t } = useLocale();

    const runDrawerAction = useCallback((action) => {
        setOpen(false);
        window.requestAnimationFrame(() => {
            action?.();
        });
    }, []);

    return (
        <>
            <div className="sticky top-0 z-30 -mx-4 flex h-[60px] items-center border-b border-slate-200 bg-slate-50 px-6 backdrop-blur sm:-mx-6 sm:h-[68px] xl:hidden disable-font-scaling">
                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={() => setOpen(true)}
                        className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition-transform active:scale-95"
                        aria-label={t('openSharedMapControls')}
                    >
                        <Menu size={20} />
                    </button>

                    <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-bold text-slate-900 sm:text-[17px]">{directory.name}</p>
                    </div>
                </div>
            </div>

            <Drawer.Root direction="left" open={open} onOpenChange={setOpen}>
                <Drawer.Portal>
                    <Drawer.Overlay className="fixed inset-0 z-[580] bg-slate-950/35 xl:hidden" />
                    <Drawer.Content
                        className="fixed bottom-0 left-0 top-0 z-[590] flex w-[min(92vw,380px)] flex-col border-r bg-white shadow-2xl xl:hidden"
                        style={{
                            borderColor: 'var(--color-border)',
                            background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(246,252,251,0.96) 100%)',
                        }}
                    >
                        <Drawer.Title className="sr-only">{t('sharedMapControls')}</Drawer.Title>
                        <Drawer.Description className="sr-only">
                            {t('sharedMapControlsDescription')}
                        </Drawer.Description>

                        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-4">
                            <div className="min-w-0">
                                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-600">{t('sharedMap')}</p>
                                <h2 className="mt-1 truncate text-[17px] font-bold text-slate-900">{directory.name}</h2>
                            </div>

                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                aria-label={t('closeSharedMapControls')}
                                className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4">
                            <div className="rounded-[24px] border border-brand-100 bg-brand-50/70 p-4">
                                <div className="flex items-start gap-3">
                                    <div className="mt-0.5 inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-white text-brand-700 shadow-sm">
                                        <Sparkles size={18} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-brand-900">
                                            {t('signInSavePersonalizeMap')}
                                        </p>
                                        <p className="mt-1 text-[13px] leading-5 text-brand-800/90">
                                            {t('signInSavePersonalizeMapHelp')}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-4 space-y-2">
                                    {!isOwner && isAuth ? (
                                        <button
                                            type="button"
                                            onClick={() => runDrawerAction(onCopyToMyMaps)}
                                            disabled={copying}
                                            className="btn-primary h-12 w-full justify-center px-4 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            <CopyPlus size={16} />
                                            {copying ? t('copying') : t('copyToMyMaps')}
                                        </button>
                                    ) : !isAuth ? (
                                        <Link
                                            to={loginPath}
                                            onClick={() => setOpen(false)}
                                            className="btn-primary h-12 w-full justify-center px-4 text-sm"
                                        >
                                            <LogIn size={16} />
                                            {t('signUpOrLogIn')}
                                        </Link>
                                    ) : null}
                                </div>

                                {copyError ? (
                                    <p className="mt-3 text-xs font-medium text-red-600">{copyError}</p>
                                ) : null}
                            </div>

                            <div className="mt-4 space-y-2">
                                <button
                                    type="button"
                                    onClick={() => runDrawerAction(onOpenPrintView)}
                                    className="btn-ghost h-12 w-full justify-center border border-slate-200 px-4 text-sm text-slate-700"
                                >
                                    <Printer size={16} />
                                    {t('printFriendlyView')}
                                </button>
                            </div>

                            <div className="mt-4 space-y-4 pb-4">
                                <SharedMapLanguageSelect compact translatingNotes={noteTranslationLoading} />

                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                        <Search size={15} className="text-slate-500" />
                                        {t('searchThisMap')}
                                    </div>
                                    <DirectorySearchBar
                                        value={query}
                                        onChange={onQueryChange}
                                        inputId="shared-directory-search-mobile"
                                        compact
                                        className="min-w-0"
                                    />
                                </div>

                                <DirectoryDistanceControls
                                    anchorState={anchorState}
                                    compact
                                    compactLayout="stacked"
                                    className="min-w-0"
                                />
                            </div>
                        </div>
                    </Drawer.Content>
                </Drawer.Portal>
            </Drawer.Root>
        </>
    );
}

export default function SharedMapPage() {
    const { token } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { isAuth, user } = useAuth();
    const { locale, t } = useLocale();
    const [directory, setDirectory] = useState(null);
    const [noteTranslationByLocale, setNoteTranslationByLocale] = useState({});
    const [noteTranslationLoading, setNoteTranslationLoading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [copying, setCopying] = useState(false);
    const [copyError, setCopyError] = useState('');
    const [focusedPlaceKey, setFocusedPlaceKey] = useState(null);
    const [highlightPlaceKey, setHighlightPlaceKey] = useState(null);
    const [hoveredPlaceKey, setHoveredPlaceKey] = useState(null);
    const [hoveredClusterPlaceKeys, setHoveredClusterPlaceKeys] = useState([]);
    const [selectedClusterPlaceKeys, setSelectedClusterPlaceKeys] = useState([]);
    const [selectionScrollRequest, setSelectionScrollRequest] = useState(0);
    const viewerRefreshKeyRef = useRef('');
    const isPrintView = searchParams.get('view') === 'print';
    const useDesktopLayout = useMediaQuery('(min-width: 1024px)');
    const anchorState = useDirectoryDistanceAnchor({
        storageKey: token ? `shared-map:${token}` : 'shared-map',
        userPostalCode: user?.postalCode || '',
    });

    const loadDirectory = useCallback(async ({ keepCurrent = false } = {}) => {
        if (!token) return;
        if (!keepCurrent) setLoading(true);
        setError('');
        try {
            const [nextDirectory, subcategories] = await Promise.all([
                api.getSharedMap(token),
                api.getSubCategories({ suppressAuthExpired: true }).catch(() => []),
            ]);
            setDirectory(applySubCategoryMetaToDirectory(nextDirectory, subcategories));
            setNoteTranslationByLocale({});
        } catch (err) {
            console.error(err);
            setError(err.message || '');
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        loadDirectory();
    }, [loadDirectory]);

    useEffect(() => {
        if (!token || loading || !directory) return;

        const expectedAuthenticated = Boolean(isAuth);
        const directoryAuthenticated = Boolean(directory.viewer?.isAuthenticated);
        if (expectedAuthenticated === directoryAuthenticated) return;

        const refreshKey = `${token}:${expectedAuthenticated ? (user?.id || 'auth') : 'guest'}`;
        if (viewerRefreshKeyRef.current === refreshKey) return;

        viewerRefreshKeyRef.current = refreshKey;
        loadDirectory({ keepCurrent: true });
    }, [directory, isAuth, loadDirectory, loading, token, user?.id]);

    useEffect(() => {
        if (!token || !directory || locale === DEFAULT_LOCALE) {
            setNoteTranslationLoading(false);
            return undefined;
        }

        if (noteTranslationByLocale[locale]) {
            setNoteTranslationLoading(false);
            return undefined;
        }

        let cancelled = false;
        setNoteTranslationLoading(true);
        api.getSharedMapNoteTranslations(token, locale)
            .then((payload) => {
                if (cancelled) return;
                setNoteTranslationByLocale((current) => ({
                    ...current,
                    [locale]: payload,
                }));
            })
            .catch((err) => {
                console.error('Shared note translation failed:', err);
                if (cancelled) return;
                setNoteTranslationByLocale((current) => ({
                    ...current,
                    [locale]: {
                        locale,
                        status: 'error',
                        translations: {},
                    },
                }));
            })
            .finally(() => {
                if (!cancelled) setNoteTranslationLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [directory, locale, noteTranslationByLocale, token]);

    const noteTranslationPayload = locale === DEFAULT_LOCALE ? null : noteTranslationByLocale[locale] || null;
    const translatedDirectory = useMemo(() => (
        applySharedNoteTranslationsToDirectory(directory, noteTranslationPayload)
    ), [directory, noteTranslationPayload]);

    const isOwner = useMemo(() => (
        Boolean(translatedDirectory?.viewer?.isOwner || (user?.id && translatedDirectory?.viewer?.isAuthenticated && translatedDirectory?.viewer?.isOwner))
    ), [translatedDirectory?.viewer, user?.id]);
    const activeAnchor = anchorState.activeAnchor;
    const sharedPresentation = useMemo(() => (
        buildDirectoryPresentation(translatedDirectory, { query, activeAnchor, presentationMode: 'v2-cards' })
    ), [activeAnchor, translatedDirectory, query]);
    const sharedDirectoryUrl = useMemo(() => (
        buildDirectoryShareUrl(translatedDirectory?.share?.sharePath || (token ? `/shared/maps/${token}` : ''))
    ), [translatedDirectory?.share?.sharePath, token]);
    const sharedMapReturnPath = useMemo(() => (
        buildCurrentAppPath(location)
    ), [location.hash, location.pathname, location.search]);
    const loginPath = useMemo(() => (
        buildLoginPathWithMapReturn(sharedMapReturnPath)
    ), [sharedMapReturnPath]);
    const ownerMyMapPath = useMemo(() => (
        isAuth && isOwner ? buildOwnerMyMapPathFromSharedDirectory(translatedDirectory) : ''
    ), [isAuth, isOwner, translatedDirectory]);
    const canSaveSharedResources = Boolean(isAuth && !isOwner);

    useEffect(() => {
        if (loading || !ownerMyMapPath) return;
        // Personal notes and owner controls live only on the private My Map route.
        navigate(ownerMyMapPath, { replace: true });
    }, [loading, navigate, ownerMyMapPath]);

    function handleViewSection(placeKey) {
        const resolvedPlaceKey = sharedPresentation.groupKeyByPlaceKey?.[placeKey] || placeKey;
        setQuery('');
        setHoveredPlaceKey(null);
        setHoveredClusterPlaceKeys([]);
        setSelectedClusterPlaceKeys([]);
        setHighlightPlaceKey(null);
        window.requestAnimationFrame(() => {
            setHighlightPlaceKey(resolvedPlaceKey);
        });
    }

    function handleViewOnMap(placeKey) {
        const resolvedPlaceKey = sharedPresentation.groupKeyByPlaceKey?.[placeKey] || placeKey;
        setFocusedPlaceKey(null);
        setHoveredPlaceKey(null);
        setHoveredClusterPlaceKeys([]);
        setSelectedClusterPlaceKeys([]);
        window.requestAnimationFrame(() => {
            setFocusedPlaceKey(resolvedPlaceKey);
            setHighlightPlaceKey(resolvedPlaceKey);
        });
    }

    const activePlaceKey = (hoveredClusterPlaceKeys.length || selectedClusterPlaceKeys.length)
        ? null
        : (hoveredPlaceKey || highlightPlaceKey || null);
    const activePlaceKeys = hoveredClusterPlaceKeys.length
        ? hoveredClusterPlaceKeys
        : (selectedClusterPlaceKeys.length ? selectedClusterPlaceKeys : (activePlaceKey ? [activePlaceKey] : []));
    const effectiveFocusedPlaceKey = (hoveredClusterPlaceKeys.length || selectedClusterPlaceKeys.length)
        ? null
        : focusedPlaceKey;

    const handleMapHoverStart = useCallback((placeKey) => {
        if (!placeKey) return;
        setHighlightPlaceKey(null);
        setHoveredClusterPlaceKeys([]);
        setSelectedClusterPlaceKeys([]);
        setHoveredPlaceKey(String(placeKey));
    }, []);

    const handleMapHoverEnd = useCallback((placeKey) => {
        setHoveredPlaceKey((current) => (String(current) === String(placeKey) ? null : current));
    }, []);

    const handleMapClusterHoverStart = useCallback((placeKeys) => {
        if (!placeKeys?.length) return;
        setHighlightPlaceKey(null);
        setHoveredPlaceKey(null);
        setSelectedClusterPlaceKeys([]);
        setHoveredClusterPlaceKeys(placeKeys.map((value) => String(value)));
    }, []);

    const handleMapClusterHoverEnd = useCallback((placeKeys) => {
        const normalizedKeys = new Set((placeKeys || []).map((value) => String(value)));
        setHoveredClusterPlaceKeys((current) => current.filter((value) => !normalizedKeys.has(String(value))));
    }, []);

    const handleMapClusterSelect = useCallback((placeKeys) => {
        if (!placeKeys?.length) return;
        setFocusedPlaceKey(null);
        setHighlightPlaceKey(null);
        setHoveredPlaceKey(null);
        setHoveredClusterPlaceKeys([]);
        setSelectedClusterPlaceKeys(placeKeys.map((value) => String(value)));
        setSelectionScrollRequest((value) => value + 1);
    }, []);

    async function handleCopyToMyMaps() {
        if (!token || !isAuth || isOwner) return;
        setCopying(true);
        setCopyError('');
        try {
            const copied = await api.copySharedMap(token);
            navigate(`/my-directory/maps/${copied.id}`);
        } catch (err) {
            console.error(err);
            setCopyError(err.message || t('failedCopySharedMap'));
        } finally {
            setCopying(false);
        }
    }

    function openPrintView() {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('view', 'print');
        setSearchParams(nextParams);
    }

    function closePrintView() {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('view');
        setSearchParams(nextParams);
    }

    if (loading || ownerMyMapPath) {
        return (
            <div className="min-h-screen bg-slate-50">
                {useDesktopLayout ? (
                    <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
                        <BrandLockup />
                    </div>
                ) : null}
                <div className="mx-auto w-full max-w-6xl space-y-5 px-4 pb-12 sm:px-6 lg:px-8">
                    <div className="h-56 animate-pulse rounded-[32px] border border-slate-200 bg-white shadow-sm" />
                    <div className="h-80 animate-pulse rounded-[32px] border border-slate-200 bg-white shadow-sm" />
                </div>
            </div>
        );
    }

    if (error || !translatedDirectory) {
        return (
            <div className="min-h-screen bg-slate-50">
                {useDesktopLayout ? (
                    <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
                        <BrandLockup />
                    </div>
                ) : null}
                <UnavailableState message={error} />
            </div>
        );
    }

    if (isPrintView) {
        return (
            <div className="min-h-screen bg-slate-100">
                <div className="print:hidden border-b border-slate-200 bg-white/90 backdrop-blur">
                    <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
                        <button
                            type="button"
                            onClick={closePrintView}
                            className="btn-ghost justify-center border border-slate-200 text-slate-700"
                        >
                            <ArrowLeft size={16} />
                            {t('backToInteractiveView')}
                        </button>
                    </div>
                </div>

                <div className="px-4 py-6 sm:px-6 lg:px-8">
                    <DirectoryPrintView
                        directory={translatedDirectory}
                        mode="shared"
                        generatedAt={new Date()}
                        activeAnchor={activeAnchor}
                        shareUrl={sharedDirectoryUrl}
                        footerNote={t('openSharedLinkForInteractiveMap')}
                        className="mx-auto"
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f6f8fb]">
            {useDesktopLayout ? (
                <div className="border-b border-slate-200 bg-white/90 backdrop-blur">
                    <div className="mx-auto flex w-full max-w-[1800px] items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8 xl:px-10 2xl:px-14">
                        <BrandLockup />
                        {!isAuth ? (
                            <Link to={loginPath} className="btn-ghost justify-center border border-slate-200 text-slate-700">
                                {t('signIn')}
                            </Link>
                        ) : null}
                    </div>
                </div>
            ) : null}

            {!useDesktopLayout ? (
                <SharedMapMobileControls
                    directory={translatedDirectory}
                    query={query}
                    onQueryChange={setQuery}
                    anchorState={anchorState}
                    isAuth={isAuth}
                    isOwner={isOwner}
                    copying={copying}
                    copyError={copyError}
                    onCopyToMyMaps={handleCopyToMyMaps}
                    onOpenPrintView={openPrintView}
                    noteTranslationLoading={noteTranslationLoading}
                    loginPath={loginPath}
                />
            ) : null}

            <div className="mx-auto w-full max-w-[1800px] space-y-5 px-4 pb-8 pt-0 sm:px-6 sm:pb-10 sm:pt-0 lg:px-8 lg:py-8 xl:px-10 2xl:px-14">
                {useDesktopLayout ? (
                    <>
                        <DirectoryHeader
                            directory={translatedDirectory}
                            isAuth={isAuth}
                            isOwner={isOwner}
                            copying={copying}
                            copyError={copyError}
                            onCopyToMyMaps={handleCopyToMyMaps}
                            onOpenPrintView={openPrintView}
                            noteTranslationLoading={noteTranslationLoading}
                            loginPath={loginPath}
                        />

                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
                            <DirectorySearchBar
                                value={query}
                                onChange={setQuery}
                            />
                            <DirectoryDistanceControls anchorState={anchorState} />
                        </div>

                        <SharedMapDirectoryList
                            presentation={sharedPresentation}
                            mode="shared"
                            layout="desktop"
                            onViewOnMap={handleViewOnMap}
                            highlightPlaceKey={activePlaceKey}
                            highlightPlaceKeys={activePlaceKeys}
                            selectionPlaceKey={highlightPlaceKey || selectedClusterPlaceKeys[0] || null}
                            selectionScrollRequest={selectionScrollRequest}
                            canSaveResources={canSaveSharedResources}
                            showDesktopHoverLogo
                            showMapLegend={false}
                            cardBadgeMode="logo"
                            desktopGridClassName={SHARED_MAP_V2_DESKTOP_GRID_CLASS}
                            renderDesktopMap={() => (
                                <DirectoryMap
                                    activeAnchor={activeAnchor}
                                    pins={sharedPresentation.pins}
                                    focusedPlaceKey={effectiveFocusedPlaceKey}
                                    activePlaceKey={activePlaceKey}
                                    activePlaceKeys={activePlaceKeys}
                                    onViewSection={handleViewSection}
                                    onHoverPlaceStart={handleMapHoverStart}
                                    onHoverPlaceEnd={handleMapHoverEnd}
                                    onHoverClusterStart={handleMapClusterHoverStart}
                                    onHoverClusterEnd={handleMapClusterHoverEnd}
                                    onClusterSelect={handleMapClusterSelect}
                                    markerMode="category-bubble"
                                    pinBadgeMode="none"
                                    pinCategoryIconMode="none"
                                    clusterMarkerMode="none"
                                    placeNumberByKey={sharedPresentation.placeNumberByKey}
                                    emptyLabel={query ? t('noMappableSharedPlacesMatchSearch') : t('sharedMapNoMappablePlacesYet')}
                                    mapHeightClassName={SHARED_MAP_V2_DESKTOP_MAP_HEIGHT_CLASS}
                                    layoutSignature="shared-v2-map"
                                    fitPaddingBottomRight={SHARED_MAP_V2_FIT_PADDING_BOTTOM_RIGHT}
                                />
                            )}
                            renderMobileMap={() => (
                                <DirectoryMap
                                    activeAnchor={activeAnchor}
                                    pins={sharedPresentation.pins}
                                    focusedPlaceKey={effectiveFocusedPlaceKey}
                                    activePlaceKey={activePlaceKey}
                                    activePlaceKeys={activePlaceKeys}
                                    onViewSection={handleViewSection}
                                    onHoverPlaceStart={handleMapHoverStart}
                                    onHoverPlaceEnd={handleMapHoverEnd}
                                    onHoverClusterStart={handleMapClusterHoverStart}
                                    onHoverClusterEnd={handleMapClusterHoverEnd}
                                    onClusterSelect={handleMapClusterSelect}
                                    markerMode="category-bubble"
                                    pinBadgeMode="none"
                                    pinCategoryIconMode="none"
                                    clusterMarkerMode="none"
                                    placeNumberByKey={sharedPresentation.placeNumberByKey}
                                    emptyLabel={query ? t('noMappableSharedPlacesMatchSearch') : t('sharedMapNoMappablePlacesYet')}
                                    mapHeightClassName={SHARED_MAP_V2_MOBILE_MAP_HEIGHT_CLASS}
                                    layoutSignature="shared-v2-map"
                                    fitPaddingBottomRight={SHARED_MAP_V2_FIT_PADDING_BOTTOM_RIGHT}
                                />
                            )}
                        />
                    </>
                ) : (
                    <SharedMapDirectoryList
                        presentation={sharedPresentation}
                        mode="shared"
                        layout="responsive"
                        onViewOnMap={handleViewOnMap}
                        highlightPlaceKey={activePlaceKey}
                        highlightPlaceKeys={activePlaceKeys}
                        selectionPlaceKey={highlightPlaceKey || selectedClusterPlaceKeys[0] || null}
                        selectionScrollRequest={selectionScrollRequest}
                        canSaveResources={canSaveSharedResources}
                        showDesktopHoverLogo
                        showMapLegend={false}
                        cardBadgeMode="logo"
                        desktopGridClassName={SHARED_MAP_V2_DESKTOP_GRID_CLASS}
                        renderDesktopMap={() => (
                            <DirectoryMap
                                activeAnchor={activeAnchor}
                                pins={sharedPresentation.pins}
                                focusedPlaceKey={effectiveFocusedPlaceKey}
                                activePlaceKey={activePlaceKey}
                                activePlaceKeys={activePlaceKeys}
                                onViewSection={handleViewSection}
                                onHoverPlaceStart={handleMapHoverStart}
                                onHoverPlaceEnd={handleMapHoverEnd}
                                onHoverClusterStart={handleMapClusterHoverStart}
                                onHoverClusterEnd={handleMapClusterHoverEnd}
                                onClusterSelect={handleMapClusterSelect}
                                markerMode="category-bubble"
                                pinBadgeMode="none"
                                pinCategoryIconMode="none"
                                clusterMarkerMode="none"
                                placeNumberByKey={sharedPresentation.placeNumberByKey}
                                emptyLabel={query ? t('noMappableSharedPlacesMatchSearch') : t('sharedMapNoMappablePlacesYet')}
                                mapHeightClassName={SHARED_MAP_V2_DESKTOP_MAP_HEIGHT_CLASS}
                                layoutSignature="shared-v2-map"
                                fitPaddingBottomRight={SHARED_MAP_V2_FIT_PADDING_BOTTOM_RIGHT}
                            />
                        )}
                        renderMobileMap={() => (
                            <DirectoryMap
                                activeAnchor={activeAnchor}
                                pins={sharedPresentation.pins}
                                focusedPlaceKey={effectiveFocusedPlaceKey}
                                activePlaceKey={activePlaceKey}
                                activePlaceKeys={activePlaceKeys}
                                onViewSection={handleViewSection}
                                onHoverPlaceStart={handleMapHoverStart}
                                onHoverPlaceEnd={handleMapHoverEnd}
                                onHoverClusterStart={handleMapClusterHoverStart}
                                onHoverClusterEnd={handleMapClusterHoverEnd}
                                onClusterSelect={handleMapClusterSelect}
                                markerMode="category-bubble"
                                pinBadgeMode="none"
                                pinCategoryIconMode="none"
                                clusterMarkerMode="none"
                                placeNumberByKey={sharedPresentation.placeNumberByKey}
                                emptyLabel={query ? t('noMappableSharedPlacesMatchSearch') : t('sharedMapNoMappablePlacesYet')}
                                mapHeightClassName={SHARED_MAP_V2_MOBILE_MAP_HEIGHT_CLASS}
                                layoutSignature="shared-v2-map"
                                fitPaddingBottomRight={SHARED_MAP_V2_FIT_PADDING_BOTTOM_RIGHT}
                            />
                        )}
                        mobileMapStickyClassName="sticky top-[60px] sm:top-[68px] z-30 -mx-4 bg-[#f6f8fb] px-4 pb-5 pt-2 shadow-[0_18px_28px_-24px_rgba(15,23,42,0.45)] sm:-mx-6 sm:px-6 isolate disable-font-scaling"
                    />
                )}
            </div>
        </div>
    );
}
