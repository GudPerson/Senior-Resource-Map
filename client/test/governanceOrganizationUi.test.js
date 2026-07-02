import test from 'node:test';
import assert from 'node:assert/strict';

import {
    clearSectionFeedbackBySource,
    formatCoveredOfferingExplanation,
    formatGovernanceGroupScopeLabel,
    getGovernanceGroupRoleOptionLabel,
    getGovernanceGroupTypeMeta,
    formatGovernanceActionError,
    getOrganizationStatusBadgeMeta,
    getNewGovernanceRecordLockMessage,
    getNewGovernanceRecordSubmitState,
    isGovernanceControlVisible,
    isOrganizationOpenForNewRecords,
    normalizeOrganizationStatus,
} from '../src/lib/governanceOrganizationUi.js';
import { getAdminTabs, getRoleMeta, normalizeRole } from '../src/lib/roles.js';

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

test('group display helpers keep coordination-only wording', () => {
    assert.deepEqual(getGovernanceGroupTypeMeta('org'), {
        label: 'Org Group',
        description: 'Internal coordination inside one organisation.',
    });
    assert.deepEqual(getGovernanceGroupTypeMeta('region'), {
        label: 'Region Group',
        description: 'Cross-organisation coordination context.',
    });
    assert.equal(getGovernanceGroupRoleOptionLabel('admin'), 'Group Admin');
    assert.equal(getGovernanceGroupRoleOptionLabel('staff'), 'Group Staff');
    assert.equal(formatGovernanceGroupScopeLabel({ groupType: 'org', organizationName: 'Healthcare Group' }), 'Healthcare Group');
    assert.equal(formatGovernanceGroupScopeLabel({ groupType: 'region', subregionName: 'Bukit Batok' }), 'Bukit Batok');
});

test('group helper copy avoids approval and internal public labels', () => {
    const combined = [
        getGovernanceGroupTypeMeta('org').description,
        getGovernanceGroupTypeMeta('region').description,
        getGovernanceGroupRoleOptionLabel('admin'),
        getGovernanceGroupRoleOptionLabel('staff'),
        formatGovernanceGroupScopeLabel({ groupType: 'region', subregionName: 'Bukit Batok' }),
    ].join(' ');

    assert.match(combined, /coordination/i);
    assert.doesNotMatch(combined, /approve publishing|pending approval|ICCP SR Group Admin/i);
});

test('governance action errors keep rule messages but hide infrastructure wording', () => {
    assert.equal(
        formatGovernanceActionError(
            new Error('Every organisation needs at least one active Organisation Admin.'),
            'Organisation access could not be changed.',
        ),
        'Every organisation needs at least one active Organisation Admin.',
    );

    assert.equal(
        formatGovernanceActionError(
            new Error('Error connecting to database: Too many subrequests by single Worker invocation.'),
            'Organisation data could not be loaded.',
        ),
        'Organisation data could not be loaded. Refresh or try again in a moment.',
    );

    assert.equal(
        formatGovernanceActionError(
            new Error('Failed to fetch'),
            'Linked resources could not be searched.',
        ),
        'Linked resources could not be searched. Refresh or try again in a moment.',
    );
});

test('candidate refreshes do not clear organisation action errors', () => {
    const finalAdminFeedback = {
        access: {
            type: 'error',
            message: 'Every organisation needs at least one active Organisation Admin.',
        },
    };
    assert.equal(
        clearSectionFeedbackBySource(finalAdminFeedback, 'access', 'candidates'),
        finalAdminFeedback,
    );

    assert.deepEqual(
        clearSectionFeedbackBySource({
            access: {
                type: 'error',
                source: 'candidates',
                message: 'Access candidates failed to load.',
            },
        }, 'access', 'candidates'),
        {},
    );
});

test('region group coordination tab stays hidden from normal admin navigation', () => {
    assert.equal(getAdminTabs('super_admin').includes('groups'), false);
    assert.equal(getAdminTabs('regional_admin').includes('groups'), false);
});

test('admin platform role label hides the old region-admin wording', () => {
    assert.equal(getRoleMeta('regional_admin').label, 'Admin');
    assert.equal(getRoleMeta('regional_admin').shortLabel, 'Admin');
    assert.equal(normalizeRole('Admin'), 'regional_admin');
    assert.equal(normalizeRole('Region Admin'), 'regional_admin');
    assert.equal(normalizeRole('Regional Admin'), 'regional_admin');
});

test('governance group panel source keeps groups as coordination-only', async () => {
    const fs = await import('node:fs/promises');
    const source = await fs.readFile(new URL('../src/components/admin/GovernanceGroupsPanel.jsx', import.meta.url), 'utf8');

    assert.match(source, /coordination-only/i);
    assert.match(source, /Group roles do not grant resource editing/i);
    assert.doesNotMatch(source, /approve publishing/i);
    assert.doesNotMatch(source, /pending approval/i);
});
