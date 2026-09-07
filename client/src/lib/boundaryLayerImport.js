const POSTAL_KEYS = new Set(['postalcode', 'postcode']);
const REGION_KEYS = new Set(['region', 'regionname']);
const SUBREGION_KEYS = new Set(['subregion', 'subregionname']);
const MAX_REPORTED_ERRORS = 50;

function normalizeHeader(value) {
    return String(value || '').trim().replace(/[^a-z0-9]+/gi, '').toLowerCase();
}

function normalizeLabel(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
}

function readValue(row, acceptedKeys) {
    for (const [key, value] of Object.entries(row || {})) {
        if (acceptedKeys.has(normalizeHeader(key))) return value;
    }
    return '';
}

function normalizePostalCode(value) {
    if (value === undefined || value === null || value === '') return '';
    const raw = String(value).trim();
    if (/^\d{6}$/.test(raw)) return raw;
    if (/^\d{1,5}$/.test(raw)) return raw.padStart(6, '0');
    return '';
}

function pushError(state, message) {
    state.errorCount += 1;
    if (state.errors.length < MAX_REPORTED_ERRORS) state.errors.push(message);
}

function getOrCreate(map, key, create) {
    if (!map.has(key)) map.set(key, create());
    return map.get(key);
}

export function serializePostalCodeRanges(postalCodes = []) {
    const sorted = [...new Set(postalCodes)]
        .filter((value) => /^\d{6}$/.test(String(value)))
        .map(String)
        .sort();
    const tokens = [];
    let start = null;
    let previous = null;

    const flush = () => {
        if (start === null) return;
        tokens.push(start === previous ? start : `${start}-${previous}`);
    };

    for (const postalCode of sorted) {
        const current = Number.parseInt(postalCode, 10);
        if (previous !== null && current !== Number.parseInt(previous, 10) + 1) {
            flush();
            start = postalCode;
        } else if (start === null) {
            start = postalCode;
        }
        previous = postalCode;
    }
    flush();
    return tokens.join(',');
}

export function buildSubregionBoundaryRows(subregion, maxCellLength = 4500) {
    const serialized = serializePostalCodeRanges(subregion?.postalCodes || []);
    const tokens = serialized ? serialized.split(',') : [];
    const chunks = [];
    let current = '';
    for (const token of tokens) {
        const candidate = current ? `${current},${token}` : token;
        if (current && candidate.length > maxCellLength) {
            chunks.push(current);
            current = token;
        } else {
            current = candidate;
        }
    }
    if (current) chunks.push(current);

    return chunks.map((Running_Range) => ({
        subregionId: subregion?.subregionCode || subregion?.id,
        Running_Range,
    }));
}

export function buildBoundaryLayerImportPlan(rows = [], availableSubregions = []) {
    const state = { errorCount: 0, errors: [] };
    const subregionsByName = new Map();
    for (const subregion of Array.isArray(availableSubregions) ? availableSubregions : []) {
        const nameKey = normalizeLabel(subregion?.name).toLowerCase();
        if (nameKey) subregionsByName.set(nameKey, subregion);
    }

    const regionGroups = new Map();
    const subregionGroups = new Map();
    const subregionParentNames = new Map();
    const postalOwners = new Map();
    const unmappedPostalCodes = new Set();
    let duplicateRows = 0;
    let mappedPostalCodes = 0;

    for (let index = 0; index < rows.length; index += 1) {
        const rowNumber = index + 2;
        const postalCode = normalizePostalCode(readValue(rows[index], POSTAL_KEYS));
        const regionName = normalizeLabel(readValue(rows[index], REGION_KEYS));
        const subregionName = normalizeLabel(readValue(rows[index], SUBREGION_KEYS));

        if (!postalCode) {
            pushError(state, `Row ${rowNumber}: POSTAL CODE must be an exact six-digit code.`);
            continue;
        }
        if (!regionName) {
            pushError(state, `Row ${rowNumber}: REGION is required.`);
            continue;
        }

        const isUnmapped = regionName.toLowerCase() === 'unmapped';
        if (isUnmapped && subregionName) {
            pushError(state, `Row ${rowNumber}: Unmapped rows must not contain a SUBREGION.`);
            continue;
        }
        if (!isUnmapped && !subregionName) {
            pushError(state, `Row ${rowNumber}: mapped rows require a SUBREGION.`);
            continue;
        }

        const ownerKey = isUnmapped
            ? 'unmapped'
            : `${regionName.toLowerCase()}::${subregionName.toLowerCase()}`;
        const existingOwner = postalOwners.get(postalCode);
        if (existingOwner) {
            if (existingOwner === ownerKey) duplicateRows += 1;
            else pushError(state, `Row ${rowNumber}: postal code ${postalCode} has conflicting boundary assignments.`);
            continue;
        }
        if (isUnmapped) {
            postalOwners.set(postalCode, ownerKey);
            unmappedPostalCodes.add(postalCode);
            continue;
        }

        const subregion = subregionsByName.get(subregionName.toLowerCase());
        if (!subregion) {
            pushError(state, `Row ${rowNumber}: SUBREGION "${subregionName}" is not configured in CareAround SG.`);
            continue;
        }

        const priorParent = subregionParentNames.get(subregion.id);
        if (priorParent && priorParent.toLowerCase() !== regionName.toLowerCase()) {
            pushError(state, `Row ${rowNumber}: SUBREGION "${subregionName}" belongs to both "${priorParent}" and "${regionName}".`);
            continue;
        }
        subregionParentNames.set(subregion.id, regionName);
        postalOwners.set(postalCode, ownerKey);

        const regionKey = regionName.toLowerCase();
        const region = getOrCreate(regionGroups, regionKey, () => ({
            name: regionName,
            postalCodes: new Set(),
            subregionIds: new Set(),
            subregionNames: new Set(),
        }));
        region.postalCodes.add(postalCode);
        region.subregionIds.add(Number(subregion.id));
        region.subregionNames.add(subregionName);

        const subregionGroup = getOrCreate(subregionGroups, Number(subregion.id), () => ({
            id: Number(subregion.id),
            name: subregion.name,
            subregionCode: subregion.subregionCode || '',
            postalCodes: new Set(),
        }));
        subregionGroup.postalCodes.add(postalCode);
        mappedPostalCodes += 1;
    }

    const regions = [...regionGroups.values()]
        .map((region) => ({
            ...region,
            postalCodes: [...region.postalCodes].sort(),
            subregionIds: [...region.subregionIds].sort((left, right) => left - right),
            subregionNames: [...region.subregionNames].sort((left, right) => left.localeCompare(right, 'en-SG')),
        }))
        .sort((left, right) => left.name.localeCompare(right.name, 'en-SG'));
    const subregions = [...subregionGroups.values()]
        .map((subregion) => ({ ...subregion, postalCodes: [...subregion.postalCodes].sort() }))
        .sort((left, right) => left.name.localeCompare(right.name, 'en-SG'));

    return {
        regions,
        subregions,
        unmapped: { name: 'Unmapped', postalCodes: [...unmappedPostalCodes].sort() },
        errors: state.errors,
        errorCount: state.errorCount,
        summary: {
            sourceRows: Array.isArray(rows) ? rows.length : 0,
            uniquePostalCodes: postalOwners.size,
            mappedPostalCodes,
            unmappedPostalCodes: unmappedPostalCodes.size,
            regionCount: regions.length,
            subregionCount: subregions.length,
            duplicateRows,
        },
    };
}
