import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { LOCALES, translateUi } from '../src/lib/i18n.js';
import { enDictionary } from '../src/locales/en.js';
import { msDictionary } from '../src/locales/ms.js';
import { taDictionary } from '../src/locales/ta.js';
import { zhCnDictionary } from '../src/locales/zh-CN.js';
import * as softAssetBuckets from '../src/lib/softAssetBuckets.js';

function readDictionaries() {
    return {
        en: enDictionary,
        'zh-CN': zhCnDictionary,
        ms: msDictionary,
        ta: taDictionary,
    };
}

test('every supported UI locale defines the same keys as English', () => {
    const dictionaries = readDictionaries();
    const englishKeys = Object.keys(dictionaries.en);

    for (const { code } of LOCALES) {
        const missingKeys = englishKeys.filter((key) => !(key in dictionaries[code]));
        assert.deepEqual(missingKeys, [], `${code} is missing UI translation keys`);
    }
});

test('embedded resource availability uses the compact Programmes / Services label', () => {
    const dictionaries = readDictionaries();

    assert.equal(
        dictionaries.en.embedMapOpenProgrammeServiceCount,
        '{{count}} Programmes / Services',
    );
    for (const { code } of LOCALES) {
        assert.match(dictionaries[code].embedMapOpenProgrammeServiceCount, /\//);
    }
});

test('recent user-facing UI labels do not fall back to English in supported translated locales', () => {
    const recentUiKeys = [
        'authHandoffTitle',
        'authHandoffSubtitle',
        'phoneLoginRegisterButton',
        'updateSharedLink',
        'embedPreviewSnapshotTitle',
        'embedPreviewSnapshotDescription',
        'includeAnnotationsInShare',
        'includeAnnotationsInShareHelp',
        'noAnnotationsToShare',
        'mapStudioResourceCategoriesSummary',
        'shareLinkNeedsUpdateTitle',
        'shareLinkNeedsUpdateDescription',
        'copyExistingLink',
        'sharedMapSnapshotTitle',
        'mapNotes',
        'mapNotesPrivacyHelp',
        'mapNoteMarkdownBold',
        'mapNoteMarkdownItalic',
        'mapNoteMarkdownBulletList',
        'mapNoteMarkdownNumberedList',
        'mapNoteMarkdownLink',
        'mapNoteMarkdownPreview',
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
        'grabGuideTitle',
        'grabGuideCopiedLabel',
        'grabGuideStepWhereTo',
        'grabGuideStepPaste',
        'grabGuideSkipLabel',
        'grabGuideOpenGrab',
        'softAssetBucketProgrammes',
        'softAssetBucketServices',
        'softAssetBucketPromotions',
        'careCalendarToday',
        'careCalendarDayView',
        'careCalendarWeekView',
        'careCalendarMonthView',
        'careCalendarPreviousDay',
        'careCalendarNextDay',
        'printLayout',
        'printLayoutBalanced',
        'printLayoutMapFocus',
        'printMapPosition',
        'printMapWidth',
        'printLabelDetail',
        'printLabelNamesOnly',
        'printLabelNamesLogos',
        'printLabelNamesAddresses',
        'printLabelFullDetails',
        'townMapsTitle',
        'townMapsIntro',
        'townMapsSearchPlaceholder',
        'townMapsMobileDownloadHelp',
        'townMapsUnavailableTitle',
        'townMapsPngDetails',
        'townMapsPdfDetails',
        'townMapsDownloadFailed',
        'arrangeCategories',
        'refineCategorySequence',
        'refineCategorySequenceHelp',
        'categoryNumberedPinShape',
        'categoryNumberedPinShapeHelp',
        'categoryPinShapeCircle',
        'categoryPinShapeTriangle',
        'categoryPinShapeStar',
        'categoryPinShapeSquare',
        'categoryPinShapePentagon',
        'categoryPinShapeForCategory',
        'categoryPinNumberColour',
        'categoryPinNumberColourForCategory',
        'categoryPinNumberColourAutomatic',
        'categoryPinNumberColourCustom',
        'categoryPinPreview',
        'categoryPinPreviewForCategory',
        'applyCategoryRefinements',
        'moveCategoryEarlier',
        'moveCategoryLater',
        'resetCategoryOrder',
        'saveCategoryOrder',
        'failedUpdateCategoryOrder',
        'removeFromMap',
        'removingFromMap',
        'removeMapResourceTitle',
        'removeMapResourceMessage',
        'removeMapResourceDetail',
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
