import { useCallback, useEffect, useRef, useState } from 'react';
import { GripHorizontal } from 'lucide-react';
import DirectoryMap from './DirectoryMap.jsx';
import DirectoryQrCode from './DirectoryQrCode.jsx';
import SharedMapDirectoryList from './SharedMapDirectoryList.jsx';
import BrandLockup from './layout/BrandLockup.jsx';
import { buildDirectoryPresentation, buildDirectoryShareUrl } from '../lib/directoryPresentation.js';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { getIntlLocale } from '../lib/i18n.js';
import {
    PRINT_MAP_CANVAS_WIDTH_PX,
    PRINT_MAP_HEIGHT_STEP_PX,
    PRINT_MAP_LABEL_DETAIL_FULL,
    PRINT_MAP_LABEL_DETAIL_LOGOS,
    PRINT_MAP_LAYOUT_FOCUS,
    PRINT_MAP_PAGE_LAYOUT_FULL,
    PRINT_MAP_RESOURCE_LAYER_SHOW,
    buildPrintMapCaptureKey,
    clampPrintMapHeight,
    getOwnerPrintLayoutConfig,
    getPrintMapPreviewScale,
    getPrintMapHeightBounds,
    normalizePrintMapLabelDetail,
    normalizePrintMapResourceLayer,
} from '../lib/printMapState.js';

const PRINT_BADGE_COORDINATE_GROUPING_TOLERANCE = 0.0003;
const PRINT_FULL_MAP_FIXED_SURFACE_MAX_DECODED_BYTES = 384 * 1024 * 1024;

function PrintMapResizeHandle({ height, onChange, previewScale = 1, printMapState = null }) {
    const dragRef = useRef(null);
    const { defaultHeight, minHeight, maxHeight } = getPrintMapHeightBounds(printMapState);

    const applyHeight = (value) => onChange?.(clampPrintMapHeight(value, printMapState));
    const finishDrag = (event) => {
        const drag = dragRef.current;
        if (!drag || (event?.pointerId !== undefined && event.pointerId !== drag.pointerId)) return;
        if (event?.currentTarget?.hasPointerCapture?.(drag.pointerId)) {
            event.currentTarget.releasePointerCapture(drag.pointerId);
        }
        dragRef.current = null;
    };

    return (
        <div
            role="separator"
            aria-label="Resize print map height"
            aria-orientation="horizontal"
            aria-valuemin={minHeight}
            aria-valuemax={maxHeight}
            aria-valuenow={height}
            tabIndex={0}
            title="Drag to resize the print map. Use arrow keys to adjust, or double-click to reset."
            onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                dragRef.current = { pointerId: event.pointerId, startY: event.clientY, startHeight: height };
            }}
            onPointerMove={(event) => {
                const drag = dragRef.current;
                if (!drag || event.pointerId !== drag.pointerId) return;
                event.preventDefault();
                const scale = Math.max(0.2, Number(previewScale) || 1);
                applyHeight(drag.startHeight + ((event.clientY - drag.startY) / scale));
            }}
            onPointerUp={finishDrag}
            onPointerCancel={finishDrag}
            onDoubleClick={() => applyHeight(defaultHeight)}
            onKeyDown={(event) => {
                let nextHeight = null;
                if (event.key === 'ArrowDown') nextHeight = height + PRINT_MAP_HEIGHT_STEP_PX;
                if (event.key === 'ArrowUp') nextHeight = height - PRINT_MAP_HEIGHT_STEP_PX;
                if (event.key === 'Home') nextHeight = defaultHeight;
                if (event.key === 'End') nextHeight = maxHeight;
                if (nextHeight === null) return;
                event.preventDefault();
                applyHeight(nextHeight);
            }}
            className="absolute bottom-0 left-1/2 z-[1100] flex h-8 w-28 -translate-x-1/2 translate-y-1/2 cursor-ns-resize touch-none items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-500 shadow-md hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 focus:outline-none focus:ring-4 focus:ring-brand-100"
            data-print-map-resize-handle="true"
        >
            <GripHorizontal size={18} strokeWidth={2.4} aria-hidden="true" />
        </div>
    );
}

function formatGeneratedOn(value = new Date(), locale = 'en') {
    const date = value instanceof Date ? value : new Date(value);
    return new Intl.DateTimeFormat(getIntlLocale(locale), {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    }).format(date);
}

