import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const assetCardSource = readFileSync(new URL('../src/components/AssetCard.jsx', import.meta.url), 'utf8');
const mobileCardSource = readFileSync(new URL('../src/features/discover/DiscoveryMobileBrowseCard.jsx', import.meta.url), 'utf8');
const detailSource = readFileSync(new URL('../src/components/ResourceDetailContent.jsx', import.meta.url), 'utf8');
const resourcesPageSource = readFileSync(new URL('../src/pages/dashboard/ResourcesPage.jsx', import.meta.url), 'utf8');
const groupFormSource = readFileSync(new URL('../src/components/GroupAssetForm.jsx', import.meta.url), 'utf8');
const wizardShellSource = readFileSync(new URL('../src/components/ResourceWizardShell.jsx', import.meta.url), 'utf8');
const translationPanelSource = readFileSync(new URL('../src/components/TranslationReviewPanel.jsx', import.meta.url), 'utf8');

function sourceBetween(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start + startMarker.length);
    assert.notEqual(start, -1, `Missing source marker: ${startMarker}`);
    assert.notEqual(end, -1, `Missing source marker: ${endMarker}`);
    return source.slice(start, end);
}

test('Discover cards render Groups as collection cards without location directions', () => {
    assert.match(assetCardSource, /isGroupAsset/);
    assert.match(assetCardSource, /formatGroupMemberCountLine/);
    assert.match(assetCardSource, /isGroup \? 'Group'/);
    assert.match(assetCardSource, /!isGroup && \(isHard \? Boolean\(address\) : locationCount > 0\)/);

    assert.match(mobileCardSource, /isGroupAsset/);
    assert.match(mobileCardSource, /formatGroupMemberCountLine/);
    assert.match(mobileCardSource, /isGroup \? 'Group'/);
    assert.match(mobileCardSource, /!isGroup && displayLocation/);
});

test('Resource detail renders Group members outside hard Place offering buckets', () => {
    assert.match(detailSource, /getGroupMemberSections/);
    assert.match(detailSource, /Included resources/);
    assert.match(detailSource, /groupMemberSections\.map/);
    assert.match(detailSource, /isHard && asset\.softAssets && asset\.softAssets\.length > 0/);
});

test('Resource detail nested Place and Group cards expose in-card favorite controls', () => {
    const groupMembersSource = sourceBetween(
        detailSource,
        'groupMemberSections.map((section)',
        '{isHard && asset.softAssets && asset.softAssets.length > 0',
    );
    const placeOfferingsSource = sourceBetween(
        detailSource,
        'relatedSoftAssetGroups[activeSoftBucket].length > 0 ?',
        'className="rounded-2xl border border-dashed',
    );

    assert.match(detailSource, /import SaveAssetButton from '\.\/SaveAssetButton\.jsx';/);
    assert.match(detailSource, /function buildNestedResourceSaveSummary/);
    assert.match(detailSource, /function handleRelatedResourceCardKeyDown/);
    assert.match(groupMembersSource, /<SaveAssetButton[\s\S]*resourceType=\{member\.resourceType\}[\s\S]*resourceId=\{member\.id\}/);
    assert.match(groupMembersSource, /summary=\{buildNestedResourceSaveSummary\(member, member\.resourceType\)\}/);
    assert.match(groupMembersSource, /role="button"/);
    assert.doesNotMatch(groupMembersSource, /<button[\s\S]*key=\{`\$\{member\.resourceType\}-\$\{member\.id\}`\}/);
    assert.match(placeOfferingsSource, /<SaveAssetButton[\s\S]*resourceType="soft"[\s\S]*resourceId=\{softAsset\.id\}/);
    assert.match(placeOfferingsSource, /summary=\{buildNestedResourceSaveSummary\(softAsset, 'soft', asset\)\}/);
});

test('Resource detail gives Groups public profile parity with visibility, update, and gallery context', () => {
    assert.match(detailSource, /getGroupVisibilitySummary/);
    assert.match(detailSource, /formatGroupUpdateSummary/);
    assert.match(detailSource, /getGroupGalleryUrls/);
    assert.match(detailSource, /Collection visibility/);
    assert.match(detailSource, /groupUpdateSummary\.label/);
    assert.match(detailSource, /\(isHard \|\| isGroup\) \? splitWebsiteAndSocialLinks/);
    assert.match(detailSource, /\(isHard \|\| isGroup\) \? <SocialLinksStrip/);
    assert.match(detailSource, /Gallery/);
    assert.match(detailSource, /groupGalleryUrls\.map/);
});

