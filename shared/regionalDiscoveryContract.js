import { buildRegionalContactHref } from './regionalDiscoveryContactValues.js';

const CONTACT_STATUSES = ['available', 'hidden', 'needs-postal', 'temporarily-unavailable'];
const EVALUATION_STATUSES = ['none', 'inside-region', 'outside-region', 'coverage-unconfirmed', 'postal-unresolved'];

function invalid(path) {
    // Do not include untrusted field values or postal/contact context in errors.
    throw new TypeError(`Invalid regional discovery payload: ${path}`);
}

function object(value, required, optional, path) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(path);
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) invalid(path);
    const allowed = new Set([...required, ...optional]);
    for (const key of Reflect.ownKeys(value)) {
        if (!allowed.has(key) || !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value')) invalid(path);
    }
    for (const key of required) {
        if (!Object.hasOwn(value, key)) invalid(`${path}.${key}`);
    }
    return value;
}

function text(value, path, nullable = false) {
    if (nullable && value === null) return null;
    if (typeof value !== 'string' || (!nullable && !value.trim()) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) invalid(path);
    return value;
}

function choice(value, options, path) {
    if (!options.includes(value)) invalid(path);
    return value;
}

function array(value, normalize, path) {
    if (!Array.isArray(value)) invalid(path);
    return Array.from(value, (item, index) => normalize(item, `${path}[${index}]`));
}

function finite(value, minimum, maximum, path) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) invalid(path);
    return value;
}

function unique(values, path) {
    if (new Set(values).size !== values.length) invalid(path);
}

function entryKey(value, path) {
    text(value, path);
    if (!/^(hard|soft):[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value.split(':')[1]))) invalid(path);
    return value;
}

function url(value, path) {
    if (value === null) return null;
    text(value, path);
    if (!/^https?:\/\//i.test(value) || /\s/.test(value)) invalid(path);
    try {
        const parsed = new URL(value);
        if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) invalid(path);
    } catch {
        invalid(path);
    }
    return value;
}

function contact(raw, channel, path) {
    object(raw, ['status', 'appliesTo'], ['label', 'value', 'href'], path);
    const result = {
        status: choice(raw.status, CONTACT_STATUSES, `${path}.status`),
        appliesTo: choice(raw.appliesTo, ['service', 'entered-location'], `${path}.appliesTo`),
    };
    if (result.status !== 'available') {
        if (['label', 'value', 'href'].some((key) => Object.hasOwn(raw, key))) invalid(path);
        return result;
    }
    const label = text(raw.label, `${path}.label`);
    const value = text(raw.value, `${path}.value`);
    const href = text(raw.href, `${path}.href`);
    const expectedHref = buildRegionalContactHref(channel, value);
    if (!expectedHref || href !== expectedHref) invalid(path);
    return { ...result, label, value, href };
}

function category(raw, path) {
    object(raw, ['key', 'label'], [], path);
    return { key: text(raw.key, `${path}.key`), label: text(raw.label, `${path}.label`) };
}

function entry(raw, path) {
    object(raw, [
        'entryKey', 'publishedOrder', 'name', 'categoryKey', 'categoryLabel',
        'shortDescription', 'description', 'addressText', 'websiteUrl', 'logoUrl',
        'pinPlaceKeys', 'placement', 'recommended', 'distanceMeters', 'contacts',
    ], [], path);
    if (!Number.isSafeInteger(raw.publishedOrder) || raw.publishedOrder < 0) invalid(`${path}.publishedOrder`);
    if (typeof raw.recommended !== 'boolean') invalid(`${path}.recommended`);
    object(raw.contacts, ['email', 'phone'], [], `${path}.contacts`);
    const pinPlaceKeys = array(raw.pinPlaceKeys, text, `${path}.pinPlaceKeys`);
    unique(pinPlaceKeys, `${path}.pinPlaceKeys`);
    const placement = choice(raw.placement, ['plotted', 'intentionally-unplotted', 'coordinates-unavailable'], `${path}.placement`);
    if ((placement === 'plotted') !== (pinPlaceKeys.length > 0)) invalid(`${path}.placement`);
    return {
        entryKey: entryKey(raw.entryKey, `${path}.entryKey`),
        publishedOrder: raw.publishedOrder,
        name: text(raw.name, `${path}.name`),
        categoryKey: text(raw.categoryKey, `${path}.categoryKey`),
        categoryLabel: text(raw.categoryLabel, `${path}.categoryLabel`),
        shortDescription: text(raw.shortDescription, `${path}.shortDescription`, true),
        description: text(raw.description, `${path}.description`, true),
        addressText: text(raw.addressText, `${path}.addressText`, true),
        websiteUrl: url(raw.websiteUrl, `${path}.websiteUrl`),
        logoUrl: url(raw.logoUrl, `${path}.logoUrl`),
        pinPlaceKeys,
        placement,
        recommended: raw.recommended,
        distanceMeters: raw.distanceMeters === null ? null : finite(raw.distanceMeters, 0, Number.MAX_VALUE, `${path}.distanceMeters`),
        contacts: {
            email: contact(raw.contacts.email, 'email', `${path}.contacts.email`),
            phone: contact(raw.contacts.phone, 'phone', `${path}.contacts.phone`),
        },
    };
}

