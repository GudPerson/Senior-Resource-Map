import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildAuditChangeLines,
    buildAuditDetailChips,
    buildAuditLegacyDetailNote,
    buildAuditPlainSummary,
    buildOrganizationFilterOptions,
    humanizeAuditFieldName,
} from '../src/lib/auditTrailPresentation.js';

test('audit summaries explain organisation profile changes in plain language', () => {
    const log = {
        actionType: 'organization_updated',
        actionLabel: 'Organisation updated',
        actor: { id: 1, name: 'GudPerson' },
        organization: { id: 7, name: 'Entrust Healthcare Group' },
        metadata: {
            changedFields: ['governanceStatus', 'dataContactEmail'],
        },
    };

    assert.equal(
        buildAuditPlainSummary(log),
        'GudPerson updated the organisation profile for Entrust Healthcare Group.'
    );
    assert.deepEqual(buildAuditDetailChips(log.metadata, log), [
        'Changed: status, data contact email',
    ]);
});

test('audit change lines explain safe before-and-after details and redact sensitive values', () => {
    const metadata = {
        changedFields: ['dataContactEmail', 'governanceStatus', 'name', 'notes'],
        changeDetails: [
            { field: 'dataContactEmail', valuePolicy: 'redacted' },
            { field: 'governanceStatus', previous: 'active', next: 'archived', valuePolicy: 'visible' },
            { field: 'name', previous: 'Entrust Healthcare Group', next: 'Entrust Healthcare Group Ltd', valuePolicy: 'visible' },
            { field: 'notes', valuePolicy: 'redacted' },
        ],
    };

    assert.deepEqual(buildAuditChangeLines(metadata), [
        {
            field: 'Data contact email',
            summary: 'Changed. Values hidden for privacy.',
            previous: '',
            next: '',
            isValueHidden: true,
        },
        {
            field: 'Status',
            summary: 'Changed from Active to Archived.',
            previous: 'Active',
            next: 'Archived',
            isValueHidden: false,
        },
        {
            field: 'Name',
            summary: 'Changed from Entrust Healthcare Group to Entrust Healthcare Group Ltd.',
            previous: 'Entrust Healthcare Group',
            next: 'Entrust Healthcare Group Ltd',
            isValueHidden: false,
        },
        {
            field: 'Notes',
            summary: 'Changed. Values hidden for privacy.',
            previous: '',
            next: '',
            isValueHidden: true,
        },
    ]);
});

test('audit summaries describe resource visibility without code-style wording', () => {
    const log = {
        actionType: 'resource_hidden',
        actor: { id: 1, name: 'GudPerson' },
        resourceType: 'soft',
        resource: { id: 166, name: 'Meals-on-Wheels West' },
    };

    assert.equal(
        buildAuditPlainSummary(log),
        'GudPerson hid programme or service "Meals-on-Wheels West" from the app.'
    );
});

test('resource change audit summaries show resource name and changed fields', () => {
    const log = {
        actionType: 'resource_updated',
        resource: { name: 'Precious Active Ageing Centre (Sunshine Gardens)', type: 'Place' },
        actor: { name: 'GudPerson' },
        metadata: { changedFields: ['phone', 'hours'] },
    };

    assert.match(buildAuditPlainSummary(log), /GudPerson/);
    assert.match(buildAuditPlainSummary(log), /Precious Active Ageing Centre/);
    assert.deepEqual(buildAuditDetailChips(log.metadata, log), [
        'Changed: phone, hours',
    ]);
});

test('audit legacy note explains older update rows that lack detail metadata', () => {
    assert.equal(buildAuditLegacyDetailNote({
        actionType: 'organization_updated',
        metadata: {},
    }), 'Detailed field changes were not recorded for this older entry.');

    assert.equal(buildAuditLegacyDetailNote({
        actionType: 'organization_updated',
        metadata: { changeDetails: [{ field: 'name', previous: 'Old', next: 'New', valuePolicy: 'visible' }] },
    }), '');
});

test('audit field labels convert common camelCase and unknown names for layman chips', () => {
    assert.equal(humanizeAuditFieldName('contactPhone'), 'contact phone');
    assert.equal(humanizeAuditFieldName('resource_visibility_status'), 'resource visibility status');
});

test('organisation dropdown keeps all statuses for super admins and scopes organisation admins', () => {
    const organizations = [
        { id: 1, name: 'Active Org', governanceStatus: 'active' },
        { id: 2, name: 'Archived Org', governanceStatus: 'archived' },
        { id: 3, name: 'Paused Org', governanceStatus: 'paused' },
    ];

    assert.deepEqual(buildOrganizationFilterOptions({ organizations }), [
        { value: '1', label: 'Active Org (Active)' },
        { value: '2', label: 'Archived Org (Archived)' },
        { value: '3', label: 'Paused Org (Paused)' },
    ]);

    assert.deepEqual(buildOrganizationFilterOptions({
        organizations,
        scope: 'organizations',
        scopeOrganizationIds: [2],
    }), [
        { value: '2', label: 'Archived Org (Archived)' },
    ]);
});
