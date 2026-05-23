import assert from 'node:assert/strict';
import test from 'node:test';

import {
    buildCollateralReviewRows,
    buildMissingOfferingRows,
    buildUpdateDiffs,
} from '../src/utils/collateralImportMatching.js';

const hostOffering = {
    id: 10,
    name: 'Chair Yoga',
    bucket: 'Programmes',
    subCategory: 'Senior Fitness',
    description: 'Gentle seated yoga for seniors.',
    schedule: 'Mondays 9am',
    contactPhone: '+65 6123 4567',
    contactEmail: '',
    ctaLabel: 'Register',
    ctaUrl: '',
    venueNote: 'Activity room',
    newTags: ['fitness', 'senior activities'],
};

test('classifies same-host programme with changed schedule as likely update', () => {
    const [row] = buildCollateralReviewRows({
        draftRows: [{
            id: 'draft-1',
            name: 'Chair Yoga',
            bucket: 'Programmes',
            subCategorySuggestion: 'Senior Fitness',
            description: 'Gentle seated yoga for seniors.',
            schedule: 'Tuesdays 10am',
            newTags: ['fitness', 'senior activities'],
        }],
        existingOfferings: [hostOffering],
        importMode: 'refresh',
    });

    assert.equal(row.reviewStatus, 'likely_update');
    assert.equal(row.suggestedAction, 'update');
    assert.equal(row.targetSoftAssetId, 10);
    assert.equal(row.matchCandidates[0].id, 10);
    assert.ok(row.updateDiffs.some((diff) => diff.field === 'schedule'));
});

test('classifies exact duplicate content as no change and skip', () => {
    const [row] = buildCollateralReviewRows({
        draftRows: [{
            id: 'draft-1',
            name: 'Chair Yoga',
            bucket: 'Programmes',
            subCategorySuggestion: 'Senior Fitness',
            description: 'Gentle seated yoga for seniors.',
            schedule: 'Mondays 9am',
            contactPhone: '+65 6123 4567',
            ctaLabel: 'Register',
            venueNote: 'Activity room',
            newTags: ['fitness', 'senior activities'],
        }],
        existingOfferings: [hostOffering],
        importMode: 'refresh',
    });

    assert.equal(row.reviewStatus, 'no_change');
    assert.equal(row.suggestedAction, 'skip');
    assert.equal(row.targetSoftAssetId, 10);
});

test('does not match unrelated weak programme names', () => {
    const [row] = buildCollateralReviewRows({
        draftRows: [{
            id: 'draft-1',
            name: 'Digital Banking Talk',
            bucket: 'Programmes',
            subCategorySuggestion: 'Digital Literacy',
            description: 'Learn how to stay safe online.',
            schedule: 'Fridays 2pm',
            newTags: ['digital literacy'],
        }],
        existingOfferings: [hostOffering],
        importMode: 'refresh',
    });

    assert.equal(row.reviewStatus, 'new_offering');
    assert.equal(row.suggestedAction, 'create');
    assert.equal(row.matchCandidates.length, 0);
});

test('builds missing offering rows only for unmatched existing offerings in refresh mode', () => {
    const reviewRows = buildCollateralReviewRows({
        draftRows: [{
            id: 'draft-1',
            name: 'Digital Banking Talk',
            bucket: 'Programmes',
            subCategorySuggestion: 'Digital Literacy',
            description: 'Learn how to stay safe online.',
            schedule: 'Fridays 2pm',
            newTags: ['digital literacy'],
        }],
        existingOfferings: [hostOffering],
        importMode: 'refresh',
    });

    const missingRows = buildMissingOfferingRows({
        existingOfferings: [hostOffering],
        reviewRows,
        importMode: 'refresh',
    });

    assert.equal(missingRows.length, 1);
    assert.equal(missingRows[0].id, 'missing-10');
    assert.equal(missingRows[0].suggestedAction, 'review_later');
});

test('does not build missing offering rows for new import mode', () => {
    const missingRows = buildMissingOfferingRows({
        existingOfferings: [hostOffering],
        reviewRows: [],
        importMode: 'new',
    });

    assert.equal(missingRows.length, 0);
});

test('buildUpdateDiffs reports changed fields and ignores unchanged fields', () => {
    const diffs = buildUpdateDiffs({
        existing: hostOffering,
        draft: {
            ...hostOffering,
            schedule: 'Tuesdays 10am',
            contactPhone: '+65 6123 4567',
        },
    });

    assert.deepEqual(diffs, [{
        field: 'schedule',
        label: 'Schedule',
        before: 'Mondays 9am',
        after: 'Tuesdays 10am',
    }]);
});

test('buildUpdateDiffs treats blank optional draft fields as preserve-existing evidence gaps', () => {
    const diffs = buildUpdateDiffs({
        existing: hostOffering,
        draft: {
            id: 'draft-1',
            name: 'Chair Yoga',
            bucket: 'Programmes',
            subCategorySuggestion: 'Senior Fitness',
            description: '',
            schedule: 'Mondays 9am',
            contactPhone: '',
            contactEmail: '',
            ctaLabel: '',
            ctaUrl: '',
            venueNote: '',
            newTags: [],
        },
    });

    assert.deepEqual(diffs, []);
});

test('missing offering hide and mark ended actions are explicit review actions', () => {
    const [missing] = buildMissingOfferingRows({
        existingOfferings: [hostOffering],
        reviewRows: [],
        importMode: 'refresh',
    });

    assert.equal(missing.suggestedAction, 'review_later');
    assert.equal(missing.softAssetId, 10);
});
