import { X } from 'lucide-react';

import { useLocale } from '../contexts/LocaleContext.jsx';
import {
    PRINT_MAP_DEFAULT_HEIGHT_PX,
    PRINT_MAP_FULL_PAGE_DEFAULT_HEIGHT_PX,
    PRINT_MAP_LABEL_DETAIL_FULL,
    PRINT_MAP_LABEL_DETAIL_LOGOS,
    PRINT_MAP_LABEL_DETAIL_NAMES,
    PRINT_MAP_LABEL_DETAIL_NAMES_ADDRESSES,
    PRINT_MAP_LABEL_DETAIL_NAMES_DESCRIPTIONS,
    PRINT_MAP_LAYOUT_BALANCED,
    PRINT_MAP_LAYOUT_FOCUS,
    PRINT_MAP_LAYOUT_FULL,
    PRINT_MAP_MAX_HEIGHT_PX,
    PRINT_MAP_PAGE_LAYOUT_FULL,
    PRINT_MAP_PAGE_LAYOUT_STANDARD,
    PRINT_MAP_RESOURCE_LAYER_HIDE,
    PRINT_MAP_RESOURCE_LAYER_SHOW,
    PRINT_MAP_RESOURCE_PLACEMENT_BESIDE,
    PRINT_MAP_RESOURCE_PLACEMENT_NEXT_PAGE,
    PRINT_MAP_SIDE_LEFT,
    PRINT_MAP_SIDE_RIGHT,
    PRINT_MAP_WIDTH_EXTRA_WIDE,
    PRINT_MAP_WIDTH_WIDE,
    normalizePrintMapLabelDetail,
    normalizePrintMapLayoutPreset,
    normalizePrintMapResourceColumnCount,
    normalizePrintMapResourceLayer,
    normalizePrintMapSide,
    normalizePrintMapWidth,
} from '../lib/printMapState.js';

function ChoiceButton({ selected, label, onClick }) {
    return (
        <button
            type="button"
            aria-pressed={selected}
            onClick={onClick}
            className={`min-h-11 min-w-0 touch-manipulation rounded-xl border px-2 py-2 text-center transition focus:outline-none focus:ring-4 focus:ring-brand-100 ${
                selected
                    ? 'border-brand-600 bg-brand-700 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-brand-200 hover:bg-brand-50'
            }`}
        >
            <span className="block break-words text-xs font-bold leading-4 sm:text-sm sm:leading-5">{label}</span>
        </button>
    );
}

