import { Link } from 'react-router-dom';
import { ArrowRight, Clock3, MapPin, Tag, Trash2 } from 'lucide-react';

import { buildSavedAssetDetailPath } from '../lib/savedAssets.js';

function formatResourceType(resourceType) {
    return resourceType === 'hard' ? 'Place' : 'Offering';
}

function formatSavedDate(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    return new Intl.DateTimeFormat('en-SG', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    }).format(date);
}

function StatusBadge({ asset }) {
    if (asset.status === 'unavailable') {
        return (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                No longer available
            </span>
        );
    }

    if (!asset.hasCoordinates) {
        return (
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                Not shown on map
            </span>
        );
    }

    return null;
}

export default function SavedAssetCard({
    asset,
    removing = false,
    onRemove,
}) {
    const detailPath = asset.detailPath || buildSavedAssetDetailPath(asset.resourceType, asset.resourceId);
    const savedDate = formatSavedDate(asset.createdAt);

    return (
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
            <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-slate-900">
                                <Tag size={12} />
                                {formatResourceType(asset.resourceType)}
                            </span>
                            {asset.subCategory ? (
                                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-900">
                                    {asset.subCategory}
                                </span>
                            ) : null}
                            <StatusBadge asset={asset} />
                        </div>
                        <h2 className="mt-3 text-lg font-bold leading-snug text-slate-900">
                            {asset.name || 'Saved resource'}
                        </h2>
                    </div>
                    {savedDate ? (
                        <span className="inline-flex flex-shrink-0 items-center gap-1 text-xs font-medium text-slate-400">
                            <Clock3 size={13} />
                            Saved {savedDate}
                        </span>
                    ) : null}
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3.5 py-3">
                    <div className="flex items-start gap-2 text-sm text-slate-600">
                        <MapPin size={16} className="mt-0.5 flex-shrink-0 text-slate-400" />
                        <p className="leading-6">
                            {asset.address || (asset.status === 'unavailable' ? 'Location is no longer available.' : 'Location details are not available.')}
                        </p>
                    </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                    <Link to={detailPath} reloadDocument className="btn-primary flex-1 justify-center">
                        View details
                        <ArrowRight size={16} />
                    </Link>
                    <button
                        type="button"
                        onClick={() => onRemove?.(asset)}
                        disabled={removing}
                        className="btn-ghost flex-1 justify-center border border-slate-200 text-slate-700 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-wait disabled:opacity-70"
                    >
                        <Trash2 size={16} />
                        {removing ? 'Removing…' : 'Remove'}
                    </button>
                </div>
            </div>
        </article>
    );
}
