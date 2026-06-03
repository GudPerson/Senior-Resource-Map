export const ORGANIZATION_STATUS_HELP = {
    draft: 'Profile is being prepared. Empty drafts can be deleted before they are used.',
    active: 'Ready for agreement coverage, governance access, and resource linking.',
    paused: 'Temporarily prevents new access, agreement records, and resource links.',
    archived: 'Retained for records. Existing history remains, but new governance activity is closed.',
};

const READ_ONLY_HIDDEN_CONTROLS = new Set([
    'saveProfile',
    'archiveOrganization',
    'deleteEmptyDraft',
    'addAccess',
    'revokeAccess',
    'linkResource',
    'unlinkResource',
    'saveAgreement',
    'revokeAgreement',
]);

export function normalizeOrganizationStatus(value) {
    const normalized = String(value || 'active').trim().toLowerCase();
    return ['active', 'draft', 'paused', 'archived'].includes(normalized) ? normalized : 'active';
}

export function getOrganizationStatusBadgeMeta(value) {
    const status = normalizeOrganizationStatus(value);
    const badgeMeta = {
        active: {
            label: 'Active',
            className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        },
        draft: {
            label: 'Draft',
            className: 'border-sky-200 bg-sky-50 text-sky-700',
        },
        paused: {
            label: 'Paused',
            className: 'border-amber-200 bg-amber-50 text-amber-700',
        },
        archived: {
            label: 'Archived',
            className: 'border-slate-200 bg-slate-100 text-slate-600',
        },
    };

    return badgeMeta[status];
}

export function isOrganizationOpenForNewRecords(organization) {
    const status = normalizeOrganizationStatus(organization?.governanceStatus);
    return status === 'active' || status === 'draft';
}

export function getNewGovernanceRecordLockMessage(organization, recordLabel = 'new records') {
    if (!organization || isOrganizationOpenForNewRecords(organization)) return '';
    const status = normalizeOrganizationStatus(organization.governanceStatus);
    return `This organisation is ${status}. Set the Organisation profile status to Active or Draft and click Save Organisation before adding ${recordLabel}. Existing access, links, and agreement records can still be reviewed or removed.`;
}

export function getNewGovernanceRecordSubmitState({
    organization,
    selectedCount = 0,
    saving = false,
    recordLabel = 'records',
    editingExistingRecord = false,
} = {}) {
    if (saving) {
        return {
            disabled: true,
            reason: 'Saving. Please wait.',
        };
    }

    if (!editingExistingRecord) {
        const lockMessage = getNewGovernanceRecordLockMessage(organization, recordLabel);
        if (lockMessage) {
            return {
                disabled: true,
                reason: lockMessage,
            };
        }

        if (selectedCount <= 0) {
            return {
                disabled: true,
                reason: 'Choose at least one item first.',
            };
        }
    }

    return {
        disabled: false,
        reason: '',
    };
}

export function isGovernanceControlVisible({ readOnly = false, control = '' } = {}) {
    return !(readOnly && READ_ONLY_HIDDEN_CONTROLS.has(control));
}

export function formatCoveredOfferingExplanation(count = 0) {
    const total = Number(count) || 0;
    if (total <= 0) return '';
    if (total === 1) return '1 programme or service is covered because its place is linked.';
    return `${total} programmes and services are covered because their places are linked.`;
}

export function formatGovernanceActionError(error, fallbackMessage = 'This action could not be completed.') {
    const message = String(error?.message || '').trim();
    const fallback = String(fallbackMessage || 'This action could not be completed.').trim();
    if (!message) return fallback;

    if (/too many subrequests|error connecting to database|failed to fetch|networkerror|network error/i.test(message)) {
        return `${fallback} Refresh or try again in a moment.`;
    }

    return message;
}
