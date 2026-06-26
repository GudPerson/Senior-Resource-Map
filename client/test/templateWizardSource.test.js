import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const templateFormSource = readFileSync(new URL('../src/components/SoftAssetTemplateForm.jsx', import.meta.url), 'utf8');
const eligibilityRulesEditorSource = readFileSync(new URL('../src/components/EligibilityRulesEditor.jsx', import.meta.url), 'utf8');
const resourcesPageSource = readFileSync(new URL('../src/pages/dashboard/ResourcesPage.jsx', import.meta.url), 'utf8');

function sourceBetween(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start + startMarker.length);
    assert.notEqual(start, -1, `Missing source marker: ${startMarker}`);
    assert.notEqual(end, -1, `Missing source marker: ${endMarker}`);
    return source.slice(start, end);
}

function stringArrayConstant(source, constantName) {
    const definition = source.match(new RegExp(`const ${constantName} = \\[([^\\]]+)\\];`));
    assert.ok(definition, `${constantName} definition should exist`);
    return [...definition[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
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

function assertSourceContainsAll(source, markers, label) {
    for (const marker of markers) {
        assert.match(source, marker, `${label} should include ${marker}`);
    }
}

test('Template form declares the ResourceWizardShell contract', () => {
    const templateSteps = stringArrayConstant(templateFormSource, 'TEMPLATE_STEPS');
    const templateShellSource = resourceWizardShellBlockContaining(templateFormSource, [
        'steps={TEMPLATE_STEPS}',
        'renderStep={renderTemplateStep}',
        'validateStep={validateTemplateStep}',
        'onSave={handleTemplateWizardSave}',
        'renderPreview={renderTemplatePreview}',
    ]);

    assert.match(templateFormSource, /import ResourceWizardShell from '\.\/ResourceWizardShell\.jsx';/);
    assert.deepEqual(templateSteps, ['Profile', 'Defaults', 'Visibility', 'Generate', 'Translate']);
    assert.match(templateShellSource, /activeStep=\{activeTemplateStep\}/);
    assert.match(templateShellSource, /setActiveStep=\{setActiveTemplateStep\}/);
    assert.match(templateShellSource, /saveLabel=\{initialData\?\.id \? 'Save Template' : 'Create Template'\}/);
    assert.match(templateShellSource, /previewLabel="Preview"/);
    assert.match(templateShellSource, /renderPreview=\{renderTemplatePreview\}/);
});

test('Template wizard declares step and preview renderers', () => {
    const renderTemplateStepSource = sourceBetween(templateFormSource, 'function renderTemplateStep(stepIndex)', 'function renderTemplatePreview');
    const renderTemplateStepBranches = [...renderTemplateStepSource.matchAll(/if \(stepIndex === (\d+)\) return (renderTemplate\w+)\(\);/g)]
        .map((match) => ({
            index: Number(match[1]),
            renderer: match[2],
        }));

    assert.deepEqual(renderTemplateStepBranches, [
        { index: 0, renderer: 'renderTemplateProfileStep' },
        { index: 1, renderer: 'renderTemplateDefaultsStep' },
        { index: 2, renderer: 'renderTemplateVisibilityStep' },
        { index: 3, renderer: 'renderTemplateGenerateStep' },
        { index: 4, renderer: 'renderTemplateTranslationStep' },
    ]);
    assert.match(renderTemplateStepSource, /return null;/);
    assert.match(templateFormSource, /function renderTemplatePreview\(\)/);
});

test('Template wizard places existing fields in the intended steps', () => {
    const profileStepSource = sourceBetween(templateFormSource, 'function renderTemplateProfileStep()', 'function renderTemplateDefaultsStep()');
    const defaultsStepSource = sourceBetween(templateFormSource, 'function renderTemplateDefaultsStep()', 'function renderTemplateVisibilityStep()');
    const visibilityStepSource = sourceBetween(templateFormSource, 'function renderTemplateVisibilityStep()', 'function renderTemplateGenerateStep()');

    assertSourceContainsAll(profileStepSource, [
        /ImageUpload/,
        /Logo \/ Icon/,
        /form\.logoUrl/,
        /Hero Banner/,
        /form\.bannerUrl/,
        /form\.externalKey/,
        /External Key/,
        /Template Name/,
        /form\.name/,
        /SOFT_ASSET_BUCKETS/,
        /<select required value=\{form\.bucket \|\| 'Programmes'\}/,
        /form\.bucket/,
        /<select required value=\{form\.subCategory \|\| 'Programmes'\}/,
        /form\.subCategory/,
        /MarkdownDescriptionField/,
        /id="template-description"/,
        /CreatableSelect/,
        /value=\{currentTags\}/,
        /newTags/,
    ], 'Profile step');

    assertSourceContainsAll(defaultsStepSource, [
        /form\.ownershipMode/,
        /OWNERSHIP_OPTIONS/,
        /Inherited from generated place access/,
        /Default Schedule/,
        /form\.schedule/,
    ], 'Defaults step');

    assertSourceContainsAll(visibilityStepSource, [
        /Audience/,
        /form\.audienceMode/,
        /audience_zones/,
        /form\.isMemberOnly/,
        /For linked members/,
        /Target areas/,
        /value=\{selectedAudienceZoneOptions\}/,
        /audienceZoneIds/,
        /Generated place versions will use these target areas from the template\./,
        /EligibilityRulesEditor/,
        /These demographic rules are copied into generated place versions\./,
    ], 'Visibility step');
});

test('Template wizard keeps translation and generation guidance', () => {
    const generateStepSource = sourceBetween(templateFormSource, 'function renderTemplateGenerateStep()', 'function renderTemplateTranslationStep()');
    const translationStepSource = sourceBetween(templateFormSource, 'function renderTemplateTranslationStep()', 'function renderTemplateStep(stepIndex)');

    assert.match(generateStepSource, /Inherited from generated place access/);
    assert.match(generateStepSource, /Save the template first, then generate hidden place-specific offerings from the template panel\./);
    assert.match(translationStepSource, /TranslationReviewPanel/);
    assert.match(translationStepSource, /data-resource-wizard-skip-validity/);
    assert.match(translationStepSource, /resourceType="template"/);
    assert.match(translationStepSource, /Save this template first, then edit it again to review Mandarin, Malay, and Tamil translations\./);
});

test('Template wizard preserves the existing save payload contract', () => {
    const payloadSource = sourceBetween(templateFormSource, 'const payload = {', 'if (!payload.name?.trim())');
    const payloadKeys = [...payloadSource.matchAll(/^\s{16}([A-Za-z0-9_]+):/gm)].map((match) => match[1]);

    assert.deepEqual(payloadKeys, [
        'externalKey',
        'name',
        'bucket',
        'subCategory',
        'description',
        'schedule',
        'logoUrl',
        'bannerUrl',
        'newTags',
        'ownershipMode',
        'partnerId',
        'audienceMode',
        'audienceZoneIds',
        'isMemberOnly',
        'eligibilityRules',
    ]);
    assertSourceContainsAll(payloadSource, [
        /externalKey: String\(form\.externalKey \|\| ''\)\.trim\(\) \|\| undefined/,
        /name: form\.name/,
        /bucket: form\.bucket \|\| 'Programmes'/,
        /subCategory: form\.subCategory \|\| 'Programmes'/,
        /description: form\.description \|\| null/,
        /schedule: form\.schedule \|\| null/,
        /logoUrl: form\.logoUrl \|\| null/,
        /bannerUrl: form\.bannerUrl \|\| null/,
        /newTags: form\.newTags \|\| \[\]/,
        /ownershipMode: 'system'/,
        /partnerId: null/,
        /audienceMode:/,
        /audienceZoneIds: form\.audienceMode === 'audience_zones' \? \(form\.audienceZoneIds \|\| \[\]\) : \[\]/,
        /isMemberOnly: Boolean\(form\.isMemberOnly\)/,
        /eligibilityRules: normalizeEligibilityRules\(form\.eligibilityRules\)/,
    ], 'Template payload');
    assert.doesNotMatch(payloadSource, /PrivateResourceContentEditor/);
    assert.doesNotMatch(payloadSource, /AssetAccessPanel/);
    assert.doesNotMatch(payloadSource, /\b(?:restricted|private|schema|permission|viewer|grant|file|notes|resourceType|accessGrants|accessMode|privateFiles|restrictedNotes)\b/i);
});

test('Template wizard avoids backend or permission-scope expansion', () => {
    const templateSteps = stringArrayConstant(templateFormSource, 'TEMPLATE_STEPS');

    assert.doesNotMatch(templateFormSource, /PrivateResourceContentEditor/);
    assert.doesNotMatch(templateFormSource, /AssetAccessPanel/);
    assert.ok(!templateSteps.includes('Restricted'), 'TEMPLATE_STEPS should not include Restricted');
    assert.doesNotMatch(templateFormSource, /renderTemplateRestrictedStep/);
    assert.doesNotMatch(templateFormSource, /resourceType=["']restricted["']/);
    assert.doesNotMatch(templateFormSource, />\s*Back\s*</);
    assert.doesNotMatch(templateFormSource, />\s*Next\s*</);
    assert.match(templateFormSource, /api\.createSoftAssetParent\(payload\)/);
    assert.match(templateFormSource, /api\.updateSoftAssetParent\(initialData\.id, payload\)/);
});

test('Template wizard routes validation failures to the owning steps', () => {
    const templateValidationSource = sourceBetween(templateFormSource, 'function getTemplateStepValidationError(stepIndex = activeTemplateStep)', 'function validateTemplateStep');
    const allStepsValidationSource = sourceBetween(templateFormSource, 'function validateAllTemplateSteps()', 'async function handleTemplateWizardSave()');
    const eligibilityAgeValidationSource = sourceBetween(templateFormSource, 'function getEligibilityAgeValidationError(rules)', 'export default function SoftAssetTemplateForm');

    assert.match(templateValidationSource, /if \(stepIndex === 0\)/);
    assert.match(templateValidationSource, /Add a template name to continue\./);
    assert.match(templateValidationSource, /if \(stepIndex === 2\)/);
    assert.match(templateValidationSource, /audienceMode === 'audience_zones'/);
    assert.match(templateValidationSource, /audienceZoneIds/);
    assert.match(templateValidationSource, /Select at least one audience zone for audience-zone templates\./);
    assert.match(templateValidationSource, /getEligibilityAgeValidationError\(form\.eligibilityRules\)/);
    assert.match(eligibilityAgeValidationSource, /Eligibility age must use whole numbers greater than or equal to 0\./);
    assert.match(eligibilityAgeValidationSource, /Eligibility minimum age cannot be greater than maximum age\./);
    assert.match(allStepsValidationSource, /for \(const stepIndex of \[0, 2\]\)/);
    assert.match(allStepsValidationSource, /setActiveTemplateStep\(stepIndex\)/);
});

test('EligibilityRulesEditor preserves raw age values for parent wizard validation', () => {
    const buildEditableRulesSource = sourceBetween(eligibilityRulesEditorSource, 'function buildEditableRules(rules)', 'function buildRulesPayload(state)');
    const buildRulesPayloadSource = sourceBetween(eligibilityRulesEditorSource, 'function buildRulesPayload(state)', 'export default function EligibilityRulesEditor');

    assert.match(buildEditableRulesSource, /ageMin: rawCriteria\?\.age\?\.min \?\? normalized\?\.criteria\?\.age\?\.min \?\? ''/);
    assert.match(buildEditableRulesSource, /ageMax: rawCriteria\?\.age\?\.max \?\? normalized\?\.criteria\?\.age\?\.max \?\? ''/);
    assert.match(buildRulesPayloadSource, /if \(!state\.enabled\) return null;/);
    assert.match(buildRulesPayloadSource, /version: 1/);
    assert.match(buildRulesPayloadSource, /min: state\.ageMin/);
    assert.match(buildRulesPayloadSource, /max: state\.ageMax/);
    assert.match(buildRulesPayloadSource, /anyOf: state\.genders/);
    assert.match(buildRulesPayloadSource, /anyOf: state\.chasCards/);
    assert.match(buildRulesPayloadSource, /anyOf: state\.caregiverStatuses/);
    assert.match(buildRulesPayloadSource, /anyOf: state\.propertyTypes/);
    assert.match(buildRulesPayloadSource, /anyOf: state\.volunteerInterests/);
    assert.doesNotMatch(buildRulesPayloadSource, /normalizeEligibilityRules/);
});

test('resource editor wizard modals use the wide static-shell layout', () => {
    const groupModalSource = sourceBetween(resourcesPageSource, '{groupModal ? (', '{assetModal ? (');
    const assetModalSource = sourceBetween(resourcesPageSource, '{assetModal ? (', '{templateModal ? (');
    const templateModalSource = sourceBetween(resourcesPageSource, '{templateModal ? (', '{generateModal ? (');

    for (const [label, modalSource] of [
        ['Group modal', groupModalSource],
        ['Asset modal', assetModalSource],
        ['Template modal', templateModalSource],
    ]) {
        assert.match(modalSource, /maxWidth="max-w-\[min\(96vw,1180px\)\]"/, `${label} should use the wide wizard modal`);
        assert.match(modalSource, /bodyClassName="overflow-hidden"/, `${label} should let the wizard own scrolling`);
    }
    assert.match(assetModalSource, /<AssetForm/);
    assert.match(groupModalSource, /<GroupAssetForm/);
    assert.match(templateModalSource, /<SoftAssetTemplateForm/);
});
