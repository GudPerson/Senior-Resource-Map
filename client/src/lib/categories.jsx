import { Building2, CalendarDays } from 'lucide-react';

export function CategoryBadge({ category }) {
    if (!category) return null;

    // Normalize string to match "Places" or "Offerings" or "hard" or "soft"
    const isHard = category.toLowerCase() === 'places' || category.toLowerCase() === 'hard';
    const isSoft = category.toLowerCase() === 'offerings' || category.toLowerCase() === 'soft';

    if (isHard) {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-bold border border-emerald-200">
                <Building2 size={14} /> Place
            </span>
        );
    }

    if (isSoft) {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 text-sm font-bold border border-sky-200">
                <CalendarDays size={14} /> Offering
            </span>
        );
    }

    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 text-slate-700 text-sm font-bold border border-slate-200">
            {category}
        </span>
    );
}
