import test from 'node:test';
import assert from 'node:assert/strict';

import {
    formatCoveredOfferingExplanation,
    getOrganizationStatusBadgeMeta,
    getNewGovernanceRecordLockMessage,
    getNewGovernanceRecordSubmitState,
    isGovernanceControlVisible,
    isOrganizationOpenForNewRecords,
    normalizeOrganizationStatus,
} from '../src/lib/governanceOrganizationUi.js';

test('organisation status keeps active and draft open for new governance records only', () => {
    assert.equal(normalizeOrganizationStatus('Active'), 'active');
    assert.equal(normalizeOrganizationStatus(' Draft '), 'draft');
    assert.equal(normalizeOrganizationStatus('paused'), 'paused');
    assert.equal(normalizeOrganizationStatus('archived'), 'archived');
    assert.equal(normalizeOrganizationStatus('unexpected'), 'active');

    assert.equal(isOrganizationOpenForNewRecords({ governanceStatus: 'active' }), true);
    assert.equal(isOrganizationOpenForNewRecords({ governanceStatus: 'draft' }), true);
    assert.equal(isOrganizationOpenForNewRecords({ governanceStatus: 'paused' }), false);
    assert.equal(isOrganizationOpenForNewRecords({ governanceStatus: 'archived' }), false);
});

test('organisation status badge metadata gives each list card a clear status pill', () => {
    assert.deepEqual(getOrganizationStatusBadgeMeta('active'), {
        label: 'Active',
        className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    });

    assert.deepEqual(getOrganizationStatusBadgeMeta('draft'), {
        label: 'Draft',
        className: 'border-sky-200 bg-sky-50 text-sky-700',
    });

    assert.deepEqual(getOrganizationStatusBadgeMeta('paused'), {
        label: 'Paused',
        className: 'border-amber-200 bg-amber-50 text-amber-700',
    });

    assert.deepEqual(getOrganizationStatusBadgeMeta('archived'), {
        label: 'Archived',
        className: 'border-slate-200 bg-slate-100 text-slate-600',
    });

    assert.equal(getOrganizationStatusBadgeMeta('unexpected').label, 'Active');
});

test('closed organisations explain why new access, links, and agreements do not respond', () => {
    assert.equal(getNewGovernanceRecordLockMessage({ governanceStatus: 'active' }, 'access'), '');

    const archivedMessage = getNewGovernanceRecordLockMessage({ governanceStatus: 'archived' }, 'access');
    assert.match(archivedMessage, /archived/i);
    assert.match(archivedMessage, /Active or Draft/);
    assert.match(archivedMessage, /Save Organisation/);

    const pausedMessage = getNewGovernanceRecordLockMessage({ governanceStatus: 'paused' }, 'linked resources');
    assert.match(pausedMessage, /paused/i);
    assert.match(pausedMessage, /linked resources/);
});

test('new governance record submit state distinguishes missing selection from closed status', () => {
    assert.deepEqual(getNewGovernanceRecordSubmitState({
        organization: { governanceStatus: 'active' },
        selectedCount: 0,
    }), {
        disabled: true,
        reason: 'Choose at least one item first.',
    });

    const archivedState = getNewGovernanceRecordSubmitState({
        organization: { governanceStatus: 'archived' },
        selectedCount: 1,
        recordLabel: 'access',
    });
    assert.equal(archivedState.disabled, true);
    assert.match(archivedState.reason, /archived/i);

    assert.deepEqual(getNewGovernanceRecordSubmitState({
        organization: { governanceStatus: 'active' },
        selectedCount: 1,
    }), {
        disabled: false,
        reason: '',
    });
});

test('editing existing agreements remains available while new archived records stay locked', () => {
    assert.deepEqual(getNewGovernanceRecordSubmitState({
        organization: { governanceStatus: 'archived' },
        selectedCount: 0,
        editingExistingRecord: true,
    }), {
        disabled: false,
        reason: '',
    });
});

test('read-only organisation workspace hides management controls', () => {
    assert.equal(isGovernanceControlVisible({ readOnly: true, control: 'addAccess' }), false);
    assert.equal(isGovernanceControlVisible({ readOnly: true, control: 'saveProfile' }), false);
    assert.equal(isGovernanceControlVisible({ readOnly: true, control: 'viewAgreement' }), true);
    assert.equal(isGovernanceControlVisible({ readOnly: false, control: 'addAccess' }), true);
});

test('covered offering explanation is plain language', () => {
    assert.equal(formatCoveredOfferingExplanation(0), '');
    assert.equal(
        formatCoveredOfferingExplanation(1),
        '1 programme or service is covered because its place is linked.',
    );
    assert.equal(
        formatCoveredOfferingExplanation(2),
        '2 programmes and services are covered because their places are linked.',
    );
});
