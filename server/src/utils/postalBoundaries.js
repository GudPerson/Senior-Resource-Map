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

const MAX_RANGE_SIZE = 200000;

export function parsePostalCodeListInput(rawValue) {
    const seen = new Set();
    const postalCodes = [];

    const tokens = tokenizePostalInput(rawValue);
    
    for (const token of tokens) {
        // Handle Range: START-END
        if (typeof token === 'string' && token.includes('-')) {
            const [startRaw, endRaw] = token.split('-').map(t => t.trim());
            const startStr = normalizePostalCode(startRaw);
            const endStr = normalizePostalCode(endRaw);

            if (!startStr || !endStr) {
                throw new Error(`Invalid range "${token}". Both start and end must be exact 6-digit postal codes.`);
            }

            const startNum = Number.parseInt(startStr, 10);
            const endNum = Number.parseInt(endStr, 10);

            if (startNum > endNum) {
                throw new Error(`Invalid range "${token}". Start must be less than or equal to end.`);
            }

            const rangeSize = endNum - startNum + 1;
            if (rangeSize > MAX_RANGE_SIZE) {
                throw new Error(`Range "${token}" is too large (${rangeSize.toLocaleString()} codes). Max range size is ${MAX_RANGE_SIZE.toLocaleString()}.`);
            }

            for (let i = startNum; i <= endNum; i++) {
                const code = String(i).padStart(6, '0');
                if (!seen.has(code)) {
                    seen.add(code);
                    postalCodes.push(code);
                }
            }
            continue;
        }

        const postalCode = normalizePostalCode(token);
        if (!postalCode) {
            throw new Error(`Invalid postal code "${token}". Boundary uploads only support exact 6-digit postal codes or ranges (e.g. 180000-189999).`);
        }

        if (!seen.has(postalCode)) {
            seen.add(postalCode);
            postalCodes.push(postalCode);
        }
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
