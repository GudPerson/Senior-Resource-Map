import { enDictionary } from '../locales/en.js';
import { zhCnDictionary } from '../locales/zh-CN.js';
import { msDictionary } from '../locales/ms.js';
import { taDictionary } from '../locales/ta.js';

export const LOCALES = [
    { code: 'en', label: 'English', shortLabel: 'EN' },
    { code: 'zh-CN', label: 'Mandarin', shortLabel: '中文' },
    { code: 'ms', label: 'Malay', shortLabel: 'MS' },
    { code: 'ta', label: 'Tamil', shortLabel: 'TA' },
];

export const DEFAULT_LOCALE = 'en';

const dictionaries = {
    en: enDictionary,
    'zh-CN': zhCnDictionary,
    ms: msDictionary,
    ta: taDictionary,
};

export function getIntlLocale(locale) {
    if (locale === 'zh-CN') return 'zh-SG';
    if (locale === 'ms') return 'ms-SG';
    if (locale === 'ta') return 'ta-SG';
    return 'en-SG';
}

export function isSupportedLocale(locale) {
    return LOCALES.some((item) => item.code === locale);
}

export function translateUi(locale, key, params = {}) {
    const dictionary = dictionaries[isSupportedLocale(locale) ? locale : DEFAULT_LOCALE] || dictionaries.en;
    const template = dictionary[key] || dictionaries.en[key] || key;
    return Object.entries(params).reduce(
        (text, [param, value]) => text.replaceAll(`{{${param}}}`, String(value)),
        template,
    );
}
