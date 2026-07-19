import { X } from 'lucide-react';

import { useLocale } from '../contexts/LocaleContext.jsx';
import {
    PRINT_MAP_LABEL_DETAIL_FULL,
    PRINT_MAP_LABEL_DETAIL_LOGOS,
    PRINT_MAP_LABEL_DETAIL_NAMES,
    PRINT_MAP_LABEL_DETAIL_NAMES_ADDRESSES,
    PRINT_MAP_LAYOUT_BALANCED,
    PRINT_MAP_LAYOUT_FOCUS,
    PRINT_MAP_SIDE_LEFT,
    PRINT_MAP_SIDE_RIGHT,
    PRINT_MAP_WIDTH_EXTRA_WIDE,
    PRINT_MAP_WIDTH_WIDE,
    normalizePrintMapLabelDetail,
    normalizePrintMapLayoutPreset,
    normalizePrintMapSide,
    normalizePrintMapWidth,
} from '../lib/printMapState.js';

function ChoiceButton({ selected, label, description = '', onClick }) {
    return (
        <button
            type="button"
            aria-pressed={selected}
            onClick={onClick}
            className={`min-h-11 rounded-xl border px-3 py-2 text-left transition focus:outline-none focus:ring-4 focus:ring-brand-100 ${
                selected
                    ? 'border-brand-600 bg-brand-700 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-brand-200 hover:bg-brand-50'
            }`}
        >
            <span className="block text-sm font-bold leading-5">{label}</span>
            {description ? (
                <span className={`mt-0.5 block text-xs leading-4 ${selected ? 'text-white/80' : 'text-slate-500'}`}>
                    {description}
                </span>
            ) : null}
        </button>
    );
}

export default function PrintLayoutControls({ value, onChange, onClose }) {
    const { t } = useLocale();
    const layoutPreset = normalizePrintMapLayoutPreset(value?.layoutPreset);
    const mapSide = normalizePrintMapSide(value?.mapSide);
    const mapWidth = normalizePrintMapWidth(value?.mapWidth);
    const labelDetail = normalizePrintMapLabelDetail(value?.labelDetail);
    const patchState = (patch) => onChange?.((current) => ({ ...current, ...patch }));

    const labelOptions = [
        { value: PRINT_MAP_LABEL_DETAIL_NAMES, label: t('printLabelNamesOnly') },
        { value: PRINT_MAP_LABEL_DETAIL_LOGOS, label: t('printLabelNamesLogos') },
        { value: PRINT_MAP_LABEL_DETAIL_NAMES_ADDRESSES, label: t('printLabelNamesAddresses') },
        { value: PRINT_MAP_LABEL_DETAIL_FULL, label: t('printLabelFullDetails') },
    ];

    return (
        <section
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm sm:p-5"
            aria-labelledby="print-layout-heading"
            data-print-layout-controls="true"
        >
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 id="print-layout-heading" className="text-base font-black text-slate-900">
                        {t('printLayout')}
                    </h2>
                    <p className="mt-1 text-sm leading-5 text-slate-600">
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

            <fieldset className="mt-4">
                <legend className="text-sm font-bold text-slate-800">{t('printLayoutType')}</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <ChoiceButton
                        selected={layoutPreset === PRINT_MAP_LAYOUT_BALANCED}
                        label={t('printLayoutBalanced')}
                        description={t('printLayoutBalancedDescription')}
                        onClick={() => patchState({ layoutPreset: PRINT_MAP_LAYOUT_BALANCED })}
                    />
                    <ChoiceButton
                        selected={layoutPreset === PRINT_MAP_LAYOUT_FOCUS}
                        label={t('printLayoutMapFocus')}
                        description={t('printLayoutMapFocusDescription')}
                        onClick={() => patchState({ layoutPreset: PRINT_MAP_LAYOUT_FOCUS })}
                    />
                </div>
            </fieldset>

            <div className={`mt-4 grid gap-4 ${layoutPreset === PRINT_MAP_LAYOUT_FOCUS ? 'lg:grid-cols-2' : ''}`}>
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

            <fieldset className="mt-4">
                <legend className="text-sm font-bold text-slate-800">{t('printLabelDetail')}</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {labelOptions.map((option) => (
                        <ChoiceButton
                            key={option.value}
                            selected={labelDetail === option.value}
                            label={option.label}
                            onClick={() => patchState({ labelDetail: option.value })}
                        />
                    ))}
                </div>
                <p className="mt-2 text-xs font-medium leading-5 text-slate-500">
                    {t('printLabelDetailHelp')}
                </p>
            </fieldset>
        </section>
    );
}
