export const PERSONAL_PLACE_IMPORT_MAX_BYTES = 2 * 1024 * 1024;
export const PERSONAL_PLACE_IMPORT_MAX_ROWS = 500;
export const PERSONAL_PLACE_IMPORT_BATCH_SIZE = 25;
export const PERSONAL_PLACE_IMPORT_TEMPLATE = 'Name,Postal Code,Short Description\r\n';

const HEADER_ALIASES = new Map([
    ['name', 'name'], ['placename', 'name'],
    ['postalcode', 'postalCode'], ['postcode', 'postalCode'], ['postal', 'postalCode'],
    ['shortdescription', 'shortDescription'], ['description', 'shortDescription'],
]);
const COMPLETED_STATUSES = new Set(['created', 'attached', 'already_added']);

function text(value) {
    return value === null || value === undefined ? '' : String(value).trim();
}

function cleanIncomingText(value, maxLength = 500) {
    return String(value ?? '')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
        .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
        .slice(0, maxLength).trim();
}

function cleanIncomingOneLineText(value, maxLength) {
    return cleanIncomingText(value, maxLength).replace(/[ \t]*\n+[ \t]*/g, ' ').replace(/\s+/g, ' ').trim();
}

function matchText(value) {
    // Match SQL's trim(...)/POSIX-space identity without stripping legacy edge
    // tabs/newlines or treating nonbreaking spaces as ordinary ASCII spaces.
    return String(value ?? '').replace(/^ +| +$/g, '').replace(/[ \t\n\r\f\v]+/g, ' ').toLowerCase();
}

function blankRow(row) {
    return row.every((value) => text(value) === '');
}

export function normalizePersonalPlaceImportHeader(value) {
    return HEADER_ALIASES.get(text(value).replace(/^\uFEFF/, '').replace(/[^a-z0-9]/gi, '').toLowerCase()) || null;
}

export function parsePersonalPlaceImportGrid(grid = []) {
    if (!Array.isArray(grid)) throw new Error('The spreadsheet has no readable rows.');
    const headerIndex = grid.findIndex((row) => Array.isArray(row) && !blankRow(row));
    if (headerIndex < 0) throw new Error('The spreadsheet is empty. Use the template to add your places.');
    const rawHeaders = grid[headerIndex];
    const headers = rawHeaders.map(normalizePersonalPlaceImportHeader);
    const seen = new Set();
    rawHeaders.forEach((header, index) => {
        // Formatting can leave empty trailing worksheet columns. Data in one is still rejected below.
        if (!text(header)) return;
        if (!headers[index]) throw new Error(`Unexpected column "${text(header)}". Use only Name, Postal Code and optional Short Description.`);
        if (seen.has(headers[index])) throw new Error(`Duplicate column "${text(header)}". Keep each template column once.`);
        seen.add(headers[index]);
    });
    if (!seen.has('name') || !seen.has('postalCode')) throw new Error('The spreadsheet needs Name and Postal Code columns.');
    const rows = [];
    for (let index = headerIndex + 1; index < grid.length; index += 1) {
        const cells = grid[index];
        if (!Array.isArray(cells)) throw new Error(`Row ${index + 1} is not readable.`);
        if (blankRow(cells)) continue;
        if (rows.length >= PERSONAL_PLACE_IMPORT_MAX_ROWS) throw new Error('Import at most 500 places at a time. Split this file into smaller files.');
        const values = { name: '', postalCode: '', shortDescription: '' };
        const errors = [];
        cells.forEach((value, column) => {
            if (value !== null && value !== undefined && !['string', 'number'].includes(typeof value)) {
                errors.push('Use plain text or numbers in spreadsheet cells.');
                return;
            }
            if (text(value) && !headers[column]) {
                errors.push('Remove data outside the template columns.');
                return;
            }
            if (/^\s*=/.test(String(value ?? ''))) errors.push('Formula cells cannot be imported. Replace the formula with plain text.');
            if (headers[column]) values[headers[column]] = text(value);
        });
        const rawNameLength = values.name.length;
        const rawDescriptionLength = values.shortDescription.length;
        values.name = cleanIncomingOneLineText(values.name, 160);
        values.shortDescription = cleanIncomingOneLineText(values.shortDescription, 240);
        if (!values.name) errors.push('Name is required.');
        else if (rawNameLength > 160) errors.push('Name must be 160 characters or fewer.');
        if (!/^\d{6}$/.test(values.postalCode)) errors.push('Postal Code must contain exactly six digits. Keep leading zeros by storing it as text.');
        if (rawDescriptionLength > 240) errors.push('Short Description must be 240 characters or fewer.');
        rows.push({
            id: `row-${index + 1}`, rowNumber: index + 1, ...values,
            parseErrors: [...new Set(errors)], address: '', addressEdited: false, categoryId: null,
            lookupStatus: errors.length ? 'blocked' : 'pending', lookupError: '', location: null,
            excluded: false, attempted: false, result: null,
        });
    }
    if (!rows.length) throw new Error('No places were found below the headers. Add a Name and Postal Code for each place.');
    return rows;
}

