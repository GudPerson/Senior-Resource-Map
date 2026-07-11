export const FIXED_TOWN_SURFACE_SCHEMA = 'carearound.fixed-town-surface';
export const FIXED_TOWN_SURFACE_SCHEMA_VERSION = 1;

const URL_SCHEME_PATTERN = /^[a-z][a-z\d+.-]*:/i;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const SHA256_PATTERN = /^[a-f\d]{64}$/;
const W01_CHUNK_ID_PATTERN = /^z19-(\d+)-(\d+)-(\d+)-(\d+)$/;
const WEB_MERCATOR_TILE_SIZE = 256;
const WEB_MERCATOR_ZOOM = 19;
const WEB_MERCATOR_WORLD_SIZE = WEB_MERCATOR_TILE_SIZE * (2 ** WEB_MERCATOR_ZOOM);
const WORLD_PIXEL_TOLERANCE = 1e-6;
const GEOGRAPHIC_TOLERANCE = 1e-9;

const ACCEPTED_W01 = Object.freeze({
    id: 'W01',
    name: 'Choa Chu Kang Town Family',
    provider: 'OneMap',
    crs: 'EPSG:3857',
    zoom: WEB_MERCATOR_ZOOM,
    tileSize: WEB_MERCATOR_TILE_SIZE,
    retainedScale: 0.5,
    jpegQuality: 95,
    jpegChromaSubsampling: '4:4:4',
    generatorVersion: 3,
    profile: 'urban-50',
    profileLabel: '50% z19 residential',
    readabilityPercent: 175,
    readabilityEdition: 'readability-175',
    readabilityScaleFactor: 1.75,
    chunkCount: 300,
    chunkBytes: 53590423,
    nominalBounds: Object.freeze([
        103.68517275109161,
        1.3288013160069154,
        103.79145700603425,
        1.4091396382237347,
    ]),
    surfaceBounds: Object.freeze([
        103.68517220020294,
        1.32880009648789,
        103.79145741462708,
        1.409141498385829,
    ]),
    nominalWorldPixelBounds: Object.freeze([
        105765498.20538618,
        66583445.6937285,
        105805123.84766555,
        66613406.545208044,
    ]),
    surfaceWorldPixelBounds: Object.freeze([
        105765498,
        66583445,
        105805124,
        66613407,
    ]),
    nativePixelDimensions: Object.freeze([39626, 29961]),
    nominalRetainedPixelDimensions: Object.freeze([19813, 14980]),
    chunkGridRetainedPixelDimensions: Object.freeze([19813, 14982]),
    tileGrid: Object.freeze({
        columns: 156,
        rows: 118,
        sourceTiles: 18408,
        chunkColumns: 20,
        chunkRows: 15,
        chunkCount: 300,
    }),
    chunkSetSha256: '81bd26441edaff1d761f9e395575f8e00b9303f25e1d7896307f7f3036bbc8c6',
    chunkSetCanonicalization: 'UTF-8 lines "<sha256>  <filename>\\n", sorted by filename',
    integrity: Object.freeze({
        sourceManifestSha256: '10228b774ed45b540394ae5541039c9d90d136616fb8c2cbb6830a5083410334',
        islandwidePlanSha256: '59c44eb4bcbcf86165427cb9d56ae6325d0bb141de8c66fc9efc3cb1ef7204c6',
        readabilityValidationSha256: 'db02729149cb5e3e08bd434360011f3760414102ea1c142baea1e3f92f065809',
        readabilityReportSha256: 'fccc1c03747b06a1d7cadcc2605005ad49e287944d9e972805c7bac34b8cb17c',
        validatedSourcePdfSha256: 'a12af3fcdf0487e785486aeb02d0ad9820f854513f271f0cd4748bdd93ed05e8',
        validatedReadabilityPdfSha256: '9ebfbf89efa754102122c681bc25ca0158a055349791c8ed503c786f7bc9ade2',
        embeddedImageStreamSignature: 'e50b42303fb256ae694fd39c3b914526d81459a53e10ee83ab8a732dfb2ce67e',
        extractedTextSignature: '2be2501882971a3efb42cbde00fe3e6f42ce78d7340fd9632a03f023d1f19458',
    }),
});

