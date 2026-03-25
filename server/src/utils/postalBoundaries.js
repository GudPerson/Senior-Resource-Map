const EXACT_POSTAL_REGEX = /^\d{6}$/;

export function normalizePostalCode(value) {
    if (value === undefined || value === null) return '';
    // Fast path: if it's already a 6-digit number/string, return it directly
    if (typeof value === 'string' && value.length === 6 && /^\d+$/.test(value)) return value;
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 999999) {
        return String(value).padStart(6, '0');
    }
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
    if (Array.isArray(rawValue)) {
        // If it's already an array, assume they are potentially messy so still normalize, 
        // but skip the expensive regex and tokenization if they already match.
        const seen = new Set();
        const postalCodes = [];

        for (const item of rawValue) {
            const token = String(item).trim();
            // Fast-path: if it's already a 6-digit string, just add it.
            if (token.length === 6 && /^\d+$/.test(token)) {
                if (!seen.has(token)) {
                    seen.add(token);
                    postalCodes.push(token);
                }
            } else {
                const postalCode = normalizePostalCode(token);
                if (postalCode && !seen.has(postalCode)) {
                    seen.add(postalCode);
                    postalCodes.push(postalCode);
                }
            }
        }
        return postalCodes;
    }

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
    if (Array.isArray(rawValue)) {
        return rawValue.join(', ');
    }
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