export async function readPersonalPlaceImportFile(file, { sheetName } = {}) {
    if (!file || !/\.(csv|xlsx|xls)$/i.test(file.name || '')) throw new Error('Choose a CSV, XLSX or XLS spreadsheet.');
    if (!Number.isFinite(file.size) || file.size < 1) throw new Error('The selected file is empty.');
    if (file.size > PERSONAL_PLACE_IMPORT_MAX_BYTES) throw new Error('Choose a file smaller than 2 MB.');
    if (/\.csv$/i.test(file.name)) {
        const { default: Papa } = await import('papaparse');
        const parsed = Papa.parse(await file.text(), { skipEmptyLines: false, dynamicTyping: false });
        if (parsed.errors.length) throw new Error(`The CSV could not be read: ${parsed.errors[0].message}. Check quotes and separators, then choose the corrected file.`);
        return { rows: parsePersonalPlaceImportGrid(parsed.data), sheetNames: [], selectedSheetName: null };
    }
    const XLSX = await import('@e965/xlsx');
    let workbook;
    try {
        workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false, cellFormula: true, sheetRows: PERSONAL_PLACE_IMPORT_MAX_ROWS + 2 });
    } catch {
        throw new Error('The Excel workbook could not be read. Save a fresh XLSX file or use the CSV template.');
    }
    const sheetNames = workbook.SheetNames.filter((name) => {
        const sheet = workbook.Sheets[name];
        return sheet && Object.keys(sheet).some((key) => !key.startsWith('!') && (sheet[key]?.f || text(sheet[key]?.v)));
    });
    if (!sheetNames.length) throw new Error('The Excel workbook has no readable data sheet.');
    if (!sheetName && sheetNames.length > 1) return { rows: [], sheetNames, selectedSheetName: null };
    const selectedSheetName = sheetName || sheetNames[0];
    if (!sheetNames.includes(selectedSheetName)) throw new Error('Choose one of the workbook’s data sheets.');
    const sheet = workbook.Sheets[selectedSheetName];
    const range = XLSX.utils.decode_range(sheet['!fullref'] || sheet['!ref'] || 'A1');
    if (range.e.r > PERSONAL_PLACE_IMPORT_MAX_ROWS) throw new Error('Import at most 500 worksheet rows at a time, with the headers on the first row. Split this sheet into smaller sheets.');
    if (range.e.c - range.s.c > 20) throw new Error('This sheet has too many columns. Use the three-column template.');
    for (const [key, cell] of Object.entries(sheet)) {
        if (key.startsWith('!')) continue;
        if (cell?.f || cell?.F) throw new Error(`Formula cell ${key} cannot be imported. Replace formulas with plain text.`);
        if (cell && !['s', 'n', 'z', undefined].includes(cell.t)) throw new Error(`Cell ${key} is not plain text or a number. Correct it before importing.`);
    }
    const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '', blankrows: true, range: 0 });
    return { rows: parsePersonalPlaceImportGrid(grid), sheetNames, selectedSheetName };
}

export function validatePersonalPlaceImportLookup(postalCode, result) {
    if (!result || text(result.postalCode) !== postalCode || !/^\d{6}$/.test(text(result.postalCode))) {
        throw new Error('This postal code could not be matched exactly. Retry the lookup or correct the file.');
    }
    const address = text(result.address);
    const lat = Number(result.lat);
    const lng = Number(result.lng);
    if (!address || address.length > 500 || !['number', 'string'].includes(typeof result.lat) || !['number', 'string'].includes(typeof result.lng) || text(result.lat) === '' || text(result.lng) === ''
        || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        throw new Error('The lookup did not return a complete location. Retry the lookup or correct the file.');
    }
    return { address, postalCode, lat, lng };
}

