import { buildSchedulePlanForm, schedulePlanToApi } from '../../lib/offeringSchedule.js';

export const GUIDE_VISIBILITY_LABELS = {
    hidden: 'Hidden from directory; people with permitted access may still see it',
    public: 'Public directory listing, subject to CareAround access and publishing rules',
};

export function isProgrammeCreationRequest(value) {
    const request = String(value || '').trim();
    if (/\bstandalone\b|\b(?:without|no|not|unlinked|unattached)\b.{0,45}\b(?:places?|centres?|centers?|hosts?)\b/i.test(request)) return false;
    if (/\b(?:several|multiple|two|many|more\s+than\s+one)\s+(?:places?|centres?|centers?|hosts?)\b/i.test(request)) return false;
    return /^(?:(?:please|can you|could you|would you|i want to|i need to|i would like to|i'd like to|help me|let's|lets)\s+)*(?:create|add|draft|make|set\s+up|start)\b.{0,140}\b(?:programmes?|programs?|services?)\b/i.test(request);
}

// Only the defined creation fields cross the action boundary. Local editor state
// retains incomplete dates until the user has finished entering them.
export function programmeDraftFromApi(draft = {}) {
    return {
        name: draft.name || '', description: draft.description || '', schedule: draft.schedule || '',
        contactPhone: draft.contactPhone || '', contactEmail: draft.contactEmail || '',
        bucket: draft.bucket === 'Services' ? 'Services' : 'Programmes',
        locationId: draft.locationId || null, visibility: draft.visibility === 'public' ? 'public' : 'hidden',
        schedulePlan: buildSchedulePlanForm({ schedulePlan: draft.schedulePlan || { enabled: false, entries: [] } }),
    };
}

export function programmeDraftToApi(draft = {}) {
    return {
        name: draft.name || '', description: draft.description || '', schedule: draft.schedule || '',
        contactPhone: draft.contactPhone || '', contactEmail: draft.contactEmail || '',
        bucket: draft.bucket === 'Services' ? 'Services' : 'Programmes',
        locationId: draft.locationId || null, visibility: draft.visibility === 'public' ? 'public' : 'hidden',
        schedulePlan: schedulePlanToApi(draft.schedulePlan || {}),
    };
}

export function isUncertainProgrammeCreate(error) {
    if (['GUIDE_REVIEW_REQUIRED', 'GUIDE_ACTION_CONFLICT'].includes(error?.code)) return false;
    return !error?.status || error.status >= 500 || [408, 409, 429].includes(error.status);
}
