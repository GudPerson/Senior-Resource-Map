import { useCallback, useEffect, useRef, useState } from 'react';
import DirectoryMap from './DirectoryMap.jsx';
import DirectoryQrCode from './DirectoryQrCode.jsx';
import SharedMapDirectoryList from './SharedMapDirectoryList.jsx';
import BrandLockup from './layout/BrandLockup.jsx';
import { buildDirectoryPresentation, buildDirectoryShareUrl } from '../lib/directoryPresentation.js';

function formatGeneratedOn(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    return new Intl.DateTimeFormat('en-SG', {
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

function PrintDirectoryBoardHeader({
    directory,
    generatedAt,
    resourceCount,
    mappedPlaceCount,
    unmappedCount,
    canShowQr,
    resolvedShareUrl,
}) {
    const rightHeaderBlock = (
        <div className="flex w-[292px] max-w-[292px] flex-col">
            <p className="mb-2.5 w-full whitespace-nowrap text-left text-[10px] font-bold uppercase leading-3 tracking-[0.18em] text-brand-600">
                Scan QR code for interactive directory
            </p>
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <SummaryChip label="Resources" value={resourceCount} tone="brand" />
                        <SummaryChip label="Mapped places" value={mappedPlaceCount} />
                        {unmappedCount ? <SummaryChip label="Not shown on map" value={unmappedCount} /> : null}
                    </div>
                    <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Prepared on {formatGeneratedOn(generatedAt)}
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
        <div className="border-b border-slate-100 pb-5">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-8">
                <div className="min-w-0 flex-1">
                    <BrandLockup compact />
                    {(() => {
                        const name = directory?.name || 'Untitled directory';
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
}) {
    return (
        <div className="mx-auto w-full max-w-[680px] rounded-[30px] border border-slate-200 bg-white p-5">
            <PrintDirectoryBoardHeader
                directory={directory}
                generatedAt={generatedAt}
                resourceCount={resourceCount}
                mappedPlaceCount={mappedPlaceCount}
                unmappedCount={presentation.unmappedRows.length}
                canShowQr={canShowQr}
                resolvedShareUrl={resolvedShareUrl}
            />

            {presentation.activeAnchorNote ? (
                <p className="mt-4 rounded-xl border border-sky-100 bg-sky-50/70 px-3 py-2 text-[12px] font-semibold leading-5 text-sky-700">
                    {presentation.activeAnchorNote}
                </p>
            ) : null}

            <DirectoryMap
                activeAnchor={presentation.activeAnchor}
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
                interactive={interactive}
                markerMode="number"
                placeNumberByKey={presentation.placeNumberByKey}
                showPopup={false}
                showZoomControl={false}
                showAttribution={true}
                showProviderBadgeLogo={interactive}
                mapHeightClassName={interactive ? 'h-[360px]' : 'h-[300px]'}
                className={presentation.activeAnchorNote ? 'mt-3' : (interactive ? 'mt-8' : 'mt-5')}
                emptyLabel="No mappable places in this directory"
                onMapReadyForCapture={onMapReadyForCapture}
                onMapCaptureError={onMapCaptureError}
                onClusterChange={onClusterChange}
            />

            {/* Legend — self-contained inside the print map card */}
            <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2 text-[13px] font-bold text-slate-600">
                <div className="flex items-center gap-1.5">
                    <div className="h-[0.9em] w-[0.9em] rounded-full border border-white bg-[#0f766e] shadow-sm" />
                    <span>Single</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="flex h-[1.1em] w-[1.1em] items-center justify-center rounded-lg bg-[#0f766e] text-[0.7em] font-black text-white shadow-sm">1</div>
                    <span>Resource #</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="flex -space-x-1.5">
                        <div className="h-[0.9em] w-[0.9em] rounded-full border border-white bg-blue-500 shadow-sm" />
                        <div className="h-[0.9em] w-[0.9em] rounded-full border border-white bg-pink-500 shadow-sm" />
                        <div className="h-[0.9em] w-[0.9em] rounded-full border border-white bg-orange-500 shadow-sm" />
                    </div>
                    <span>Clusters</span>
                </div>
            </div>
        </div>
    );
}

const PREVIEW_CONTAINER_WIDTH = 1480;

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
}) {
    const presentation = buildDirectoryPresentation(directory, { activeAnchor });
    const resolvedShareUrl = shareUrl || buildDirectoryShareUrl(directory?.share?.sharePath);
    const canShowQr = Boolean(resolvedShareUrl) && (mode === 'shared' || directory?.share?.isShared);
    
    // Scaling logic for screen preview
    const sheetRef = useRef(null);
    const [scale, setScale] = useState(1);
    
    useEffect(() => {
        if (variant !== 'screen') return undefined;

        const handleResize = () => {
            if (!sheetRef.current) return;
            const parent = sheetRef.current.parentElement;
            if (!parent) return;
            
            // Allow some margins
            const availableWidth = parent.clientWidth - (window.innerWidth < 640 ? 32 : 64);
            
            // If the parent width isn't ready yet or is too small, default to a sensible scale
            if (availableWidth <= 0) {
                setScale(1);
                return;
            }

            const nextScale = Math.min(1, Math.max(0.2, availableWidth / PREVIEW_CONTAINER_WIDTH));
            setScale(nextScale);
        };

        // Use a small timeout to let the layout settle before calculating scale
        const timeoutId = window.setTimeout(handleResize, 50);
        window.addEventListener('resize', handleResize);
        return () => {
            window.clearTimeout(timeoutId);
            window.removeEventListener('resize', handleResize);
        };
    }, [variant]);

    const resourceCount = directory?.summary?.resourceCount || 0;
    const mappedPlaceCount = presentation.mappedGroups.length;
    const printMapInteractive = variant === 'screen';
    const [focusedPrintPlaceKey, setFocusedPrintPlaceKey] = useState(null);
    const [hoveredPrintPlaceKey, setHoveredPrintPlaceKey] = useState(null);
    const [hoveredPrintClusterPlaceKeys, setHoveredPrintClusterPlaceKeys] = useState([]);
    const [selectedPrintPlaceKeys, setSelectedPrintPlaceKeys] = useState([]);

    const resolvePrintPlaceKey = useCallback((placeKey) => (
        presentation.groupKeyByPlaceKey?.[placeKey] || placeKey
    ), [presentation.groupKeyByPlaceKey]);

    const clearPrintMapSelection = useCallback(() => {
        setFocusedPrintPlaceKey(null);
        setHoveredPrintPlaceKey(null);
        setHoveredPrintClusterPlaceKeys([]);
        setSelectedPrintPlaceKeys([]);
    }, []);

    const handlePrintPlaceSelect = useCallback((placeKey) => {
        const resolvedPlaceKey = resolvePrintPlaceKey(placeKey);
        if (!resolvedPlaceKey) return;
        setHoveredPrintPlaceKey(null);
        setHoveredPrintClusterPlaceKeys([]);
        setSelectedPrintPlaceKeys([String(resolvedPlaceKey)]);
        setFocusedPrintPlaceKey(`${resolvedPlaceKey}:zoom`);
    }, [resolvePrintPlaceKey]);

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
            : (hoveredPrintPlaceKey ? [hoveredPrintPlaceKey] : []));

    const sheetWidth = variant === 'export' ? (exportWidth || PREVIEW_CONTAINER_WIDTH) : PREVIEW_CONTAINER_WIDTH;
    const paddingClass = 'p-10';

    const content = (
        <div 
            ref={sheetRef}
            className={`text-slate-900 ${paddingClass} flex-shrink-0`}
            style={{ 
                width: `${sheetWidth}px`,
                transform: variant === 'screen' ? `scale(${scale})` : undefined,
                transformOrigin: 'top center',
                marginBottom: variant === 'screen' ? `-${(1 - scale) * 101}%` : undefined,
                backgroundColor: 'white'
            }}
        >
            <SharedMapDirectoryList
                presentation={presentation}
                mode={mode}
                layout="print"
                canSaveResources={false}
                allowPrintLinks={variant === 'screen'}
                highlightPlaceKeys={activePrintPlaceKeys}
                // Keep the preview balanced on desktop by slightly reducing the side rails
                // and letting the center map card sit in a bounded, centered column.
                desktopGridClassName="grid-cols-[340px_minmax(0,1fr)_340px]"
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
                    />
                )}
            />


        </div>
    );

    if (variant === 'export') {
        return content;
    }

    return (
        <div className={`w-full flex justify-center overflow-hidden py-4 ${className}`}>
            {content}
        </div>
    );
}
