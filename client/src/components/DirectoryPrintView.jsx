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
    const rightHeaderBlock = canShowQr ? (
        <div className="flex items-start gap-5">
            <div className="flex min-h-[128px] min-w-[420px] flex-col justify-center">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-brand-600">Scan QR code for interactive directory</p>
                <div className="mt-4 flex flex-wrap items-center gap-2.5">
                    <SummaryChip label="Resources" value={resourceCount} tone="brand" />
                    <SummaryChip label="Mapped places" value={mappedPlaceCount} />
                    {unmappedCount ? <SummaryChip label="Not shown on map" value={unmappedCount} /> : null}
                </div>
                <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Prepared on {formatGeneratedOn(generatedAt)}</p>
                {activeAnchorNote ? (
                    <p className="mt-2 text-[12px] font-semibold text-sky-700">{activeAnchorNote}</p>
                ) : null}
            </div>
            <DirectoryQrCode value={resolvedShareUrl} compact className="flex-shrink-0" />
        </div>
    ) : (
        <div className="flex flex-col items-start xl:items-end">
            <div className="flex flex-wrap items-center gap-3 xl:justify-end">
                <SummaryChip label="Resources" value={resourceCount} tone="brand" />
                <SummaryChip label="Mapped places" value={mappedPlaceCount} />
                {unmappedCount ? <SummaryChip label="Not shown on map" value={unmappedCount} /> : null}
            </div>
            <p className="mt-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 xl:text-right">Prepared on {formatGeneratedOn(generatedAt)}</p>
            {activeAnchorNote ? (
                <p className="mt-2 text-[12px] font-semibold text-sky-700 xl:text-right">{activeAnchorNote}</p>
            ) : null}
        </div>
    );

    return (
        <div className="border-b border-slate-100 pb-4">
            <div className="flex flex-col gap-6 xl:grid xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start xl:gap-10">
                <div className="min-w-0 max-w-[560px]">
                    <BrandLockup compact />
                    <h1 className="mt-4 text-[2rem] font-extrabold tracking-tight text-slate-900 sm:text-[2.35rem]">
                        {directory?.name || 'Untitled directory'}
                    </h1>
                    {directory?.description ? (
                        <p className="mt-2 text-sm leading-7 text-slate-600">
                            {directory.description}
                        </p>
                    ) : null}
                </div>

                <div className="xl:justify-self-end">
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
}) {
    return (
        <div className="rounded-[30px] border border-slate-200 bg-white p-4 xl:p-5">
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
                mapHeightClassName="h-[500px] xl:h-[540px]"
                className="mt-4"
                emptyLabel="No mappable places in this directory"
                onMapReadyForCapture={onMapReadyForCapture}
                onMapCaptureError={onMapCaptureError}
            />
        </div>
    );
}

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
    const containerWidthClass = variant === 'export' ? 'max-w-none' : 'w-full max-w-[1600px]';
    const sheetPaddingClass = variant === 'export' ? 'p-8' : 'p-6 sm:p-8 xl:p-10';
    const resourceCount = directory?.summary?.resourceCount || 0;
    const mappedPlaceCount = presentation.mappedGroups.length;
    const containerStyle = variant === 'export' ? { width: `${exportWidth || 1480}px` } : undefined;

    return (
        <div className={`${containerWidthClass} ${className}`} style={containerStyle}>
            <div className={`rounded-[32px] border border-brand-100 bg-white text-slate-900 shadow-xl ${sheetPaddingClass}`}>
                <div>
                    <SharedMapDirectoryList
                        presentation={presentation}
                        mode={mode}
                        layout="print"
                        canSaveResources={false}
                        allowPrintLinks={variant === 'screen'}
                        desktopGridClassName="lg:grid-cols-[minmax(320px,1fr)_minmax(640px,1.65fr)_minmax(320px,1fr)] xl:grid-cols-[minmax(360px,1fr)_minmax(780px,1.9fr)_minmax(360px,1fr)]"
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
                </div>

                <div className="mt-6 flex flex-col gap-5 border-t border-slate-100 pt-5 lg:flex-row lg:items-end lg:justify-between">
                    <div className="space-y-2 text-sm text-slate-500">
                        <p>Created with CareAround SG</p>
                        {footerNote ? <p className="text-slate-400">{footerNote}</p> : null}
                        <p>
                            {mappedPlaceCount} mapped place{mappedPlaceCount === 1 ? '' : 's'}
                            {presentation.unmappedRows.length ? `, ${presentation.unmappedRows.length} resource${presentation.unmappedRows.length === 1 ? '' : 's'} not shown on map` : ''}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
