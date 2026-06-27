import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const assetFormSource = readFileSync(new URL('../src/components/AssetForm.jsx', import.meta.url), 'utf8');
const resourcesPageSource = readFileSync(new URL('../src/pages/dashboard/ResourcesPage.jsx', import.meta.url), 'utf8');

function sourceBetween(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start + startMarker.length);
    assert.notEqual(start, -1, `Missing source marker: ${startMarker}`);
    assert.notEqual(end, -1, `Missing source marker: ${endMarker}`);
    return source.slice(start, end);
}

function resourceWizardShellBlockContaining(source, requiredMarkers) {
    let searchStart = 0;
    while (searchStart < source.length) {
        const start = source.indexOf('<ResourceWizardShell', searchStart);
        if (start === -1) break;
        const end = source.indexOf('/>', start);
        assert.notEqual(end, -1, 'ResourceWizardShell block should be self-closing');
        const shellSource = source.slice(start, end + 2);
        if (requiredMarkers.every((marker) => shellSource.includes(marker))) {
            return shellSource;
        }
        searchStart = end + 2;
    }
    assert.fail(`Missing ResourceWizardShell block containing: ${requiredMarkers.join(', ')}`);
}

function assertSourceOrder(source, earlierMarker, laterMarker) {
    const earlier = source.indexOf(earlierMarker);
    const later = source.indexOf(laterMarker);
    assert.notEqual(earlier, -1, `Missing source marker: ${earlierMarker}`);
    assert.notEqual(later, -1, `Missing source marker: ${laterMarker}`);
    assert.ok(earlier < later, `Expected "${earlierMarker}" before "${laterMarker}"`);
}

