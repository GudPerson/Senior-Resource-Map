import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { LOCALES, translateUi } from '../src/lib/i18n.js';

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
        'profileTitle',
    ];

    for (const { code } of LOCALES.filter((locale) => locale.code !== 'en')) {
        for (const key of recentUiKeys) {
            assert.notEqual(translateUi(code, key), translateUi('en', key), `${key} should be translated for ${code}`);
        }
    }
});
