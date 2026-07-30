import { useEffect, useState } from 'react';
import {
    AlignLeft,
    Ban,
    Check,
    Highlighter,
    Palette,
    Plus,
    Trash2,
    X,
} from 'lucide-react';
import { useLocale } from '../contexts/LocaleContext.jsx';
import {
    MAP_SHORT_DESCRIPTOR_DEFAULT_TEXT_COLOR,
    MAP_SHORT_DESCRIPTOR_HIGHLIGHT_COLORS,
    MAP_SHORT_DESCRIPTOR_TEXT_COLORS,
    normalizeMapShortDescriptorItems,
    normalizeMapShortDescriptorColor,
} from '../lib/mapShortDescriptorStyle.js';

const MAX_SHORT_DESCRIPTION_LENGTH = 240;
const MAX_SHORT_DESCRIPTIONS = 20;

function createDescriptionItem(source = {}, index = 0) {
    return {
        clientId: source.clientId || `${source.id || 'new'}-${index}-${Date.now()}-${Math.random()}`,
        id: Number.isInteger(source.id) ? source.id : null,
        text: String(source.text || ''),
        textColor: normalizeMapShortDescriptorColor(
            source.textColor,
            MAP_SHORT_DESCRIPTOR_DEFAULT_TEXT_COLOR,
        ),
        highlightColor: normalizeMapShortDescriptorColor(source.highlightColor, ''),
    };
}

