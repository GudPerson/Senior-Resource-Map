import { useEffect, useState } from 'react';
import { Archive, ArrowDown, ArrowUp, Pencil, Plus, RotateCcw, X } from 'lucide-react';

import {
    PERSONAL_PLACE_COLOR_OPTIONS,
    PERSONAL_PLACE_ICON_OPTIONS,
    PersonalPlaceCategoryIcon,
} from '../../lib/personalPlaceCategories.jsx';

const EMPTY_FORM = {
    id: null,
    name: '',
    iconKey: PERSONAL_PLACE_ICON_OPTIONS[0].key,
    color: PERSONAL_PLACE_COLOR_OPTIONS[0],
};

function CategoryForm({ initialValue, busy, onCancel, onSubmit }) {
    const [form, setForm] = useState(EMPTY_FORM);

    useEffect(() => {
        setForm(initialValue ? {
            id: initialValue.id,
            name: initialValue.name || '',
            iconKey: initialValue.iconKey || 'map-pin',
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

            <fieldset>
                <legend className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Icon</legend>
                <div className="mt-2 grid grid-cols-6 gap-2">
                    {PERSONAL_PLACE_ICON_OPTIONS.map((option) => {
                        const selected = form.iconKey === option.key;
                        return (
                            <button
                                key={option.key}
                                type="button"
                                onClick={() => setForm((current) => ({ ...current, iconKey: option.key }))}
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

            <fieldset>
                <legend className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Colour</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                    {PERSONAL_PLACE_COLOR_OPTIONS.map((color) => (
                        <button
                            key={color}
                            type="button"
                            onClick={() => setForm((current) => ({ ...current, color }))}
                            className={`h-9 w-9 rounded-full border-2 border-white shadow-sm ring-offset-2 transition ${
                                form.color === color ? 'ring-2 ring-slate-900' : 'ring-1 ring-slate-200'
                            }`}
                            style={{ backgroundColor: color }}
                            aria-label={`Use colour ${color}`}
                            title={color}
                        />
                    ))}
                </div>
            </fieldset>

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
                        <p className="mt-0.5 text-xs font-semibold text-slate-500">Icons and colours update everywhere the category is used.</p>
                    </div>
                    <button type="button" onClick={onClose} disabled={busy} className="inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100" aria-label="Close">
                        <X size={19} />
                    </button>
                </header>

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

                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                    {error ? <p className="mb-3 text-sm font-semibold text-red-600">{error}</p> : null}
                    <div className="space-y-2">
                        {sortedCategories.map((category, index) => (
                            <div key={category.id} className={`flex items-center gap-3 rounded-xl border p-3 ${category.isArchived ? 'border-slate-200 bg-slate-50 opacity-65' : 'border-slate-200 bg-white'}`}>
                                <span className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundColor: category.color }}>
                                    <PersonalPlaceCategoryIcon iconKey={category.iconKey} size={18} />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-bold text-slate-900">{category.name}</span>
                                    <span className="block text-xs font-semibold text-slate-500">{category.isArchived ? 'Archived' : 'Active'}</span>
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
            </section>
        </div>
    );
}
