import { Link } from 'react-router-dom';
import { ArrowRight, Clock3, Map, Pencil, Trash2 } from 'lucide-react';

function formatUpdatedAt(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    return new Intl.DateTimeFormat('en-SG', {
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
    const updatedAt = formatUpdatedAt(map.updatedAt);

    return (
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
            <div className="flex h-full flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <span className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700">
                            <Map size={12} />
                            My Map
                        </span>
                        <h2 className="mt-3 text-lg font-bold leading-snug text-slate-900">
                            {map.name}
                        </h2>
                    </div>
                    {updatedAt ? (
                        <span className="inline-flex flex-shrink-0 items-center gap-1 text-xs font-medium text-slate-400">
                            <Clock3 size={13} />
                            Updated {updatedAt}
                        </span>
                    ) : null}
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3.5 py-3">
                    <p className="text-sm font-medium text-slate-700">
                        {map.assetCount} {map.assetCount === 1 ? 'asset' : 'assets'}
                    </p>
                </div>

                <div className="mt-auto flex flex-col gap-2 sm:flex-row">
                    <Link to={`/my-directory/maps/${map.id}`} className="btn-primary flex-1 justify-center">
                        Open map
                        <ArrowRight size={16} />
                    </Link>
                    <button
                        type="button"
                        onClick={() => onRename?.(map)}
                        className="btn-ghost flex-1 justify-center border border-slate-200 text-slate-700"
                    >
                        <Pencil size={16} />
                        Rename
                    </button>
                    <button
                        type="button"
                        onClick={() => onDelete?.(map)}
                        disabled={deleting}
                        className="btn-ghost flex-1 justify-center border border-slate-200 text-slate-700 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-wait disabled:opacity-70"
                    >
                        <Trash2 size={16} />
                        {deleting ? 'Deleting…' : 'Delete'}
                    </button>
                </div>
            </div>
        </article>
    );
}
