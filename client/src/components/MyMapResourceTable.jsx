import CategoryPinShapeBadge from './CategoryPinShapeBadge.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { getCategoryPinShape } from '../lib/categoryPinShapes.js';
import { getCategoryPinStyle } from '../lib/categoryPinStyles.js';
import { getMapShortDescriptorPrintStyle } from '../lib/mapShortDescriptorStyle.js';
import { buildMyMapAssetLedger } from '../lib/myMapAssetLedger.js';

export default function MyMapResourceTable({
    directory,
    presentation,
    interactive = true,
    onViewOnMap,
    onHoverPlaceStart,
    onHoverPlaceEnd,
    numberedPinShapesByCategory = {},
    numberedPinStylesByCategory = {},
}) {
    const { locale, t } = useLocale();
    const ledger = buildMyMapAssetLedger({ directory, presentation, locale });

    return (
        <div className="space-y-5" data-my-map-resource-table="true">
            {ledger.categories.map((category) => (
                <section key={category.name} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <h3 className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black uppercase tracking-[0.1em] text-slate-700">
                        {category.name}
                    </h3>
                    <div className="hidden grid-cols-[4.5rem_minmax(12rem,1fr)_minmax(14rem,1.25fr)] gap-4 border-b border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-slate-500 sm:grid">
                        <span>{t('mapAssetTableNumber')}</span>
                        <span>{t('mapAssetTableResource')}</span>
                        <span>{t('mapAssetTableDescriptions')}</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {category.assets.map((asset) => {
                            const pinStyle = getCategoryPinStyle(
                                numberedPinStylesByCategory,
                                category.name,
                                asset.categoryColor,
                            );
                            const content = (
                                <>
                                    <div className="flex items-start gap-2 sm:block">
                                        <span className="mt-1 text-xs font-black uppercase text-slate-400 sm:hidden">
                                            {t('mapAssetTableNumber')}
                                        </span>
                                        {asset.sourceMapNumber === 'List only' ? (
                                            <span className="inline-flex min-h-8 items-center rounded-full bg-slate-100 px-2.5 text-xs font-bold text-slate-600">
                                                {t('mapAssetListOnly')}
                                            </span>
                                        ) : (
                                            <CategoryPinShapeBadge
                                                shape={getCategoryPinShape(numberedPinShapesByCategory, category.name)}
                                                color={pinStyle.fillColor}
                                                ringColor={pinStyle.ringColor}
                                                label={asset.sourceMapNumber}
                                            />
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-bold leading-5 text-slate-900">{asset.name}</p>
                                        <p className="mt-1 text-sm leading-5 text-slate-500">{asset.address}</p>
                                        {asset.isPersonalPlace ? (
                                            <span className="mt-2 inline-flex rounded-full bg-brand-50 px-2 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-brand-700">
                                                {t('personalPlace')}
                                            </span>
                                        ) : null}
                                    </div>
                                    <div className="min-w-0">
                                        <span className="mb-1 block text-xs font-black uppercase text-slate-400 sm:hidden">
                                            {t('mapAssetTableDescriptions')}
                                        </span>
                                        {asset.descriptions.length ? (
                                            <div className="flex flex-wrap gap-1.5">
                                                {asset.descriptions.map((description, index) => (
                                                    <span
                                                        key={`${asset.assetKey}:description:${index}`}
                                                        className="rounded px-1.5 py-0.5 text-sm font-semibold leading-5 print-color-adjust"
                                                        style={getMapShortDescriptorPrintStyle(description)}
                                                    >
                                                        {description.text}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-sm text-slate-400">{t('mapAssetNoDescriptions')}</span>
                                        )}
                                    </div>
                                </>
                            );

                            if (!interactive || !asset.placeKey || !onViewOnMap) {
                                return (
                                    <div key={asset.assetKey} className="grid gap-3 px-4 py-4 sm:grid-cols-[4.5rem_minmax(12rem,1fr)_minmax(14rem,1.25fr)] sm:gap-4">
                                        {content}
                                    </div>
                                );
                            }

                            return (
                                <button
                                    key={asset.assetKey}
                                    type="button"
                                    onClick={() => onViewOnMap(asset.placeKey)}
                                    onMouseEnter={() => onHoverPlaceStart?.(asset.placeKey)}
                                    onMouseLeave={() => onHoverPlaceEnd?.(asset.placeKey)}
                                    className="grid w-full gap-3 px-4 py-4 text-left transition hover:bg-brand-50/50 focus:outline-none focus:ring-4 focus:ring-inset focus:ring-brand-100 sm:grid-cols-[4.5rem_minmax(12rem,1fr)_minmax(14rem,1.25fr)] sm:gap-4"
                                >
                                    {content}
                                </button>
                            );
                        })}
                    </div>
                </section>
            ))}
        </div>
    );
}