export default function PrintLayoutControls({ value, onChange, onClose }) {
    const { t } = useLocale();
    const layoutPreset = normalizePrintMapLayoutPreset(value?.layoutPreset);
    const resourceLayer = normalizePrintMapResourceLayer(value?.resourceLayer);
    const mapSide = normalizePrintMapSide(value?.mapSide);
    const mapWidth = normalizePrintMapWidth(value?.mapWidth);
    const labelDetail = normalizePrintMapLabelDetail(value?.labelDetail);
    const resourceColumnCount = normalizePrintMapResourceColumnCount(value?.resourceColumnCount);
    const patchState = (patch) => onChange?.((current) => ({
        ...current,
        ...(typeof patch === 'function' ? patch(current || {}) : patch),
    }));
    const selectLayout = (nextLayout) => patchState((current) => {
        if (nextLayout === PRINT_MAP_LAYOUT_FULL) {
            return {
                layoutPreset: PRINT_MAP_LAYOUT_FULL,
                pageLayout: PRINT_MAP_PAGE_LAYOUT_FULL,
                resourcePlacement: PRINT_MAP_RESOURCE_PLACEMENT_NEXT_PAGE,
                height: Math.max(Number(current.height) || 0, PRINT_MAP_FULL_PAGE_DEFAULT_HEIGHT_PX),
            };
        }
        return {
            layoutPreset: nextLayout,
            pageLayout: PRINT_MAP_PAGE_LAYOUT_STANDARD,
            resourcePlacement: PRINT_MAP_RESOURCE_PLACEMENT_BESIDE,
            height: Math.min(Number(current.height) || PRINT_MAP_DEFAULT_HEIGHT_PX, PRINT_MAP_MAX_HEIGHT_PX),
        };
    });

    const labelOptions = [
        { value: PRINT_MAP_LABEL_DETAIL_NAMES, label: t('printLabelNamesOnly') },
        { value: PRINT_MAP_LABEL_DETAIL_LOGOS, label: t('printLabelNamesLogos') },
        { value: PRINT_MAP_LABEL_DETAIL_NAMES_ADDRESSES, label: t('printLabelNamesAddresses') },
        { value: PRINT_MAP_LABEL_DETAIL_NAMES_DESCRIPTIONS, label: t('printLabelNamesDescriptions') },
        { value: PRINT_MAP_LABEL_DETAIL_FULL, label: t('printLabelFullDetails') },
    ];

    return (
        <section
            className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm sm:p-4"
            aria-labelledby="print-layout-heading"
            data-print-layout-controls="true"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h2 id="print-layout-heading" className="text-base font-black text-slate-900">
                        {t('printLayout')}
                    </h2>
                    <p className="mt-0.5 text-xs leading-4 text-slate-600 sm:text-sm sm:leading-5">
                        {t('printLayoutDescription')}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-brand-100"
                    aria-label={t('closePrintLayout')}
                    title={t('closePrintLayout')}
                >
                    <X size={18} aria-hidden="true" />
                </button>
            </div>

            <fieldset className="mt-3">
                <legend className="text-sm font-bold text-slate-800">{t('printLayoutType')}</legend>
                <div className="mt-2 grid grid-cols-3 gap-2">
                    <ChoiceButton
                        selected={layoutPreset === PRINT_MAP_LAYOUT_BALANCED}
                        label={t('printLayoutBalanced')}
                        onClick={() => selectLayout(PRINT_MAP_LAYOUT_BALANCED)}
                    />
                    <ChoiceButton
                        selected={layoutPreset === PRINT_MAP_LAYOUT_FOCUS}
                        label={t('printLayoutMapFocus')}
                        onClick={() => selectLayout(PRINT_MAP_LAYOUT_FOCUS)}
                    />
                    <ChoiceButton
                        selected={layoutPreset === PRINT_MAP_LAYOUT_FULL}
                        label={t('printPageFullMap')}
                        onClick={() => selectLayout(PRINT_MAP_LAYOUT_FULL)}
                    />
                </div>
                <p className="mt-2 text-xs font-medium leading-4 text-slate-500">
                    {layoutPreset === PRINT_MAP_LAYOUT_FULL
                        ? t('printPageFullMapDescription')
                        : layoutPreset === PRINT_MAP_LAYOUT_FOCUS
                            ? t('printLayoutMapFocusDescription')
                            : t('printLayoutBalancedDescription')}
                </p>
            </fieldset>

            {layoutPreset === PRINT_MAP_LAYOUT_FULL ? (
                <fieldset className="mt-3" data-print-resource-column-controls="true">
                    <legend className="text-sm font-bold text-slate-800">{t('printResourceCardColumns')}</legend>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                        {[2, 3, 4].map((count) => (
                            <ChoiceButton
                                key={count}
                                selected={resourceColumnCount === count}
                                label={String(count)}
                                onClick={() => patchState({ resourceColumnCount: count })}
                            />
                        ))}
                    </div>
                    <p className="mt-1.5 text-xs font-medium leading-4 text-slate-500">
                        {t('printResourceCardColumnsHelp')}
                    </p>
                </fieldset>
            ) : null}

            {layoutPreset !== PRINT_MAP_LAYOUT_FULL ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {layoutPreset === PRINT_MAP_LAYOUT_FOCUS ? (
                        <fieldset>
                            <legend className="text-sm font-bold text-slate-800">{t('printMapPosition')}</legend>
                            <div className="mt-2 grid grid-cols-2 gap-2">
                                <ChoiceButton
                                    selected={mapSide === PRINT_MAP_SIDE_LEFT}
                                    label={t('printMapOnLeft')}
                                    onClick={() => patchState({ mapSide: PRINT_MAP_SIDE_LEFT })}
                                />
                                <ChoiceButton
                                    selected={mapSide === PRINT_MAP_SIDE_RIGHT}
                                    label={t('printMapOnRight')}
                                    onClick={() => patchState({ mapSide: PRINT_MAP_SIDE_RIGHT })}
                                />
                            </div>
                        </fieldset>
                    ) : null}

                    <fieldset data-print-map-width-controls="true">
                        <legend className="text-sm font-bold text-slate-800">{t('printMapWidth')}</legend>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                            <ChoiceButton
                                selected={mapWidth === PRINT_MAP_WIDTH_WIDE}
                                label={t('printMapWidthWide')}
                                onClick={() => patchState({ mapWidth: PRINT_MAP_WIDTH_WIDE })}
                            />
                            <ChoiceButton
                                selected={mapWidth === PRINT_MAP_WIDTH_EXTRA_WIDE}
                                label={t('printMapWidthExtraWide')}
                                onClick={() => patchState({ mapWidth: PRINT_MAP_WIDTH_EXTRA_WIDE })}
                            />
                        </div>
                    </fieldset>
                </div>
            ) : null}

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <fieldset data-print-resource-layer-controls="true">
                    <legend className="text-sm font-bold text-slate-800">{t('printResourcePins')}</legend>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                        <ChoiceButton
                            selected={resourceLayer === PRINT_MAP_RESOURCE_LAYER_SHOW}
                            label={t('printResourcePinsShow')}
                            onClick={() => patchState({ resourceLayer: PRINT_MAP_RESOURCE_LAYER_SHOW })}
                        />
                        <ChoiceButton
                            selected={resourceLayer === PRINT_MAP_RESOURCE_LAYER_HIDE}
                            label={t('printResourcePinsHide')}
                            onClick={() => patchState({ resourceLayer: PRINT_MAP_RESOURCE_LAYER_HIDE })}
                        />
                    </div>
                    <p className="mt-1.5 text-xs font-medium leading-4 text-slate-500">
                        {t('printResourcePinsHelp')}
                    </p>
                </fieldset>
                <fieldset>
                    <legend className="text-sm font-bold text-slate-800">{t('printLabelDetail')}</legend>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                        {labelOptions.map((option) => (
                            <ChoiceButton
                                key={option.value}
                                selected={labelDetail === option.value}
                                label={option.label}
                                onClick={() => patchState({ labelDetail: option.value })}
                            />
                        ))}
                    </div>
                    <p className="mt-1.5 text-xs font-medium leading-4 text-slate-500">
                        {t('printLabelDetailHelp')}
                    </p>
                </fieldset>
            </div>
        </section>
    );
}
