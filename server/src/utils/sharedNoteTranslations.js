import { cleanText } from './inputValidation.js';
import {
    normalizeLocale,
    resolveTranslationConfig,
    translateTextBatchAutoSource,
} from './resourceTranslations.js';

const MAX_NOTE_TRANSLATION_ITEMS = 120;
const MAX_NOTE_TRANSLATION_LENGTH = 3000;

function getAssetKey(item) {
    if (item?.assetKey) return String(item.assetKey);
    if (item?.resourceType && Number.isInteger(item?.resourceId)) {
        return `${item.resourceType}-${item.resourceId}`;
    }
    return '';
}

function getVisibleNoteItems(item) {
    if (!Array.isArray(item?.notes?.items)) return [];
    return item.notes.items
        .map((note, index) => ({
            index,
            text: cleanText(note?.text || note?.noteText || '', MAX_NOTE_TRANSLATION_LENGTH),
            isShared: note?.isShared,
        }))
        .filter((note) => note.text && note.isShared !== false);
}

function collectRowSources(directory) {
    return (directory?.places || []).flatMap((place) => place?.rows || []);
}

export function collectSharedNoteTranslationItems(directory) {
    const seen = new Set();
    const items = [];
    const sources = [
        ...(Array.isArray(directory?.assets) ? directory.assets : []),
        ...collectRowSources(directory),
    ];

    for (const source of sources) {
        const assetKey = getAssetKey(source);
        if (!assetKey) continue;

        for (const note of getVisibleNoteItems(source)) {
            const key = `${assetKey}:${note.index}`;
            if (seen.has(key)) continue;
            seen.add(key);
            items.push({
                assetKey,
                noteIndex: note.index,
                text: note.text,
            });
            if (items.length >= MAX_NOTE_TRANSLATION_ITEMS) {
                return items;
            }
        }
    }

    return items;
}

export async function translateSharedMapNotes(env, directory, locale, options = {}) {
    const targetLocale = normalizeLocale(locale);
    if (!targetLocale) {
        return {
            locale: 'en',
            status: 'source',
            translations: {},
        };
    }

    const items = collectSharedNoteTranslationItems(directory);
    if (items.length === 0) {
        return {
            locale: targetLocale,
            status: 'empty',
            translations: {},
        };
    }

    const config = resolveTranslationConfig(env);
    if (!config) {
        return {
            locale: targetLocale,
            status: 'not_configured',
            translations: {},
        };
    }

    const translator = options.translator || translateTextBatchAutoSource;
    const translatedValues = await translator(config, targetLocale, items.map((item) => item.text));
    const translations = {};

    items.forEach((item, index) => {
        const translatedText = cleanText(translatedValues[index] || '', MAX_NOTE_TRANSLATION_LENGTH);
        if (!translatedText) return;
        translations[item.assetKey] = {
            ...(translations[item.assetKey] || {}),
            [item.noteIndex]: translatedText,
        };
    });

    return {
        locale: targetLocale,
        status: 'ok',
        translations,
    };
}
