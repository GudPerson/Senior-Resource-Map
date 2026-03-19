import { Link } from 'react-router-dom';
import { BookOpen, Compass, SearchX } from 'lucide-react';

function getStateCopy(mode) {
    if (mode === 'no-results') {
        return {
            icon: SearchX,
            title: 'No saved assets match your search',
            description: 'Try a different search term or clear it to see all of your saved resources.',
        };
    }

    return {
        icon: BookOpen,
        title: 'No saved assets yet',
        description: 'Save places and offerings from Discover to build your personal directory.',
    };
}

export default function SavedAssetsEmptyState({
    mode = 'empty',
    searchTerm = '',
    onClearSearch,
}) {
    const copy = getStateCopy(mode);
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
                    Clear search
                </button>
            ) : (
                <Link to="/discover" className="btn-primary mt-6 inline-flex justify-center">
                    <Compass size={16} />
                    Back to Discover
                </Link>
            )}
        </div>
    );
}