function SummaryChip({ label, value, tone = 'neutral' }) {
    const toneClassName = tone === 'brand'
        ? 'border-brand-100 bg-brand-50 text-brand-700'
        : 'border-slate-200 bg-slate-50 text-slate-700';

    return (
        <div className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 ${toneClassName}`}>
            <span className="text-[9px] font-semibold uppercase tracking-[0.13em] text-slate-400">{label}</span>
            <span className="text-[13px] font-semibold">{value}</span>
        </div>
    );
}

function normalizePrintNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
}

function getPrintBadgeNumber(group = {}, placeNumberByKey = {}) {
    return normalizePrintNumber(group.number || placeNumberByKey?.[group.placeKey]);
}

function getPrintBadgeColor(group = {}) {
    const rowColor = (group.rows || []).find((row) => row?.categoryColor)?.categoryColor;
    return group.categoryColor || rowColor || null;
}

function getPrintBadgeCoordinateKey(group = {}) {
    const lat = Number.parseFloat(group.lat);
    const lng = Number.parseFloat(group.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
    return `${lat.toFixed(4)}:${lng.toFixed(4)}`;
}

function shouldSharePrintBadgeCoordinate(left = {}, right = {}) {
    const leftPostal = String(left.postalCode || '').trim();
    const rightPostal = String(right.postalCode || '').trim();
    if (leftPostal && rightPostal && leftPostal === rightPostal) return true;

    const leftLat = Number.parseFloat(left.lat);
    const leftLng = Number.parseFloat(left.lng);
    const rightLat = Number.parseFloat(right.lat);
    const rightLng = Number.parseFloat(right.lng);
    if (![leftLat, leftLng, rightLat, rightLng].every(Number.isFinite)) return false;

    return Math.abs(leftLat - rightLat) <= PRINT_BADGE_COORDINATE_GROUPING_TOLERANCE
        && Math.abs(leftLng - rightLng) <= PRINT_BADGE_COORDINATE_GROUPING_TOLERANCE;
}

function withOwnerPrintBadgePins(presentation) {
    const displayGroups = presentation?.displayGroups?.length
        ? presentation.displayGroups
        : (presentation?.mappedGroups || []);
    const mappedBadgeGroups = displayGroups.filter((group) => (
        group?.hasCoordinates
        && group.lat !== null
        && group.lng !== null
        && getPrintBadgeNumber(group, presentation.placeNumberByKey)
    ));

    const groupsByCoordinate = new Map();
    mappedBadgeGroups.forEach((group) => {
        const coordinateKey = getPrintBadgeCoordinateKey(group);
        if (!coordinateKey) return;
        const existingCoordinateEntry = [...groupsByCoordinate.entries()].find(([, groups]) => (
            groups.some((candidate) => shouldSharePrintBadgeCoordinate(candidate, group))
        ));
        const resolvedCoordinateKey = existingCoordinateEntry?.[0] || coordinateKey;
        groupsByCoordinate.set(resolvedCoordinateKey, [
            ...(groupsByCoordinate.get(resolvedCoordinateKey) || []),
            group,
        ]);
    });

    const groupKeyByPlaceKey = {};
    const hoverPlaceKeysByKey = {};
    const coordinateGroupEntries = [...groupsByCoordinate.entries()];
    const pins = coordinateGroupEntries.map(([coordinateKey, groups]) => {
        const firstGroup = groups[0];
        const firstNumber = getPrintBadgeNumber(firstGroup, presentation.placeNumberByKey);
        const memberPlaceKeys = groups.map((group) => group.placeKey).filter(Boolean);
        const compositePlaceKey = groups.length > 1
            ? `print-group:${coordinateKey}`
            : firstGroup.placeKey;

        memberPlaceKeys.forEach((memberPlaceKey) => {
            groupKeyByPlaceKey[memberPlaceKey] = compositePlaceKey;
        });
        if (compositePlaceKey) {
            groupKeyByPlaceKey[compositePlaceKey] = compositePlaceKey;
            hoverPlaceKeysByKey[compositePlaceKey] = memberPlaceKeys;
        }

        return {
            pinKey: groups.length > 1 ? `print:${coordinateKey}` : `print:${firstGroup.placeKey}`,
            placeKey: compositePlaceKey,
            placeId: firstGroup.placeId,
            title: firstGroup.name,
            address: firstGroup.address,
            postalCode: firstGroup.postalCode || '',
            lat: firstGroup.lat,
            lng: firstGroup.lng,
            curatedCount: groups.reduce((total, group) => total + (group.curatedCount || Math.max(1, (group.rows || []).length)), 0),
            number: firstNumber,
            printNumberLabel: String(firstNumber),
            printBadgeItems: groups.map((group) => {
                const number = getPrintBadgeNumber(group, presentation.placeNumberByKey);
                return {
                    number,
                    label: String(number),
                    color: getPrintBadgeColor(group),
                    placeKey: group.placeKey,
                };
            }),
            categoryColor: getPrintBadgeColor(firstGroup),
            categoryColorSegments: [],
            previewResourceNames: groups.flatMap((group) => (group.rows || []).slice(0, 1).map((row) => row.name)).slice(0, 3),
            hiddenPreviewCount: Math.max(0, groups.length - 3),
            isPostalGroup: false,
            memberPlaceKeys,
            printOffsetX: 0,
            printOffsetY: 0,
        };
    });

    displayGroups.forEach((group) => {
        if (group?.placeKey && !groupKeyByPlaceKey[group.placeKey]) {
            groupKeyByPlaceKey[group.placeKey] = group.placeKey;
        }
    });

    return {
        ...presentation,
        pins,
        groupKeyByPlaceKey,
        hoverPlaceKeysByKey,
    };
}

function withOwnerPrintLayout(presentation, printLayoutConfig) {
    if (printLayoutConfig.layoutPreset !== PRINT_MAP_LAYOUT_FOCUS) return presentation;

    const labelRailGroups = presentation.displayGroups?.length
        ? presentation.displayGroups
        : [
            ...(presentation.leftGroups || []),
            ...(presentation.mapColumnGroups || []),
            ...(presentation.rightGroups || []),
        ];

    return {
        ...presentation,
        leftGroups: printLayoutConfig.mapSide === 'right' ? labelRailGroups : [],
        mapColumnGroups: [],
        rightGroups: printLayoutConfig.mapSide === 'left' ? labelRailGroups : [],
    };
}

function PrintDirectoryBoardHeader({
    directory,
    generatedAt,
    resourceCount,
    mappedPlaceCount,
    unmappedCount,
    canShowQr,
    resolvedShareUrl,
    showMapStatusCounters = true,
    compact = false,
}) {
    const { locale, t } = useLocale();
    const rightHeaderBlock = (
        <div className="flex w-[292px] max-w-[292px] flex-col">
            <p className="mb-2.5 w-full whitespace-nowrap text-left text-[10px] font-bold uppercase leading-3 tracking-[0.18em] text-brand-600">
                {t('scanQrInteractiveMap')}
            </p>
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <SummaryChip label={t('resources')} value={resourceCount} tone="brand" />
                        {showMapStatusCounters ? (
                            <>
                                <SummaryChip label={t('mappedPlaces')} value={mappedPlaceCount} />
                                {unmappedCount ? <SummaryChip label={t('notShownOnMap')} value={unmappedCount} /> : null}
                            </>
                        ) : null}
                    </div>
                    <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        {t('preparedOn', { date: formatGeneratedOn(generatedAt, locale) })}
                    </p>
                </div>
                {canShowQr ? (
                    <div className="shrink-0">
                        <DirectoryQrCode value={resolvedShareUrl} compact compactSize="sm" />
                    </div>
                ) : null}
            </div>
        </div>
    );

    return (
        <div className={`border-b border-slate-100 ${compact ? 'pb-3' : 'pb-5'}`}>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-8">
                <div className="min-w-0 flex-1">
                    <BrandLockup compact />
                    {(() => {
                        const name = directory?.name || t('untitledMap');
                        return (
                            <h1 className="mt-4 break-words text-[1.35rem] font-black leading-[1.08] text-slate-900" title={name}>
                                {name}
                            </h1>
                        );
                    })()}
                    {directory?.description ? (
                        <p className="mt-2 break-words text-[12px] leading-[1.45] text-slate-600">
                            {directory.description}
                        </p>
                    ) : null}
                </div>

                <div className="shrink-0 justify-self-end">
                    {rightHeaderBlock}
                </div>
            </div>
        </div>
    );
}

function PrintResourcePageHeader({ directory, generatedAt, resourceCount }) {
    const { locale, t } = useLocale();
    const name = directory?.name || t('untitledMap');

    return (
        <div
            className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-8 border-b border-slate-100 pb-5"
            data-print-resource-page-header="true"
        >
            <div className="min-w-0">
                <BrandLockup compact />
                <h2 className="mt-4 break-words text-[1.35rem] font-black leading-[1.08] text-slate-900" title={name}>
                    {name}
                </h2>
            </div>
            <div className="flex min-w-[180px] flex-col items-end">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-600">
                    {t('resources')}
                </p>
                <p className="mt-1 text-2xl font-black text-slate-900">{resourceCount}</p>
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    {t('preparedOn', { date: formatGeneratedOn(generatedAt, locale) })}
                </p>
            </div>
        </div>
    );
}

function PrintDirectoryMap({
    presentation,
    directory,
    generatedAt,
    resourceCount,
    mappedPlaceCount,
    canShowQr,
    resolvedShareUrl,
    onMapReadyForCapture,
    onMapCaptureError,
    onMapViewportSnapshot,
    onClusterChange,
    interactive = false,
    focusedPlaceKey = null,
    activePlaceKey = null,
    activePlaceKeys = [],
    onViewSection,
    onHoverPlaceStart,
    onHoverPlaceEnd,
    onHoverClusterStart,
    onHoverClusterEnd,
    onClusterSelect,
    onFocusHandled,
    onResetView,
    useV2Format = false,
    printMapState = null,
    onPrintMapStateChange = null,
    mapModeControl = null,
    fixedTownSurfaceManifest = null,
    fixedTownAssetBaseUrl = '',
    fixedTownSurfaceAvailable = false,
    fixedTownSurfacePending = false,
    fixedTownSurfaceMinZoom,
    onFixedTownSurfaceViewportChange,
    previewScale = 1,
    mapMaxWidthPx = 680,
    showResourcePins = true,
    mobileControlPortalTarget = null,
}) {
    const { t } = useLocale();
    const handleControlledMapStyleChange = useCallback((mapStyle) => {
        onPrintMapStateChange?.({ mapStyle });
    }, [onPrintMapStateChange]);
    const handleControlledMapViewChange = useCallback((view) => {
        onPrintMapStateChange?.({ view });
    }, [onPrintMapStateChange]);
    const handleControlledMapHeightChange = useCallback((height) => {
        onPrintMapStateChange?.({ height });
    }, [onPrintMapStateChange]);
    return (
        <div
            className="mx-auto w-full rounded-[30px] border border-slate-200 bg-white p-5"
            style={{ maxWidth: `${mapMaxWidthPx}px` }}
        >
            <PrintDirectoryBoardHeader
                directory={directory}
                generatedAt={generatedAt}
                resourceCount={resourceCount}
                mappedPlaceCount={mappedPlaceCount}
                unmappedCount={presentation.unmappedRows.length}
                canShowQr={canShowQr}
                resolvedShareUrl={resolvedShareUrl}
                showMapStatusCounters={!useV2Format}
                compact={useV2Format}
            />

            {presentation.activeAnchorNote ? (
                <p className="mt-4 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-[12px] font-semibold leading-5 text-brand-700">
                    {presentation.activeAnchorNote}
                </p>
            ) : null}

            <div className={printMapState && interactive ? 'relative mb-4' : ''}>
            <DirectoryMap
                activeAnchor={presentation.activeAnchor}
                pins={presentation.pins}
                showPins={showResourcePins}
                focusedPlaceKey={showResourcePins ? focusedPlaceKey : null}
                activePlaceKey={showResourcePins ? activePlaceKey : null}
                activePlaceKeys={showResourcePins ? activePlaceKeys : []}
                onViewSection={showResourcePins ? onViewSection : undefined}
                onHoverPlaceStart={showResourcePins ? onHoverPlaceStart : undefined}
                onHoverPlaceEnd={showResourcePins ? onHoverPlaceEnd : undefined}
                onHoverClusterStart={showResourcePins ? onHoverClusterStart : undefined}
                onHoverClusterEnd={showResourcePins ? onHoverClusterEnd : undefined}
                onClusterSelect={showResourcePins ? onClusterSelect : undefined}
                onFocusHandled={showResourcePins ? onFocusHandled : undefined}
                onResetView={onResetView}
                interactive={interactive}
                markerMode={useV2Format ? 'print-badge' : 'number'}
                pinBadgeMode={useV2Format ? 'none' : 'count'}
                pinCategoryIconMode={useV2Format ? 'none' : 'auto'}
                clusterMarkerMode={useV2Format ? 'none' : 'bubble'}
                spreadCoincidentPins={!useV2Format}
                placeNumberByKey={presentation.placeNumberByKey}
                showPopup={false}
                showZoomControl={Boolean(printMapState && interactive)}
                showZoomLevelCounter={Boolean(printMapState && interactive)}
                showAttribution={true}
                showProviderBadgeLogo={interactive}
                mapHeightClassName={interactive ? 'h-[360px]' : 'h-[300px]'}
                mapHeightPx={printMapState ? clampPrintMapHeight(printMapState.height, printMapState) : null}
                className={presentation.activeAnchorNote ? 'mt-3' : (useV2Format ? 'mt-3' : (interactive ? 'mt-8' : 'mt-5'))}
                layoutSignature={`${useV2Format ? 'print-v2-map' : 'print-map'}:${Number(printMapState?.resetVersion || 0)}`}
                fitPaddingBottomRight={useV2Format ? PRINT_V2_FIT_PADDING_BOTTOM_RIGHT : undefined}
                emptyLabel={t('noMappablePlacesInMap')}
                onMapReadyForCapture={onMapReadyForCapture}
                onMapCaptureError={onMapCaptureError}
                onMapViewportSnapshot={onMapViewportSnapshot}
                onClusterChange={onClusterChange}
                observeFrameResize={Boolean(printMapState)}
                mapStyleOverride={printMapState?.mapStyle || null}
                onMapStyleOverrideChange={printMapState && interactive ? handleControlledMapStyleChange : null}
                mapStyleDescription={printMapState ? 'This choice applies only to this print preview.' : undefined}
                mapViewState={printMapState?.view || null}
                onMapViewStateChange={printMapState && interactive ? handleControlledMapViewChange : null}
                captureReadyKey={printMapState ? buildPrintMapCaptureKey(printMapState) : ''}
                basemapMode={printMapState?.basemapMode || 'live'}
                fixedTownSurfaceManifest={fixedTownSurfaceManifest}
                fixedTownAssetBaseUrl={fixedTownAssetBaseUrl}
                fixedTownSurfaceAvailable={fixedTownSurfaceAvailable}
                fixedTownSurfacePending={fixedTownSurfacePending}
                fixedTownSurfaceMinZoom={fixedTownSurfaceMinZoom}
                fixedTownSurfaceLockMinZoom={false}
                fixedTownSurfaceSnapToMinZoom={Boolean(printMapState && interactive)}
                fixedTownSurfaceFallbackBelowMinZoom={false}
                fixedTownSurfaceMaxDecodedBytes={printMapState?.pageLayout === PRINT_MAP_PAGE_LAYOUT_FULL
                    ? PRINT_FULL_MAP_FIXED_SURFACE_MAX_DECODED_BYTES
                    : null}
                fixedTownSurfaceFallbackScope="local"
                onFixedTownSurfaceViewportChange={onFixedTownSurfaceViewportChange}
                mobileControlPortalTarget={mobileControlPortalTarget}
                mapModeControl={printMapState && interactive ? mapModeControl : null}
                showMapStyleControl={interactive}
            />
            {printMapState && interactive ? (
                <PrintMapResizeHandle
                    height={clampPrintMapHeight(printMapState.height, printMapState)}
                    previewScale={previewScale}
                    printMapState={printMapState}
                    onChange={handleControlledMapHeightChange}
                />
            ) : null}
            </div>

            {!useV2Format ? (
                <div className="mt-3 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-3 text-[15px] font-bold text-slate-600">
                    <div className="flex items-center gap-2">
                        <div className="h-[1.05em] w-[1.05em] rounded-full border border-white bg-[#0f766e] shadow-sm" />
                        <span>{t('legendSingle')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex h-[1.3em] w-[1.3em] items-center justify-center rounded-lg bg-[#0f766e] text-[0.78em] font-black text-white shadow-sm">1</div>
                        <span>{t('legendResourceNumber')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                            <div className="h-[1.05em] w-[1.05em] rounded-full border border-white bg-blue-500 shadow-sm" />
                            <div className="h-[1.05em] w-[1.05em] rounded-full border border-white bg-pink-500 shadow-sm" />
                            <div className="h-[1.05em] w-[1.05em] rounded-full border border-white bg-orange-500 shadow-sm" />
                        </div>
                        <span>{t('legendClusters')}</span>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

const PREVIEW_CONTAINER_WIDTH = PRINT_MAP_CANVAS_WIDTH_PX;
const PRINT_V2_FIT_PADDING_BOTTOM_RIGHT = [44, 24];

export default function DirectoryPrintView({
    directory,
    generatedAt = new Date(),
    mode = 'shared',
    variant = 'screen',
    exportWidth,
    footerNote = '',
    className = '',
    activeAnchor = null,
    shareUrl = '',
    onMapReadyForCapture,
    onMapCaptureError,
    onMapViewportSnapshot,
    printMapState = null,
    onPrintMapStateChange = null,
    mapModeControl = null,
    fixedTownSurfaceManifest = null,
    fixedTownAssetBaseUrl = '',
    fixedTownSurfaceAvailable = false,
    fixedTownSurfacePending = false,
    fixedTownSurfaceMinZoom,
    onFixedTownSurfaceViewportChange,
}) {
    const useV2OwnerPrint = mode === 'owner';
    const basePresentation = buildDirectoryPresentation(directory, {
        activeAnchor,
        presentationMode: useV2OwnerPrint ? 'v2-cards' : 'default',
    });
    const printLayoutConfig = getOwnerPrintLayoutConfig(printMapState);
    const labelDetail = normalizePrintMapLabelDetail(printMapState?.labelDetail);
    const resourceLayer = normalizePrintMapResourceLayer(printMapState?.resourceLayer);
    const showResourcePins = resourceLayer === PRINT_MAP_RESOURCE_LAYER_SHOW;
    const printResourcesBelow = Boolean(printLayoutConfig.resourcesBelow);
    const ownerPrintPresentation = useV2OwnerPrint ? withOwnerPrintBadgePins(basePresentation) : basePresentation;
    const presentation = useV2OwnerPrint
        ? withOwnerPrintLayout(ownerPrintPresentation, printLayoutConfig)
        : ownerPrintPresentation;
    const showPrintLogos = labelDetail === PRINT_MAP_LABEL_DETAIL_LOGOS
        || labelDetail === PRINT_MAP_LABEL_DETAIL_FULL;
    const resolvedShareUrl = shareUrl || buildDirectoryShareUrl(directory?.share?.sharePath);
    const canShowQr = Boolean(resolvedShareUrl) && (mode === 'shared' || mode === 'owner' || directory?.share?.isShared);
    
    // Scaling logic for screen preview
    const sheetRef = useRef(null);
    const [scale, setScale] = useState(1);
    const [previewFrameHeight, setPreviewFrameHeight] = useState(null);
    const [mobileControlPortalTarget, setMobileControlPortalTarget] = useState(null);
    const mobileControlPortalRef = useCallback((node) => {
        setMobileControlPortalTarget(node);
    }, []);
    
    useEffect(() => {
        if (variant !== 'screen') return undefined;

        const handleResize = () => {
            if (!sheetRef.current) return;
            const parent = sheetRef.current.parentElement?.parentElement || sheetRef.current.parentElement;
            if (!parent) return;
            
            // Keep a small print-preview gutter while allowing zoomed-out and wide
            // desktop viewports to use the available horizontal space.
            const nextScale = getPrintMapPreviewScale(parent.clientWidth);
            setScale(nextScale);
            const nextHeight = Math.ceil(sheetRef.current.offsetHeight * nextScale);
            setPreviewFrameHeight(nextHeight > 0 ? nextHeight : null);
        };

        // Use a small timeout to let the layout settle before calculating scale
        const timeoutId = window.setTimeout(handleResize, 50);
        const resizeObserver = typeof ResizeObserver === 'undefined'
            ? null
            : new ResizeObserver(handleResize);
        if (sheetRef.current && resizeObserver) {
            resizeObserver.observe(sheetRef.current);
        }
        window.addEventListener('resize', handleResize);
        return () => {
            window.clearTimeout(timeoutId);
            resizeObserver?.disconnect();
            window.removeEventListener('resize', handleResize);
        };
    }, [variant]);

    const resourceCount = directory?.summary?.resourceCount || 0;
    const mappedPlaceCount = presentation.mappedGroups.length;
    const printMapInteractive = variant === 'screen';
    const patchPrintMapState = useCallback((patch) => {
        if (!onPrintMapStateChange) return;
        onPrintMapStateChange((current) => ({ ...current, ...patch }));
    }, [onPrintMapStateChange]);
    const [focusedPrintPlaceKey, setFocusedPrintPlaceKey] = useState(null);
    const [hoveredPrintPlaceKey, setHoveredPrintPlaceKey] = useState(null);
    const [hoveredPrintClusterPlaceKeys, setHoveredPrintClusterPlaceKeys] = useState([]);
    const [selectedPrintPlaceKeys, setSelectedPrintPlaceKeys] = useState([]);

    const resolvePrintPlaceKey = useCallback((placeKey) => (
        presentation.groupKeyByPlaceKey?.[placeKey] || placeKey
    ), [presentation.groupKeyByPlaceKey]);
    const getPrintHoverPlaceKeys = useCallback((placeKey) => {
        const normalizedPlaceKey = placeKey ? String(placeKey) : '';
        return presentation.hoverPlaceKeysByKey?.[normalizedPlaceKey] || (normalizedPlaceKey ? [normalizedPlaceKey] : []);
    }, [presentation.hoverPlaceKeysByKey]);

    const clearPrintMapSelection = useCallback(() => {
        setFocusedPrintPlaceKey(null);
        setHoveredPrintPlaceKey(null);
        setHoveredPrintClusterPlaceKeys([]);
        setSelectedPrintPlaceKeys([]);
    }, []);

    const handlePrintPlaceSelect = useCallback((placeKey) => {
        const resolvedPlaceKey = resolvePrintPlaceKey(placeKey);
        if (!resolvedPlaceKey) return;
        const hoverPlaceKeys = getPrintHoverPlaceKeys(resolvedPlaceKey);
        setHoveredPrintPlaceKey(null);
        setHoveredPrintClusterPlaceKeys([]);
        setSelectedPrintPlaceKeys(hoverPlaceKeys.length ? hoverPlaceKeys.map((value) => String(value)) : [String(resolvedPlaceKey)]);
        setFocusedPrintPlaceKey(`${resolvedPlaceKey}:zoom`);
    }, [getPrintHoverPlaceKeys, resolvePrintPlaceKey]);

    const handlePrintPlaceHoverStart = useCallback((placeKey) => {
        const resolvedPlaceKey = resolvePrintPlaceKey(placeKey);
        if (!resolvedPlaceKey) return;
        setSelectedPrintPlaceKeys([]);
        setHoveredPrintClusterPlaceKeys([]);
        setHoveredPrintPlaceKey(String(resolvedPlaceKey));
    }, [resolvePrintPlaceKey]);

    const handlePrintPlaceHoverEnd = useCallback((placeKey) => {
        const resolvedPlaceKey = resolvePrintPlaceKey(placeKey);
        setHoveredPrintPlaceKey((current) => (
            String(current) === String(resolvedPlaceKey) ? null : current
        ));
    }, [resolvePrintPlaceKey]);

    const handlePrintClusterHoverStart = useCallback((placeKeys) => {
        if (!placeKeys?.length) return;
        setSelectedPrintPlaceKeys([]);
        setHoveredPrintPlaceKey(null);
        setHoveredPrintClusterPlaceKeys(placeKeys.map((value) => String(resolvePrintPlaceKey(value))));
    }, [resolvePrintPlaceKey]);

    const handlePrintClusterHoverEnd = useCallback((placeKeys) => {
        const normalizedKeys = new Set((placeKeys || []).map((value) => String(resolvePrintPlaceKey(value))));
        setHoveredPrintClusterPlaceKeys((current) => current.filter((value) => !normalizedKeys.has(String(value))));
    }, [resolvePrintPlaceKey]);

    const handlePrintClusterSelect = useCallback((placeKeys) => {
        if (!placeKeys?.length) return;
        setFocusedPrintPlaceKey(null);
        setHoveredPrintPlaceKey(null);
        setHoveredPrintClusterPlaceKeys([]);
        setSelectedPrintPlaceKeys(placeKeys.map((value) => String(resolvePrintPlaceKey(value))));
    }, [resolvePrintPlaceKey]);

    const handlePrintFocusHandled = useCallback((handledPlaceKey) => {
        setFocusedPrintPlaceKey((current) => (current === handledPlaceKey ? null : current));
    }, []);

    const activePrintPlaceKey = hoveredPrintClusterPlaceKeys.length || selectedPrintPlaceKeys.length
        ? null
        : hoveredPrintPlaceKey;
    const activePrintPlaceKeys = hoveredPrintClusterPlaceKeys.length
        ? hoveredPrintClusterPlaceKeys
        : (selectedPrintPlaceKeys.length
            ? selectedPrintPlaceKeys
            : (hoveredPrintPlaceKey ? getPrintHoverPlaceKeys(hoveredPrintPlaceKey) : []));

    const sheetWidth = variant === 'export' ? (exportWidth || PREVIEW_CONTAINER_WIDTH) : PREVIEW_CONTAINER_WIDTH;
    const paddingClass = printResourcesBelow ? '' : 'p-10';

    const content = (
        <div 
            ref={sheetRef}
            data-print-map-sheet={variant}
            data-print-layout-preset={printLayoutConfig.layoutPreset}
            data-print-map-side={printLayoutConfig.mapSide}
            data-print-map-width={printLayoutConfig.mapWidth}
            data-print-label-detail={labelDetail}
            data-print-resources-below={printResourcesBelow ? 'true' : 'false'}
            data-print-resource-layer={resourceLayer}
            className={`text-slate-900 ${paddingClass} flex-shrink-0`}
            style={{ 
                width: `${sheetWidth}px`,
                transform: variant === 'screen' ? `scale(${scale})` : undefined,
                transformOrigin: variant === 'screen' ? 'top left' : undefined,
                position: variant === 'screen' && previewFrameHeight ? 'absolute' : undefined,
                left: variant === 'screen' && previewFrameHeight ? 0 : undefined,
                top: variant === 'screen' && previewFrameHeight ? 0 : undefined,
                backgroundColor: printResourcesBelow ? '#f8fafc' : 'white'
            }}
        >
            <SharedMapDirectoryList
                presentation={presentation}
                mode={mode}
                layout="print"
                canSaveResources={false}
                allowPrintLinks={variant === 'screen'}
                highlightPlaceKeys={activePrintPlaceKeys}
                // Keep Balanced exact, while Map focus swaps to a constrained single label rail.
                desktopGridClassName={printLayoutConfig.gridClassName}
                desktopMapWrapperClassName="mx-auto w-full"
                renderDesktopMap={() => (
                    <PrintDirectoryMap
                        presentation={presentation}
                        directory={directory}
                        generatedAt={generatedAt}
                        resourceCount={resourceCount}
                        mappedPlaceCount={mappedPlaceCount}
                        canShowQr={canShowQr}
                        resolvedShareUrl={resolvedShareUrl}
                        onMapReadyForCapture={onMapReadyForCapture}
                        onMapCaptureError={onMapCaptureError}
                        onMapViewportSnapshot={onMapViewportSnapshot}
                        interactive={printMapInteractive}
                        focusedPlaceKey={focusedPrintPlaceKey}
                        activePlaceKey={activePrintPlaceKey}
                        activePlaceKeys={activePrintPlaceKeys}
                        onViewSection={handlePrintPlaceSelect}
                        onHoverPlaceStart={handlePrintPlaceHoverStart}
                        onHoverPlaceEnd={handlePrintPlaceHoverEnd}
                        onHoverClusterStart={handlePrintClusterHoverStart}
                        onHoverClusterEnd={handlePrintClusterHoverEnd}
                        onClusterSelect={handlePrintClusterSelect}
                        onFocusHandled={handlePrintFocusHandled}
                        onResetView={clearPrintMapSelection}
                        useV2Format={useV2OwnerPrint}
                        printMapState={useV2OwnerPrint ? printMapState : null}
                        onPrintMapStateChange={useV2OwnerPrint ? patchPrintMapState : null}
                        mapModeControl={mapModeControl}
                        fixedTownSurfaceManifest={fixedTownSurfaceManifest}
                        fixedTownAssetBaseUrl={fixedTownAssetBaseUrl}
                        fixedTownSurfaceAvailable={fixedTownSurfaceAvailable}
                        fixedTownSurfacePending={fixedTownSurfacePending}
                        fixedTownSurfaceMinZoom={fixedTownSurfaceMinZoom}
                        onFixedTownSurfaceViewportChange={onFixedTownSurfaceViewportChange}
                        previewScale={variant === 'screen' ? scale : 1}
                        mapMaxWidthPx={printLayoutConfig.mapMaxWidthPx}
                        showResourcePins={showResourcePins}
                        mobileControlPortalTarget={useV2OwnerPrint && variant === 'screen'
                            ? mobileControlPortalTarget
                            : null}
                    />
                )}
                cardBadgeMode={useV2OwnerPrint ? (showPrintLogos ? 'logo' : 'none') : 'number'}
                showPrintNumberBadges={useV2OwnerPrint}
                printLabelDetail={labelDetail}
                printResourcesBelow={printResourcesBelow}
                printResourcePageHeader={printResourcesBelow ? (
                    <PrintResourcePageHeader
                        directory={directory}
                        generatedAt={generatedAt}
                        resourceCount={resourceCount}
                    />
                ) : null}
                showMapLegend={!useV2OwnerPrint}
            />


        </div>
    );

    if (variant === 'export') {
        return content;
    }

    return (
        <div className={`w-full overflow-x-hidden overflow-y-visible py-4 ${className}`} data-print-map-variant={variant}>
            {useV2OwnerPrint ? (
                <div
                    ref={mobileControlPortalRef}
                    className="mb-3 flex min-h-16 w-full items-center justify-end px-4 lg:hidden"
                    data-print-mobile-map-control-target="true"
                />
            ) : null}
            <div
                className="relative mx-auto"
                style={variant === 'screen' ? {
                    width: `${Math.ceil(sheetWidth * scale)}px`,
                    height: previewFrameHeight ? `${previewFrameHeight}px` : undefined,
                } : undefined}
            >
                {content}
            </div>
        </div>
    );
}
