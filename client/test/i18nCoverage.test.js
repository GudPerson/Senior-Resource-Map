import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { LOCALES, translateUi } from '../src/lib/i18n.js';
import * as softAssetBuckets from '../src/lib/softAssetBuckets.js';

function readDictionaries() {
    const source = fs.readFileSync(new URL('../src/lib/i18n.js', import.meta.url), 'utf8');
    const match = source.match(/const dictionaries = ([\s\S]*?);\n\nexport function getIntlLocale/);
    assert.ok(match, 'i18n dictionaries block should be readable');
    return Function(`return (${match[1]});`)();
}

test('every supported UI locale defines the same keys as English', () => {
    const dictionaries = readDictionaries();
    const englishKeys = Object.keys(dictionaries.en);

    for (const { code } of LOCALES) {
        const missingKeys = englishKeys.filter((key) => !(key in dictionaries[code]));
        assert.deepEqual(missingKeys, [], `${code} is missing UI translation keys`);
    }
});

test('recent user-facing UI labels do not fall back to English in supported translated locales', () => {
    const recentUiKeys = [
        'authHandoffTitle',
        'authHandoffSubtitle',
        'phoneLoginRegisterButton',
        'updateSharedLink',
        'sharedMapSnapshotTitle',
        'mapNotes',
        'mapNotesPrivacyHelp',
        'failedSaveMapNotes',
        'discoveryRecommendedForYou',
        'discoveryRecommendedForThisLocation',
        'overviewResourcesTitle',
        'overviewAuditDescription',
        'profileTitle',
        'organisationWorkspaceTitle',
        'getDirectionsShort',
        'openInGrab',
        'copyAddressForGrab',
        'addressCopiedForGrab',
        'softAssetBucketProgrammes',
        'softAssetBucketServices',
        'softAssetBucketPromotions',
    ];

    for (const { code } of LOCALES.filter((locale) => locale.code !== 'en')) {
        for (const key of recentUiKeys) {
            assert.notEqual(translateUi(code, key), translateUi('en', key), `${key} should be translated for ${code}`);
        }
    }
});

test('resource cards localize directions and soft asset bucket labels', () => {
    assert.equal(
        typeof softAssetBuckets.getSoftAssetBucketLabel,
        'function',
        'soft asset bucket display labels should be centralized for localization',
    );

    const translatedBucketLabels = softAssetBuckets.SOFT_ASSET_BUCKETS.map((bucket) => (
        softAssetBuckets.getSoftAssetBucketLabel((key) => translateUi('zh-CN', key), bucket)
    ));
    assert.deepEqual(translatedBucketLabels, ['活动', '服务', '优惠']);

    const assetCardSource = fs.readFileSync(new URL('../src/components/AssetCard.jsx', import.meta.url), 'utf8');
    assert.equal(
        assetCardSource.includes('>Get directions<') || assetCardSource.includes('Get directions\n'),
        false,
        'Discover/resource cards should use the shared short directions translation key',
    );
    assert.match(
        assetCardSource,
        /getSoftAssetBucketLabel\(t,\s*bucket\)/,
        'Discover/resource cards should translate visible soft asset bucket labels',
    );

    const resourceDetailSource = fs.readFileSync(new URL('../src/components/ResourceDetailContent.jsx', import.meta.url), 'utf8');
    assert.match(
        resourceDetailSource,
        /getSoftAssetBucketLabel\(t,\s*bucket\)/,
        'Resource detail bucket tabs should translate visible soft asset bucket labels',
    );
});
