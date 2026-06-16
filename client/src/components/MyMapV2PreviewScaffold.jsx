import { ArrowLeft, Edit3, Link2, MapPinned, Plus, Printer, Search } from 'lucide-react';
import { Link } from 'react-router-dom';

import DirectoryDistanceControls from './DirectoryDistanceControls.jsx';
import DirectoryMap from './DirectoryMap.jsx';
import DirectorySearchBar from './DirectorySearchBar.jsx';
import SharedMapDirectoryList from './SharedMapDirectoryList.jsx';

const V2_DESKTOP_MAP_HEIGHT_CLASS = 'h-[48vh] min-h-[440px] max-h-[700px]';
const V2_MOBILE_MAP_HEIGHT_CLASS = 'h-[34svh] min-h-[260px] max-h-[390px]';
const V2_DESKTOP_GRID_CLASS = 'lg:grid-cols-[minmax(300px,0.85fr)_minmax(520px,1.4fr)_minmax(340px,0.95fr)] xl:grid-cols-[minmax(320px,0.85fr)_minmax(620px,1.45fr)_minmax(360px,0.95fr)] 2xl:grid-cols-[minmax(360px,0.9fr)_minmax(760px,1.55fr)_minmax(400px,1fr)]';

export default function MyMapV2PreviewScaffold({
    directory,
    query,
    onQueryChange,
    anchorState,
    actionError,
    activeAnchor,
    presentation,
    useDesktopLayout,
    focusedPlaceKey,
    activePlaceKey,
    activePlaceKeys,
    selectionPlaceKey,
    selectionScrollRequest,
    desktopScrollTargetRef,
    suspendMapInteraction,
    stableViewHref,
    renderPdfExportButton,
    onAddAssets,
    onEditDetails,
    onOpenPrintView,
    onOpenShare,
    onViewOnMap,
    onViewSection,
    onRemoveResource,
    onUpdateResourceNotes,
    onHoverPlaceStart,
    onHoverPlaceEnd,
    onHoverClusterStart,
    onHoverClusterEnd,
    onClusterSelect,
    onFocusHandled,
    onResetView,
    emptyLabel,
    emptyState = null,
}) {
    const resourceCount = Number(directory?.summary?.resourceCount || 0);
    const mappedCount = Array.isArray(presentation?.pins) ? presentation.pins.length : 0;
    const sharedLabel = directory?.share?.isShared ? 'Shared' : 'Private';

    const actionButtonClassName = 'inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800';

    const renderMap = (mapHeightClassName) => (
        <DirectoryMap
            activeAnchor={activeAnchor}
            pins={presentation.pins}
            focusedPlaceKey={focusedPlaceKey}
            activePlaceKey={activePlaceKey}
            activePlaceKeys={activePlaceKeys}
            onViewSection={onViewSection}
            onHoverPlaceStart={onHoverPlaceStart}
            onHoverPlaceEnd={onHoverPlaceEnd}
            onHoverClusterStart={onHoverClusterStart}
            onHoverClusterEnd={onHoverClusterEnd}
            onClusterSelect={onClusterSelect}
            onFocusHandled={onFocusHandled}
            onResetView={onResetView}
            interactive={!suspendMapInteraction}
            markerMode="count"
            pinBadgeMode="none"
            clusterMarkerMode="none"
            placeNumberByKey={presentation.placeNumberByKey}
            emptyLabel={emptyLabel}
            mapHeightClassName={mapHeightClassName}
            layoutSignature="v2-map"
        />
    );

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-[#f6f8fb]">
            <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6 xl:px-10 2xl:px-14">
                <section className="rounded-lg border border-slate-200 bg-white shadow-sm" data-my-map-ui="v2">
                    <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:p-5">
                        <div className="min-w-0">
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                                <span className="inline-flex h-8 items-center gap-2 rounded-lg border border-brand-100 bg-brand-50 px-3 text-xs font-bold uppercase text-brand-700">
                                    <MapPinned size={14} />
                                    Map view
                                </span>
                                <span className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-600">
                                    {sharedLabel}
                                </span>
                            </div>
                            <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
                                {directory.name}
                            </h1>
                            {directory.description ? (
                                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                                    {directory.description}
                                </p>
                            ) : null}
                            <div className="mt-4 grid gap-2 sm:grid-cols-3">
                                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                    <p className="text-xs font-semibold uppercase text-slate-500">Resources</p>
                                    <p className="mt-1 text-xl font-bold text-slate-950">{resourceCount}</p>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                    <p className="text-xs font-semibold uppercase text-slate-500">Mapped</p>
                                    <p className="mt-1 text-xl font-bold text-slate-950">{mappedCount}</p>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                    <p className="text-xs font-semibold uppercase text-slate-500">View</p>
                                    <p className="mt-1 text-xl font-bold text-slate-950">Default</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 lg:max-w-[520px] lg:justify-end">
                            <Link to="/my-directory?section=my-maps" className={actionButtonClassName}>
                                <ArrowLeft size={16} />
                                My Maps
                            </Link>
                            <Link to={stableViewHref} className={actionButtonClassName}>
                                Classic view
                            </Link>
                            <button type="button" onClick={onAddAssets} className="btn-primary h-10 rounded-lg px-3 text-sm">
                                <Plus size={16} />
                                Manage
                            </button>
                            <button type="button" onClick={onEditDetails} className={actionButtonClassName}>
                                <Edit3 size={16} />
                                Edit
                            </button>
                            <button type="button" onClick={onOpenPrintView} className={actionButtonClassName}>
                                <Printer size={16} />
                                Print
                            </button>
                            {renderPdfExportButton?.('h-10 rounded-lg px-3 text-sm')}
                            <button type="button" onClick={onOpenShare} className={actionButtonClassName}>
                                <Link2 size={16} />
                                Share
                            </button>
                        </div>
                    </div>

                    <div className="grid gap-3 border-t border-slate-200 p-4 lg:grid-cols-[minmax(300px,1fr)_minmax(420px,1.2fr)] lg:p-5">
                        <div className="min-w-0">
                            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
                                <Search size={14} />
                                Search this map
                            </div>
                            <DirectorySearchBar
                                value={query}
                                onChange={onQueryChange}
                                inputId="directory-search-v2"
                                compact
                                className="min-w-0"
                            />
                        </div>
                        <DirectoryDistanceControls anchorState={anchorState} compact className="min-w-0" />
                    </div>

                    {actionError ? (
                        <p className="border-t border-slate-200 px-4 py-3 text-sm font-medium text-red-600 lg:px-5">
                            {actionError}
                        </p>
                    ) : null}
                </section>

                {useDesktopLayout ? (
                    <div
                        ref={desktopScrollTargetRef}
                        aria-hidden="true"
                        className="h-px -mt-px scroll-mt-[56px] sm:scroll-mt-[64px]"
                    />
                ) : null}

                {resourceCount === 0 ? emptyState : (
                    <SharedMapDirectoryList
                        presentation={presentation}
                        mode="owner"
                        layout={useDesktopLayout ? 'desktop' : 'responsive'}
                        onViewOnMap={onViewOnMap}
                        onRemoveResource={onRemoveResource}
                        onUpdateResourceNotes={onUpdateResourceNotes}
                        highlightPlaceKey={activePlaceKey}
                        highlightPlaceKeys={activePlaceKeys}
                        selectionPlaceKey={selectionPlaceKey}
                        selectionScrollRequest={selectionScrollRequest}
                        showDesktopHoverLogo
                        showMapLegend={false}
                        cardBadgeMode="logo"
                        desktopScrollTargetRef={desktopScrollTargetRef}
                        desktopGridClassName={V2_DESKTOP_GRID_CLASS}
                        renderDesktopMap={() => renderMap(V2_DESKTOP_MAP_HEIGHT_CLASS)}
                        renderMobileMap={() => renderMap(V2_MOBILE_MAP_HEIGHT_CLASS)}
                        mobileMapStickyClassName="sticky top-[56px] sm:top-[64px] z-30 -mx-4 bg-[#f6f8fb] px-4 pb-5 shadow-[0_18px_28px_-24px_rgba(15,23,42,0.45)] isolate disable-font-scaling"
                    />
                )}
            </div>
        </div>
    );
}