export function applyPersonalPlaceImportLookup(row, outcome) {
    if (row.result) return row;
    if (outcome.error) return { ...row, lookupStatus: 'failed', lookupError: outcome.error };
    return {
        ...row, lookupStatus: 'ready', lookupError: '', location: outcome.location,
        address: row.addressEdited ? row.address : outcome.location.address,
    };
}

export async function lookupPersonalPlaceImportLocations(rows, lookup, onResult, shouldContinue = () => true) {
    const postals = [...new Set(rows.filter((row) => !row.parseErrors.length && !row.excluded && !row.result).map((row) => row.postalCode))];
    let cursor = 0;
    async function worker() {
        while (cursor < postals.length && shouldContinue()) {
            const postalCode = postals[cursor++];
            let outcome;
            try {
                outcome = { location: validatePersonalPlaceImportLookup(postalCode, await lookup(postalCode)) };
            } catch (error) {
                outcome = { error: error.message || 'Location lookup failed. Retry this row.' };
            }
            if (shouldContinue()) onResult(postalCode, outcome);
        }
    }
    await Promise.all(Array.from({ length: Math.min(3, postals.length) }, worker));
}

export function personalPlaceImportPayload(row) {
    return {
        name: cleanIncomingOneLineText(row.name, 160), postalCode: text(row.postalCode),
        shortDescription: cleanIncomingOneLineText(row.shortDescription, 240),
        address: cleanIncomingText(row.address, 500), categoryId: row.categoryId === null || row.categoryId === '' ? null : Number(row.categoryId),
    };
}

function identityKey(row, incoming = false) {
    const values = incoming ? personalPlaceImportPayload(row) : row;
    return JSON.stringify([matchText(values.name), String(values.postalCode ?? ''), matchText(values.address)]);
}

function contentKey(row, incoming = false) {
    const values = incoming ? personalPlaceImportPayload(row) : row;
    const categoryId = values.categoryId ? Number(values.categoryId) : null;
    const legacyLabel = categoryId === null ? matchText(row.legacyCategoryLabel ?? row.categoryLabel) : '';
    const storedDescription = typeof row.importShortDescription === 'string'
        ? row.importShortDescription : { unavailable: true };
    return JSON.stringify([
        identityKey(row, incoming), incoming ? values.shortDescription : storedDescription, categoryId,
        legacyLabel === 'personal place' ? '' : legacyLabel,
        roundedCoordinate(row.location?.lat ?? row.lat), roundedCoordinate(row.location?.lng ?? row.lng),
    ]);
}

function roundedCoordinate(value) {
    if (!['number', 'string'].includes(typeof value) || !text(value)) return null;
    if (typeof value === 'string' && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) return null;
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    // The server serialises a Number into JSON, then PostgreSQL rounds that decimal
    // value to scale 7. Round decimal digits directly so binary floating-point ties
    // cannot disagree with numeric's half-away-from-zero rule.
    const [, sign, whole, fraction = '', exponent = '0'] = String(number).match(/^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i);
    const digits = BigInt(whole + fraction);
    const shift = Number(exponent) + 7 - fraction.length;
    let scaled;
    if (shift >= 0) {
        scaled = digits * (10n ** BigInt(shift));
    } else {
        const divisor = 10n ** BigInt(-shift);
        scaled = digits / divisor;
        if ((digits % divisor) * 2n >= divisor) scaled += 1n;
    }
    const scale = 10000000n;
    return `${sign && scaled !== 0n ? '-' : ''}${scaled / scale}.${String(scaled % scale).padStart(7, '0')}`;
}

function linkedToMap(place, mapId) {
    return (place.mapIds || []).some((id) => Number(id) === Number(mapId));
}