test('Dashboard Resources keeps Groups on a separate tab and editor path', () => {
    const groupTabSource = sourceBetween(resourcesPageSource, ") : activeTab === 'groups' ? (", ") : activeTab === 'soft' ? (");

    assert.match(resourcesPageSource, /activeTab === 'groups'/);
    assert.match(resourcesPageSource, /Groups \(\{groupTabCount\}\)/);
    assert.match(resourcesPageSource, /GroupAssetForm/);
    assert.match(resourcesPageSource, /offeringSoftAssets = useMemo/);
    assert.match(resourcesPageSource, /groupMemberCandidates/);
    assert.match(resourcesPageSource, /groupMemberHardCandidateParams/);
    assert.match(resourcesPageSource, /groupMemberSoftCandidateParams/);
    assert.doesNotMatch(resourcesPageSource, /fetchAllPaginatedResults\(api\.getHardAssets, hardResourceListParams\)/);
    assert.doesNotMatch(resourcesPageSource, /fetchAllPaginatedResults\(api\.getSoftAssets, softResourceListParams\)/);
    assert.match(resourcesPageSource, /hardAssets=\{groupMemberCandidates\.hard\}/);
    assert.match(resourcesPageSource, /softAssets=\{groupMemberCandidates\.soft\}/);

    assert.match(groupFormSource, /assetMode: 'group'/);
    assert.match(groupFormSource, /replaceSoftAssetGroupMembers/);
    assert.match(groupFormSource, /initialAccess/);
    assert.match(groupFormSource, /function renderAccessStep/);
    assert.match(groupFormSource, /<AssetAccessPanel asset=\{initialData\} assetType="group" \/>/);
    assert.doesNotMatch(groupTabSource, /openAssetAccess\(asset, 'group'\)/);
    assert.doesNotMatch(groupTabSource, /AssetAccessPanel/);
    assert.match(groupFormSource, /isGroupAsset/);
});

test('Group asset form uses wizard sections and upload controls without legacy routing fields', () => {
    const stepsDefinition = groupFormSource.match(/const STEPS = \[([^\]]+)\]/)?.[1] || '';

    assert.match(groupFormSource, /Profile/);
    assert.match(groupFormSource, /Visibility/);
    assert.match(groupFormSource, /Access/);
    assert.match(groupFormSource, /Members/);
    assert.match(groupFormSource, /Translate/);
    assert.match(groupFormSource, /Restricted/);
    assert.doesNotMatch(stepsDefinition, /Review/);
    assert.doesNotMatch(groupFormSource, /function renderReviewStep/);
    assert.match(groupFormSource, /ImageUpload/);
    assert.match(groupFormSource, /label="Logo \/ Icon"/);
    assert.match(groupFormSource, /label="Hero Banner"/);
    assert.match(groupFormSource, /label="Gallery Image"/);
    assert.match(groupFormSource, /Gallery images/);
    assert.match(groupFormSource, /Add gallery image/);
    assert.match(groupFormSource, /updateGalleryImage/);
    assert.match(groupFormSource, /Group Owner/);
    assert.doesNotMatch(groupFormSource, /Logo URL/);
    assert.doesNotMatch(groupFormSource, /Banner URL/);
    assert.doesNotMatch(groupFormSource, /Admin area/);
    assert.doesNotMatch(groupFormSource, /System owned/);
});

test('Group asset form exposes Target region visibility using existing Regions', () => {
    assert.match(groupFormSource, /Who can see this\?/);
    assert.match(groupFormSource, /Target region\/s/);
    assert.match(groupFormSource, /Search existing Regions/);
    assert.match(groupFormSource, /selectedRegionOptions/);
    assert.match(groupFormSource, /formatGroupRegionCountLine/);
    assert.match(groupFormSource, /filterGroupRegionOptions/);
    assert.match(groupFormSource, /coverageRegionIds/);
    assert.match(groupFormSource, /subregions = \[\]/);
    assert.match(resourcesPageSource, /subregions=\{subregions\}/);
});

