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
        <div className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 ${toneClassName}`}>
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</span>
            <span className="text-sm font-semibold">{value}</span>
        </div>
    );
}

function PrintDirectoryMap({
    presentation,
    mappedPlaceCount,
    onMapReadyForCapture,
    onMapCaptureError,
}) {
    return (
        <div className="rounded-[30px] border border-slate-200 bg-white p-4 xl:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-600">Directory map</p>
                    <h2 className="mt-1.5 text-[22px] font-bold tracking-tight text-slate-900">Mapped place overview</h2>
                    <p className="mt-1.5 text-sm leading-6 text-slate-500">
                            Numbered markers match the numbered place groups around the map.
                    </p>
                </div>
                <div className="inline-flex rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700">
                    {mappedPlaceCount} mapped place{mappedPlaceCount === 1 ? '' : 's'}
                </div>
            </div>

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
    const containerWidthClass = variant === 'export' ? 'w-[1480px]' : 'w-full max-w-[1600px]';
    const sheetPaddingClass = variant === 'export' ? 'p-8' : 'p-6 sm:p-8 xl:p-10';
    const resourceCount = directory?.summary?.resourceCount || 0;
    const mappedPlaceCount = presentation.mappedGroups.length;
    const viewLabel = mode === 'owner' ? 'Print view preview' : 'Shared directory print view';

    return (
        <div className={`${containerWidthClass} ${className}`}>
            <div className={`rounded-[32px] border border-brand-100 bg-white text-slate-900 shadow-xl ${sheetPaddingClass}`}>
                <div className="flex flex-col gap-5 border-b border-slate-100 pb-6 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                        <BrandLockup compact />
                        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.22em] text-brand-600">{viewLabel}</p>
                        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                            {directory?.name || 'Untitled directory'}
                        </h1>
                        {directory?.description ? (
                            <p className="mt-3 max-w-4xl text-base leading-8 text-slate-600">
                                {directory.description}
                            </p>
                        ) : null}

                        <div className="mt-4 flex flex-wrap items-center gap-2.5">
                            <SummaryChip label="Resources" value={resourceCount} tone="brand" />
                            <SummaryChip label="Mapped places" value={mappedPlaceCount} />
                            {presentation.unmappedRows.length ? (
                                <SummaryChip label="Not shown on map" value={presentation.unmappedRows.length} />
                            ) : null}
                            {presentation.activeAnchorNote ? (
                                <div className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3.5 py-2 text-sm font-semibold text-sky-700">
                                    {presentation.activeAnchorNote}
                                </div>
                            ) : null}
                        </div>
                    </div>

                    <div className="flex flex-col gap-4 lg:items-end">
                        <div className="flex flex-col items-start gap-2 text-sm text-slate-500 lg:items-end lg:text-right">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Prepared for print</p>
                            <p className="text-base font-semibold text-slate-700">{formatGeneratedOn(generatedAt)}</p>
                            <p className="max-w-[360px] leading-6">
                                Static directory board with numbered map pins and matching grouped listings.
                            </p>
                        </div>
                        {canShowQr ? (
                            <DirectoryQrCode value={resolvedShareUrl} compact className="w-full max-w-[320px]" />
                        ) : null}
                    </div>
                </div>

                <div className="mt-8">
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
                                mappedPlaceCount={mappedPlaceCount}
                                onMapReadyForCapture={onMapReadyForCapture}
                                onMapCaptureError={onMapCaptureError}
                            />
                        )}
                    />
                </div>

                <div className="mt-8 flex flex-col gap-5 border-t border-slate-100 pt-5 lg:flex-row lg:items-end lg:justify-between">
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