export function reviewPersonalPlaceImportRows(rows, { categories = [], personalPlaces = [], mapId } = {}) {
    const activeIds = new Set(categories.filter((category) => !category.isArchived).map((category) => Number(category.id)));
    const earlier = [];
    return rows.map((row) => {
        if (row.result) return { ...row, reviewStatus: row.result.confirmed ? 'completed' : 'unconfirmed', reviewMessage: row.result.confirmed ? 'Saved and confirmed on this map.' : 'Saved result received. Refresh is required to confirm it.' };
        if (row.excluded) return { ...row, reviewStatus: 'skipped', reviewMessage: 'This row will not be imported.' };
        const problems = [...row.parseErrors];
        if (row.lookupStatus === 'failed') problems.push(row.lookupError);
        if (row.lookupStatus === 'ready') {
            if (!cleanIncomingText(row.address)) problems.push('Address is required.');
            else if (text(row.address).length > 500) problems.push('Address must be 500 characters or fewer.');
            if (row.categoryId !== null && !activeIds.has(Number(row.categoryId))) problems.push('Choose an active category or Personal place.');
        }
        if (problems.length) return { ...row, reviewStatus: 'invalid', reviewMessage: problems.join(' ') };
        if (row.lookupStatus !== 'ready') return { ...row, reviewStatus: 'pending', reviewMessage: 'Looking up this postal code…' };
        const sameLocation = personalPlaces.filter((place) => identityKey(place) === identityKey(row, true));
        const exact = sameLocation.filter((place) => contentKey(place) === contentKey(row, true));
        const previous = earlier.find((place) => identityKey(place, true) === identityKey(row, true));
        if (sameLocation.length > 1 || (!exact.length && sameLocation.length) || (previous && contentKey(previous, true) !== contentKey(row, true))) {
            return { ...row, reviewStatus: 'invalid', reviewMessage: 'A place at this location has different details or multiple matches. Correct the file or skip this row; existing places will not be changed.' };
        }
        earlier.push(row);
        if (exact.length) return { ...row, reviewStatus: 'ready', reviewMessage: linkedToMap(exact[0], mapId) ? 'Already on this map. No new place will be created.' : 'Will reuse your existing My Places entry.', previewAction: linkedToMap(exact[0], mapId) ? 'already_added' : 'attached' };
        if (previous) return { ...row, reviewStatus: 'ready', reviewMessage: `Matches row ${previous.rowNumber}. One place will be reused.`, previewAction: 'duplicate' };
        return { ...row, reviewStatus: 'ready', reviewMessage: 'Ready to create a private place.', previewAction: 'created' };
    });
}

export function readPersonalPlaceImportBatchResults(response, batchRows) {
    if (!Array.isArray(response?.results) || response.results.length !== batchRows.length) throw new Error('The save response was incomplete. Refresh saved results before trying again.');
    const seen = new Set();
    return response.results.map((result) => {
        if (!Number.isInteger(result.index) || result.index < 0 || result.index >= batchRows.length || seen.has(result.index)
            || !COMPLETED_STATUSES.has(result.status) || !Number.isSafeInteger(Number(result.placeId)) || Number(result.placeId) < 1) {
            throw new Error('The save response was incomplete. Refresh saved results before trying again.');
        }
        seen.add(result.index);
        return { id: batchRows[result.index].id, result: { status: result.status, placeId: Number(result.placeId), confirmed: false } };
    });
}

export function markPersonalPlaceImportRejectedBatch(rows, batchIds, status) {
    if (![400, 403, 404, 409].includes(Number(status))) return rows;
    const rejectedIds = new Set(batchIds);
    return rows.map((row) => rejectedIds.has(row.id) && !row.result ? { ...row, attempted: false } : row);
}

export function reconcilePersonalPlaceImportRows(rows, context, mapId) {
    if (!Array.isArray(context?.personalPlaces) || !context.map || Number(context.map.id) !== Number(mapId) || !Array.isArray(context.map.personalPlaces)) {
        throw new Error('Saved places could not be refreshed. Keep this preview open and refresh saved results.');
    }
    const mapPlaceIds = new Set(context.map.personalPlaces.map((place) => Number(place.personalPlaceId ?? place.resourceId)));
    return rows.map((row) => {
        if (row.result) {
            const saved = context.personalPlaces.find((place) => Number(place.id) === row.result.placeId && linkedToMap(place, mapId) && mapPlaceIds.has(Number(place.id)) && contentKey(place) === contentKey(row, true));
            if (!saved) throw new Error('A saved place is not confirmed on this map yet. Refresh saved results before continuing.');
            return { ...row, result: { ...row.result, confirmed: true } };
        }
        if (!row.attempted || row.excluded) return row;
        const sameLocation = context.personalPlaces.filter((place) => identityKey(place) === identityKey(row, true));
        if (sameLocation.length > 1) throw new Error('More than one matching place was found. Keep this preview and check My Places before trying again.');
        const matches = sameLocation.filter((place) => contentKey(place) === contentKey(row, true) && linkedToMap(place, mapId) && mapPlaceIds.has(Number(place.id)));
        if (!matches.length) return row;
        return { ...row, result: { status: 'already_added', placeId: Number(matches[0].id), confirmed: true } };
    });
}
