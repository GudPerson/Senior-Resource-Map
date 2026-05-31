import { useEffect, useState } from 'react';
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
    logoUrl = null,
    alt = '',
    className = '',
}) {
    const Icon = resolveIcon(resourceType, bucket, subCategory);
    const [logoFitMode, setLogoFitMode] = useState('cover');
    const [logoFailed, setLogoFailed] = useState(false);
    const shouldShowLogo = Boolean(logoUrl) && !logoFailed;
    const imageClassName = logoFitMode === 'contain'
        ? 'h-full w-full rounded-[inherit] object-contain p-[2px]'
        : 'h-full w-full rounded-[inherit] object-cover';

    useEffect(() => {
        setLogoFitMode('cover');
        setLogoFailed(false);
    }, [logoUrl]);

    return (
        <div className={`inline-flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-brand-100 bg-brand-50 text-brand-700 ${className}`}>
            {shouldShowLogo ? (
                <img
                    src={logoUrl}
                    alt={alt}
                    className={imageClassName}
                    onError={() => setLogoFailed(true)}
                    onLoad={(event) => {
                        const { naturalWidth, naturalHeight } = event.currentTarget;
                        if (!naturalWidth || !naturalHeight) return;
                        const aspectRatio = naturalWidth / naturalHeight;
                        setLogoFitMode(aspectRatio > 1.2 || aspectRatio < 0.84 ? 'contain' : 'cover');
                    }}
                />
            ) : (
                <Icon size={20} />
            )}
        </div>
    );
}
