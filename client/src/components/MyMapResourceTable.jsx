import CategoryPinShapeBadge from './CategoryPinShapeBadge.jsx';
import ResourceRowIcon from './ResourceRowIcon.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { getCategoryPinShape } from '../lib/categoryPinShapes.js';
import { getCategoryPinStyle } from '../lib/categoryPinStyles.js';
import { getMapShortDescriptorPrintStyle } from '../lib/mapShortDescriptorStyle.js';
import { buildMyMapAssetLedger } from '../lib/myMapAssetLedger.js';
import {
    getMyMapResourceTableDetailVisibility,
    normalizeMyMapResourceTableColumnCount,
    splitMyMapResourceTableCategories,
} from '../lib/myMapResourceTablePresentation.js';

export default function MyMapResourceTable({
    directory,
    presentation,
    interactive = true,
    onViewOnMap,
    onHoverPlaceStart,
    onHoverPlaceEnd,
    numberedPinShapesByCategory = {},
    numberedPinStylesByCategory = {},
    labelDetail = 'full',
    columnCount = 1,
}) {
    const { locale, t } = useLocale();
    const ledger = buildMyMapAssetLedger({ directory, presentation, locale });
    const detail = getMyMapResourceTableDetailVisibility(labelDetail);
    const normalizedColumnCount = normalizeMyMapResourceTableColumnCount(columnCount);
    const categoryColumns = splitMyMapResourceTableCategories(
        ledger.categories,
        normalizedColumnCount,
    );
    const useStackedRowLayout = normalizedColumnCount >= 3;
    const rowGridClassName = useStackedRowLayout
        ? 'sm:grid-cols-[2.75rem_minmax(0,1fr)]'
        : (detail.showDescriptions
            ? 'sm:grid-cols-[3.25rem_minmax(0,0.95fr)_minmax(0,1.05fr)]'
            : 'sm:grid-cols-[3.25rem_minmax(0,1fr)]');
    const rowPaddingClassName = detail.compact ? 'py-2.5' : 'py-3.5';

    return (
        <div
            className={`grid items-start ${normalizedColumnCount >= 4 ? 'gap-3' : 'gap-5'}`}
            style={{ gridTemplateColumns: `repeat(${normalizedColumnCount}, minmax(0, 1fr))` }}
            data-my-map-resource-table="true"
            data-my-map-resource-table-columns={normalizedColumnCount}
            data-my-map-resource-table-detail={detail.labelDetail}
        >
            {categoryColumns.map((categories, columnIndex) => (
                <div key={`my-map-table-column:${columnIndex}`} className="min-w-0 space-y-5" data-my-map-resource-table-column="true">
                    {categories.map((category) => {
                        const categoryColor = category.assets[0]?.categoryColor;
                        const pinStyle = getCategoryPinStyle(
                            numberedPinStylesByCategory,
                            category.name,
                            categoryColor,
                        );
                        const categoryShape = getCategoryPinShape(
                            numberedPinShapesByCategory,
                            category.name,
                        );

                        return (
                            <section key={category.name} className="break-inside-avoid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                                <h3 className="flex min-w-0 items-center gap-2.5 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-black uppercase tracking-[0.1em] text-slate-700">
                                    <CategoryPinShapeBadge
                                        shape={categoryShape}
                                        color={pinStyle.fillColor}
                                        ringColor={pinStyle.ringColor}
                                        ringWeight={pinStyle.ringWeight}
                                        compact
                                    />
                                    <span className="min-w-0 break-words">{category.name}</span>
                                </h3>
                                <div className={`hidden gap-3 border-b border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-slate-500 sm:grid ${rowGridClassName}`}>
                                    <span>{t('mapAssetTableNumber')}</span>
                                    <span>{t(detail.showAddress ? 'mapAssetTableResource' : 'mapAssetTableResourceName')}</span>
                                    {detail.showDescriptions && !useStackedRowLayout ? <span>{t('mapAssetTableDescriptions')}</span> : null}
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {category.assets.map((asset) => {
                                        const content = (
                                            <>
                                                <div className="flex items-start gap-2 sm:block">
                                                    <span className="mt-0.5 text-xs font-black uppercase text-slate-400 sm:hidden">
                                                        {t('mapAssetTableNumber')}
                                                    </span>
                                                    {asset.sourceMapNumber === 'List only' ? (
                                                        <span className="inline-flex min-h-7 items-center rounded-full bg-slate-100 px-2 text-xs font-bold text-slate-600">
                                                            {t('mapAssetListOnly')}
                                                        </span>
                                                    ) : (
                                                        <span
                                                            className="inline-flex min-h-7 items-center text-sm font-black tabular-nums text-slate-800"
                                                            data-my-map-table-number-index="true"
                                                        >
                                                            {asset.sourceMapNumber}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className={`min-w-0 ${detail.showLogo ? 'flex items-start gap-2.5' : ''}`}>
                                                    {detail.showLogo ? (
                                                        <ResourceRowIcon
                                                            resourceType={asset.resourceType}
                                                            bucket={asset.bucket}
                                                            subCategory={asset.subCategory}
                                                            logoUrl={asset.logoUrl}
                                                            alt={asset.logoUrl ? `${asset.name} logo` : ''}
                                                            className="!h-8 !w-8 !rounded-lg"
                                                        />
                                                    ) : null}
                                                    <div className="min-w-0 flex-1">
                                                        <p className="font-bold leading-5 text-slate-900">{asset.name}</p>
                                                        {detail.showAddress ? (
                                                            <p className="mt-1 break-words text-sm leading-5 text-slate-500">{asset.address}</p>
                                                        ) : null}
                                                        {detail.showPersonalPlaceLabel && asset.isPersonalPlace ? (
                                                            <span className="mt-2 inline-flex rounded-full bg-brand-50 px-2 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-brand-700">
                                                                {t('personalPlace')}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                </div>
                                                {detail.showDescriptions ? (
                                                    <div className={`min-w-0 ${useStackedRowLayout ? 'sm:col-start-2' : ''}`}>
                                                        <span className="mb-1 block text-xs font-black uppercase text-slate-400 sm:hidden">
                                                            {t('mapAssetTableDescriptions')}
                                                        </span>
                                                        {asset.descriptions.length ? (
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {asset.descriptions.map((description, index) => (
                                                                    <span
                                                                        key={`${asset.assetKey}:description:${index}`}
                                                                        className="rounded px-1.5 py-0.5 text-base font-semibold leading-5 print-color-adjust"
                                                                        style={getMapShortDescriptorPrintStyle(description)}
                                                                    >
                                                                        {description.text}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <span className="text-base text-slate-400">{t('mapAssetNoDescriptions')}</span>
                                                        )}
                                                    </div>
                                                ) : null}
                                            </>
                                        );
                                        const rowClassName = `grid gap-3 px-4 text-left sm:gap-3 ${rowPaddingClassName} ${rowGridClassName}`;

                                        if (!interactive || !asset.placeKey || !onViewOnMap) {
                                            return (
                                                <div key={asset.assetKey} className={rowClassName}>
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
                                                className={`w-full transition hover:bg-brand-50/50 focus:outline-none focus:ring-4 focus:ring-inset focus:ring-brand-100 ${rowClassName}`}
                                                aria-label={`${t('viewOnMap')}: ${asset.name}`}
                                            >
                                                {content}
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}
