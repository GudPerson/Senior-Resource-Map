import DirectoryMap from './DirectoryMap.jsx';
import SharedMapDirectoryList from './SharedMapDirectoryList.jsx';

const V2_DESKTOP_MAP_HEIGHT_CLASS = 'h-[48vh] min-h-[440px] max-h-[700px]';
const V2_MOBILE_MAP_HEIGHT_CLASS = 'h-[34svh] min-h-[260px] max-h-[390px]';
const V2_DESKTOP_GRID_CLASS = 'lg:grid-cols-[minmax(300px,0.85fr)_minmax(520px,1.4fr)_minmax(340px,0.95fr)] xl:grid-cols-[minmax(320px,0.85fr)_minmax(620px,1.45fr)_minmax(360px,0.95fr)] 2xl:grid-cols-[minmax(360px,0.9fr)_minmax(760px,1.55fr)_minmax(400px,1fr)]';
const V2_FIT_PADDING_BOTTOM_RIGHT = [44, 24];

export default function MyMapV2PreviewScaffold({
    directory,
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
    toolbar = null,
    emptyLabel,
    emptyState = null,
}) {
    const resourceCount = Number(directory?.summary?.resourceCount || 0);

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
            fitPaddingBottomRight={V2_FIT_PADDING_BOTTOM_RIGHT}
        />
    );

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-[#f6f8fb]">
            {!useDesktopLayout ? (
                <div data-my-map-ui="v2">
                    {toolbar}
                </div>
            ) : null}

            <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6 xl:px-10 2xl:px-14">
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