function isRecord(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0 && !CONTROL_CHARACTER_PATTERN.test(value);
}

function toFiniteCoordinate(value) {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }
    if (typeof value !== 'string' || !value.trim()) {
        return null;
    }
    const coordinate = Number(value);
    return Number.isFinite(coordinate) ? coordinate : null;
}

function readWsenBounds(bounds) {
    if (!Array.isArray(bounds) || bounds.length !== 4 || !bounds.every(isFiniteNumber)) {
        return null;
    }

    const [west, south, east, north] = bounds;
    if (
        west < -180
        || east > 180
        || south < -90
        || north > 90
        || west >= east
        || south >= north
    ) {
        return null;
    }

    return { west, south, east, north };
}

function areBoundsContained(innerBounds, outerBounds) {
    const inner = readWsenBounds(innerBounds);
    const outer = readWsenBounds(outerBounds);
    if (!inner || !outer) return false;

    return inner.west >= outer.west
        && inner.south >= outer.south
        && inner.east <= outer.east
        && inner.north <= outer.north;
}

function isValidPixelBounds(bounds) {
    if (
        !Array.isArray(bounds)
        || bounds.length !== 4
        || !bounds.every((value) => Number.isSafeInteger(value))
    ) {
        return false;
    }
    const [left, top, right, bottom] = bounds;
    return left >= 0 && top >= 0 && right > left && bottom > top;
}

function isValidPixelSize(size) {
    return Array.isArray(size)
        && size.length === 2
        && size.every((value) => Number.isSafeInteger(value) && value > 0);
}

function isNumericBounds(bounds) {
    return Array.isArray(bounds)
        && bounds.length === 4
        && bounds.every(isFiniteNumber);
}

function isExactIntegerBounds(bounds) {
    return isNumericBounds(bounds)
        && bounds.every((value) => Number.isSafeInteger(value));
}

function nearlyEqual(left, right, tolerance) {
    return isFiniteNumber(left)
        && isFiniteNumber(right)
        && Math.abs(left - right) <= tolerance;
}

function arraysNearlyEqual(left, right, tolerance) {
    return Array.isArray(left)
        && Array.isArray(right)
        && left.length === right.length
        && left.every((value, index) => nearlyEqual(value, right[index], tolerance));
}

function lonLatToWorldPixel(longitude, latitude) {
    const sinLatitude = Math.sin((latitude * Math.PI) / 180);
    return [
        ((longitude + 180) / 360) * WEB_MERCATOR_WORLD_SIZE,
        (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI))
            * WEB_MERCATOR_WORLD_SIZE,
    ];
}

function worldPixelToLonLat(x, y) {
    const longitude = (x / WEB_MERCATOR_WORLD_SIZE) * 360 - 180;
    const mercatorY = Math.PI - (2 * Math.PI * y) / WEB_MERCATOR_WORLD_SIZE;
    const latitude = (Math.atan(Math.sinh(mercatorY)) * 180) / Math.PI;
    return [longitude, latitude];
}

function wsenBoundsToWorldPixelBounds(bounds) {
    const normalizedBounds = readWsenBounds(bounds);
    if (!normalizedBounds) return null;

    const [left, top] = lonLatToWorldPixel(normalizedBounds.west, normalizedBounds.north);
    const [right, bottom] = lonLatToWorldPixel(normalizedBounds.east, normalizedBounds.south);
    return [left, top, right, bottom];
}

function worldPixelBoundsToWsenBounds(bounds) {
    if (!isNumericBounds(bounds)) return null;
    const [left, top, right, bottom] = bounds;
    if (left < 0 || top < 0 || right > WEB_MERCATOR_WORLD_SIZE || bottom > WEB_MERCATOR_WORLD_SIZE) {
        return null;
    }

    const [west, north] = worldPixelToLonLat(left, top);
    const [east, south] = worldPixelToLonLat(right, bottom);
    return [west, south, east, north];
}

