export const ORGANIZATION_STATUS_HELP = {
    draft: 'Profile is being prepared. Empty drafts can be deleted before they are used.',
    active: 'Ready for agreement coverage, governance access, and resource linking.',
    paused: 'Temporarily prevents new access, agreement records, and resource links.',
    archived: 'Retained for records. Existing history remains, but new governance activity is closed.',
};

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
