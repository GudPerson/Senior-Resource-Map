import test from 'node:test';
import assert from 'node:assert/strict';

import {
    AGREEMENT_TYPE_OPTIONS,
    AGREEMENT_USE_DETAILS,
    buildAgreementPrintHtml,
    getAgreementCoverageSummary,
    getAgreementTypeLabel,
    openPrintableAgreement,
} from './governanceAgreementUi.js';

test('agreement type labels are plain-language choices', () => {
    assert.equal(getAgreementTypeLabel('data_sharing'), 'Data sharing agreement');
    assert.equal(getAgreementTypeLabel('pilot_mou'), 'Pilot MOU / collaboration agreement');
    assert.equal(getAgreementTypeLabel('unknown_custom_type'), 'unknown custom type');
    assert.equal(AGREEMENT_TYPE_OPTIONS.some((option) => option.value === 'data_sharing'), true);
});

test('agreement use copy explains what each checkbox permits', () => {
    assert.equal(AGREEMENT_USE_DETAILS.publicListing.label, 'Public listing');
    assert.match(AGREEMENT_USE_DETAILS.restrictedFiles.description, /private files/i);
    assert.match(AGREEMENT_USE_DETAILS.aiAssistedEnrichment.description, /AI/i);
});

test('agreement coverage summary is friendly for active, draft, expired, and missing records', () => {
    assert.deepEqual(getAgreementCoverageSummary([], 'publicListing'), {
        tone: 'warning',
        label: 'Not covered yet',
        description: 'Add an active agreement that allows public listing.',
    });

    assert.deepEqual(getAgreementCoverageSummary([{ status: 'draft', allowedUses: { publicListing: true } }], 'publicListing'), {
        tone: 'warning',
        label: 'Not covered yet',
        description: 'Add an active agreement that allows public listing.',
    });

    assert.deepEqual(getAgreementCoverageSummary([{ status: 'active', expiresAt: '2026-01-01', allowedUses: { publicListing: true } }], 'publicListing', new Date('2026-05-22')), {
        tone: 'danger',
        label: 'Expired',
        description: 'An agreement exists, but it has expired.',
    });

    assert.deepEqual(getAgreementCoverageSummary([{ status: 'active', expiresAt: '2026-12-31', allowedUses: { publicListing: false } }], 'publicListing', new Date('2026-05-22')), {
        tone: 'warning',
        label: 'Not allowed',
        description: 'An active agreement exists, but public listing is not included.',
    });

    assert.deepEqual(getAgreementCoverageSummary([{ status: 'active', expiresAt: '2026-12-31', allowedUses: { publicListing: true } }], 'publicListing', new Date('2026-05-22')), {
        tone: 'success',
        label: 'Covered',
        description: 'An active agreement allows public listing.',
    });
});

test('buildAgreementPrintHtml escapes content and includes signature blocks', () => {
    const html = buildAgreementPrintHtml({
        organization: {
            name: 'Care <Partner>',
            dataContactName: 'Alex',
            dataContactEmail: 'alex@example.sg',
        },
        agreement: {
            agreementReference: 'AGR-001',
            agreementType: 'data_sharing',
            status: 'active',
            effectiveAt: '2026-05-22',
            allowedUses: { publicListing: true, restrictedFiles: false },
        },
        resourceLinks: [
            { resourceName: 'Main Centre', resourceType: 'hard', resourceId: 12 },
        ],
    });

    assert.match(html, /Care &lt;Partner&gt;/);
    assert.doesNotMatch(html, /Care <Partner>/);
    assert.match(html, /Data sharing agreement/);
    assert.match(html, /Public listing/);
    assert.match(html, /Organisation authorised representative/);
    assert.match(html, /CareAround SG representative/);
});

test('openPrintableAgreement writes printable HTML into a scriptable blank window before printing', () => {
    const originalWindow = globalThis.window;
    let openArgs;
    let printed = false;
    let focused = false;
    let writtenHtml = '';

    const fakeTarget = {
        document: {
            open() {},
            write(html) {
                writtenHtml = html;
            },
            close() {},
        },
        focus() {
            focused = true;
        },
        print() {
            printed = true;
        },
        opener: {},
    };

    globalThis.window = {
        open(...args) {
            openArgs = args;
            return fakeTarget;
        },
        setTimeout(callback) {
            callback();
        },
    };

    try {
        const opened = openPrintableAgreement({
            organization: { name: 'Test Org' },
            agreement: { agreementReference: 'AGR-PRINT-001', agreementType: 'data_sharing' },
            resourceLinks: [],
        });

        assert.equal(opened, true);
        assert.deepEqual(openArgs, ['', '_blank']);
        assert.match(writtenHtml, /AGR-PRINT-001/);
        assert.equal(fakeTarget.opener, null);
        assert.equal(focused, true);
        assert.equal(printed, true);
    } finally {
        globalThis.window = originalWindow;
    }
});
