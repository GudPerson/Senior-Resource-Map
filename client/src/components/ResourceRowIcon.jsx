import {
    BookOpen,
    Building2,
    CalendarDays,
    Gift,
    HandHeart,
    HeartPulse,
    ShieldPlus,
    Sparkles,
    Stethoscope,
    TicketPercent,
    Users,
} from 'lucide-react';

function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
}

function resolveIcon(resourceType, bucket, subCategory) {
    const normalizedBucket = normalizeText(bucket);
    const normalizedSubCategory = normalizeText(subCategory);

    if (resourceType === 'hard') {
        if (normalizedSubCategory.includes('health')) return Stethoscope;
        if (normalizedSubCategory.includes('community')) return Users;
        return Building2;
    }

    if (normalizedBucket === 'services') {
        if (normalizedSubCategory.includes('health')) return HeartPulse;
        if (normalizedSubCategory.includes('benefit')) return ShieldPlus;
        return HandHeart;
    }

    if (normalizedBucket === 'promotions') {
        if (normalizedSubCategory.includes('benefit')) return TicketPercent;
        return Gift;
    }

    if (normalizedSubCategory.includes('digital')) return Sparkles;
    if (normalizedSubCategory.includes('literacy')) return BookOpen;
    return CalendarDays;
}

export default function ResourceRowIcon({
    resourceType,
    bucket = null,
    subCategory = null,
    className = '',
}) {
    const Icon = resolveIcon(resourceType, bucket, subCategory);

    return (
        <div className={`inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-brand-100 bg-brand-50 text-brand-700 ${className}`}>
            <Icon size={20} />
        </div>
    );
}