function pin(raw, path) {
    object(raw, ['placeKey', 'latitude', 'longitude', 'entryKeys'], [], path);
    const entryKeys = array(raw.entryKeys, entryKey, `${path}.entryKeys`);
    if (!entryKeys.length) invalid(`${path}.entryKeys`);
    unique(entryKeys, `${path}.entryKeys`);
    return {
        placeKey: text(raw.placeKey, `${path}.placeKey`),
        latitude: finite(raw.latitude, -90, 90, `${path}.latitude`),
        longitude: finite(raw.longitude, -180, 180, `${path}.longitude`),
        entryKeys,
    };
}

/**
 * Validate and copy the regional-only public V1 directory. Unknown fields fail
 * closed. This boundary does not grant publication permission or compute any
 * visibility, coverage, recommendations, distances, contacts or ordering.
 */
export function normalizeRegionalDiscoveryPayload(raw) {
    object(raw, ['schemaVersion', 'view', 'snapshotRevision', 'regionExtent', 'categories', 'entries', 'pins', 'evaluation'], [], 'directory');
    if (raw.schemaVersion !== 1 || raw.view !== 'regional-discovery') invalid('directory.version/view');
    const regionExtent = array(raw.regionExtent, (value, path) => finite(value, -180, 180, path), 'directory.regionExtent');
    if (regionExtent.length !== 4) invalid('directory.regionExtent');
    const [west, south, east, north] = regionExtent;
    if (west >= east || south >= north || south < -90 || north > 90) invalid('directory.regionExtent');
    const categories = array(raw.categories, category, 'directory.categories');
    if (!Array.isArray(raw.entries) || raw.entries.length > 500) invalid('directory.entries');
    const entries = array(raw.entries, entry, 'directory.entries');
    const pins = array(raw.pins, pin, 'directory.pins');
    unique(categories.map((item) => item.key), 'directory.categories');
    unique(entries.map((item) => item.entryKey), 'directory.entries');
    unique(pins.map((item) => item.placeKey), 'directory.pins');
    const categoriesByKey = new Map(categories.map((item) => [item.key, item]));
    const entriesByKey = new Map(entries.map((item) => [item.entryKey, item]));
    const pinsByKey = new Map(pins.map((item) => [item.placeKey, item]));
    for (const item of entries) {
        if (categoriesByKey.get(item.categoryKey)?.label !== item.categoryLabel) invalid('directory.entries.category');
        for (const key of item.pinPlaceKeys) {
            if (!pinsByKey.get(key)?.entryKeys.includes(item.entryKey)) invalid('directory.entries.pins');
        }
    }
    for (const item of pins) {
        for (const key of item.entryKeys) {
            if (!entriesByKey.get(key)?.pinPlaceKeys.includes(item.placeKey)) invalid('directory.pins.entries');
        }
    }
    object(raw.evaluation, ['status'], ['postalCode'], 'directory.evaluation');
    const evaluation = { status: choice(raw.evaluation.status, EVALUATION_STATUSES, 'directory.evaluation.status') };
    if (Object.hasOwn(raw.evaluation, 'postalCode')) {
        if (typeof raw.evaluation.postalCode !== 'string' || !/^\d{6}$/.test(raw.evaluation.postalCode)) invalid('directory.evaluation.postalCode');
        evaluation.postalCode = raw.evaluation.postalCode;
    }
    return {
        schemaVersion: 1,
        view: 'regional-discovery',
        snapshotRevision: text(raw.snapshotRevision, 'directory.snapshotRevision'),
        regionExtent, categories, entries, pins, evaluation,
    };
}

// Shared producer text checks use the exact public required/nullable semantics.
export { text as normalizeRegionalDiscoveryText };
