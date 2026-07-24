import { useEffect, useMemo, useState } from 'react';
import { Archive, ArrowDown, ArrowUp, Pencil, Plus, RotateCcw, X } from 'lucide-react';

import { createSavedPlacePinIcon } from '../../features/discover/discoverUtils.js';
import { api } from '../../lib/api.js';
import {
    PERSONAL_PLACE_COLOR_OPTIONS,
    PERSONAL_PLACE_ICON_OPTIONS,
    PersonalPlaceCategoryIcon,
    createPersonalPlaceIconDataUrl,
} from '../../lib/personalPlaceCategories.jsx';
import ImageUpload from '../ImageUpload.jsx';

const EMPTY_FORM = {
    id: null,
    name: '',
    iconKey: PERSONAL_PLACE_ICON_OPTIONS[0].key,
    iconUrl: '',
    color: PERSONAL_PLACE_COLOR_OPTIONS[0],
};
const PERSONAL_CATEGORY_ICON_ACCEPT = {
    'image/jpeg': [],
    'image/png': [],
    'image/webp': [],
};
const PERSONAL_CATEGORY_ICON_MAX_BYTES = 2 * 1024 * 1024;

function normalizePreviewColor(value) {
    return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : PERSONAL_PLACE_COLOR_OPTIONS[0];
}

function buildPersonalPlacePinPreviewHtml(category = {}) {
    const color = normalizePreviewColor(category.color);
    return createSavedPlacePinIcon({
        count: 1,
        emphasis: 'default',
        tone: 'saved',
        iconUrl: category.iconUrl || createPersonalPlaceIconDataUrl(category.iconKey, { color }),
        color,
    }).options.html;
}

function CategoryBadgePreview({
    name,
    iconKey,
    iconUrl,
    color,
    compact = false,
}) {
    const accent = normalizePreviewColor(color);
    const label = String(name || '').trim() || 'Category preview';

    return (
        <div className="flex min-w-0 items-center gap-2">
            <span
                className={`inline-flex flex-shrink-0 items-center justify-center rounded-full border bg-white ${
                    compact ? 'h-8 w-8' : 'h-9 w-9'
                }`}
                style={{
                    borderColor: `${accent}88`,
                    boxShadow: `0 0 0 2px ${accent}1F`,
                    color: accent,
                }}
                aria-hidden="true"
            >
                <PersonalPlaceCategoryIcon
                    iconKey={iconKey}
                    iconUrl={iconUrl}
                    size={compact ? 15 : 18}
                    strokeWidth={2.4}
                />
            </span>
            <span
                className={`min-w-0 truncate rounded-full border font-black uppercase text-[0.6875rem] ${
                    compact ? 'px-2.5 py-1' : 'px-3 py-1.5'
                }`}
                style={{
                    borderColor: `${accent}55`,
                    backgroundColor: `${accent}14`,
                    color: accent,
                }}
                title={label}
            >
                {label}
            </span>
        </div>
    );
}

