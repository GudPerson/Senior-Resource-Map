import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { enDictionary } from '../src/locales/en.js';
import { msDictionary } from '../src/locales/ms.js';
import { taDictionary } from '../src/locales/ta.js';
import { zhCnDictionary } from '../src/locales/zh-CN.js';
import { LOCALES, translateUi } from '../src/lib/i18n.js';

test('locale dictionaries remain independently owned with exact key parity', () => {
    const englishKeys = Object.keys(enDictionary).sort();
    assert.ok(englishKeys.length > 1000);
    assert.deepEqual(Object.keys(zhCnDictionary).sort(), englishKeys);
    assert.deepEqual(Object.keys(msDictionary).sort(), englishKeys);
    assert.deepEqual(Object.keys(taDictionary).sort(), englishKeys);
    assert.deepEqual(LOCALES.map((locale) => locale.code), ['en', 'zh-CN', 'ms', 'ta']);
});

test('i18n public translation behavior keeps locale, fallback and interpolation contracts', () => {
    assert.equal(translateUi('en', 'login'), enDictionary.login);
    assert.equal(translateUi('zh-CN', 'login'), zhCnDictionary.login);
    assert.equal(translateUi('unsupported', 'login'), enDictionary.login);
    assert.equal(translateUi('en', 'embedMapResults', { count: 3 }), '3 mapped resources');
    assert.equal(translateUi('en', 'missingTranslationKey'), 'missingTranslationKey');
});

test('i18n coordinator stays small and delegates content to locale modules', async () => {
    const source = await readFile(new URL('../src/lib/i18n.js', import.meta.url), 'utf8');
    assert.ok(source.split('\n').length < 100);
    assert.match(source, /\.\.\/locales\/en\.js/);
    assert.match(source, /\.\.\/locales\/zh-CN\.js/);
    assert.doesNotMatch(source, /loadingResources:\s*['"]/);
});
