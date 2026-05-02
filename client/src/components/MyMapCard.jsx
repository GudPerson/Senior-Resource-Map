import { Link } from 'react-router-dom';
import { ArrowRight, Clock3, Map, Pencil, Trash2 } from 'lucide-react';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { getIntlLocale } from '../lib/i18n.js';

function formatUpdatedAt(value, locale) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    return new Intl.DateTimeFormat(getIntlLocale(locale), {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    }).format(date);
}

export default function MyMapCard({
    map,
    onRename,
    onDelete,
    deleting = false,
}) {
    const { locale, t } = useLocale();
    const updatedAt = formatUpdatedAt(map.updatedAt, locale);

    return (
        <article className="group relative flex flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-500/10">
            <div className="mb-4 flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-brand-50 px-3 text-[10px] font-bold uppercase tracking-wider text-brand-700">
                            <Map size={12} strokeWidth={2.5} />
                            {t('collection')}
                        </span>
                        {updatedAt && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                • {updatedAt}
                            </span>
                        )}
                    </div>
                    <h2 className="mt-4 line-clamp-2 text-xl font-bold leading-tight tracking-tight text-slate-900 group-hover:text-brand-600 transition-colors">
                        {map.name}
                    </h2>
                </div>
            </div>

            <div className="mb-6 flex items-center gap-3 rounded-2xl bg-slate-50 p-4 transition-colors group-hover:bg-brand-50/50">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-100">
                    <ArrowRight size={18} className="text-brand-600" />
                </div>
                <div>
                    <p className="text-sm font-bold text-slate-900">
                        {map.assetCount} {map.assetCount === 1 ? t('resource') : t('resources')}
                    </p>
                    <p className="text-xs font-medium text-slate-500">{t('curatedSet')}</p>
                </div>
            </div>

            <div className="mt-auto grid grid-cols-1 gap-2">
                <Link
                    to={`/my-directory/maps/${map.id}`}
                    className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-brand-600 px-4 text-sm font-bold text-white shadow-lg shadow-brand-200 transition-all hover:bg-brand-700 hover:shadow-xl hover:shadow-brand-300 active:scale-[0.98]"
                >
                    <ArrowRight size={18} />
                    {t('openMap')}
                </Link>
                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() => onRename?.(map)}
                        className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 transition-all hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98]"
                    >
                        <Pencil size={14} />
                        {t('rename')}
                    </button>
                    <button
                        type="button"
                        onClick={() => onDelete?.(map)}
                        disabled={deleting}
                        className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-wait disabled:opacity-50 active:scale-[0.98]"
                    >
                        <Trash2 size={14} />
                        {deleting ? t('wait') : t('delete')}
                    </button>
                </div>
            </div>
        </article>
    );
}
