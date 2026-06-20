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
    assert.match(groupFormSource, /isGroupAsset/);
});

test('Group asset form uses upload controls for logo and banner images', () => {
    assert.match(groupFormSource, /ImageUpload/);
    assert.match(groupFormSource, /label="Logo \/ Icon"/);
    assert.match(groupFormSource, /label="Hero Banner"/);
    assert.doesNotMatch(groupFormSource, /Logo URL/);
    assert.doesNotMatch(groupFormSource, /Banner URL/);
});
