import { Link } from 'react-router-dom';
import { BookOpen, Compass, SearchX } from 'lucide-react';
import { useLocale } from '../contexts/LocaleContext.jsx';

function getStateCopy(mode, t) {
    if (mode === 'no-results') {
        return {
            icon: SearchX,
            title: t('noSavedResultsTitle'),
            description: t('noSavedResultsDescription'),
        };
    }

    return {
        icon: BookOpen,
        title: t('noSavedResourcesTitle'),
        description: t('noSavedResourcesDescription'),
    };
}

export default function SavedAssetsEmptyState({
    mode = 'empty',
    searchTerm = '',
    onClearSearch,
}) {
    const { t } = useLocale();
    const copy = getStateCopy(mode, t);
    const Icon = copy.icon;

    return (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
                <Icon size={28} />
            </div>
            <h2 className="mt-5 text-xl font-bold text-slate-900">{copy.title}</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
                {copy.description}
            </p>
            {mode === 'no-results' && searchTerm ? (
                <button
                    type="button"
                    onClick={onClearSearch}
                    className="btn-ghost mt-6 inline-flex justify-center"
                >
                    {t('clearSearch')}
                </button>
            ) : (
                <Link to="/discover" className="btn-primary mt-6 inline-flex justify-center">
                    <Compass size={16} />
                    {t('browseResources')}
                </Link>
            )}
        </div>
    );
}