test('Group asset form exposes protected notes/files and translation review for saved Groups', () => {
    const accessStepSource = sourceBetween(groupFormSource, 'function renderAccessStep()', 'function renderMembersStep()');
    const translationStepSource = sourceBetween(groupFormSource, 'function renderTranslationStep()', 'function renderRestrictedStep()');
    const restrictedStepSource = sourceBetween(groupFormSource, 'function renderRestrictedStep()', 'function renderPreviewInfoRow');

    assert.match(groupFormSource, /PrivateResourceContentEditor/);
    assert.match(groupFormSource, /TranslationReviewPanel/);
    assert.match(groupFormSource, /function renderTranslationStep/);
    assert.match(groupFormSource, /function renderRestrictedStep/);
    assert.match(accessStepSource, /data-resource-wizard-skip-validity/);
    assert.match(translationStepSource, /TranslationReviewPanel/);
    assert.match(translationStepSource, /data-resource-wizard-skip-validity/);
    assert.match(translationStepSource, /resourceType="soft"/);
    assert.match(translationStepSource, /resourceId=\{initialData\.id\}/);
    assert.match(translationStepSource, /excludedFields=\{GROUP_TRANSLATION_EXCLUDED_FIELDS\}/);
    assert.match(translationPanelSource, /excludedFields = EMPTY_EXCLUDED_FIELDS/);
    assert.match(translationPanelSource, /excludedFieldSet/);
    assert.match(translationPanelSource, /\.filter\(\(\[field\]\) => !excludedFieldSet\.has\(field\)\)/);
    assert.match(restrictedStepSource, /PrivateResourceContentEditor/);
    assert.match(restrictedStepSource, /data-resource-wizard-skip-validity/);
    assert.match(restrictedStepSource, /resourceType="soft"/);
    assert.match(restrictedStepSource, /resourceId=\{initialData\.id\}/);
    assert.match(groupFormSource, /Save this Group first\. Edit the saved Group again to use \{toolName\.toLowerCase\(\)\}/);
});

