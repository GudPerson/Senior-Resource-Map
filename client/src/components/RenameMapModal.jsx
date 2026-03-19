import { useEffect, useState } from 'react';
import { Pencil, X } from 'lucide-react';

export default function RenameMapModal({
    isOpen,
    map,
    submitting = false,
    error = '',
    onClose,
    onSubmit,
}) {
    const [name, setName] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        setName(map?.name || '');
    }, [isOpen, map?.name]);

    if (!isOpen || !map) return null;

    const canSubmit = !submitting && Boolean(name.trim());

    async function handleSubmit(event) {
        event.preventDefault();
        if (!canSubmit) return;
        await onSubmit?.(name.trim());
    }

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-[28px] border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-start justify-between border-b border-slate-100 px-5 py-5 sm:px-6">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">Rename map</p>
                        <h2 className="mt-2 text-2xl font-bold text-slate-900">Update this map name</h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="px-5 py-5 sm:px-6">
                    <label htmlFor="rename-map-name" className="block text-sm font-semibold text-slate-700">
                        Map name
                    </label>
                    <input
                        id="rename-map-name"
                        type="text"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                        maxLength={255}
                        autoFocus
                    />

                    {error ? (
                        <p className="mt-4 text-sm font-medium text-red-600">{error}</p>
                    ) : null}

                    <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                        <button type="button" onClick={onClose} className="btn-ghost justify-center">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!canSubmit}
                            className="btn-primary justify-center disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {submitting ? 'Saving…' : (
                                <>
                                    <Pencil size={16} />
                                    Save name
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