test('AssetForm declares the Offering wizard shell and step contract', () => {
    const stepsDefinition = assetFormSource.match(/const OFFERING_STEPS = \[([^\]]+)\];/);
    assert.ok(stepsDefinition, 'OFFERING_STEPS definition should exist');
    const offeringSteps = [...stepsDefinition[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
    const renderOfferingStepSource = sourceBetween(assetFormSource, 'function renderOfferingStep(stepIndex)', 'function renderOfferingDetailPreview');
    const renderOfferingStepBranches = [...renderOfferingStepSource.matchAll(/if \(stepIndex === (\d+)\) return (renderOffering\w+)\(\);/g)]
        .map((match) => ({
            index: Number(match[1]),
            renderer: match[2],
        }));
    const offeringShellSource = resourceWizardShellBlockContaining(assetFormSource, [
        'steps={OFFERING_STEPS}',
        'renderStep={renderOfferingStep}',
        'validateStep={validateOfferingStep}',
        'onSave={handleOfferingWizardSave}',
        'saveLabel="Save Offering"',
        'renderPreview={renderOfferingDetailPreview}',
    ]);

    assert.match(assetFormSource, /import ResourceWizardShell from '\.\/ResourceWizardShell\.jsx';/);
    assert.deepEqual(offeringSteps, ['Profile', 'Schedule', 'Host & coverage', 'Visibility', 'Access', 'Translate', 'Restricted']);
    assert.match(offeringShellSource, /<ResourceWizardShell/);
    assert.match(offeringShellSource, /steps=\{OFFERING_STEPS\}/);
    assert.match(offeringShellSource, /renderStep=\{renderOfferingStep\}/);
    assert.match(offeringShellSource, /validateStep=\{validateOfferingStep\}/);
    assert.match(offeringShellSource, /onSave=\{handleOfferingWizardSave\}/);
    assert.match(offeringShellSource, /saveLabel="Save Offering"/);
    assert.match(offeringShellSource, /renderPreview=\{renderOfferingDetailPreview\}/);
    assert.match(assetFormSource, /function getOfferingStepValidationError\(stepIndex = activeOfferingStep\)/);
    assert.match(assetFormSource, /function validateAllOfferingSteps\(\)/);
    assert.match(assetFormSource, /setActiveOfferingStep\(stepIndex\)/);
    assert.match(assetFormSource, /Add an offering name to continue\./);
    assert.match(assetFormSource, /function isValidOptionalHttpUrl\(value\)/);
    assert.match(assetFormSource, /function isValidOptionalEmail\(value\)/);
    assert.match(assetFormSource, /function getOfferingProfileContactValidationError\(\)/);
    assert.match(assetFormSource, /Enter a valid website URL starting with http:\/\/ or https:\/\/\./);
    assert.match(assetFormSource, /Enter a valid contact email address\./);
    assert.match(assetFormSource, /Enter a valid action button link starting with http:\/\/ or https:\/\/\./);
    assert.match(assetFormSource, /function renderOfferingStep\(stepIndex\)/);
    assert.deepEqual(renderOfferingStepBranches, [
        { index: 0, renderer: 'renderOfferingProfileStep' },
        { index: 1, renderer: 'renderOfferingScheduleStep' },
        { index: 2, renderer: 'renderOfferingHostCoverageStep' },
        { index: 3, renderer: 'renderOfferingVisibilityStep' },
        { index: 4, renderer: 'renderOfferingAccessStep' },
        { index: 5, renderer: 'renderOfferingTranslationStep' },
        { index: 6, renderer: 'renderOfferingRestrictedStep' },
    ]);
    assert.match(renderOfferingStepSource, /return null;/);
    assert.match(assetFormSource, /function renderOfferingDetailPreview\(\)/);
});

test('Offering wizard keeps description, schedule, coverage, eligibility, access, translation, and restricted panels', () => {
    const profileStepSource = sourceBetween(assetFormSource, 'function renderOfferingProfileStep()', 'function renderOfferingScheduleStep()');
    const scheduleStepSource = sourceBetween(assetFormSource, 'function renderOfferingScheduleStep()', 'function renderOfferingHostCoverageStep()');
    const hostCoverageStepSource = sourceBetween(assetFormSource, 'function renderOfferingHostCoverageStep()', 'function renderOfferingVisibilityStep()');
    const visibilityStepSource = sourceBetween(assetFormSource, 'function renderOfferingVisibilityStep()', 'function renderOfferingAccessStep()');
    const accessStepSource = sourceBetween(assetFormSource, 'function renderOfferingAccessStep()', 'function renderOfferingTranslationStep()');
    const translationStepSource = sourceBetween(assetFormSource, 'function renderOfferingTranslationStep()', 'function renderOfferingRestrictedStep()');
    const restrictedStepSource = sourceBetween(assetFormSource, 'function renderOfferingRestrictedStep()', 'function renderOfferingStep(stepIndex)');

    assert.match(profileStepSource, /MarkdownDescriptionField/);
    assert.match(profileStepSource, /id="offering-description"/);
    assert.match(profileStepSource, /Category \*/);
    assert.match(profileStepSource, /<select required value=\{form\.subCategory \|\| 'Programmes'\}/);
    assert.doesNotMatch(profileStepSource, /Sub-Category/);
    for (const fieldName of ['website', 'socialLinks', 'SOCIAL_PLATFORMS', 'contactPhone', 'whatsappContact', 'contactEmail', 'ctaLabel', 'ctaUrl', 'venueNote']) {
        assert.match(profileStepSource, new RegExp(fieldName));
    }
    assert.match(profileStepSource, /Venue note/);
    assert.doesNotMatch(profileStepSource, /renderOfferingFreshnessFields\(\)/);
    assert.match(scheduleStepSource, /availabilityEnabled/);
    assert.match(scheduleStepSource, /availabilityCount/);
    assert.match(scheduleStepSource, /availabilityUnit/);
    assert.match(scheduleStepSource, /isHidden/);
    assert.match(scheduleStepSource, /hideFrom/);
    assert.match(scheduleStepSource, /hideUntil/);
    assert.match(scheduleStepSource, /renderSystemUpdateRecord\('Offering'\)/);
    assert.doesNotMatch(scheduleStepSource, /renderOfferingFreshnessFields\(\)/);
    assert.doesNotMatch(assetFormSource, /function renderOfferingFreshnessFields/);
    assert.doesNotMatch(assetFormSource, /Freshness check/);
    assert.doesNotMatch(assetFormSource, /Mark reviewed today/);
    assert.doesNotMatch(assetFormSource, /Last reviewed/);
    assert.match(assetFormSource, /function renderSystemUpdateRecord/);
    assert.match(assetFormSource, /System update record/);
    assert.match(assetFormSource, /CareAround SG records who saves this/);
    assert.match(hostCoverageStepSource, /locationIds/);
    assert.match(hostCoverageStepSource, /coverageRegionIds/);
    assert.match(visibilityStepSource, /EligibilityRulesEditor/);
    assert.doesNotMatch(visibilityStepSource, /isHidden/);
    assert.doesNotMatch(visibilityStepSource, /hideFrom/);
    assert.doesNotMatch(visibilityStepSource, /hideUntil/);
    assert.match(assetFormSource, /const isOfferingLinkedToHostPlace = !isHard && Array\.isArray\(form\.locationIds\) && form\.locationIds\.length > 0;/);
    assert.match(accessStepSource, /if \(!initialData\?\.id\) return renderSavedToolUnlockMessage\('Access'\);/);
    assert.match(accessStepSource, /if \(isOfferingLinkedToHostPlace\)/);
    assertSourceOrder(accessStepSource, "if (!initialData?.id) return renderSavedToolUnlockMessage('Access');", 'if (isOfferingLinkedToHostPlace)');
    assert.match(accessStepSource, /Access is inherited from the host Place/);
    assert.match(accessStepSource, /AssetAccessPanel/);
    assert.match(accessStepSource, /data-resource-wizard-skip-validity/);
    assert.match(accessStepSource, /assetType="soft"/);
    assert.match(accessStepSource, /onChanged=\{onResourceToolsChanged\}/);
    assert.match(translationStepSource, /TranslationReviewPanel/);
    assert.match(translationStepSource, /data-resource-wizard-skip-validity/);
    assert.match(translationStepSource, /resourceType="soft"/);
    assert.match(restrictedStepSource, /PrivateResourceContentEditor/);
    assert.match(restrictedStepSource, /data-resource-wizard-skip-validity/);
    assert.match(restrictedStepSource, /resourceType="soft"/);
});

test('Offering wizard routes hidden profile URL and email validation back to Profile', () => {
    const offeringValidationSource = sourceBetween(assetFormSource, 'function getOfferingStepValidationError(stepIndex = activeOfferingStep)', 'function validateOfferingStep');
    const allStepsValidationSource = sourceBetween(assetFormSource, 'function validateAllOfferingSteps()', 'async function handleOfferingWizardSave()');
    const profileContactValidationSource = sourceBetween(assetFormSource, 'function getOfferingProfileContactValidationError()', 'function getPlaceStepValidationError');

    assert.match(offeringValidationSource, /if \(stepIndex === 0\)/);
    assert.match(offeringValidationSource, /getOfferingProfileContactValidationError\(\)/);
    assert.match(profileContactValidationSource, /form\.website/);
    assert.match(profileContactValidationSource, /form\.contactEmail/);
    assert.match(profileContactValidationSource, /form\.ctaUrl/);
    assert.match(profileContactValidationSource, /getInvalidSocialLinkMessage\(\)/);
    assert.match(profileContactValidationSource, /isValidOptionalHttpUrl/);
    assert.match(profileContactValidationSource, /isValidOptionalEmail/);
    assert.match(allStepsValidationSource, /for \(const stepIndex of \[0, 2, 3\]\)/);
    assert.match(allStepsValidationSource, /setActiveOfferingStep\(stepIndex\)/);
});

test('Offering wizard routes hidden eligibility age validation back to Visibility', () => {
    const offeringValidationSource = sourceBetween(assetFormSource, 'function getOfferingStepValidationError(stepIndex = activeOfferingStep)', 'function validateOfferingStep');
    const allStepsValidationSource = sourceBetween(assetFormSource, 'function validateAllOfferingSteps()', 'async function handleOfferingWizardSave()');
    const eligibilityAgeValidationSource = sourceBetween(assetFormSource, 'function getEligibilityAgeValidationError(rules)', 'function normalizeFormText(value)');

    assert.match(offeringValidationSource, /if \(stepIndex === 3\)/);
    assert.match(offeringValidationSource, /getEligibilityAgeValidationError\(form\.eligibilityRules\)/);
    assert.match(eligibilityAgeValidationSource, /Eligibility age must use whole numbers greater than or equal to 0\./);
    assert.match(eligibilityAgeValidationSource, /Eligibility minimum age cannot be greater than maximum age\./);
    assert.match(allStepsValidationSource, /for \(const stepIndex of \[0, 2, 3\]\)/);
    assert.match(allStepsValidationSource, /setActiveOfferingStep\(stepIndex\)/);
});

test('Dashboard soft asset rows remove duplicate Access shortcut after Offering wizard migration', () => {
    const softTabSource = sourceBetween(resourcesPageSource, ") : activeTab === 'soft' ? (", "templateListStatus === 'load-error' ? (");

    assert.doesNotMatch(softTabSource, /openAssetAccess\(asset, 'soft'\)/);
    assert.doesNotMatch(softTabSource, />\s*Access\s*</);
    assert.doesNotMatch(softTabSource, /<AssetAccessPanel/);
    assert.doesNotMatch(softTabSource, /assetType="soft"/);
    assert.doesNotMatch(softTabSource, /inlineAction\?\.assetType === 'soft'/);
    assert.doesNotMatch(softTabSource, /inlineAction\?\.type === 'access'/);
    assert.match(softTabSource, /<Pencil size=\{15\} \/> <span>\{isChild \? 'Edit place version' : 'Edit'\}<\/span>/);
});