function ColorSwatch({
    color,
    selected,
    label,
    onSelect,
}) {
    return (
        <button
            type="button"
            onClick={() => onSelect(color)}
            className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full border-2 transition ${
                selected
                    ? 'border-slate-900 ring-2 ring-brand-200 ring-offset-2'
                    : 'border-white shadow-[0_0_0_1px_rgba(148,163,184,0.55)] hover:scale-105'
            }`}
            style={{ backgroundColor: color }}
            aria-label={label}
            title={label}
        >
            {selected ? (
                <Check
                    size={15}
                    strokeWidth={3}
                    className={color === '#0F172A' || color === '#334155' || color === '#64748B'
                        ? 'text-white'
                        : 'text-slate-950'}
                    aria-hidden="true"
                />
            ) : null}
        </button>
    );
}

export default function MapAssetShortDescriptionModal({
    open,
    row,
    submitting = false,
    error = '',
    onClose,
    onSubmit,
}) {
    const { t } = useLocale();
    const [items, setItems] = useState([createDescriptionItem()]);

    useEffect(() => {
        if (!open) return;
        const descriptors = normalizeMapShortDescriptorItems(row);
        setItems(
            descriptors.length > 0
                ? descriptors.map(createDescriptionItem)
                : [createDescriptionItem()],
        );
    }, [open, row]);

    if (!open || !row) return null;

    function handleSubmit(event) {
        event.preventDefault();
        if (submitting) return;
        const shortDescriptors = items
            .map((item, index) => ({
                ...(item.id ? { id: item.id } : {}),
                text: item.text.trim(),
                textColor: item.textColor === MAP_SHORT_DESCRIPTOR_DEFAULT_TEXT_COLOR
                    ? null
                    : item.textColor,
                highlightColor: item.highlightColor || null,
                sortOrder: index,
            }))
            .filter((item) => item.text);
        const firstItem = shortDescriptors[0] || null;
        onSubmit?.({
            shortDescriptors,
            shortDescriptor: firstItem?.text || '',
            shortDescriptorTextColor: firstItem?.textColor || null,
            shortDescriptorHighlightColor: firstItem?.highlightColor || null,
        });
    }

    function updateItem(clientId, patch) {
        setItems((currentItems) => currentItems.map((item) => (
            item.clientId === clientId ? { ...item, ...patch } : item
        )));
    }

    function addItem() {
        setItems((currentItems) => (
            currentItems.length >= MAX_SHORT_DESCRIPTIONS
                ? currentItems
                : [...currentItems, createDescriptionItem({}, currentItems.length)]
        ));
    }

    function removeItem(clientId) {
        setItems((currentItems) => {
            const nextItems = currentItems.filter((item) => item.clientId !== clientId);
            return nextItems.length > 0 ? nextItems : [createDescriptionItem()];
        });
    }

    return (
        <div
            className="fixed inset-0 z-[1500] flex items-end bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-6"
            role="presentation"
            onClick={() => {
                if (!submitting) onClose?.();
            }}
        >
            <section
                className="flex max-h-[calc(100svh-1rem)] w-full flex-col rounded-t-[24px] bg-white shadow-2xl sm:max-h-[calc(100svh-3rem)] sm:max-w-lg sm:rounded-[24px]"
                role="dialog"
                aria-modal="true"
                aria-label={`${t('editShortDescription')}: ${row.name}`}
                onClick={(event) => event.stopPropagation()}
            >
                <header className="flex shrink-0 items-center gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
                    <span className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                        <AlignLeft size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-base font-black text-slate-900">{t('personalPlaceShortDescription')}</h2>
                        <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">{row.name}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </header>

                <form onSubmit={handleSubmit} className="overflow-y-auto p-4 sm:p-5">
                    <div className="divide-y divide-slate-200 border-y border-slate-200">
                        {items.map((item, index) => (
                            <section
                                key={item.clientId}
                                className="space-y-4 py-5 first:pt-0 last:pb-0"
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <h3 className="text-sm font-black text-slate-800">
                                        {t('shortDescriptionNumber')} {index + 1}
                                    </h3>
                                    {items.length > 1 ? (
                                        <button
                                            type="button"
                                            onClick={() => removeItem(item.clientId)}
                                            disabled={submitting}
                                            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-red-50 hover:text-red-600"
                                            aria-label={t('removeShortDescription')}
                                            title={t('removeShortDescription')}
                                        >
                                            <Trash2 size={16} aria-hidden="true" />
                                        </button>
                                    ) : null}
                                </div>
                                <label className="block space-y-1.5">
                                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                                        {t('personalPlaceShortDescription')}
                                    </span>
                                    <textarea
                                        value={item.text}
                                        onChange={(event) => updateItem(item.clientId, { text: event.target.value })}
                                        maxLength={MAX_SHORT_DESCRIPTION_LENGTH}
                                        rows={3}
                                        className="input-field min-h-[92px] resize-y"
                                        placeholder={t('personalPlaceShortDescriptionPlaceholder')}
                                        autoFocus={index === 0}
                                    />
                                    <span className="block text-right text-xs font-semibold text-slate-400">
                                        {item.text.length}/{MAX_SHORT_DESCRIPTION_LENGTH}
                                    </span>
                                </label>
                                <fieldset className="space-y-2">
                                    <legend className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                                        <Palette size={14} aria-hidden="true" />
                                        {t('shortDescriptionTextColour')}
                                    </legend>
                                    <div className="flex flex-wrap items-center gap-3">
                                        {MAP_SHORT_DESCRIPTOR_TEXT_COLORS.map((color) => (
                                            <ColorSwatch
                                                key={color}
                                                color={color}
                                                selected={item.textColor === color}
                                                label={`${t('shortDescriptionUseTextColour')} ${color}`}
                                                onSelect={(nextColor) => updateItem(item.clientId, { textColor: nextColor })}
                                            />
                                        ))}
                                        <label className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-600">
                                            <input
                                                type="color"
                                                value={item.textColor}
                                                onChange={(event) => updateItem(item.clientId, {
                                                    textColor: event.target.value.toUpperCase(),
                                                })}
                                                className="h-6 w-6 cursor-pointer border-0 bg-transparent p-0"
                                                aria-label={t('shortDescriptionCustomTextColour')}
                                            />
                                            {item.textColor}
                                        </label>
                                    </div>
                                </fieldset>
                                <fieldset className="space-y-2">
                                    <legend className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                                        <Highlighter size={14} aria-hidden="true" />
                                        {t('shortDescriptionHighlight')}
                                    </legend>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() => updateItem(item.clientId, { highlightColor: '' })}
                                            className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition ${
                                                !item.highlightColor
                                                    ? 'border-slate-900 bg-slate-100 text-slate-700 ring-2 ring-brand-200 ring-offset-2'
                                                    : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50'
                                            }`}
                                            aria-label={t('shortDescriptionNoHighlight')}
                                            title={t('shortDescriptionNoHighlight')}
                                        >
                                            <Ban size={16} aria-hidden="true" />
                                        </button>
                                        {MAP_SHORT_DESCRIPTOR_HIGHLIGHT_COLORS.map((color) => (
                                            <ColorSwatch
                                                key={color}
                                                color={color}
                                                selected={item.highlightColor === color}
                                                label={`${t('shortDescriptionUseHighlightColour')} ${color}`}
                                                onSelect={(nextColor) => updateItem(item.clientId, {
                                                    highlightColor: nextColor,
                                                })}
                                            />
                                        ))}
                                        <label className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-600">
                                            <input
                                                type="color"
                                                value={item.highlightColor || MAP_SHORT_DESCRIPTOR_HIGHLIGHT_COLORS[0]}
                                                onChange={(event) => updateItem(item.clientId, {
                                                    highlightColor: event.target.value.toUpperCase(),
                                                })}
                                                className="h-6 w-6 cursor-pointer border-0 bg-transparent p-0"
                                                aria-label={t('shortDescriptionCustomHighlightColour')}
                                            />
                                            {item.highlightColor || 'None'}
                                        </label>
                                    </div>
                                </fieldset>
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                                        {t('shortDescriptionPreview')}
                                    </p>
                                    <div className="mt-2 min-h-12 border-y border-slate-100 py-3">
                                        <span
                                            className="rounded px-1 py-0.5 text-base font-medium leading-snug"
                                            style={{
                                                color: item.textColor,
                                                ...(item.highlightColor
                                                    ? { backgroundColor: item.highlightColor }
                                                    : {}),
                                                boxDecorationBreak: 'clone',
                                                WebkitBoxDecorationBreak: 'clone',
                                            }}
                                        >
                                            {item.text.trim() || t('personalPlaceShortDescriptionPlaceholder')}
                                        </span>
                                    </div>
                                </div>
                            </section>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={addItem}
                        disabled={submitting || items.length >= MAX_SHORT_DESCRIPTIONS}
                        className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md border border-dashed border-brand-300 px-3 text-sm font-bold text-brand-700 hover:bg-brand-50 disabled:opacity-50"
                    >
                        <Plus size={16} aria-hidden="true" />
                        {t('addAnotherShortDescription')}
                    </button>
                    <div className="mt-5 flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="btn-ghost min-h-11 border border-slate-200 px-4"
                        >
                            {t('cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="btn-primary min-h-11 px-4 disabled:opacity-60"
                        >
                            {submitting ? t('saving') : t('save')}
                        </button>
                    </div>
                    {error ? <p className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}
                </form>
            </section>
        </div>
    );
}
