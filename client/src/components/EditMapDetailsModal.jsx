import { useEffect, useState } from 'react';
import { Pencil, X } from 'lucide-react';
import { useLocale } from '../contexts/LocaleContext.jsx';

export default function EditMapDetailsModal({
    isOpen,
    map,
    submitting = false,
    error = '',
    onClose,
    onSubmit,
}) {
    const { t } = useLocale();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        setName(map?.name || '');
        setDescription(map?.description || '');
    }, [isOpen, map?.description, map?.name]);

    if (!isOpen || !map) return null;

    const canSubmit = !submitting && Boolean(name.trim());

    async function handleSubmit(event) {
        event.preventDefault();
        if (!canSubmit) return;
        await onSubmit?.({
            name: name.trim(),
            description: description.trim() || null,
        });
    }

    return (
        <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-start justify-between border-b border-slate-100 px-5 py-5 sm:px-6">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">{t('mapDetails')}</p>
                        <h2 className="mt-2 text-2xl font-bold text-slate-900">{t('updateDirectoryTitleDescription')}</h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                        aria-label={t('close')}
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5 px-5 py-5 sm:px-6">
                    <div>
                        <label htmlFor="edit-map-name" className="block text-sm font-semibold text-slate-700">
                            {t('directoryTitle')}
                        </label>
                        <input
                            id="edit-map-name"
                            type="text"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                            maxLength={255}
                            autoFocus
                        />
                    </div>

                    <div>
                        <label htmlFor="edit-map-description" className="block text-sm font-semibold text-slate-700">
                            {t('descriptionOrSubtitle')}
                        </label>
                        <textarea
                            id="edit-map-description"
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            placeholder={t('mapDescriptionPlaceholder')}
                            className="mt-2 min-h-[132px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                            maxLength={500}
                        />
                        <p className="mt-2 text-xs text-slate-400">
                            {description.trim().length}/500
                        </p>
                    </div>

                    {error ? (
                        <p className="text-sm font-medium text-red-600">{error}</p>
                    ) : null}

                    <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                        <button type="button" onClick={onClose} className="btn-ghost justify-center">
                            {t('cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={!canSubmit}
                            className="btn-primary justify-center disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {submitting ? t('saving') : (
                                <>
                                    <Pencil size={16} />
                                    {t('saveDetails')}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
