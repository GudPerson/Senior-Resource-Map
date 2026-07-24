import { useEffect, useState } from 'react';
import { AlignLeft, X } from 'lucide-react';
import { useLocale } from '../contexts/LocaleContext.jsx';

const MAX_SHORT_DESCRIPTION_LENGTH = 240;

export default function MapAssetShortDescriptionModal({
    open,
    row,
    submitting = false,
    error = '',
    onClose,
    onSubmit,
}) {
    const { t } = useLocale();
    const [value, setValue] = useState('');

    useEffect(() => {
        if (!open) return;
        setValue(row?.mapShortDescriptor || '');
    }, [open, row]);

    if (!open || !row) return null;

    function handleSubmit(event) {
        event.preventDefault();
        if (submitting) return;
        onSubmit?.(value.trim());
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
                className="w-full rounded-t-[24px] bg-white shadow-2xl sm:max-w-lg sm:rounded-[24px]"
                role="dialog"
                aria-modal="true"
                aria-label={`${t('editShortDescription')}: ${row.name}`}
                onClick={(event) => event.stopPropagation()}
            >
                <header className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
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

                <form onSubmit={handleSubmit} className="space-y-4 p-4 sm:p-5">
                    <label className="block space-y-1.5">
                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                            {t('personalPlaceShortDescription')}
                        </span>
                        <textarea
                            value={value}
                            onChange={(event) => setValue(event.target.value)}
                            maxLength={MAX_SHORT_DESCRIPTION_LENGTH}
                            rows={3}
                            className="input-field min-h-[92px] resize-y"
                            placeholder={t('personalPlaceShortDescriptionPlaceholder')}
                            autoFocus
                        />
                    </label>
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-slate-400">
                            {value.length}/{MAX_SHORT_DESCRIPTION_LENGTH}
                        </span>
                        <div className="flex gap-2">
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
                    </div>
                    {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
                </form>
            </section>
        </div>
    );
}
