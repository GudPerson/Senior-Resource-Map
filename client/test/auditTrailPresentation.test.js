import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildAuditDetailChips,
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
