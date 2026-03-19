import { Compass, Map } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function MyMapsEmptyState({
    hasSavedAssets = false,
    onCreate,
}) {
    return (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
                <Map size={28} />
            </div>
            <h2 className="mt-5 text-xl font-bold text-slate-900">No maps yet</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
                {hasSavedAssets
                    ? 'Create a named map from your saved assets to keep related resources together.'
                    : 'Save a few places or offerings first, then group them into a private map here.'}
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <button
                    type="button"
                    onClick={onCreate}
                    className="btn-primary inline-flex justify-center"
                >
                    Create My Map
                </button>
                {!hasSavedAssets ? (
                    <Link to="/discover" className="btn-ghost inline-flex justify-center">
                        <Compass size={16} />
                        Back to Discover
                    </Link>
                ) : null}
            </div>
        </div>
    );
}
