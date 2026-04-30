import { getProfileFieldLabel } from './profileAttributes.js';

export const OFFERING_ACCESS = {
    GRANTED: 'GRANTED',
    DENIED: 'DENIED',
    LOCKED_MISSING_DATA: 'LOCKED_MISSING_DATA',
};

function normalizeRange(range) {
    if (!range || typeof range !== 'object') return null;
    const min = Number.parseInt(range.min, 10);
    const max = Number.parseInt(range.max, 10);
    const normalized = {};
    if (Number.isInteger(min) && min >= 0) normalized.min = min;
    if (Number.isInteger(max) && max >= 0) normalized.max = max;
    return Object.keys(normalized).length ? normalized : null;
}

function normalizeAnyOf(entry) {
    if (!entry || typeof entry !== 'object') return null;
    const values = Array.isArray(entry.anyOf)
        ? [...new Set(entry.anyOf.map((value) => String(value || '').trim().toLowerCase()).filter(Boolean))]
        : [];
    return values.length ? { anyOf: values } : null;
}

export function normalizeEligibilityRules(rawRules) {
    if (!rawRules || typeof rawRules !== 'object') return null;
    const criteria = rawRules.criteria && typeof rawRules.criteria === 'object'
        ? rawRules.criteria
        : {};

    const normalizedCriteria = {};
    const age = normalizeRange(criteria.age);
    const gender = normalizeAnyOf(criteria.gender);
    const chasCard = normalizeAnyOf(criteria.chasCard);
    const caregiverStatus = normalizeAnyOf(criteria.caregiverStatus);
    const propertyType = normalizeAnyOf(criteria.propertyType);
    const volunteerInterest = normalizeAnyOf(criteria.volunteerInterest);

    if (age) normalizedCriteria.age = age;
    if (gender) normalizedCriteria.gender = gender;
    if (chasCard) normalizedCriteria.chasCard = chasCard;
    if (caregiverStatus) normalizedCriteria.caregiverStatus = caregiverStatus;
    if (propertyType) normalizedCriteria.propertyType = propertyType;
    if (volunteerInterest) normalizedCriteria.volunteerInterest = volunteerInterest;

    if (!Object.keys(normalizedCriteria).length) {
        return null;
    }

    return {
        version: 1,
        criteria: normalizedCriteria,
    };
}

export function summarizeEligibilityRules(rules) {
    const normalized = normalizeEligibilityRules(rules);
    if (!normalized) return [];

    const criteria = normalized.criteria || {};
    const summary = [];

    if (criteria.age?.min !== undefined || criteria.age?.max !== undefined) {
        if (criteria.age.min !== undefined && criteria.age.max !== undefined) {
            summary.push(`Age ${criteria.age.min}-${criteria.age.max}`);
        } else if (criteria.age.min !== undefined) {
            summary.push(`Age ${criteria.age.min}+`);
        } else if (criteria.age.max !== undefined) {
            summary.push(`Age up to ${criteria.age.max}`);
        }
    }

    if (criteria.gender?.anyOf?.length) {
        summary.push(`Gender: ${criteria.gender.anyOf.join(', ')}`);
    }

    if (criteria.chasCard?.anyOf?.length) {
        summary.push(`CHAS card: ${criteria.chasCard.anyOf.join(', ')}`);
    }

    if (criteria.caregiverStatus?.anyOf?.length) {
        summary.push(`Caregiver: ${criteria.caregiverStatus.anyOf.join(', ')}`);
    }

    if (criteria.propertyType?.anyOf?.length) {
        summary.push(`Property type: ${criteria.propertyType.anyOf.join(', ')}`);
    }

    if (criteria.volunteerInterest?.anyOf?.length) {
        summary.push(`Volunteer interest: ${criteria.volunteerInterest.anyOf.join(', ')}`);
    }

    return summary;
}

export function formatMissingProfileFields(fields = []) {
    const labels = [...new Set((fields || []).map((field) => getProfileFieldLabel(field)))];
    if (!labels.length) return '';
    if (labels.length === 1) return labels[0];
    if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
    return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}
