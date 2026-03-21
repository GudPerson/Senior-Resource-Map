import { Search, X } from 'lucide-react';

export default function DirectorySearchBar({
    value,
    onChange,
    placeholder = 'Search places, resources, or categories',
    className = '',
}) {
    const hasValue = Boolean(String(value || '').trim());

    return (
        <div className={`rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
            <label htmlFor="directory-search" className="block text-sm font-semibold text-slate-700">
                Search this directory
            </label>
            <div className="relative mt-3">
                <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    id="directory-search"
                    type="search"
                    value={value}
                    onChange={(event) => onChange?.(event.target.value)}
                    placeholder={placeholder}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-12 text-base text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                />
                {hasValue ? (
                    <button
                        type="button"
                        onClick={() => onChange?.('')}
                        className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                        aria-label="Clear directory search"
                    >
                        <X size={16} />
                    </button>
                ) : null}
            </div>
        </div>
    );
}
