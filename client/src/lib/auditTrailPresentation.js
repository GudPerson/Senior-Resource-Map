const FIELD_LABELS = {
    accessRole: 'access level',
    actionButtonLabel: 'action button label',
    actionButtonUrl: 'action button link',
    address: 'address',
    allowedUses: 'allowed uses',
    category: 'category',
    contactEmail: 'contact email',
    contactPhone: 'contact phone',
    dataContactEmail: 'data contact email',
    dataContactName: 'data contact name',
    description: 'description',
    endDate: 'end date',
    governanceStatus: 'status',
    isHidden: 'visibility',
    name: 'name',
    notes: 'notes',
    postalCode: 'postal code',
    resourceName: 'resource name',
    schedule: 'schedule',
    signedCopyUrl: 'signed copy link',
    startDate: 'start date',
    status: 'status',
    tags: 'tags',
    venueNote: 'venue note',
    whatsappContact: 'WhatsApp contact',
};

const RESOURCE_LABELS = {
    hard: 'place',
    soft: 'programme or service',
    template: 'template',
};

const ACTION_SUMMARIES = {
    organization_created: ({ actor, organization }) => `${actor} created the organisation profile for ${organization}.`,
    organization_updated: ({ actor, organization }) => `${actor} updated the organisation profile for ${organization}.`,
    organization_deleted: ({ actor, organization }) => `${actor} deleted the organisation profile for ${organization}.`,
    organization_access_added: ({ actor, target, organization }) => `${actor} gave ${target} organisation access for ${organization}.`,
    organization_access_revoked: ({ actor, target, organization }) => `${actor} removed ${target}'s organisation access for ${organization}.`,
    organization_agreement_created: ({ actor, organization }) => `${actor} added an agreement record for ${organization}.`,
    organization_agreement_updated: ({ actor, organization }) => `${actor} updated an agreement record for ${organization}.`,
    organization_agreement_revoked: ({ actor, organization }) => `${actor} removed an agreement record for ${organization}.`,
    organization_resource_linked: ({ actor, resource, organization }) => `${actor} linked ${resource} to ${organization}.`,
    organization_resource_unlinked: ({ actor, resource, organization }) => `${actor} unlinked ${resource} from ${organization}.`,
    resource_created: ({ actor, resourceLabel, resource }) => `${actor} created ${resourceLabel} ${resource}.`,
    resource_updated: ({ actor, resourceLabel, resource }) => `${actor} updated ${resourceLabel} ${resource}.`,
    resource_deleted: ({ actor, resourceLabel, resource }) => `${actor} deleted ${resourceLabel} ${resource}.`,
    resource_hidden: ({ actor, resourceLabel, resource }) => `${actor} hid ${resourceLabel} ${resource} from the app.`,
    resource_shown: ({ actor, resourceLabel, resource }) => `${actor} made ${resourceLabel} ${resource} visible in the app.`,
    resource_availability_updated: ({ actor, resourceLabel, resource }) => `${actor} updated availability for ${resourceLabel} ${resource}.`,
    resource_access_added: ({ actor, target, resourceLabel, resource }) => `${actor} gave ${target} access to ${resourceLabel} ${resource}.`,
    resource_access_updated: ({ actor, target, resourceLabel, resource }) => `${actor} changed ${target}'s access to ${resourceLabel} ${resource}.`,
    resource_access_revoked: ({ actor, target, resourceLabel, resource }) => `${actor} removed ${target}'s access to ${resourceLabel} ${resource}.`,
    resource_imported: ({ actor, resourceLabel }) => `${actor} imported ${resourceLabel} records from a workbook.`,
    workbook_exported: ({ actor }) => `${actor} exported a workbook.`,
    filtered_workbook_exported: ({ actor }) => `${actor} exported a filtered workbook.`,
    restricted_content_updated: ({ actor, resourceLabel, resource }) => `${actor} updated private notes or files for ${resourceLabel} ${resource}.`,
    private_file_uploaded: ({ actor, resourceLabel, resource }) => `${actor} uploaded a private file for ${resourceLabel} ${resource}.`,
    private_file_downloaded: ({ actor, resourceLabel, resource }) => `${actor} downloaded a private file for ${resourceLabel} ${resource}.`,
    private_file_deleted: ({ actor, resourceLabel, resource }) => `${actor} deleted a private file for ${resourceLabel} ${resource}.`,
    user_view_started: ({ actor, target }) => `${actor} opened ${target}'s account view.`,
    notification_preferences_updated: ({ actor, target }) => `${actor} updated notification preferences for ${target}.`,
    opt_out_recorded: ({ actor, target }) => `${actor} recorded an opt-out for ${target}.`,
    opt_out_revoked: ({ actor, target }) => `${actor} removed an opt-out for ${target}.`,
    consent_recorded: ({ actor, target }) => `${actor} recorded consent for ${target}.`,
};

