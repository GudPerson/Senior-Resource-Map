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
        if (!postalCode) {
            throw new Error(`Invalid postal code "${token}". Boundary uploads only support exact 6-digit postal codes.`);
        }

        if (seen.has(postalCode)) continue;
        seen.add(postalCode);
        postalCodes.push(postalCode);
    }

    return postalCodes;
}

export function serializePostalCodeList(rawValue) {
    return parsePostalCodeListInput(rawValue).join(', ');
}

export function createPostalCodeSet(postalCodes) {
    return new Set(parsePostalCodeListInput(postalCodes));
}

export function getBoundaryStatus(postalCode, postalCodes) {
    const normalizedPostalCode = normalizePostalCode(postalCode);
    if (!postalCodes || postalCodes.size === 0) return 'no-boundary';
    if (!normalizedPostalCode) return 'missing-postal';
    return postalCodes.has(normalizedPostalCode) ? 'inside' : 'outside';
}
