import { Link } from 'react-router-dom';
import { ArrowRight, Clock3, MapPin, MapPinned, ShieldCheck, Tag, Trash2 } from 'lucide-react';

import { buildSavedAssetDetailPath } from '../lib/savedAssets.js';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { getIntlLocale } from '../lib/i18n.js';

function formatResourceType(resourceType, t) {
    return resourceType === 'hard' ? t('placeType') : t('offeringType');
}

function formatSavedDate(value, locale) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    return new Intl.DateTimeFormat(getIntlLocale(locale), {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    }).format(date);
}

function StatusBadge({ asset, t }) {
    if (asset.status === 'unavailable') {
        return (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                {t('noLongerAvailable')}
            </span>
        );
    }

    if (!asset.hasCoordinates) {
        return (
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                {t('listOnly')}
            </span>
        );
    }

    return null;
}

export default function SavedAssetCard({
    asset,
    mapUsageCount = 0,
    mapUsageKnown = false,
    removing = false,
    onRemove,
    onSelectionChange,
    selected = false,
    selectionDisabled = false,
    selectionMode = false,
}) {
    const { locale, t } = useLocale();
    const detailPath = asset.detailPath || buildSavedAssetDetailPath(asset.resourceType, asset.resourceId);
    const savedDate = formatSavedDate(asset.createdAt, locale);

    return (
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
            <div className="flex flex-col gap-4">
                {selectionMode ? (
                    <label className={`flex min-h-[44px] items-center gap-3 rounded-2xl border px-3.5 py-2.5 ${selectionDisabled ? 'cursor-not-allowed border-amber-200 bg-amber-50 text-amber-800' : 'cursor-pointer border-brand-200 bg-brand-50 text-slate-800'}`}>
                        <input
                            type="checkbox"
                            checked={selected}
                            disabled={selectionDisabled}
                            onChange={(event) => onSelectionChange?.(asset, event.target.checked)}
                            className="h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                            aria-label={t('selectSavedResource', { name: asset.name || t('savedResourceFallbackName') })}
                        />
                        {selectionDisabled ? <ShieldCheck size={17} className="shrink-0" /> : null}
                        <span className="text-sm font-semibold">
                            {selectionDisabled ? t('protectedByMyMap') : t('selectSavedResourceShort')}
                        </span>
                    </label>
                ) : null}

                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-slate-900">
                                <Tag size={12} />
                                {formatResourceType(asset.resourceType, t)}
                            </span>
                            {asset.subCategory ? (
                                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-900">
                                    {asset.subCategory}
                                </span>
                            ) : null}
                            <StatusBadge asset={asset} t={t} />
                            {mapUsageKnown ? (
                                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${mapUsageCount > 0 ? 'border-teal-200 bg-teal-50 text-teal-800' : 'border-slate-200 bg-white text-slate-500'}`}>
                                    <MapPinned size={12} />
                                    {mapUsageCount > 0
                                        ? t('usedInMyMaps', {
                                            count: mapUsageCount,
                                            label: mapUsageCount === 1 ? t('map') : t('maps'),
                                        })
                                        : t('notUsedInMyMaps')}
                                </span>
                            ) : null}
                        </div>
                        <h2 className="mt-3 text-lg font-bold leading-snug text-slate-900 line-clamp-2">
                            {asset.name || t('savedResourceFallbackName')}
                        </h2>
                    </div>
                    {savedDate ? (
                        <span className="inline-flex flex-shrink-0 items-center gap-1 text-xs font-medium text-slate-400">
                            <Clock3 size={13} />
                            {t('savedOn', { date: savedDate })}
                        </span>
                    ) : null}
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3.5 py-3">
                    <div className="flex items-start gap-2 text-sm text-slate-600">
                        <MapPin size={16} className="mt-0.5 flex-shrink-0 text-slate-400" />
                        <p className="line-clamp-2 leading-6">
                            {asset.address || (asset.status === 'unavailable' ? t('locationNoLongerAvailable') : t('locationDetailsUnavailable'))}
                        </p>
                    </div>
                </div>

                <div className="resource-action-grid gap-2">
                    <Link to={detailPath} reloadDocument className="btn-primary resource-action-button justify-center text-sm">
                        {t('viewDetails')}
                        <ArrowRight size={16} />
                    </Link>
                    {!selectionMode ? (
                        <button
                            type="button"
                            onClick={() => onRemove?.(asset)}
                            disabled={removing}
                            className="btn-ghost resource-action-button justify-center border border-slate-200 text-slate-700 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-wait disabled:opacity-70"
                        >
                            <Trash2 size={16} />
                            {removing ? t('removing') : t('remove')}
                        </button>
                    ) : null}
                </div>
            </div>
        </article>
    );
}
