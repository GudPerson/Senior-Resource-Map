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

function PrintDirectoryMap({
    presentation,
    mappedPlaceCount,
    onMapReadyForCapture,
    onMapCaptureError,
}) {
    return (
        <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Directory map</p>
                        <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Overview of mapped place groups</h2>
                        <p className="mt-2 text-sm leading-7 text-slate-500">
                            Numbered markers match the numbered place groups around the map.
                        </p>
                    </div>
                    <div className="inline-flex rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700">
                        {mappedPlaceCount} mapped place{mappedPlaceCount === 1 ? '' : 's'}
                    </div>
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
                mapHeightClassName="h-[420px]"
                className="mt-5"
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
    const containerWidthClass = variant === 'export' ? 'w-[1320px]' : 'w-full max-w-7xl';
    const sheetPaddingClass = variant === 'export' ? 'p-8' : 'p-6 sm:p-8';
    const resourceCount = directory?.summary?.resourceCount || 0;
    const mappedPlaceCount = presentation.mappedGroups.length;
    const viewLabel = mode === 'owner' ? 'Print view preview' : 'Shared directory print view';

    return (
        <div className={`${containerWidthClass} ${className}`}>
            <div className={`rounded-[32px] border border-brand-100 bg-white text-slate-900 shadow-xl ${sheetPaddingClass}`}>
                <div className="flex flex-col gap-5 border-b border-slate-100 pb-6 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                        <BrandLockup compact />
                        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.22em] text-brand-600">{viewLabel}</p>
                        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                            {directory?.name || 'Untitled directory'}
                        </h1>
                        {directory?.description ? (
                            <p className="mt-3 max-w-3xl text-base leading-8 text-slate-600">
                                {directory.description}
                            </p>
                        ) : null}
                        {presentation.activeAnchorNote ? (
                            <div className="mt-4 inline-flex rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700">
                                {presentation.activeAnchorNote}
                            </div>
                        ) : null}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[420px]">
                        <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
                            <p className="text-sm font-semibold leading-6 text-slate-500">Resources in this directory</p>
                            <p className="mt-1 text-2xl font-extrabold text-slate-900">{resourceCount}</p>
                        </div>
                        <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
                            <p className="text-sm font-semibold leading-6 text-slate-500">Mapped places</p>
                            <p className="mt-1 text-2xl font-extrabold text-slate-900">{mappedPlaceCount}</p>
                        </div>
                        <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
                            <p className="text-sm font-semibold leading-6 text-slate-500">Resources not shown on map</p>
                            <p className="mt-1 text-2xl font-extrabold text-slate-900">{presentation.unmappedRows.length}</p>
                        </div>
                        <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
                            <p className="text-sm font-semibold leading-6 text-slate-500">Generated on</p>
                            <p className="mt-1 text-lg font-bold text-slate-900">{formatGeneratedOn(generatedAt)}</p>
                        </div>
                    </div>
                </div>

                <div className="mt-8">
                    <SharedMapDirectoryList
                        presentation={presentation}
                        mode={mode}
                        layout="print"
                        canSaveResources={false}
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

                    {canShowQr ? (
                        <DirectoryQrCode value={resolvedShareUrl} className="w-full max-w-[320px] self-start lg:self-auto" />
                    ) : null}
                </div>
            </div>
        </div>
    );
}
