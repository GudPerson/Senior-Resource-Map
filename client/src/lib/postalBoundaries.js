const EXACT_POSTAL_REGEX = /^\d{6}$/;

export function normalizePostalCode(value) {
    if (value === undefined || value === null) return '';
    const digits = String(value).replace(/\D/g, '');
    return EXACT_POSTAL_REGEX.test(digits) ? digits : '';
}

function tokenizePostalInput(rawValue) {
    if (Array.isArray(rawValue)) {
        return rawValue.flatMap((value) => tokenizePostalInput(value));
    }

    if (rawValue === undefined || rawValue === null) return [];

    return String(rawValue)
        .split(/[\n,;]+/)
        .map((token) => token.trim())
        .filter(Boolean);
}

export function parsePostalCodeListInput(rawValue) {
    const seen = new Set();
    const postalCodes = [];

    for (const token of tokenizePostalInput(rawValue)) {
        const postalCode = normalizePostalCode(token);
        if (!postalCode || seen.has(postalCode)) continue;
        seen.add(postalCode);
        postalCodes.push(postalCode);
    }

    return postalCodes;
}

export function collectSubregionPostalCodes(subregions, scopedSubregionIds = []) {
    const scope = new Set((scopedSubregionIds || []).map(Number));
    return new Set(
        (subregions || [])
            .filter((subregion) => scope.has(Number(subregion.id)))
            .flatMap((subregion) => Array.isArray(subregion.postalCodesList) ? subregion.postalCodesList : [])
            .map((postalCode) => normalizePostalCode(postalCode))
            .filter(Boolean)
    );
}

export function getBoundaryStatus(postalCode, postalCodes) {
    if (!postalCodes || postalCodes.size === 0) return 'no-boundary';
    const normalizedPostalCode = normalizePostalCode(postalCode);
    if (!normalizedPostalCode) return 'missing-postal';
    return postalCodes.has(normalizedPostalCode) ? 'inside' : 'outside';
}

export function resolveSingleSubregionByPostal(subregions, rawPostalCode, scopedSubregionIds = null) {
    const postalCode = normalizePostalCode(rawPostalCode);
    if (!postalCode) {
        return { status: 'invalid', subregion: null, matches: [] };
    }

    const scope = Array.isArray(scopedSubregionIds) && scopedSubregionIds.length > 0
        ? new Set(scopedSubregionIds.map(Number))
        : null;

    const matches = (subregions || []).filter((subregion) => {
        if (scope && !scope.has(Number(subregion.id))) return false;
        const postalCodes = Array.isArray(subregion.postalCodesList) ? subregion.postalCodesList : [];
        return postalCodes.map(normalizePostalCode).includes(postalCode);
    });

    if (matches.length === 0) {
        return { status: 'missing', subregion: null, matches: [] };
    }
    if (matches.length > 1) {
        return { status: 'ambiguous', subregion: null, matches };
    }

    return { status: 'ok', subregion: matches[0], matches };
}
