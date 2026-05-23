import {
    buildDeterministicExternalKey,
    EXTERNAL_KEY_MAX_LENGTH,
    normalizeExternalKey,
} from './externalKeys.js';

function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function appendNumericSuffix(base, attempt) {
    const suffix = String(attempt);
    const truncated = base
        .slice(0, EXTERNAL_KEY_MAX_LENGTH - suffix.length - 1)
        .replace(/-+$/g, '');
    return `${truncated}-${suffix}`;
}

export function allocateUniqueSoftAssetExternalKeys(entries = [], existingKeys = new Set()) {
    const used = new Set([...existingKeys].filter(Boolean));

    return entries.map((entry) => {
        const name = entry?.payload?.name || entry?.name || 'offering';
        const base = normalizeExternalKey(buildDeterministicExternalKey('offering', name));
        let candidate = base;
        let attempt = 1;

        while (used.has(candidate)) {
            attempt += 1;
            candidate = appendNumericSuffix(base, attempt);
        }

        used.add(candidate);
        return candidate;
    });
}

export function buildImportRowFailureResult(reviewedRow, rowKey, err) {
    const result = {
        id: rowKey,
        status: 'failed',
        error: err?.message || 'Failed to process this draft row.',
    };
    const name = normalizeText(reviewedRow?.name);
    if (name) result.name = name;
    return result;
}