function CategoryForm({ initialValue, busy, onCancel, onSubmit }) {
    const [form, setForm] = useState(EMPTY_FORM);
    const pinPreviewHtml = useMemo(() => buildPersonalPlacePinPreviewHtml(form), [form]);

    useEffect(() => {
        setForm(initialValue ? {
            id: initialValue.id,
            name: initialValue.name || '',
            iconKey: initialValue.iconKey || 'map-pin',
            iconUrl: initialValue.iconUrl || '',
            color: initialValue.color || PERSONAL_PLACE_COLOR_OPTIONS[0],
        } : EMPTY_FORM);
    }, [initialValue]);

    return (
        <form
            className="space-y-4 border-b border-slate-100 bg-slate-50 p-4"
            onSubmit={(event) => {
                event.preventDefault();
                if (!form.name.trim() || busy) return;
                onSubmit?.({
                    id: form.id,
                    name: form.name.trim(),
                    iconKey: form.iconKey,
                    iconUrl: form.iconUrl || null,
                    color: form.color,
                });
            }}
        >
            <label className="block space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Category name</span>
                <input
                    type="text"
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    maxLength={120}
                    required
                    className="input-field min-h-11"
                    placeholder="e.g. Pharmacy"
                />
            </label>

            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">
                <div className="space-y-4">
                    <fieldset>
                        <legend className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Pin icon</legend>
                        <div className="mt-2 grid grid-cols-6 gap-2">
                            {PERSONAL_PLACE_ICON_OPTIONS.map((option) => {
                                const selected = form.iconKey === option.key;
                                return (
                                    <button
                                        key={option.key}
                                        type="button"
                                        onClick={() => setForm((current) => ({
                                            ...current,
                                            iconKey: option.key,
                                            iconUrl: '',
                                        }))}
                                        className={`inline-flex h-11 items-center justify-center rounded-xl border transition ${
                                            selected
                                                ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-100'
                                                : 'border-slate-200 bg-white text-slate-500 hover:border-brand-200'
                                        }`}
                                        aria-label={option.label}
                                        title={option.label}
                                    >
                                        <PersonalPlaceCategoryIcon iconKey={option.key} size={18} />
                                    </button>
                                );
                            })}
                        </div>
                    </fieldset>

                    <ImageUpload
                        label="Upload custom icon"
                        value={form.iconUrl}
                        onChange={(iconUrl) => setForm((current) => ({ ...current, iconUrl }))}
                        uploadFile={api.uploadPersonalPlaceCategoryIcon}
                        accept={PERSONAL_CATEGORY_ICON_ACCEPT}
                        maxSize={PERSONAL_CATEGORY_ICON_MAX_BYTES}
                    />

                    <fieldset>
                        <legend className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Badge</legend>
                        <div className="mt-2 flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3">
                            <input
                                type="color"
                                value={form.color}
                                onChange={(event) => setForm((current) => ({ ...current, color: event.target.value.toUpperCase() }))}
                                className="h-8 w-8 cursor-pointer overflow-hidden rounded border-0 p-0"
                                aria-label="Badge colour"
                            />
                            <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: form.color }} />
                            <span className="truncate font-mono text-xs uppercase text-slate-500">{form.color}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {PERSONAL_PLACE_COLOR_OPTIONS.map((color) => (
                                <button
                                    key={color}
                                    type="button"
                                    onClick={() => setForm((current) => ({ ...current, color }))}
                                    className={`h-8 w-8 rounded-full border-2 border-white shadow-sm ring-offset-2 transition ${
                                        form.color === color ? 'ring-2 ring-slate-900' : 'ring-1 ring-slate-200'
                                    }`}
                                    style={{ backgroundColor: color }}
                                    aria-label={`Use colour ${color}`}
                                    title={color}
                                />
                            ))}
                        </div>
                    </fieldset>
                </div>

                <div className="border-t border-slate-200 pt-4 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Preview</p>
                    <div className="mt-3">
                        <CategoryBadgePreview
                            name={form.name}
                            iconKey={form.iconKey}
                            iconUrl={form.iconUrl}
                            color={form.color}
                        />
                    </div>
                    <div className="mt-4 flex items-start gap-3">
                        <div className="relative h-16 w-12 flex-shrink-0 overflow-visible" aria-hidden="true">
                            <div
                                className="origin-top-left"
                                style={{ transform: 'scale(0.78)' }}
                                dangerouslySetInnerHTML={{ __html: pinPreviewHtml }}
                            />
                        </div>
                        <p className="pt-1 text-xs font-semibold leading-5 text-slate-500">
                            Badge and pin update on every map using this category.
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-2">
                {initialValue ? (
                    <button type="button" onClick={onCancel} className="btn-ghost min-h-11 border border-slate-200 px-4">
                        Cancel
                    </button>
                ) : null}
                <button type="submit" disabled={!form.name.trim() || busy} className="btn-primary min-h-11 px-4 disabled:opacity-60">
                    {busy ? 'Saving...' : initialValue ? 'Save category' : 'Add category'}
                </button>
            </div>
        </form>
    );
}

