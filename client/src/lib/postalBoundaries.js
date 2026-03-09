const EXACT_POSTAL_REGEX = /^\d{6}$/;
const PREFIX_POSTAL_REGEX = /^\d{1,5}\*?$/;
const RANGE_POSTAL_REGEX = /^(\d{6})\s*-\s*(\d{6})$/;

export function normalizePostalCode(value) {
    if (value === undefined || value === null) return '';
    const digits = String(value).replace(/\D/g, '');
    return EXACT_POSTAL_REGEX.test(digits) ? digits : '';
}

function tokenizeBoundaryInput(rawValue) {
    if (Array.isArray(rawValue)) {
        return rawValue.flatMap((value) => tokenizeBoundaryInput(value));
    }

    if (rawValue === undefined || rawValue === null) return [];

    return String(rawValue)
        .split(/[\n,;]+/)
        .map((token) => token.trim())
        .filter(Boolean);
}

function normalizeBoundaryToken(token) {
    const trimmed = token.trim().replace(/\s+/g, '');
    if (!trimmed) return null;

    const rangeMatch = trimmed.match(RANGE_POSTAL_REGEX);
    if (rangeMatch) {
        const start = rangeMatch[1];
        const end = rangeMatch[2];

        if (Number.parseInt(start, 10) > Number.parseInt(end, 10)) {
            return null;
        }

        return {
            type: 'range',
            start,
            end,
            normalized: `${start}-${end}`,
        };
    }

    if (EXACT_POSTAL_REGEX.test(trimmed)) {
        return {
            type: 'exact',
            value: trimmed,
            normalized: trimmed,
        };
    }

    if (PREFIX_POSTAL_REGEX.test(trimmed)) {
        const prefix = trimmed.endsWith('*') ? trimmed.slice(0, -1) : trimmed;
        return {
            type: 'prefix',
            value: prefix,
            normalized: prefix.length === 6 ? prefix : `${prefix}*`,
        };
    }

    return null;
}

export function parsePostalBoundaryInput(rawValue) {
    const seen = new Set();
    const patterns = [];

    for (const token of tokenizeBoundaryInput(rawValue)) {
        const parsed = normalizeBoundaryToken(token);
        if (!parsed || seen.has(parsed.normalized)) continue;
        seen.add(parsed.normalized);
        patterns.push(parsed);
    }

    return patterns;
}

export function matchesPostalBoundary(postalCode, rawPatterns) {
    const normalizedPostalCode = normalizePostalCode(postalCode);
    if (!normalizedPostalCode) return false;

    const patterns = Array.isArray(rawPatterns) && rawPatterns.length > 0 && rawPatterns[0]?.type
        ? rawPatterns
        : parsePostalBoundaryInput(rawPatterns);

    return patterns.some((pattern) => {
        if (pattern.type === 'exact') {
            return normalizedPostalCode === pattern.value;
        }

        if (pattern.type === 'prefix') {
            return normalizedPostalCode.startsWith(pattern.value);
        }

        if (pattern.type === 'range') {
            return normalizedPostalCode >= pattern.start && normalizedPostalCode <= pattern.end;
        }

        return false;
    });
}

export function collectSubregionPostalPatterns(subregions, scopedSubregionIds = []) {
    const scope = new Set((scopedSubregionIds || []).map(Number));
    return subregions
        .filter((subregion) => scope.has(Number(subregion.id)))
        .flatMap((subregion) => parsePostalBoundaryInput(subregion.postalPatternsList?.length ? subregion.postalPatternsList : subregion.postalPatterns));
}

export function getBoundaryStatus(postalCode, patterns) {
    if (!patterns || patterns.length === 0) return 'no-boundary';
    const normalizedPostalCode = normalizePostalCode(postalCode);
    if (!normalizedPostalCode) return 'missing-postal';
    return matchesPostalBoundary(normalizedPostalCode, patterns) ? 'inside' : 'outside';
}
