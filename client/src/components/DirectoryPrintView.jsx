import DirectoryMap from './DirectoryMap.jsx';
import BrandLockup from './layout/BrandLockup.jsx';
import ResourceRowIcon from './ResourceRowIcon.jsx';

function formatGeneratedOn(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    return new Intl.DateTimeFormat('en-SG', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    }).format(date);
}

function buildNumberedPlaces(places, pins) {
    const mappedPlaceKeys = new Set((pins || []).map((pin) => pin.placeKey));
    let nextSectionNumber = 1;

    return (places || []).map((place) => {
        const isMapped = Boolean(
            mappedPlaceKeys.has(place.placeKey)
            && place?.hasCoordinates
            && Number.isFinite(place?.lat)
            && Number.isFinite(place?.lng)
        );
        const sectionNumber = isMapped ? nextSectionNumber++ : null;

        return {
            ...place,
            sectionNumber,
            isMapped,
        };
    });
}

function StatusBadge({ status }) {
    if (status === 'unavailable') {
        return (
            <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                Unavailable
            </span>
        );
    }

    if (status === 'list_only') {
        return (
            <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                List only
            </span>
        );
    }

    return null;
}

function PrintDirectoryMap({ pins, mappedPlaceCount, placeNumberByKey, onMapReadyForCapture }) {
    return (
        <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Directory map</p>
                    <h2 className="mt-2 text-2xl font-bold text-slate-900">Overview of curated places</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-500">
                        Numbered markers match the place sections listed below.
                    </p>
                </div>
                <div className="inline-flex rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700">
                    {mappedPlaceCount} mapped place{mappedPlaceCount === 1 ? '' : 's'}
                </div>
            </div>

            <DirectoryMap
                pins={pins}
                interactive={false}
                markerMode="number"
                placeNumberByKey={placeNumberByKey}
                showPopup={false}
                showZoomControl={false}
                showAttribution={true}
                mapHeightClassName="h-[360px]"
                className="mt-5"
                emptyLabel="No mappable places in this directory"
                onMapReadyForCapture={onMapReadyForCapture}
            />
        </div>
    );
}

function PrintResourceRow({ row }) {
    return (
        <div className="flex items-start gap-3 rounded-[20px] border border-slate-200 bg-white p-4">
            <ResourceRowIcon
                resourceType={row.resourceType}
                bucket={row.bucket}
                subCategory={row.subCategory}
                className="h-10 w-10 rounded-xl"
            />
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    {row.subCategory ? (
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                            {row.subCategory}
                        </span>
                    ) : null}
                    <StatusBadge status={row.status} />
                </div>
                <p className="mt-2 text-base font-bold leading-snug text-slate-900">{row.name}</p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                    <span>{row.resourceType === 'hard' ? 'Place' : 'Offering'}</span>
                    {row.bucket ? <span>{row.bucket}</span> : null}
                </div>
                {row.descriptor ? (
                    <p className="mt-2 text-sm leading-6 text-slate-500">{row.descriptor}</p>
                ) : null}
            </div>
        </div>
    );
}

function PrintPlaceSection({ place }) {
    return (
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-start">
                {place.sectionNumber ? (
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-brand-700 text-lg font-black text-white shadow-sm">
                        {place.sectionNumber}
                    </div>
                ) : (
                    <div className="inline-flex w-fit flex-shrink-0 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
                        Not shown on map
                    </div>
                )}
                <div className="min-w-0 flex-1">
                    <h3 className="text-2xl font-bold tracking-tight text-slate-900">{place.name}</h3>
                    {place.address ? (
                        <p className="mt-2 text-sm leading-6 text-slate-500">{place.address}</p>
                    ) : null}
                    <div className="mt-3 inline-flex rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700">
                        {place.curatedCount} {place.curatedCount === 1 ? 'selected resource' : 'selected resources'}
                    </div>
                </div>
            </div>

            <div className="mt-4 space-y-3">
                {place.rows.map((row) => (
                    <PrintResourceRow key={row.rowKey} row={row} />
                ))}
            </div>
        </section>
    );
}

export default function DirectoryPrintView({
    directory,
    generatedAt = new Date(),
    mode = 'shared',
    variant = 'screen',
    footerNote = '',
    className = '',
    onMapReadyForCapture,
}) {
    const numberedPlaces = buildNumberedPlaces(directory?.places || [], directory?.pins || []);
    const numberedPins = (directory?.pins || []).filter((pin) => {
        const place = numberedPlaces.find((item) => item.placeKey === pin.placeKey);
        return Boolean(place?.sectionNumber);
    });
    const placeNumberByKey = numberedPlaces.reduce((accumulator, place) => {
        if (place.sectionNumber) {
            accumulator[place.placeKey] = place.sectionNumber;
        }
        return accumulator;
    }, {});
    const containerWidthClass = variant === 'export' ? 'w-[1100px]' : 'w-full max-w-5xl';
    const sheetPaddingClass = variant === 'export' ? 'p-8' : 'p-6 sm:p-8';
    const resourceCount = directory?.summary?.resourceCount || 0;
    const mappedPlaceCount = directory?.summary?.mappablePlaceCount || 0;
    const viewLabel = mode === 'owner' ? 'Print view preview' : 'Shared directory';

    return (
        <div className={`${containerWidthClass} ${className}`}>
            <div className={`rounded-[32px] border border-brand-100 bg-white text-slate-900 shadow-xl ${sheetPaddingClass}`}>
                <div className="flex flex-col gap-5 border-b border-slate-100 pb-6 sm:flex-row sm:items-start sm:justify-between">
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
                    </div>

                    <div className="grid gap-3 sm:min-w-[320px] sm:grid-cols-1">
                        <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
                            <p className="text-sm font-semibold leading-6 text-slate-500">Resources in this directory</p>
                            <p className="mt-1 text-2xl font-extrabold text-slate-900">{resourceCount}</p>
                        </div>
                        <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
                            <p className="text-sm font-semibold leading-6 text-slate-500">Mapped places</p>
                            <p className="mt-1 text-2xl font-extrabold text-slate-900">{mappedPlaceCount}</p>
                        </div>
                        <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
                            <p className="text-sm font-semibold leading-6 text-slate-500">Generated on</p>
                            <p className="mt-1 text-lg font-bold text-slate-900">{formatGeneratedOn(generatedAt)}</p>
                        </div>
                    </div>
                </div>

                <div className="mt-8 space-y-8">
                    <PrintDirectoryMap
                        pins={numberedPins}
                        mappedPlaceCount={mappedPlaceCount}
                        placeNumberByKey={placeNumberByKey}
                        onMapReadyForCapture={onMapReadyForCapture}
                    />

                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Directory listing</p>
                        <h2 className="mt-2 text-2xl font-bold text-slate-900">Grouped by place</h2>
                        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">
                            This sheet includes only the curated resources that belong to this directory, grouped under each place.
                        </p>
                    </div>

                    <div className="space-y-4">
                        {numberedPlaces.map((place) => (
                            <PrintPlaceSection key={place.placeKey} place={place} />
                        ))}
                    </div>
                </div>

                <div className="mt-8 flex flex-col gap-2 border-t border-slate-100 pt-5 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                    <span>Created with CareAround SG</span>
                    {footerNote ? <span className="text-slate-400">{footerNote}</span> : null}
                    <span>{mappedPlaceCount} mapped place{mappedPlaceCount === 1 ? '' : 's'}</span>
                </div>
            </div>
        </div>
    );
}