function splitCamelCase(value) {
    return String(value || '')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

export function humanizeAuditFieldName(field) {
    const key = String(field || '').trim();
    return FIELD_LABELS[key] || splitCamelCase(key);
}

function titleCase(value) {
    return String(value || '')
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function displayFieldName(field) {
    const label = humanizeAuditFieldName(field);
    return label ? `${label.charAt(0).toUpperCase()}${label.slice(1)}` : '';
}

function displayAuditValue(value) {
    if (value === null || value === undefined || value === '') return 'Blank';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') return String(value);
    if (Array.isArray(value)) return value.length ? value.map(displayAuditValue).join(', ') : 'None';
    if (typeof value === 'object') return 'Updated details';
    return titleCase(humanizeAuditFieldName(value) || value);
}

export function userLabel(user, fallback = 'System') {
    if (!user) return fallback;
    return user.name || user.email || `User ${user.id}`;
}

export function auditTargetLabel(log) {
    if (log?.resource?.name) return log.resource.name;
    if (log?.organization?.name) return log.organization.name;
    if (log?.target?.name) return userLabel(log.target);
    return log?.entityId ? `record ${log.entityId}` : 'CareAround SG';
}

function quoted(value) {
    const text = String(value || '').trim();
    return text ? `"${text}"` : '"this record"';
}

function resourceLabel(log) {
    return RESOURCE_LABELS[log?.resourceType] || log?.resource?.label || 'record';
}

export function buildAuditPlainSummary(log = {}) {
    const context = {
        actor: userLabel(log.actor),
        target: userLabel(log.target, 'the user'),
        organization: log.organization?.name || 'this organisation',
        resource: quoted(log.resource?.name || log.metadata?.resourceName || auditTargetLabel(log)),
        resourceLabel: resourceLabel(log),
    };
    const builder = ACTION_SUMMARIES[log.actionType];
    if (builder) return builder(context);
    return `${context.actor} recorded ${String(log.actionLabel || log.actionType || 'an audit event').toLowerCase()} for ${auditTargetLabel(log)}.`;
}

export function buildAuditDetailChips(metadata = {}, log = {}) {
    const fields = Array.isArray(metadata.changedFields) ? metadata.changedFields : [];
    const chips = [];

    if (fields.length) {
        chips.push(`Changed: ${fields.map(humanizeAuditFieldName).join(', ')}`);
    }
    if (metadata.accessRole) chips.push(`Access level: ${humanizeAuditFieldName(metadata.accessRole) || metadata.accessRole}`);
    if (metadata.staffRole) chips.push(`Staff role: ${humanizeAuditFieldName(metadata.staffRole) || metadata.staffRole}`);
    if (metadata.status) chips.push(`Status: ${humanizeAuditFieldName(metadata.status) || metadata.status}`);
    if (metadata.resourceType && !log.resourceType) chips.push(`Resource type: ${humanizeAuditFieldName(metadata.resourceType) || metadata.resourceType}`);
    if (metadata.count && Number(metadata.count) > 0) chips.push(`${Number(metadata.count)} item${Number(metadata.count) === 1 ? '' : 's'} affected`);
    if (metadata.rowCount && Number(metadata.rowCount) > 0) chips.push(`${Number(metadata.rowCount)} row${Number(metadata.rowCount) === 1 ? '' : 's'} affected`);
    if (metadata.reason) chips.push(`Reason: ${metadata.reason}`);

    return [...new Set(chips.filter(Boolean))];
}

export function buildAuditChangeLines(metadata = {}) {
    const details = Array.isArray(metadata.changeDetails) ? metadata.changeDetails : [];
    if (!details.length) return [];

    return details
        .map((detail) => {
            const field = displayFieldName(detail.field);
            if (!field) return null;
            if (detail.valuePolicy !== 'visible') {
                return {
                    field,
                    summary: 'Changed. Values hidden for privacy.',
                    previous: '',
                    next: '',
                    isValueHidden: true,
                };
            }
            const previous = displayAuditValue(detail.previous);
            const next = displayAuditValue(detail.next);
            return {
                field,
                summary: `Changed from ${previous} to ${next}.`,
                previous,
                next,
                isValueHidden: false,
            };
        })
        .filter(Boolean);
}

export function buildAuditLegacyDetailNote(log = {}) {
    const action = String(log.actionType || '');
    const metadata = log.metadata || {};
    const hasDetails = Array.isArray(metadata.changeDetails) && metadata.changeDetails.length > 0;
    const hasChangedFields = Array.isArray(metadata.changedFields) && metadata.changedFields.length > 0;
    if (hasDetails || hasChangedFields) return '';
    return action.endsWith('_updated')
        ? 'Detailed field changes were not recorded for this older entry.'
        : '';
}

function statusLabel(value) {
    const text = splitCamelCase(value || 'active');
    return text ? text.replace(/\b\w/g, (char) => char.toUpperCase()) : 'Active';
}

export function buildOrganizationFilterOptions({
    organizations = [],
    scope = '',
    scopeOrganizationIds = [],
} = {}) {
    const allowedIds = scope === 'organizations'
        ? new Set((scopeOrganizationIds || []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))
        : null;

    return (organizations || [])
        .filter((organization) => !allowedIds || allowedIds.has(Number(organization.id)))
        .map((organization) => ({
            value: String(organization.id),
            label: `${organization.name || `Organisation ${organization.id}`} (${statusLabel(organization.governanceStatus)})`,
        }));
}
