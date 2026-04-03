import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CopyPlus, LogIn, Printer } from 'lucide-react';

import DirectoryDistanceControls from '../components/DirectoryDistanceControls.jsx';
import DirectoryMap from '../components/DirectoryMap.jsx';
import DirectoryPrintView from '../components/DirectoryPrintView.jsx';
import DirectorySearchBar from '../components/DirectorySearchBar.jsx';
import SharedMapDirectoryList from '../components/SharedMapDirectoryList.jsx';
import BrandLockup from '../components/layout/BrandLockup.jsx';
import MobileDirectoryWorkspace from '../components/mobile/MobileDirectoryWorkspace.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import { api } from '../lib/api.js';
import { buildDirectoryPresentation, buildDirectoryShareUrl } from '../lib/directoryPresentation.js';
import { useDirectoryDistanceAnchor } from '../hooks/useDirectoryDistanceAnchor.js';

function UnavailableState({ message }) {
    return (
        <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-12 sm:px-6 lg:px-8">
            <div className="w-full rounded-[32px] border border-slate-200 bg-white p-8 text-center shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">Shared directory</p>
                <h1 className="mt-3 text-3xl font-bold text-slate-900">This shared directory is no longer available</h1>
                <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-500">
                    {message || 'The owner may have unpublished or removed this directory.'}
                </p>
                <div className="mt-6 flex justify-center">
                    <Link to="/discover" className="btn-primary justify-center">
                        Explore CareAround SG
                        <ArrowRight size={16} />
                    </Link>
                </div>
            </div>
        </div>
    );
}

function DirectoryHeader({ directory, isAuth, isOwner, copying, copyError, onCopyToMyMaps, onOpenPrintView }) {
    return (
        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                    <span className="inline-flex rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">
                        Shared directory
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
                    <button
                        type="button"
                        onClick={onOpenPrintView}
                        className="btn-ghost justify-center border border-slate-200 text-slate-700"
                    >
                        <Printer size={16} />
                        Print view
                    </button>
                    {!isOwner && isAuth ? (
                        <button
                            type="button"
                            onClick={onCopyToMyMaps}
                            disabled={copying}
                            className="btn-primary justify-center self-start disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <CopyPlus size={16} />
                            {copying ? 'Saving copy…' : 'Save copy to My Maps'}
                        </button>
                    ) : null}
                </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Curated resources</p>
                    <p className="mt-1 text-2xl font-extrabold text-slate-900">{directory.summary.resourceCount}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Places</p>
                    <p className="mt-1 text-2xl font-extrabold text-slate-900">{directory.summary.placeCount}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Mode</p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">Read-only directory</p>
                </div>
            </div>

            {!isAuth ? (
                <div className="mt-6 flex flex-col gap-3 rounded-[24px] border border-brand-100 bg-brand-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-sm font-semibold text-brand-800">Sign in to save resources or create your own copy.</p>
                        <p className="mt-1 text-sm text-brand-700">You can fully browse this shared directory without an account.</p>
                    </div>
                    <Link to="/login" className="btn-primary justify-center">
                        <LogIn size={16} />
                        Sign in
                    </Link>
                </div>
            ) : null}

            {isOwner ? (
                <p className="mt-5 text-sm font-medium text-slate-500">
                    You are viewing the public read-only version of your shared directory.
                </p>
            ) : null}

            {copyError ? (
                <p className="mt-4 text-sm font-medium text-red-600">{copyError}</p>
            ) : null}
        </div>
    );
}