export default function PersonalPlaceCategoryManagerModal({
    open,
    categories = [],
    busy = false,
    error = '',
    onClose,
    onCreate,
    onUpdate,
}) {
    const [editing, setEditing] = useState(null);

    useEffect(() => {
        if (!open) setEditing(null);
    }, [open]);

    if (!open) return null;

    const sortedCategories = [...categories].sort((left, right) => (
        Number(left.sortOrder || 0) - Number(right.sortOrder || 0)
        || left.name.localeCompare(right.name)
    ));

    async function moveCategory(category, direction) {
        const index = sortedCategories.findIndex((item) => item.id === category.id);
        const swapIndex = index + direction;
        if (index < 0 || swapIndex < 0 || swapIndex >= sortedCategories.length) return;
        const swap = sortedCategories[swapIndex];
        await onUpdate?.(category.id, { sortOrder: Number(swap.sortOrder || swapIndex) });
        await onUpdate?.(swap.id, { sortOrder: Number(category.sortOrder || index) });
    }

    return (
        <div className="fixed inset-0 z-[1500] flex items-end bg-slate-950/45 sm:items-center sm:justify-center sm:p-6" role="presentation">
            <section className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:max-w-2xl sm:rounded-[28px]" role="dialog" aria-modal="true" aria-label="Manage personal place categories">
                <header className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                        <Plus size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-base font-black text-slate-900">Personal place categories</h2>
                        <p className="mt-0.5 text-xs font-semibold text-slate-500">Badge colour and pin icon update everywhere the category is used.</p>
                    </div>
                    <button type="button" onClick={onClose} disabled={busy} className="inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100" aria-label="Close">
                        <X size={19} />
                    </button>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto">
                    <CategoryForm
                        initialValue={editing}
                        busy={busy}
                        onCancel={() => setEditing(null)}
                        onSubmit={async (values) => {
                            if (values.id) {
                                await onUpdate?.(values.id, values);
                                setEditing(null);
                            } else {
                                await onCreate?.(values);
                            }
                        }}
                    />

                    <div className="p-4">
                        {error ? <p className="mb-3 text-sm font-semibold text-red-600">{error}</p> : null}
                        <div className="space-y-2">
                            {sortedCategories.map((category, index) => (
                                <div key={category.id} className={`flex items-center gap-3 rounded-xl border p-3 ${category.isArchived ? 'border-slate-200 bg-slate-50 opacity-65' : 'border-slate-200 bg-white'}`}>
                                    <span className="min-w-0 flex-1">
                                        <CategoryBadgePreview
                                            name={category.name}
                                            iconKey={category.iconKey}
                                            iconUrl={category.iconUrl}
                                            color={category.color}
                                            compact
                                        />
                                        <span className="mt-1.5 block pl-10 text-xs font-semibold text-slate-500">
                                            {category.isArchived ? 'Archived' : 'Active'}
                                        </span>
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <button type="button" onClick={() => moveCategory(category, -1)} disabled={busy || index === 0} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label={`Move ${category.name} up`} title="Move up">
                                            <ArrowUp size={16} />
                                        </button>
                                        <button type="button" onClick={() => moveCategory(category, 1)} disabled={busy || index === sortedCategories.length - 1} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label={`Move ${category.name} down`} title="Move down">
                                            <ArrowDown size={16} />
                                        </button>
                                        <button type="button" onClick={() => setEditing(category)} disabled={busy} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label={`Edit ${category.name}`} title="Edit">
                                            <Pencil size={16} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onUpdate?.(category.id, { isArchived: !category.isArchived })}
                                            disabled={busy}
                                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                                            aria-label={`${category.isArchived ? 'Restore' : 'Archive'} ${category.name}`}
                                            title={category.isArchived ? 'Restore' : 'Archive'}
                                        >
                                            {category.isArchived ? <RotateCcw size={16} /> : <Archive size={16} />}
                                        </button>
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
