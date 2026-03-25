import { useEffect, useRef, useState } from 'react';
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
        <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 ${toneClassName}`}>
            <span className="text-[8px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</span>
            <span className="text-[12px] font-semibold">{value}</span>
        </div>
    );
}

function PrintDirectoryBoardHeader({
    directory,
    generatedAt,
    resourceCount,
    mappedPlaceCount,
    unmappedCount,
    activeAnchorNote,
    canShowQr,
    resolvedShareUrl,
}) {
    const rightHeaderBlock = (
        <div className="flex flex-col">
            <p className="mb-3 w-full whitespace-nowrap text-left text-[11px] font-bold uppercase tracking-[0.24em] text-brand-600">
                Scan QR code for interactive directory
            </p>
            <div className="flex items-start justify-between gap-6">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                        <SummaryChip label="Resources" value={resourceCount} tone="brand" />
                        <SummaryChip label="Mapped places" value={mappedPlaceCount} />
                        {unmappedCount ? <SummaryChip label="Not shown on map" value={unmappedCount} /> : null}
                    </div>
                    <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Prepared on {formatGeneratedOn(generatedAt)}
                    </p>
                    {activeAnchorNote ? (
                        <p className="mt-2 text-[12px] font-semibold text-sky-700">{activeAnchorNote}</p>
                    ) : null}
                </div>
                {canShowQr ? (
                    <div className="shrink-0">
                        <DirectoryQrCode value={resolvedShareUrl} compact />
                    </div>
                ) : null}
            </div>
        </div>
    );

    return (
        <div className="border-b border-slate-100 pb-5">
            <div className="flex items-start justify-between gap-12">
                <div className="min-w-0 flex-1">
                    <BrandLockup compact />
                    <h1 className="mt-4 text-[2.35rem] font-black tracking-tight text-slate-900">
                        {directory?.name || 'Untitled directory'}
                    </h1>
                    {directory?.description ? (
                        <p className="mt-2 max-w-2xl text-[15px] leading-7 text-slate-600">
                            {directory.description}
                        </p>
                    ) : null}
                </div>

                <div className="shrink-0">
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
}) {
    return (
        <div className="rounded-[30px] border border-slate-200 bg-white p-5">
            <PrintDirectoryBoardHeader
                directory={directory}
                generatedAt={generatedAt}
                resourceCount={resourceCount}
                mappedPlaceCount={mappedPlaceCount}
                unmappedCount={presentation.unmappedRows.length}
                activeAnchorNote={presentation.activeAnchorNote}
                canShowQr={canShowQr}
                resolvedShareUrl={resolvedShareUrl}
            />

            <DirectoryMap
                pins={presentation.pins}
                interactive={false}
                markerMode="number"
                placeNumberByKey={presentation.placeNumberByKey}
                showPopup={false}
                showZoomControl={false}
                showAttribution={true}
                mapHeightClassName="h-[520px]"
                className="mt-5"
                emptyLabel="No mappable places in this directory"
                onMapReadyForCapture={onMapReadyForCapture}
                onMapCaptureError={onMapCaptureError}
                onClusterChange={onClusterChange}
            />
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

    const sheetWidth = variant === 'export' ? (exportWidth || PREVIEW_CONTAINER_WIDTH) : PREVIEW_CONTAINER_WIDTH;
    const paddingClass = 'p-10';

    const content = (
        <div 
            ref={sheetRef}
            className={`rounded-[32px] border border-brand-100 bg-white text-slate-900 shadow-[0_24px_50px_-12px_rgba(15,118,110,0.15)] ${paddingClass} origin-top`}
            style={{ 
                width: `${sheetWidth}px`,
                transform: variant === 'screen' ? `scale(${scale})` : undefined,
                marginBottom: variant === 'screen' ? `-${(1 - scale) * 100}%` : undefined
            }}
        >
            <SharedMapDirectoryList
                presentation={presentation}
                mode={mode}
                layout="print"
                canSaveResources={false}
                allowPrintLinks={variant === 'screen'}
                // Use a fixed grid layout that doesn't rely on viewport breakpoints
                desktopGridClassName="grid-cols-[340px_1fr_340px]"
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
                    />
                )}
            />

            <div className="mt-8 flex items-end justify-between border-t border-slate-100 pt-6">
                <div className="space-y-2 text-[13px] font-medium text-slate-500">
                    <p>Created with <span className="text-brand-700 font-bold">CareAround SG</span></p>
                    {footerNote ? <p className="text-slate-400">{footerNote}</p> : null}
                    <p>
                        {mappedPlaceCount} mapped place{mappedPlaceCount === 1 ? '' : 's'}
                        {presentation.unmappedRows.length ? `, ${presentation.unmappedRows.length} resource${presentation.unmappedRows.length === 1 ? '' : 's'} not shown on map` : ''}
                    </p>
                </div>
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-300">End of directory</p>
            </div>
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