test('Dashboard lets direct Group assignees see Groups without broad Group creation rights', () => {
    assert.match(resourcesPageSource, /canCreateGroupResources = canManageResourceTools && canCreateStandaloneResources/);
    assert.match(resourcesPageSource, /canSeeGroupResources = canManageResourceTools/);
    assert.match(resourcesPageSource, /\{canSeeGroupResources \? \(/);
    assert.match(resourcesPageSource, /action=\{canCreateGroupResources && !searchTerm \? \(/);
    assert.doesNotMatch(resourcesPageSource, /\{canManageResourceTools && canCreateStandaloneResources \? \(\s*<button[\s\S]*Groups \(\{groupTabCount\}\)/);
});

test('Group asset edit access can submit without nesting inside the Group save form', () => {
    assert.doesNotMatch(groupFormSource, /<form onSubmit=\{handleSubmit\}/);
    assert.match(groupFormSource, /onSave=\{handleSubmit\}/);
    assert.doesNotMatch(groupFormSource, /type="submit" className="btn-primary" disabled=\{submitting\}/);
});

test('Group asset form omits the misleading review notes field', () => {
    assert.doesNotMatch(groupFormSource, /Review notes/);
    assert.match(groupFormSource, /GROUP_TRANSLATION_EXCLUDED_FIELDS = Object\.freeze\(\['venueNote'\]\)/);
    assert.doesNotMatch(groupFormSource, /updateField\('venueNote'/);
    assert.doesNotMatch(groupFormSource, /venueNote: form/);
});

test('Group asset form uses resource profile fields and system update accountability', () => {
    const profileStepSource = sourceBetween(groupFormSource, 'function renderProfileStep()', 'function renderAccessStep()');

    assert.match(groupFormSource, /SOCIAL_PLATFORMS/);
    assert.match(groupFormSource, /Sub-category/);
    assert.match(groupFormSource, /Website/);
    assert.match(groupFormSource, /Social media/);
    assert.match(groupFormSource, /MarkdownDescriptionField/);
    assert.match(groupFormSource, /MarkdownLiteText/);
    assert.match(groupFormSource, /formatGroupUpdateSummary/);
    assert.match(groupFormSource, /socialLinks: form\.socialLinks/);
    assert.match(groupFormSource, /galleryUrls: normalizeGalleryUrls\(form\.galleryUrls\)/);
    assert.match(profileStepSource, /id="group-description"/);
    assert.match(profileStepSource, /Contact phone/);
    assert.match(profileStepSource, /WhatsApp/);
    assert.match(profileStepSource, /Email/);
    assert.match(profileStepSource, /CTA label/);
    assert.match(profileStepSource, /CTA URL/);
    assert.match(profileStepSource, /updateSummary\.label/);
    assert.doesNotMatch(groupFormSource, /Freshness date/);
    assert.doesNotMatch(groupFormSource, /lastReviewedAt: form\.lastReviewedAt/);
});

test('Group asset form validates hidden Profile contact and action fields before save', () => {
    const profileValidationSource = sourceBetween(groupFormSource, 'function getProfileContactValidationError()', 'function validateStep(stepIndex = activeStep)');
    const validateStepSource = sourceBetween(groupFormSource, 'function validateStep(stepIndex = activeStep)', 'function validateSubmitSteps()');
    const submitValidationSource = sourceBetween(groupFormSource, 'function validateSubmitSteps()', 'async function handleSubmit(event)');

    assert.match(groupFormSource, /function isValidOptionalHttpUrl\(value\)/);
    assert.match(groupFormSource, /function isValidOptionalEmail\(value\)/);
    assert.match(profileValidationSource, /form\.website/);
    assert.match(profileValidationSource, /form\.contactEmail/);
    assert.match(profileValidationSource, /form\.ctaUrl/);
    assert.match(profileValidationSource, /normalizeSocialLinks\(form\.socialLinks\)/);
    assert.match(profileValidationSource, /SOCIAL_PLATFORMS\.find/);
    assert.match(profileValidationSource, /Enter a valid website URL starting with http:\/\/ or https:\/\/\./);
    assert.match(profileValidationSource, /Enter a valid contact email address\./);
    assert.match(profileValidationSource, /Enter a valid CTA URL starting with http:\/\/ or https:\/\/\./);
    assert.match(validateStepSource, /if \(stepIndex === 0\)/);
    assert.match(validateStepSource, /getProfileContactValidationError\(\)/);
    assert.match(validateStepSource, /setError\(profileContactMessage\)/);
    assert.match(submitValidationSource, /requiredSteps/);
    assert.match(submitValidationSource, /setActiveStep\(stepIndex\)/);
});

test('Group asset wizard uses static tab and action bars with preview instead of Back and Next', () => {
    const tabbarSource = sourceBetween(wizardShellSource, 'resource-wizard-tabbar', 'resource-wizard-workspace');

    assert.match(groupFormSource, /import ResourceWizardShell from '\.\/ResourceWizardShell\.jsx';/);
    assert.match(groupFormSource, /<ResourceWizardShell/);
    assert.match(groupFormSource, /steps=\{STEPS\}/);
    assert.match(groupFormSource, /renderStep=\{renderWizardStep\}/);
    assert.match(wizardShellSource, /resource-wizard-shell/);
    assert.match(wizardShellSource, /resource-wizard-tabbar/);
    assert.match(wizardShellSource, /resource-wizard-workspace/);
    assert.match(wizardShellSource, /resource-wizard-footer/);
    assert.match(groupFormSource, /renderGroupDetailPreview/);
    assert.match(wizardShellSource, /showPreview/);
    assert.match(wizardShellSource, /previewLabel = 'Preview'/);
    assert.match(groupFormSource, /previewTitle="Group detail preview"/);
    assert.match(groupFormSource, /previewDescription="Unsaved edits shown as a public resource detail page\."/);
    assert.match(groupFormSource, /Included resources/);
    assert.doesNotMatch(groupFormSource, /Group card preview/);
    assert.doesNotMatch(groupFormSource, /public resource card/);
    assert.match(groupFormSource, /onSave=\{handleSubmit\}/);
    assert.match(resourcesPageSource, /bodyClassName="overflow-hidden"/);
    assert.doesNotMatch(tabbarSource, /index \+ 1/);
    assert.doesNotMatch(tabbarSource, /text-\[11px\]/);
    assert.doesNotMatch(wizardShellSource, /goNext/);
    assert.doesNotMatch(wizardShellSource, /goPrevious/);
    assert.doesNotMatch(wizardShellSource, /ChevronLeft/);
    assert.doesNotMatch(wizardShellSource, /ChevronRight/);
    assert.doesNotMatch(wizardShellSource, /> Back/);
    assert.doesNotMatch(wizardShellSource, />\s*Next\s*</);
});

test('Dashboard keeps Group access inside the wizard instead of an inline row drawer', () => {
    const groupTabSource = sourceBetween(resourcesPageSource, ") : activeTab === 'groups' ? (", ") : activeTab === 'soft' ? (");

    assert.match(resourcesPageSource, /currentInlineAssetType = inlineAction\.assetType \|\| 'hard'/);
    assert.match(groupFormSource, /function renderAccessStep/);
    assert.match(groupFormSource, /<AssetAccessPanel asset=\{initialData\} assetType="group" \/>/);
    assert.doesNotMatch(groupTabSource, /openAssetAccess\(asset, 'group'\)/);
    assert.doesNotMatch(groupTabSource, /AssetAccessPanel/);
    assert.doesNotMatch(resourcesPageSource, /activeTab === 'groups'[\s\S]*\? 'group'/);
    assert.doesNotMatch(resourcesPageSource, /activeTab !== 'hard' && inlineAction\.assetType !== 'soft'/);
});