export default function SharedMapPage() {
    const { token } = useParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { isAuth, user } = useAuth();
    const [directory, setDirectory] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [copying, setCopying] = useState(false);
    const [copyError, setCopyError] = useState('');
    const [focusedPlaceKey, setFocusedPlaceKey] = useState(null);
    const [highlightPlaceKey, setHighlightPlaceKey] = useState(null);
    const isPrintView = searchParams.get('view') === 'print';
    const useDesktopLayout = useMediaQuery('(min-width: 1024px)');
    const anchorState = useDirectoryDistanceAnchor({
        storageKey: token ? `shared-map:${token}` : 'shared-map',
        userPostalCode: user?.postalCode || '',
    });

    const loadDirectory = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        setError('');
        try {
            const nextDirectory = await api.getSharedMap(token);
            setDirectory(nextDirectory);
        } catch (err) {
            console.error(err);
            setError(err.message || 'This shared directory is no longer available');
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        loadDirectory();
    }, [loadDirectory]);

    const isOwner = useMemo(() => (
        Boolean(directory?.viewer?.isOwner || (user?.id && directory?.viewer?.isAuthenticated && directory?.viewer?.isOwner))
    ), [directory?.viewer, user?.id]);
    const activeAnchor = anchorState.activeAnchor;
    const interactivePresentation = useMemo(() => (
        buildDirectoryPresentation(directory, { query, activeAnchor })
    ), [activeAnchor, directory, query]);
    const sharedDirectoryUrl = useMemo(() => (
        buildDirectoryShareUrl(directory?.share?.sharePath || (token ? `/shared/maps/${token}` : ''))
    ), [directory?.share?.sharePath, token]);

    function handleViewSection(placeKey) {
        setQuery('');
        setHighlightPlaceKey(null);
        window.requestAnimationFrame(() => {
            setHighlightPlaceKey(placeKey);
        });
    }

    function handleViewOnMap(placeKey) {
        setFocusedPlaceKey(null);
        window.requestAnimationFrame(() => {
            setFocusedPlaceKey(placeKey);
        });
    }

    async function handleCopyToMyMaps() {
        if (!token || !isAuth || isOwner) return;
        setCopying(true);
        setCopyError('');
        try {
            const copied = await api.copySharedMap(token);
            navigate(`/my-directory/maps/${copied.id}`);
        } catch (err) {
            console.error(err);
            setCopyError(err.message || 'Failed to save a private copy of this directory.');
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

    const mobileDirectoryMap = (
        <DirectoryMap
            activeAnchor={activeAnchor}
            pins={interactivePresentation.pins}
            focusedPlaceKey={focusedPlaceKey}
            onViewSection={handleViewSection}
            markerMode="number"
            placeNumberByKey={interactivePresentation.placeNumberByKey}
            emptyLabel={query ? 'No mappable places match this directory search.' : 'This directory does not have any mappable places yet.'}
            mapHeightClassName="h-[38svh] min-h-[280px] max-h-[420px]"
        />
    );

    const mobileListContent = ({ closeSheet }) => (
        <SharedMapDirectoryList
            presentation={interactivePresentation}
            mode="shared"
            layout="mobile"
            onViewOnMap={(placeKey) => {
                handleViewOnMap(placeKey);
                closeSheet();
            }}
            highlightPlaceKey={highlightPlaceKey}
            canSaveResources={Boolean(directory?.viewer?.canSaveResources)}
            autoScrollToHighlight={false}
        />
    );

    const mobileSearchContent = (
        <div className="space-y-3 pb-2">
            <DirectorySearchBar
                value={query}
                onChange={setQuery}
                inputId="shared-directory-search-mobile-sheet"
                compact
            />
            <p className="text-[12px] leading-5 text-slate-500">
                Search filters the shared directory list and its linked map pins together.
            </p>
        </div>
    );

    const mobileDistanceContent = (
        <DirectoryDistanceControls
            anchorState={anchorState}
            compact
            compactLayout="stacked"
            className="min-w-0 pb-2"
        />
    );

    const mobileMoreContent = ({ closeSheet }) => (
        <div className="space-y-2 pb-2">
            <button
                type="button"
                onClick={() => {
                    closeSheet();
                    openPrintView();
                }}
                className="btn-ghost h-12 w-full justify-center border border-slate-200 px-4 text-sm text-slate-700"
            >
                <Printer size={16} />
                Print view
            </button>
            {!isOwner && isAuth ? (
                <button
                    type="button"
                    onClick={() => {
                        closeSheet();
                        handleCopyToMyMaps();
                    }}
                    disabled={copying}
                    className="btn-primary h-12 w-full justify-center px-4 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <CopyPlus size={16} />
                    {copying ? 'Saving copy…' : 'Save copy to My Maps'}
                </button>
            ) : null}
            {!isAuth ? (
                <Link
                    to="/login"
                    onClick={closeSheet}
                    className="btn-primary h-12 w-full justify-center px-4 text-sm"
                >
                    <LogIn size={16} />
                    Sign in
                </Link>
            ) : null}
        </div>
    );

    if (loading) {
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

    if (error || !directory) {
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
                            Back to interactive view
                        </button>
                    </div>
                </div>

                <div className="px-4 py-6 sm:px-6 lg:px-8">
                    <DirectoryPrintView
                        directory={directory}
                        mode="shared"
                        generatedAt={new Date()}
                        activeAnchor={activeAnchor}
                        shareUrl={sharedDirectoryUrl}
                        footerNote="Open the shared link for the full interactive directory."
                        className="mx-auto"
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {useDesktopLayout ? (
                <div className="border-b border-slate-200 bg-white/90 backdrop-blur">
                    <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
                        <BrandLockup />
                        {!isAuth ? (
                            <Link to="/login" className="btn-ghost justify-center border border-slate-200 text-slate-700">
                                Sign in
                            </Link>
                        ) : null}
                    </div>
                </div>
            ) : null}

            <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
                {useDesktopLayout ? (
                    <>
                        <DirectoryHeader
                            directory={directory}
                            isAuth={isAuth}
                            isOwner={isOwner}
                            copying={copying}
                            copyError={copyError}
                            onCopyToMyMaps={handleCopyToMyMaps}
                            onOpenPrintView={openPrintView}
                        />

                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
                            <DirectorySearchBar
                                value={query}
                                onChange={setQuery}
                            />
                            <DirectoryDistanceControls anchorState={anchorState} />
                        </div>

                        <SharedMapDirectoryList
                            presentation={interactivePresentation}
                            mode="shared"
                            layout="responsive"
                            onViewOnMap={handleViewOnMap}
                            highlightPlaceKey={highlightPlaceKey}
                            canSaveResources={Boolean(directory.viewer?.canSaveResources)}
                            renderDesktopMap={() => (
                                <DirectoryMap
                                    activeAnchor={activeAnchor}
                                    pins={interactivePresentation.pins}
                                    focusedPlaceKey={focusedPlaceKey}
                                    onViewSection={handleViewSection}
                                    markerMode="number"
                                    placeNumberByKey={interactivePresentation.placeNumberByKey}
                                    emptyLabel={query ? 'No mappable places match this directory search.' : 'This directory does not have any mappable places yet.'}
                                    mapHeightClassName="h-[540px]"
                                />
                            )}
                            renderMobileMap={() => (
                                <DirectoryMap
                                    activeAnchor={activeAnchor}
                                    pins={interactivePresentation.pins}
                                    focusedPlaceKey={focusedPlaceKey}
                                    onViewSection={handleViewSection}
                                    markerMode="number"
                                    placeNumberByKey={interactivePresentation.placeNumberByKey}
                                    emptyLabel={query ? 'No mappable places match this directory search.' : 'This directory does not have any mappable places yet.'}
                                    mapHeightClassName="h-[32svh] min-h-[240px] max-h-[360px]"
                                />
                            )}
                        />
                    </>
                ) : (
                    <MobileDirectoryWorkspace
                        eyebrow="Shared directory"
                        title={directory.name}
                        summary={directory.description || `${directory.summary.resourceCount} curated ${directory.summary.resourceCount === 1 ? 'resource' : 'resources'} in read-only mode.`}
                        map={mobileDirectoryMap}
                        listContent={mobileListContent}
                        searchContent={mobileSearchContent}
                        distanceContent={mobileDistanceContent}
                        moreContent={mobileMoreContent}
                    />
                )}
            </div>
        </div>
    );
}
