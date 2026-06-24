import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const assetCardSource = readFileSync(new URL('../src/components/AssetCard.jsx', import.meta.url), 'utf8');
const mobileCardSource = readFileSync(new URL('../src/features/discover/DiscoveryMobileBrowseCard.jsx', import.meta.url), 'utf8');
const detailSource = readFileSync(new URL('../src/components/ResourceDetailContent.jsx', import.meta.url), 'utf8');
const resourcesPageSource = readFileSync(new URL('../src/pages/dashboard/ResourcesPage.jsx', import.meta.url), 'utf8');
const groupFormSource = readFileSync(new URL('../src/components/GroupAssetForm.jsx', import.meta.url), 'utf8');

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
    assert.match(resourcesPageSource, /activeTab === 'groups'/);
    assert.match(resourcesPageSource, /Groups \(\{groupTabCount\}\)/);
    assert.match(resourcesPageSource, /GroupAssetForm/);
    assert.match(resourcesPageSource, /offeringSoftAssets = useMemo/);
    assert.match(resourcesPageSource, /groupMemberCandidates/);
    assert.match(resourcesPageSource, /hardAssets=\{groupMemberCandidates\.hard\}/);
    assert.match(resourcesPageSource, /softAssets=\{groupMemberCandidates\.soft\}/);

    assert.match(groupFormSource, /assetMode: 'group'/);
    assert.match(groupFormSource, /replaceSoftAssetGroupMembers/);
    assert.match(groupFormSource, /initialAccess/);
    assert.match(resourcesPageSource, /openAssetAccess\(asset, 'group'\)/);
    assert.match(groupFormSource, /isGroupAsset/);
});

test('Group asset form uses wizard sections and upload controls without legacy routing fields', () => {
    assert.match(groupFormSource, /Profile/);
    assert.match(groupFormSource, /Visibility/);
    assert.match(groupFormSource, /Access/);
    assert.match(groupFormSource, /Members/);
    assert.match(groupFormSource, /Review/);
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
    assert.match(groupFormSource, /PrivateResourceContentEditor/);
    assert.match(groupFormSource, /TranslationReviewPanel/);
    assert.match(groupFormSource, /resourceType="soft"/);
    assert.match(groupFormSource, /resourceId=\{initialData\.id\}/);
    assert.match(groupFormSource, /Group management tools unlock after this Group is saved/);
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
    assert.match(groupFormSource, /onClick=\{handleSubmit\}/);
    assert.doesNotMatch(groupFormSource, /type="submit" className="btn-primary" disabled=\{submitting\}/);
});

test('Group asset form omits the misleading review notes field', () => {
    assert.doesNotMatch(groupFormSource, /Review notes/);
    assert.doesNotMatch(groupFormSource, /venueNote/);
});

test('Group asset form uses resource profile fields and system update accountability', () => {
    assert.match(groupFormSource, /SOCIAL_PLATFORMS/);
    assert.match(groupFormSource, /Sub-category/);
    assert.match(groupFormSource, /Website/);
    assert.match(groupFormSource, /Social media/);
    assert.match(groupFormSource, /formatGroupUpdateSummary/);
    assert.match(groupFormSource, /socialLinks: form\.socialLinks/);
    assert.match(groupFormSource, /galleryUrls: normalizeGalleryUrls\(form\.galleryUrls\)/);
    assert.doesNotMatch(groupFormSource, /Freshness date/);
    assert.doesNotMatch(groupFormSource, /lastReviewedAt: form\.lastReviewedAt/);
});

test('Dashboard inline action guard preserves Group access drawers on the Groups tab', () => {
    assert.match(resourcesPageSource, /currentInlineAssetType = inlineAction\.assetType \|\| 'hard'/);
    assert.match(resourcesPageSource, /activeTab === 'groups'[\s\S]*\? 'group'/);
    assert.doesNotMatch(resourcesPageSource, /activeTab !== 'hard' && inlineAction\.assetType !== 'soft'/);
});
