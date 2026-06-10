export function LoadingState({ label }) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-16">
            <div className="rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
                <div className="flex items-center gap-3 text-sm font-semibold text-slate-600">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
                    {label}
                </div>
            </div>
        </div>
    );
}
