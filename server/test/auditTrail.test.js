import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildAuditAccessScope,
    buildResourceAuditPayload,
    formatAuditLogForResponse,
    normalizeAuditLogQuery,
    sanitizeAuditMetadata,
} from '../src/utils/auditTrail.js';

test('audit access scope allows all logs for super admins only', () => {
    assert.deepEqual(buildAuditAccessScope({ id: 1, role: 'super_admin' }, []), {
        mode: 'all',
        organizationIds: [],
    });

    assert.deepEqual(buildAuditAccessScope({ id: 2, role: 'regional_admin' }, []), {
        mode: 'none',
        organizationIds: [],
    });
});

test('audit access scope allows organisation admins to their active organisations only', () => {
    const rows = [
        { userId: 10, organizationId: 7, accessRole: 'admin', revokedAt: null },
        { userId: 10, organizationId: 8, accessRole: 'staff', revokedAt: null },
        { userId: 10, organizationId: 9, accessRole: 'admin', revokedAt: '2026-05-01T00:00:00.000Z' },
        { userId: 11, organizationId: 12, accessRole: 'admin', revokedAt: null },
    ];

    assert.deepEqual(buildAuditAccessScope({ id: 10, role: 'standard' }, rows), {
        mode: 'organizations',
        organizationIds: [7],
    });
});

test('audit query normalization caps limits and keeps explicit filters typed', () => {
    const query = normalizeAuditLogQuery({
        limit: '999',
        organizationId: '7',
        resourceId: '42',
        resourceType: 'hard',
        actionType: ' resource_updated ',
        category: 'resource',
        from: '2026-06-01T00:00:00.000Z',
        to: '2026-06-02T00:00:00.000Z',
    });

    assert.equal(query.limit, 200);
    assert.equal(query.organizationId, 7);
    assert.equal(query.resourceId, 42);
    assert.equal(query.resourceType, 'hard');
    assert.equal(query.actionType, 'resource_updated');
    assert.equal(query.category, 'resource');
    assert.equal(query.from.toISOString(), '2026-06-01T00:00:00.000Z');
    assert.equal(query.to.toISOString(), '2026-06-02T00:00:00.000Z');
});

test('audit metadata sanitizer removes secret-like keys and long text bodies', () => {
    const sanitized = sanitizeAuditMetadata({
        fieldNames: ['name', 'description'],
        password: 'secret',
        jwtToken: 'token',
        nested: {
            apiSecret: 'hidden',
            safe: 'kept',
        },
        description: 'x'.repeat(800),
    });

    assert.deepEqual(sanitized.fieldNames, ['name', 'description']);
    assert.equal(sanitized.password, undefined);
    assert.equal(sanitized.jwtToken, undefined);
    assert.deepEqual(sanitized.nested, { safe: 'kept' });
    assert.equal(sanitized.description.length, 303);
});

test('resource audit payloads describe operational changes without private body values', () => {
    const payload = buildResourceAuditPayload({
        action: 'updated',
        resourceType: 'soft',
        resourceId: 166,
        resourceName: 'Meals-on-Wheels',
        organizationId: 12,
        changedFields: ['name', 'description', 'contactPhone'],
    });

    assert.equal(payload.actionType, 'resource_updated');
    assert.equal(payload.entityType, 'resource');
    assert.equal(payload.entityId, 166);
    assert.equal(payload.resourceType, 'soft');
    assert.equal(payload.resourceId, 166);
    assert.equal(payload.organizationId, 12);
    assert.deepEqual(payload.metadata, {
        resourceName: 'Meals-on-Wheels',
        changedFields: ['contactPhone', 'description', 'name'],
        changedFieldCount: 3,
    });
});

test('formatted audit logs include readable labels and sanitized metadata', () => {
    const row = {
        id: 3,
        actorUserId: 1,
        targetUserId: 2,
        actionType: 'resource_updated',
        entityType: 'resource',
        entityId: 166,
        resourceType: 'soft',
        resourceId: 166,
        organizationId: 12,
        metadata: {
            resourceName: 'Meals-on-Wheels',
            changedFields: ['description'],
            password: 'hidden',
        },
        createdAt: new Date('2026-06-02T03:00:00.000Z'),
    };

    const formatted = formatAuditLogForResponse(row, {
        actors: new Map([[1, { id: 1, name: 'GudPerson', email: 'admin@example.com' }]]),
        targets: new Map([[2, { id: 2, name: 'Partner User', email: 'partner@example.com' }]]),
        organizations: new Map([[12, { id: 12, name: 'Test Org' }]]),
        resources: new Map([['soft:166', { id: 166, name: 'Meals-on-Wheels' }]]),
    });

    assert.equal(formatted.actionLabel, 'Resource updated');
    assert.equal(formatted.actor.name, 'GudPerson');
    assert.equal(formatted.target.name, 'Partner User');
    assert.equal(formatted.organization.name, 'Test Org');
    assert.equal(formatted.resource.name, 'Meals-on-Wheels');
    assert.equal(formatted.metadata.password, undefined);
});
