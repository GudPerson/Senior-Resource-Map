import { DEFAULT_LOCALE } from './i18n.js';

function isBlank(value) {
    return value === undefined || value === null || String(value).trim() === '';
}

function getTranslationEntry(resource, locale) {
    if (!resource || locale === DEFAULT_LOCALE) return null;
    return resource.translations?.[locale] || null;
}

function isUsableTranslation(entry, field) {
    if (!entry || isBlank(entry.fields?.[field])) return false;
    const status = entry.fieldMeta?.[field]?.status;
    return status !== 'stale';
}

export function getLocalizedField(resource, field, locale = DEFAULT_LOCALE) {
    const entry = getTranslationEntry(resource, locale);
    if (isUsableTranslation(entry, field)) {
        return entry.fields[field];
    }
    return resource?.[field];
}

export function localizeResource(resource, locale = DEFAULT_LOCALE) {
    if (!resource || locale === DEFAULT_LOCALE) return resource;

    const localized = { ...resource };
    [
        'name',
        'subCategory',
        'address',
        'hours',
        'description',
        'schedule',
        'bucket',
        'ctaLabel',
        'venueNote',
        'availabilityUnit',
    ].forEach((field) => {
        const value = getLocalizedField(resource, field, locale);
        if (!isBlank(value)) {
            localized[field] = value;
        }
    });

    if (Array.isArray(resource.locations)) {
        localized.locations = resource.locations.map((location) => localizeResource(location, locale));
    }
    if (resource.location) {
        localized.location = localizeResource(resource.location, locale);
    }
    if (resource.hostLocation) {
        localized.hostLocation = localizeResource(resource.hostLocation, locale);
    }
    if (Array.isArray(resource.softAssets)) {
        localized.softAssets = resource.softAssets.map((asset) => localizeResource(asset, locale));
    }

    return localized;
}
