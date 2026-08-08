import DirectoryMap from './DirectoryMap.jsx';
import ResizableDesktopMapSurface from './ResizableDesktopMapSurface.jsx';
import SharedMapDirectoryList from './SharedMapDirectoryList.jsx';

const V2_DESKTOP_MAP_HEIGHT_CLASS = 'h-[48vh] min-h-[440px] max-h-[700px]';
const V2_MOBILE_MAP_HEIGHT_CLASS = 'h-[34svh] min-h-[260px] max-h-[390px]';
const V2_DESKTOP_GRID_CLASS = 'lg:gap-4 lg:grid-cols-[minmax(230px,0.78fr)_minmax(430px,1.32fr)_minmax(240px,0.84fr)] xl:gap-5 xl:grid-cols-[minmax(320px,0.85fr)_minmax(620px,1.45fr)_minmax(360px,0.95fr)] 2xl:grid-cols-[minmax(360px,0.9fr)_minmax(760px,1.55fr)_minmax(400px,1fr)]';
const V2_DESKTOP_FIT_PADDING_BOTTOM_RIGHT = [44, 24];
const V2_MOBILE_FIT_PADDING_BOTTOM_RIGHT = [104, 44];

export default function MyMapV2PreviewScaffold({
    directory,
    activeAnchor,
    presentation,
    useDesktopLayout,
    focusedPlaceKey,
    focusedPlaceKeys = [],
    activePlaceKey,
    activePlaceKeys,
    selectionPlaceKey,
    selectionScrollRequest,
    desktopScrollTargetRef,
    suspendMapInteraction,
    onViewOnMap,
    onViewSection,
    onRemoveResource,
    onEditPersonalPlace,
    onEditResourceShortDescription,
    onUpdateResourceNotes,
    onHoverPlaceStart,
    onHoverPlaceEnd,
    onHoverClusterStart,
    onHoverClusterEnd,
    onClusterSelect,
    onFocusHandled,
    onResetView,
    onMapClick,
    mapOverlay = null,
    toolbar = null,
    useDesktopBodyLayout = useDesktopLayout,
    emptyLabel,
    emptyState = null,
    basemapUrl,
    mapMinZoom,
    showZoomLevelCounter = false,
    minimumZoomCenter = null,
    lockMinimumZoomCamera = false,
    basemapMode = 'live',
    fixedTownSurfaceManifest = null,
    fixedTownAssetBaseUrl = '',
    fixedTownSurfaceAvailable,
    fixedTownSurfacePending = false,
    fixedTownSurfaceMinZoom,
    fixedTownOverviewSurfaceManifest = null,
    fixedTownOverviewAssetBaseUrl = '',
    fixedTownOverviewSurfaceAvailable,
    fixedTownOverviewSurfacePending = false,
    fixedTownSurfaceGrayscale = false,
    fixedTownSurfaceLockMinZoom = true,
    fixedTownSurfaceFallbackBelowMinZoom = true,
    fixedTownSurfaceFallbackScope = 'global',
    onBasemapModeChange,
    onFixedTownSurfaceFallback,
    onFixedTownSurfaceMetricsChange,
    onFixedTownSurfaceViewportChange,
    mapModeControl = null,
    preserveMobileMapFrameInFlow = false,
    mapSurfaceStatus = null,
}) {
    const resourceCount = Number(directory?.summary?.resourceCount || 0);

    const renderMap = (mapHeightClassName) => (
        <DirectoryMap
            activeAnchor={activeAnchor}
            pins={presentation.pins}
            focusedPlaceKey={focusedPlaceKey}
            focusedPlaceKeys={focusedPlaceKeys}
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
            onMapClick={onMapClick}
            interactive={!suspendMapInteraction}
            markerMode="category-bubble"
            pinBadgeMode="none"
            pinCategoryIconMode="none"
            clusterMarkerMode="none"
            placeNumberByKey={presentation.placeNumberByKey}
            emptyLabel={emptyLabel}
            mapHeightClassName={mapHeightClassName}
            layoutSignature="v2-map"
            fitPaddingBottomRight={useDesktopLayout
                ? V2_DESKTOP_FIT_PADDING_BOTTOM_RIGHT
                : V2_MOBILE_FIT_PADDING_BOTTOM_RIGHT}
            basemapUrl={basemapUrl}
            mapMinZoom={mapMinZoom}
            showZoomLevelCounter={showZoomLevelCounter}
            minimumZoomCenter={minimumZoomCenter}
            lockMinimumZoomCamera={lockMinimumZoomCamera}
            basemapMode={basemapMode}
            fixedTownSurfaceManifest={fixedTownSurfaceManifest}
            fixedTownAssetBaseUrl={fixedTownAssetBaseUrl}
            fixedTownSurfaceAvailable={fixedTownSurfaceAvailable}
            fixedTownSurfacePending={fixedTownSurfacePending}
            fixedTownSurfaceMinZoom={fixedTownSurfaceMinZoom}
            fixedTownOverviewSurfaceManifest={fixedTownOverviewSurfaceManifest}
            fixedTownOverviewAssetBaseUrl={fixedTownOverviewAssetBaseUrl}
            fixedTownOverviewSurfaceAvailable={fixedTownOverviewSurfaceAvailable}
            fixedTownOverviewSurfacePending={fixedTownOverviewSurfacePending}
            fixedTownSurfaceGrayscale={fixedTownSurfaceGrayscale}
            fixedTownSurfaceLockMinZoom={fixedTownSurfaceLockMinZoom}
            fixedTownSurfaceFallbackBelowMinZoom={fixedTownSurfaceFallbackBelowMinZoom}
            fixedTownSurfaceFallbackScope={fixedTownSurfaceFallbackScope}
            onBasemapModeChange={onBasemapModeChange}
            onFixedTownSurfaceFallback={onFixedTownSurfaceFallback}
            onFixedTownSurfaceMetricsChange={onFixedTownSurfaceMetricsChange}
            onFixedTownSurfaceViewportChange={onFixedTownSurfaceViewportChange}
            mapModeControl={mapModeControl}
            mapOverlay={mapOverlay}
            surfaceStatus={mapSurfaceStatus}
        />
    );

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-[#f6f8fb]">
            {!useDesktopLayout ? (
                <div data-my-map-ui="v2">
                    {toolbar}
                </div>
            ) : null}

            <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6 lg:px-8 xl:px-10 2xl:px-14">
                {useDesktopLayout ? (
                    <div data-my-map-ui="v2">
                        {toolbar}
                    </div>
                ) : null}

                {useDesktopLayout ? (
                    <div
                        ref={desktopScrollTargetRef}
                        aria-hidden="true"
                        className="h-px -mt-px scroll-mt-[56px] sm:scroll-mt-[64px]"
                    />
                ) : null}

                {resourceCount === 0 ? (
                    <div className="space-y-4">
                        {onMapClick ? renderMap(useDesktopLayout ? V2_DESKTOP_MAP_HEIGHT_CLASS : V2_MOBILE_MAP_HEIGHT_CLASS) : null}
                        {emptyState}
                    </div>
                ) : (
                    <SharedMapDirectoryList
                        presentation={presentation}
                        mode="owner"
                        layout={useDesktopBodyLayout ? 'desktop' : 'responsive'}
                        onViewOnMap={onViewOnMap}
                        onHoverPlaceStart={onHoverPlaceStart}
                        onHoverPlaceEnd={onHoverPlaceEnd}
                        onRemoveResource={onRemoveResource}
                        onEditPersonalPlace={onEditPersonalPlace}
                        onEditResourceShortDescription={onEditResourceShortDescription}
                        onUpdateResourceNotes={onUpdateResourceNotes}
                        highlightPlaceKey={activePlaceKey}
                        highlightPlaceKeys={activePlaceKeys}
                        selectionPlaceKey={selectionPlaceKey}
                        selectionScrollRequest={selectionScrollRequest}
                        showDesktopHoverLogo
                        showMapLegend={false}
                        cardBadgeMode="logo"
                        mobileFocusCardVariant="complete-preview"
                        preserveMobileMapFrameInFlow={preserveMobileMapFrameInFlow}
                        desktopScrollTargetRef={desktopScrollTargetRef}
                        desktopGridClassName={V2_DESKTOP_GRID_CLASS}
                        renderDesktopMap={() => (
                            presentation.pins.length ? (
                                <ResizableDesktopMapSurface
                                    mapElement={renderMap(V2_DESKTOP_MAP_HEIGHT_CLASS)}
                                />
                            ) : renderMap(V2_DESKTOP_MAP_HEIGHT_CLASS)
                        )}
                        renderMobileMap={() => renderMap(V2_MOBILE_MAP_HEIGHT_CLASS)}
                        mobileMapStickyClassName="sticky top-[56px] sm:top-[64px] z-[1090] -mx-4 bg-[#f6f8fb] px-4 pb-5 shadow-[0_18px_28px_-24px_rgba(15,23,42,0.45)] isolate"
                    />
                )}
            </div>
        </div>
    );
}