function hasPathTraversal(value) {
    const path = value.split(/[?#]/, 1)[0];
    let decodedPath;
    try {
        decodedPath = decodeURIComponent(path);
    } catch {
        return true;
    }
    return decodedPath.split('/').some((segment) => segment === '..');
}

function normalizeHttpUrl(value) {
    try {
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
            return '';
        }
        return url.href;
    } catch {
        return '';
    }
}

function normalizeAssetReference(value) {
    if (!isNonEmptyString(value)) return '';

    const reference = value.trim();
    if (reference.startsWith('//') || reference.includes('\\') || hasPathTraversal(reference)) {
        return '';
    }
    if (URL_SCHEME_PATTERN.test(reference)) {
        return normalizeHttpUrl(reference);
    }
    return reference;
}

function parseChunkIdentity(chunk) {
    if (!isRecord(chunk) || !isNonEmptyString(chunk.id)) return null;
    const match = W01_CHUNK_ID_PATTERN.exec(chunk.id);
    if (!match) return null;

    const [xStart, yStart, xEnd, yEnd] = match.slice(1).map(Number);
    if (
        ![xStart, yStart, xEnd, yEnd].every(Number.isSafeInteger)
        || xStart > xEnd
        || yStart > yEnd
    ) {
        return null;
    }

    return { xStart, yStart, xEnd, yEnd };
}

function hasAcceptedSourceProfile(source) {
    if (!isRecord(source)) return false;
    const readability = source.readability;
    return source.provider === ACCEPTED_W01.provider
        && source.crs === ACCEPTED_W01.crs
        && source.zoom === ACCEPTED_W01.zoom
        && source.tileSize === ACCEPTED_W01.tileSize
        && source.retainedScale === ACCEPTED_W01.retainedScale
        && source.jpegQuality === ACCEPTED_W01.jpegQuality
        && source.jpegChromaSubsampling === ACCEPTED_W01.jpegChromaSubsampling
        && source.generatorVersion === ACCEPTED_W01.generatorVersion
        && source.profile === ACCEPTED_W01.profile
        && source.profileLabel === ACCEPTED_W01.profileLabel
        && source.onemapNativeLabels === true
        && source.hdbOverlay === false
        && source.readabilityPercent === ACCEPTED_W01.readabilityPercent
        && isRecord(readability)
        && readability.edition === ACCEPTED_W01.readabilityEdition
        && readability.scaleFactor === ACCEPTED_W01.readabilityScaleFactor
        && readability.rasterResampled === false
        && readability.embeddedImageStreamsPreserved === true
        && readability.textPreserved === true
        && readability.contentPreserved === true;
}

function hasAcceptedIntegrity(integrity) {
    if (
        !isRecord(integrity)
        || integrity.algorithm !== 'sha256'
        || integrity.chunkSetSha256 !== ACCEPTED_W01.chunkSetSha256
        || integrity.chunkSetCanonicalization !== ACCEPTED_W01.chunkSetCanonicalization
    ) {
        return false;
    }

    return Object.entries(ACCEPTED_W01.integrity).every(
        ([field, expectedValue]) => integrity[field] === expectedValue,
    );
}

export function validateFixedTownSurfaceManifest(manifest) {
    if (!isRecord(manifest)) return false;
    if (
        manifest.schema !== FIXED_TOWN_SURFACE_SCHEMA
        || manifest.schemaVersion !== FIXED_TOWN_SURFACE_SCHEMA_VERSION
        || !isRecord(manifest.map)
        || manifest.map.id !== ACCEPTED_W01.id
        || manifest.map.name !== ACCEPTED_W01.name
        || manifest.map.version !== `w01-s50-q95-g3-${ACCEPTED_W01.chunkSetSha256.slice(0, 16)}`
        || !isRecord(manifest.bounds)
        || !readWsenBounds(manifest.bounds.nominal)
        || !readWsenBounds(manifest.bounds.surface)
        || !areBoundsContained(manifest.bounds.nominal, manifest.bounds.surface)
        || !arraysNearlyEqual(
            manifest.bounds.nominal,
            ACCEPTED_W01.nominalBounds,
            GEOGRAPHIC_TOLERANCE,
        )
        || !arraysNearlyEqual(
            manifest.bounds.surface,
            ACCEPTED_W01.surfaceBounds,
            GEOGRAPHIC_TOLERANCE,
        )
        || !hasAcceptedSourceProfile(manifest.source)
        || !isRecord(manifest.retainedPixelDimensions)
        || !isValidPixelSize(manifest.retainedPixelDimensions.nominal)
        || !isValidPixelSize(manifest.retainedPixelDimensions.chunkGrid)
        || !arraysNearlyEqual(
            manifest.retainedPixelDimensions.nominal,
            ACCEPTED_W01.nominalRetainedPixelDimensions,
            0,
        )
        || !arraysNearlyEqual(
            manifest.retainedPixelDimensions.chunkGrid,
            ACCEPTED_W01.chunkGridRetainedPixelDimensions,
            0,
        )
        || !isRecord(manifest.attribution)
        || manifest.attribution.required !== true
        || !isNonEmptyString(manifest.attribution.text)
        || !isNonEmptyString(manifest.attribution.html)
        || !/OneMap/i.test(manifest.attribution.html)
        || !/Singapore Land Authority/i.test(manifest.attribution.html)
        || !normalizeHttpUrl(manifest.attribution.logoUrl)
        || !hasAcceptedIntegrity(manifest.integrity)
        || !isRecord(manifest.transport)
        || !Number.isSafeInteger(manifest.transport.chunkCount)
        || manifest.transport.chunkCount !== ACCEPTED_W01.chunkCount
        || !Number.isSafeInteger(manifest.transport.totalBytes)
        || manifest.transport.totalBytes !== ACCEPTED_W01.chunkBytes
        || !Array.isArray(manifest.chunks)
        || manifest.chunks.length !== manifest.transport.chunkCount
    ) {
        return false;
    }


    const source = manifest.source;
    if (
        !isRecord(source.worldPixelBounds)
        || !isNumericBounds(source.worldPixelBounds.nominal)
        || !isExactIntegerBounds(source.worldPixelBounds.surface)
        || !isValidPixelSize(source.nativePixelDimensions)
        || !isRecord(source.tileGrid)
        || !arraysNearlyEqual(
            source.worldPixelBounds.nominal,
            ACCEPTED_W01.nominalWorldPixelBounds,
            WORLD_PIXEL_TOLERANCE,
        )
        || !arraysNearlyEqual(
            source.worldPixelBounds.surface,
            ACCEPTED_W01.surfaceWorldPixelBounds,
            0,
        )
        || !arraysNearlyEqual(
            source.nativePixelDimensions,
            ACCEPTED_W01.nativePixelDimensions,
            0,
        )
    ) {
        return false;
    }

    const nominalWorldPixelBounds = wsenBoundsToWorldPixelBounds(manifest.bounds.nominal);
    const surfaceWorldPixelBounds = wsenBoundsToWorldPixelBounds(manifest.bounds.surface);
    if (
        !nominalWorldPixelBounds
        || !surfaceWorldPixelBounds
        || !arraysNearlyEqual(
            nominalWorldPixelBounds,
            source.worldPixelBounds.nominal,
            WORLD_PIXEL_TOLERANCE,
        )
        || !arraysNearlyEqual(
            surfaceWorldPixelBounds,
            source.worldPixelBounds.surface,
            WORLD_PIXEL_TOLERANCE,
        )
        || !arraysNearlyEqual(
            manifest.bounds.surface,
            worldPixelBoundsToWsenBounds(source.worldPixelBounds.surface),
            GEOGRAPHIC_TOLERANCE,
        )
    ) {
        return false;
    }

    const expectedSurfaceWorldPixelBounds = [
        Math.floor(nominalWorldPixelBounds[0]),
        Math.floor(nominalWorldPixelBounds[1]),
        Math.ceil(nominalWorldPixelBounds[2]),
        Math.ceil(nominalWorldPixelBounds[3]),
    ];
    if (!arraysNearlyEqual(
        source.worldPixelBounds.surface,
        expectedSurfaceWorldPixelBounds,
        WORLD_PIXEL_TOLERANCE,
    )) {
        return false;
    }

    const [surfaceLeft, surfaceTop, surfaceRight, surfaceBottom] = source.worldPixelBounds.surface;
    const nativePixelDimensions = [
        Math.round(nominalWorldPixelBounds[2] - nominalWorldPixelBounds[0]),
        Math.round(nominalWorldPixelBounds[3] - nominalWorldPixelBounds[1]),
    ];
    const nominalRetainedPixelDimensions = [
        Math.round((nominalWorldPixelBounds[2] - nominalWorldPixelBounds[0]) * source.retainedScale),
        Math.round((nominalWorldPixelBounds[3] - nominalWorldPixelBounds[1]) * source.retainedScale),
    ];
    if (
        !arraysNearlyEqual(source.nativePixelDimensions, nativePixelDimensions, 0)
        || !arraysNearlyEqual(
            manifest.retainedPixelDimensions.nominal,
            nominalRetainedPixelDimensions,
            0,
        )
    ) {
        return false;
    }

    const expectedTileColumns = Math.ceil(surfaceRight / source.tileSize)
        - Math.floor(surfaceLeft / source.tileSize);
    const expectedTileRows = Math.ceil(surfaceBottom / source.tileSize)
        - Math.floor(surfaceTop / source.tileSize);
    const tileGrid = source.tileGrid;
    if (
        !Object.entries(ACCEPTED_W01.tileGrid).every(
            ([field, expectedValue]) => tileGrid[field] === expectedValue,
        )
        || tileGrid.columns !== expectedTileColumns
        || tileGrid.rows !== expectedTileRows
        || tileGrid.sourceTiles !== expectedTileColumns * expectedTileRows
        || !Number.isSafeInteger(tileGrid.chunkColumns)
        || !Number.isSafeInteger(tileGrid.chunkRows)
        || tileGrid.chunkColumns <= 0
        || tileGrid.chunkRows <= 0
        || tileGrid.chunkCount !== manifest.chunks.length
        || tileGrid.chunkColumns * tileGrid.chunkRows !== manifest.chunks.length
        || manifest.integrity.chunkCount !== manifest.chunks.length
        || manifest.integrity.chunkBytes !== ACCEPTED_W01.chunkBytes
        || manifest.integrity.chunkBytes !== manifest.transport.totalBytes
    ) {
        return false;
    }

    const chunkIds = new Set();
    const chunkUrls = new Set();
    const chunkCells = new Set();
    const parsedChunks = [];
    let totalBytes = 0;
    for (let index = 0; index < manifest.chunks.length; index += 1) {
        const chunk = manifest.chunks[index];
        const identity = parseChunkIdentity(chunk);
        if (
            !identity
            || chunk.url !== `chunks/${chunk.id}.jpg`
            || !normalizeAssetReference(chunk.url)
            || !areBoundsContained(chunk.bounds, manifest.bounds.surface)
            || !isValidPixelBounds(chunk.worldPixelBounds)
            || !isValidPixelSize(chunk.pixelSize)
            || !Number.isSafeInteger(chunk.row)
            || !Number.isSafeInteger(chunk.column)
            || chunk.row < 0
            || chunk.row >= tileGrid.chunkRows
            || chunk.column < 0
            || chunk.column >= tileGrid.chunkColumns
            || Number.isSafeInteger(chunk.byteSize) === false
            || chunk.byteSize <= 0
            || typeof chunk.sha256 !== 'string'
            || !SHA256_PATTERN.test(chunk.sha256)
        ) {
            return false;
        }

        const normalizedUrl = normalizeAssetReference(chunk.url);
        const cell = `${chunk.row}:${chunk.column}`;
        if (
            chunkIds.has(chunk.id)
            || chunkUrls.has(normalizedUrl)
            || chunkCells.has(cell)
        ) {
            return false;
        }
        chunkIds.add(chunk.id);
        chunkUrls.add(normalizedUrl);
        chunkCells.add(cell);

        const expectedWorldPixelBounds = [
            Math.max(surfaceLeft, identity.xStart * source.tileSize),
            Math.max(surfaceTop, identity.yStart * source.tileSize),
            Math.min(surfaceRight, (identity.xEnd + 1) * source.tileSize),
            Math.min(surfaceBottom, (identity.yEnd + 1) * source.tileSize),
        ];
        const expectedGeographicBounds = worldPixelBoundsToWsenBounds(expectedWorldPixelBounds);
        const expectedPixelSize = [
            Math.round((expectedWorldPixelBounds[2] - expectedWorldPixelBounds[0]) * source.retainedScale),
            Math.round((expectedWorldPixelBounds[3] - expectedWorldPixelBounds[1]) * source.retainedScale),
        ];
        if (
            !isValidPixelBounds(expectedWorldPixelBounds)
            || !expectedGeographicBounds
            || !arraysNearlyEqual(chunk.worldPixelBounds, expectedWorldPixelBounds, 0)
            || !arraysNearlyEqual(chunk.bounds, expectedGeographicBounds, GEOGRAPHIC_TOLERANCE)
            || !arraysNearlyEqual(chunk.pixelSize, expectedPixelSize, 0)
        ) {
            return false;
        }

        parsedChunks.push({ chunk, ...identity });
        totalBytes += chunk.byteSize;
        if (!Number.isSafeInteger(totalBytes)) return false;
    }

    if (totalBytes !== manifest.transport.totalBytes) return false;

    const xStarts = [...new Set(parsedChunks.map((chunk) => chunk.xStart))]
        .sort((left, right) => left - right);
    const yStarts = [...new Set(parsedChunks.map((chunk) => chunk.yStart))]
        .sort((left, right) => left - right);
    if (
        xStarts.length !== tileGrid.chunkColumns
        || yStarts.length !== tileGrid.chunkRows
    ) {
        return false;
    }

    const columns = new Map(xStarts.map((value, index) => [value, index]));
    const rows = new Map(yStarts.map((value, index) => [value, index]));
    const columnWidths = new Array(tileGrid.chunkColumns);
    const rowHeights = new Array(tileGrid.chunkRows);
    let previousIndex = -1;

    for (const parsedChunk of parsedChunks) {
        const { chunk } = parsedChunk;
        const expectedColumn = columns.get(parsedChunk.xStart);
        const expectedRow = rows.get(parsedChunk.yStart);
        const index = expectedRow * tileGrid.chunkColumns + expectedColumn;
        if (
            chunk.column !== expectedColumn
            || chunk.row !== expectedRow
            || index <= previousIndex
            || (columnWidths[expectedColumn] !== undefined
                && columnWidths[expectedColumn] !== chunk.pixelSize[0])
            || (rowHeights[expectedRow] !== undefined
                && rowHeights[expectedRow] !== chunk.pixelSize[1])
        ) {
            return false;
        }
        previousIndex = index;
        columnWidths[expectedColumn] = chunk.pixelSize[0];
        rowHeights[expectedRow] = chunk.pixelSize[1];
    }

    const xRanges = xStarts.map((xStart) => {
        const parsedChunk = parsedChunks.find((chunk) => chunk.xStart === xStart);
        return [parsedChunk.xStart, parsedChunk.xEnd];
    });
    const yRanges = yStarts.map((yStart) => {
        const parsedChunk = parsedChunks.find((chunk) => chunk.yStart === yStart);
        return [parsedChunk.yStart, parsedChunk.yEnd];
    });
    const rangesAreContiguous = (ranges) => ranges.every(
        (range, index) => index === 0 || range[0] === ranges[index - 1][1] + 1,
    );
    if (
        xRanges[0][0] !== Math.floor(surfaceLeft / source.tileSize)
        || xRanges.at(-1)[1] !== Math.ceil(surfaceRight / source.tileSize) - 1
        || yRanges[0][0] !== Math.floor(surfaceTop / source.tileSize)
        || yRanges.at(-1)[1] !== Math.ceil(surfaceBottom / source.tileSize) - 1
        || !rangesAreContiguous(xRanges)
        || !rangesAreContiguous(yRanges)
    ) {
        return false;
    }

    const chunkGridPixelDimensions = [
        columnWidths.reduce((sum, value) => sum + value, 0),
        rowHeights.reduce((sum, value) => sum + value, 0),
    ];
    return arraysNearlyEqual(
        manifest.retainedPixelDimensions.chunkGrid,
        chunkGridPixelDimensions,
        0,
    );
}

export function parseFixedTownSurfaceManifest(manifest) {
    return validateFixedTownSurfaceManifest(manifest) ? manifest : null;
}

export function normalizeFixedTownAssetBaseUrl(value) {
    if (!isNonEmptyString(value)) return '';

    const baseUrl = value.trim();
    if (
        baseUrl.startsWith('//')
        || baseUrl.includes('\\')
        || hasPathTraversal(baseUrl)
        || baseUrl.includes('?')
        || baseUrl.includes('#')
    ) {
        return '';
    }

    if (URL_SCHEME_PATTERN.test(baseUrl)) {
        const normalizedUrl = normalizeHttpUrl(baseUrl);
        return normalizedUrl ? normalizedUrl.replace(/\/+$/, '') : '';
    }

    const normalizedPath = baseUrl.replace(/\/+$/, '');
    return normalizedPath || (baseUrl.startsWith('/') ? '/' : '');
}

function resolveFixedTownAssetUrl(assetBaseUrl, assetPath) {
    const reference = normalizeAssetReference(assetPath);
    if (!reference) return '';
    if (URL_SCHEME_PATTERN.test(reference)) return reference;

    const baseUrl = normalizeFixedTownAssetBaseUrl(assetBaseUrl);
    if (!baseUrl) return '';

    const relativePath = reference.replace(/^\/+/, '');
    if (!relativePath) return '';
    return baseUrl === '/' ? `/${relativePath}` : `${baseUrl}/${relativePath}`;
}

export function resolveFixedTownManifestUrl(assetBaseUrl, manifestPath = 'manifest.json') {
    return resolveFixedTownAssetUrl(assetBaseUrl, manifestPath);
}

export function resolveFixedTownChunkUrl(assetBaseUrl, chunkUrl) {
    return resolveFixedTownAssetUrl(assetBaseUrl, chunkUrl);
}

export function isPointWithinWsenBounds(point, bounds) {
    if (!isRecord(point)) return false;
    const normalizedBounds = readWsenBounds(bounds);
    const lat = toFiniteCoordinate(point.lat);
    const lng = toFiniteCoordinate(point.lng);
    if (!normalizedBounds || lat === null || lng === null) return false;

    return lng >= normalizedBounds.west
        && lng <= normalizedBounds.east
        && lat >= normalizedBounds.south
        && lat <= normalizedBounds.north;
}

export function doWsenBoundsIntersect(firstBounds, secondBounds) {
    const first = readWsenBounds(firstBounds);
    const second = readWsenBounds(secondBounds);
    if (!first || !second) return false;

    return first.west <= second.east
        && first.east >= second.west
        && first.south <= second.north
        && first.north >= second.south;
}

export function selectVisibleFixedTownChunks(chunks, viewportBounds) {
    if (!Array.isArray(chunks) || !readWsenBounds(viewportBounds)) return [];
    return chunks.filter((chunk) => isRecord(chunk) && doWsenBoundsIntersect(chunk.bounds, viewportBounds));
}

export function isFixedTownSurfaceZoomEligible(zoom, minZoom) {
    const normalizedZoom = Number(zoom);
    const normalizedMinZoom = Number(minZoom);
    return Number.isFinite(normalizedZoom)
        && Number.isFinite(normalizedMinZoom)
        && Math.round(normalizedZoom) >= Math.round(normalizedMinZoom);
}

export function resolveFixedTownBasemapMode({
    preference = 'live',
    townAvailable = false,
    zoom,
    minZoom,
} = {}) {
    const townRequested = preference === 'auto' || preference === 'town';
    return townRequested
        && townAvailable
        && isFixedTownSurfaceZoomEligible(zoom, minZoom)
        ? 'town'
        : 'live';
}
