import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const assetFormSource = readFileSync(new URL('../src/components/AssetForm.jsx', import.meta.url), 'utf8');
const assetAudienceZonesPanelSource = readFileSync(new URL('../src/components/AssetAudienceZonesPanel.jsx', import.meta.url), 'utf8');
const resourcesPageSource = readFileSync(new URL('../src/pages/dashboard/ResourcesPage.jsx', import.meta.url), 'utf8');

function sourceBetween(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start + startMarker.length);
    assert.notEqual(start, -1, `Missing source marker: ${startMarker}`);
    assert.notEqual(end, -1, `Missing source marker: ${endMarker}`);
    return source.slice(start, end);
}

test('AssetForm declares the Place wizard shell and step contract', () => {
    const stepsDefinition = assetFormSource.match(/const PLACE_STEPS = \[([^\]]+)\];/);
    assert.ok(stepsDefinition, 'PLACE_STEPS definition should exist');
    const placeSteps = [...stepsDefinition[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
    const renderPlaceStepSource = sourceBetween(assetFormSource, 'function renderPlaceStep(stepIndex)', 'function renderPlacePreviewInfoRow');
    const renderPlaceStepBranches = [...renderPlaceStepSource.matchAll(/if \(stepIndex === (\d+)\) return (renderPlace\w+)\(\);/g)]
        .map((match) => ({
            index: Number(match[1]),
            renderer: match[2],
        }));

    assert.match(assetFormSource, /import ResourceWizardShell from '\.\/ResourceWizardShell\.jsx';/);
    assert.deepEqual(placeSteps, ['Profile', 'Location', 'Visibility', 'Access', 'Zones', 'Translate', 'Restricted']);
    assert.match(assetFormSource, /<ResourceWizardShell/);
    assert.match(assetFormSource, /steps=\{PLACE_STEPS\}/);
    assert.match(assetFormSource, /function renderPlaceStep\(stepIndex\)/);
    assert.deepEqual(renderPlaceStepBranches, [
        { index: 0, renderer: 'renderPlaceProfileStep' },
        { index: 1, renderer: 'renderPlaceLocationStep' },
        { index: 2, renderer: 'renderPlaceVisibilityStep' },
        { index: 3, renderer: 'renderPlaceAccessStep' },
        { index: 4, renderer: 'renderPlaceZonesStep' },
        { index: 5, renderer: 'renderPlaceTranslationStep' },
        { index: 6, renderer: 'renderPlaceRestrictedStep' },
    ]);
    assert.match(renderPlaceStepSource, /return null;/);
    assert.match(assetFormSource, /renderStep=\{renderPlaceStep\}/);
    assert.match(assetFormSource, /function renderPlaceDetailPreview\(\)/);
    assert.match(assetFormSource, /renderPreview=\{renderPlaceDetailPreview\}/);
    assert.match(assetFormSource, /function getPlaceProfileContactValidationError\(\)/);
    assert.match(assetFormSource, /setActivePlaceStep\(stepIndex\)/);
});

test('Place wizard keeps markdown description and protected management panels', () => {
    const profileStepSource = sourceBetween(assetFormSource, 'function renderPlaceProfileStep()', 'function renderPlaceLocationStep()');
    const locationStepSource = sourceBetween(assetFormSource, 'function renderPlaceLocationStep()', 'function renderPlaceVisibilityStep()');
    const visibilityStepSource = sourceBetween(assetFormSource, 'function renderPlaceVisibilityStep()', 'function renderSavedToolUnlockMessage');
    const accessStepSource = sourceBetween(assetFormSource, 'function renderPlaceAccessStep()', 'function renderPlaceZonesStep()');
    const zonesStepSource = sourceBetween(assetFormSource, 'function renderPlaceZonesStep()', 'function renderPlaceTranslationStep()');
    const translationStepSource = sourceBetween(assetFormSource, 'function renderPlaceTranslationStep()', 'function renderPlaceRestrictedStep()');
    const restrictedStepSource = sourceBetween(assetFormSource, 'function renderPlaceRestrictedStep()', 'function renderPlaceStep(stepIndex)');

    assert.match(profileStepSource, /MarkdownDescriptionField/);
    assert.match(profileStepSource, /id="place-description"/);
    assert.match(profileStepSource, /<input required value=\{form\.name\}/);
    assert.match(locationStepSource, /<select required value=\{form\.country\}/);
    assert.match(locationStepSource, /<input required value=\{form\.postalCode\}/);
    assert.match(locationStepSource, /<input required value=\{form\.address\}/);
    assert.match(visibilityStepSource, /Visibility Settings/);
    assert.match(visibilityStepSource, /Hide from App/);
    assert.match(visibilityStepSource, /Scheduled Hide \(From\)/);
    assert.match(visibilityStepSource, /Scheduled Hide \(Until\)/);
    assert.match(visibilityStepSource, /renderSystemUpdateRecord\('Place'\)/);
    assert.doesNotMatch(visibilityStepSource, /Freshness check/);
    assert.doesNotMatch(visibilityStepSource, /Mark reviewed today/);
    assert.doesNotMatch(visibilityStepSource, /Last reviewed/);
    assert.match(accessStepSource, /AssetAccessPanel/);
    assert.match(accessStepSource, /data-resource-wizard-skip-validity/);
    assert.match(accessStepSource, /assetType="hard"/);
    assert.match(accessStepSource, /onChanged=\{onResourceToolsChanged\}/);
    assert.match(zonesStepSource, /AssetAudienceZonesPanel/);
    assert.match(zonesStepSource, /data-resource-wizard-skip-validity/);
    assert.match(zonesStepSource, /onChanged=\{onResourceToolsChanged\}/);
    assert.match(translationStepSource, /TranslationReviewPanel/);
    assert.match(translationStepSource, /data-resource-wizard-skip-validity/);
    assert.match(translationStepSource, /resourceType="hard"/);
    assert.match(restrictedStepSource, /PrivateResourceContentEditor/);
    assert.match(restrictedStepSource, /data-resource-wizard-skip-validity/);
    assert.match(restrictedStepSource, /resourceType="hard"/);
    assert.match(assetFormSource, /function renderSystemUpdateRecord/);
    assert.match(assetFormSource, /System update record/);
    assert.match(assetFormSource, /CareAround SG records who saves this/);
});

test('Place wizard routes hidden profile URL validation back to Profile', () => {
    const placeValidationSource = sourceBetween(assetFormSource, 'function getPlaceStepValidationError(stepIndex = activePlaceStep)', 'function validatePlaceStep');
    const profileContactValidationSource = sourceBetween(assetFormSource, 'function getPlaceProfileContactValidationError()', 'function getOfferingProfileContactValidationError()');
    const allStepsValidationSource = sourceBetween(assetFormSource, 'function validateAllPlaceSteps()', 'async function handlePlaceWizardSave()');

    assert.match(placeValidationSource, /if \(stepIndex === 0\)/);
    assert.match(placeValidationSource, /getPlaceProfileContactValidationError\(\)/);
    assert.match(profileContactValidationSource, /form\.website/);
    assert.match(profileContactValidationSource, /getInvalidSocialLinkMessage\(\)/);
    assert.match(profileContactValidationSource, /isValidOptionalHttpUrl/);
    assert.match(allStepsValidationSource, /for \(const stepIndex of \[0, 1\]\)/);
    assert.match(allStepsValidationSource, /setActivePlaceStep\(stepIndex\)/);
});

test('Audience zones panel notifies parent resources after zone mutations', () => {
    const createSource = sourceBetween(assetAudienceZonesPanelSource, 'async function handleCreate(e)', 'async function handleDelete(zone)');
    const deleteSource = sourceBetween(assetAudienceZonesPanelSource, 'async function handleDelete(zone)', 'const feedbackClass = feedback?.type');

    assert.match(assetAudienceZonesPanelSource, /export default function AssetAudienceZonesPanel\(\{ asset, currentUser, onChanged \}\)/);
    assert.match(createSource, /await api\.createAudienceZone/);
    assert.match(createSource, /await loadZones\(\);\s*await onChanged\?\.\(\);/);
    assert.match(deleteSource, /await api\.deleteAudienceZone/);
    assert.match(deleteSource, /await loadZones\(\);\s*await onChanged\?\.\(\);/);
});

test('Dashboard hard asset rows remove duplicate Access and Zones shortcuts after wizard migration', () => {
    const hardTabSource = sourceBetween(resourcesPageSource, ") : activeTab === 'hard' ? (", ") : activeTab === 'groups' ? (");

    assert.doesNotMatch(hardTabSource, /openAssetAccess\(asset\)/);
    assert.doesNotMatch(hardTabSource, /openAssetZones\(asset\)/);
    assert.doesNotMatch(hardTabSource, />\s*Access\s*</);
    assert.doesNotMatch(hardTabSource, />\s*Zones\s*</);
    assert.doesNotMatch(hardTabSource, /<AssetAccessPanel/);
    assert.doesNotMatch(hardTabSource, /assetType="hard"/);
    assert.doesNotMatch(hardTabSource, /<AssetAudienceZonesPanel/);
    assert.match(hardTabSource, /<Pencil size=\{15\} \/> Edit/);
    assert.match(hardTabSource, /<Plus size=\{15\} \/> Add Offering/);
    assert.match(hardTabSource, /<Files size=\{15\} \/> Import Material/);
    assert.match(hardTabSource, /<Users size=\{15\} \/> Memberships/);
});
