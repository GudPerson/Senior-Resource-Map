export const FIXED_TOWN_SURFACE_SCHEMA = 'carearound.fixed-town-surface';
export const FIXED_TOWN_SURFACE_SCHEMA_VERSION = 1;
export const FIXED_TOWN_SURFACE_INDEX_SCHEMA = 'carearound.fixed-town-surface-index';
export const FIXED_TOWN_SURFACE_INDEX_SCHEMA_VERSION = 1;

const URL_SCHEME_PATTERN = /^[a-z][a-z\d+.-]*:/i;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const SHA256_PATTERN = /^[a-f\d]{64}$/;
const FIXED_TOWN_CHUNK_ID_PATTERN = /^z19-(\d+)-(\d+)-(\d+)-(\d+)$/;
const FIXED_TOWN_SURFACE_ID_PATTERN = /^[A-Z][A-Z\d]{0,3}$/;
const FIXED_TOWN_SURFACE_VERSION_PATTERN = /^[a-z\d][a-z\d._-]{5,96}$/;
const WEB_MERCATOR_TILE_SIZE = 256;
const WEB_MERCATOR_ZOOM = 19;
const WEB_MERCATOR_WORLD_SIZE = WEB_MERCATOR_TILE_SIZE * (2 ** WEB_MERCATOR_ZOOM);
const WORLD_PIXEL_TOLERANCE = 1e-6;
const GEOGRAPHIC_TOLERANCE = 1e-9;
const ACCEPTED_RETAINED_SCALES = Object.freeze([0.4, 0.5]);
const ACCEPTED_PROFILES = Object.freeze(['sparse-40', 'urban-50']);
const ACCEPTED_CHUNK_CANONICALIZATION = 'UTF-8 lines "<sha256>  <filename>\\n", sorted by filename';

const ACCEPTED_W01_DEFAULT = Object.freeze({
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
    mapStyle: 'default',
    sourceStyle: null,
    version: 'w01-s50-q95-g3-81bd26441edaff1d',
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
    chunkSetCanonicalization: ACCEPTED_CHUNK_CANONICALIZATION,
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

const ACCEPTED_W01_GRAY = Object.freeze({
    ...ACCEPTED_W01_DEFAULT,
    generatorVersion: 1,
    mapStyle: 'gray',
    sourceStyle: 'Grey',
    version: 'w01-grey-s50-q95-g1-5456cd4fb905dcca',
    chunkCount: 88,
    chunkBytes: 48817738,
    chunkSetSha256: '5456cd4fb905dccaea7ba7f30610a34750163bff225bfc09634eb370600cb281',
    chunkGridRetainedPixelDimensions: Object.freeze([19813, 14982]),
    tileGrid: Object.freeze({
        columns: 156,
        rows: 118,
        sourceTiles: 18408,
        chunkColumns: 11,
        chunkRows: 8,
        chunkCount: 88,
    }),
    integrity: Object.freeze({
        sourceManifestSha256: 'c1f4bd12830ec9659a5d4b3240acd5455555e8282f834d1e9687cbc5f5208d0e',
        collectionValidationSha256: 'b67566aa234d8fe22cea40f1a1e03f0018b11d6858f86823ead1415811c80b0a',
        sourceAlignmentSha256: 'a43a0e16458dc15e160968631a3d0c45d3e23f6d27142a2eda6ef52c4ff3718f',
    }),
});

const ACCEPTED_W01_NATIVE_SCALE_DEFAULT = Object.freeze({
    ...ACCEPTED_W01_DEFAULT,
    generatorVersion: 1,
    version: 'w01-native-z18-s50-q95-g1-52ccb9f5bd425e29',
    profileLabel: '50% z19 native-scale residential',
    chunkCount: 88,
    chunkBytes: 62502465,
    chunkSetSha256: '52ccb9f5bd425e2955355c1db5f576305325efa320235c185916612499b584a4',
    tileGrid: Object.freeze({
        columns: 156,
        rows: 118,
        sourceTiles: 18408,
        chunkColumns: 11,
        chunkRows: 8,
        chunkCount: 88,
    }),
    integrity: Object.freeze({
        sourceManifestSha256: '2434718daaa94c72bd819fe66842f15ee49bfe78eec251c9d229dae6269e4f96',
        islandwidePlanSha256: '59c44eb4bcbcf86165427cb9d56ae6325d0bb141de8c66fc9efc3cb1ef7204c6',
    }),
});

const ACCEPTED_W01_NATIVE_SCALE_GRAY = Object.freeze({
    ...ACCEPTED_W01_NATIVE_SCALE_DEFAULT,
    mapStyle: 'gray',
    sourceStyle: 'Grey',
    version: 'w01-native-z18-s50-q95-g1-71349606693413ac',
    chunkBytes: 55468997,
    chunkSetSha256: '71349606693413acc2d724b5d7662eca126b71bed3fb253bbfe909964abfd548',
    integrity: Object.freeze({
        sourceManifestSha256: 'a060970f2067b58528de2473241895e5dcafad3f7c107e92e5386beb48d53eed',
        islandwidePlanSha256: '59c44eb4bcbcf86165427cb9d56ae6325d0bb141de8c66fc9efc3cb1ef7204c6',
    }),
});

const ACCEPTED_W01_MANIFESTS = Object.freeze({
    default: Object.freeze([
        ACCEPTED_W01_DEFAULT,
        ACCEPTED_W01_NATIVE_SCALE_DEFAULT,
    ]),
    gray: Object.freeze([
        ACCEPTED_W01_GRAY,
        ACCEPTED_W01_NATIVE_SCALE_GRAY,
    ]),
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

function getWsenBoundsCenter(bounds) {
    const normalizedBounds = readWsenBounds(bounds);
    if (!normalizedBounds) return null;

    return {
        lng: (normalizedBounds.west + normalizedBounds.east) / 2,
        lat: (normalizedBounds.south + normalizedBounds.north) / 2,
    };
}

function getWsenIntersectionArea(firstBounds, secondBounds) {
    const first = readWsenBounds(firstBounds);
    const second = readWsenBounds(secondBounds);
    if (!first || !second) return 0;

    const width = Math.min(first.east, second.east) - Math.max(first.west, second.west);
    const height = Math.min(first.north, second.north) - Math.max(first.south, second.south);
    return width > 0 && height > 0 ? width * height : 0;
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

export function areWsenBoundsContained(innerBounds, outerBounds) {
    return areBoundsContained(innerBounds, outerBounds);
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
    const match = FIXED_TOWN_CHUNK_ID_PATTERN.exec(chunk.id);
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

function hasAcceptedSourceProfile(source, accepted) {
    if (!isRecord(source)) return false;
    const readability = source.readability;
    return source.provider === accepted.provider
        && source.crs === accepted.crs
        && source.zoom === accepted.zoom
        && source.tileSize === accepted.tileSize
        && source.retainedScale === accepted.retainedScale
        && source.jpegQuality === accepted.jpegQuality
        && source.jpegChromaSubsampling === accepted.jpegChromaSubsampling
        && source.generatorVersion === accepted.generatorVersion
        && source.profile === accepted.profile
        && source.profileLabel === accepted.profileLabel
        && (!accepted.sourceStyle || source.style === accepted.sourceStyle)
        && source.onemapNativeLabels === true
        && source.hdbOverlay === false
        && source.readabilityPercent === accepted.readabilityPercent
        && isRecord(readability)
        && readability.edition === accepted.readabilityEdition
        && readability.scaleFactor === accepted.readabilityScaleFactor
        && readability.rasterResampled === false
        && readability.embeddedImageStreamsPreserved === true
        && readability.textPreserved === true
        && readability.contentPreserved === true;
}

function hasAcceptedIntegrity(integrity, accepted) {
    if (
        !isRecord(integrity)
        || integrity.algorithm !== 'sha256'
        || integrity.chunkSetSha256 !== accepted.chunkSetSha256
        || integrity.chunkSetCanonicalization !== accepted.chunkSetCanonicalization
    ) {
        return false;
    }

    return Object.entries(accepted.integrity).every(
        ([field, expectedValue]) => integrity[field] === expectedValue,
    );
}

function validateFixedTownSurfaceManifestAgainst(manifest, accepted) {
    if (!isRecord(manifest)) return false;
    if (
        manifest.schema !== FIXED_TOWN_SURFACE_SCHEMA
        || manifest.schemaVersion !== FIXED_TOWN_SURFACE_SCHEMA_VERSION
        || !isRecord(manifest.map)
        || manifest.map.id !== accepted.id
        || manifest.map.name !== accepted.name
        || (manifest.map.style || 'default') !== accepted.mapStyle
        || manifest.map.version !== accepted.version
        || !isRecord(manifest.bounds)
        || !readWsenBounds(manifest.bounds.nominal)
        || !readWsenBounds(manifest.bounds.surface)
        || !areBoundsContained(manifest.bounds.nominal, manifest.bounds.surface)
        || !arraysNearlyEqual(
            manifest.bounds.nominal,
            accepted.nominalBounds,
            GEOGRAPHIC_TOLERANCE,
        )
        || !arraysNearlyEqual(
            manifest.bounds.surface,
            accepted.surfaceBounds,
            GEOGRAPHIC_TOLERANCE,
        )
        || !hasAcceptedSourceProfile(manifest.source, accepted)
        || !isRecord(manifest.retainedPixelDimensions)
        || !isValidPixelSize(manifest.retainedPixelDimensions.nominal)
        || !isValidPixelSize(manifest.retainedPixelDimensions.chunkGrid)
        || !arraysNearlyEqual(
            manifest.retainedPixelDimensions.nominal,
            accepted.nominalRetainedPixelDimensions,
            0,
        )
        || !arraysNearlyEqual(
            manifest.retainedPixelDimensions.chunkGrid,
            accepted.chunkGridRetainedPixelDimensions,
            0,
        )
        || !isRecord(manifest.attribution)
        || manifest.attribution.required !== true
        || !isNonEmptyString(manifest.attribution.text)
        || !isNonEmptyString(manifest.attribution.html)
        || !/OneMap/i.test(manifest.attribution.html)
        || !/Singapore Land Authority/i.test(manifest.attribution.html)
        || !normalizeHttpUrl(manifest.attribution.logoUrl)
        || !hasAcceptedIntegrity(manifest.integrity, accepted)
        || !isRecord(manifest.transport)
        || !Number.isSafeInteger(manifest.transport.chunkCount)
        || manifest.transport.chunkCount !== accepted.chunkCount
        || !Number.isSafeInteger(manifest.transport.totalBytes)
        || manifest.transport.totalBytes !== accepted.chunkBytes
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
            accepted.nominalWorldPixelBounds,
            WORLD_PIXEL_TOLERANCE,
        )
        || !arraysNearlyEqual(
            source.worldPixelBounds.surface,
            accepted.surfaceWorldPixelBounds,
            0,
        )
        || !arraysNearlyEqual(
            source.nativePixelDimensions,
            accepted.nativePixelDimensions,
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
        !Object.entries(accepted.tileGrid).every(
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
        || manifest.integrity.chunkBytes !== accepted.chunkBytes
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

function hasAcceptedGenericSourceProfile(source) {
    if (!isRecord(source)) return false;
    const readability = source.readability;
    return source.provider === 'OneMap'
        && source.crs === 'EPSG:3857'
        && source.zoom === WEB_MERCATOR_ZOOM
        && source.tileSize === WEB_MERCATOR_TILE_SIZE
        && ACCEPTED_RETAINED_SCALES.includes(source.retainedScale)
        && source.jpegQuality === 95
        && source.jpegChromaSubsampling === '4:4:4'
        && Number.isSafeInteger(source.generatorVersion)
        && source.generatorVersion > 0
        && ACCEPTED_PROFILES.includes(source.profile)
        && isNonEmptyString(source.profileLabel)
        && source.onemapNativeLabels === true
        && source.hdbOverlay === false
        && source.readabilityPercent === 175
        && isRecord(readability)
        && readability.edition === 'readability-175'
        && readability.scaleFactor === 1.75
        && readability.rasterResampled === false
        && readability.embeddedImageStreamsPreserved === true
        && readability.textPreserved === true
        && readability.contentPreserved === true;
}

function isValidIntegrityHash(value) {
    return value === undefined || value === null || SHA256_PATTERN.test(String(value));
}

function hasAcceptedGenericIntegrity(integrity) {
    if (
        !isRecord(integrity)
        || integrity.algorithm !== 'sha256'
        || !SHA256_PATTERN.test(String(integrity.chunkSetSha256 || ''))
        || integrity.chunkSetCanonicalization !== ACCEPTED_CHUNK_CANONICALIZATION
        || !Number.isSafeInteger(integrity.chunkCount)
        || !Number.isSafeInteger(integrity.chunkBytes)
        || integrity.chunkCount <= 0
        || integrity.chunkBytes <= 0
    ) {
        return false;
    }

    return [
        integrity.sourceManifestSha256,
        integrity.islandwidePlanSha256,
        integrity.readabilityValidationSha256,
        integrity.readabilityReportSha256,
        integrity.collectionValidationSha256,
        integrity.sourceAlignmentSha256,
        integrity.validatedSourcePdfSha256,
        integrity.validatedReadabilityPdfSha256,
        integrity.embeddedImageStreamSignature,
        integrity.extractedTextSignature,
    ].every(isValidIntegrityHash);
}

function validateFixedTownSurfaceManifestGeneric(manifest) {
    if (!isRecord(manifest)) return false;
    if (
        manifest.schema !== FIXED_TOWN_SURFACE_SCHEMA
        || manifest.schemaVersion !== FIXED_TOWN_SURFACE_SCHEMA_VERSION
        || !isRecord(manifest.map)
        || !FIXED_TOWN_SURFACE_ID_PATTERN.test(String(manifest.map.id || ''))
        || !isNonEmptyString(manifest.map.name)
        || !FIXED_TOWN_SURFACE_VERSION_PATTERN.test(String(manifest.map.version || ''))
        || !String(manifest.map.version).startsWith(`${String(manifest.map.id).toLowerCase()}-`)
        || !['default', 'gray'].includes(manifest.map.style || 'default')
        || !isRecord(manifest.bounds)
        || !readWsenBounds(manifest.bounds.nominal)
        || !readWsenBounds(manifest.bounds.surface)
        || !areBoundsContained(manifest.bounds.nominal, manifest.bounds.surface)
        || !hasAcceptedGenericSourceProfile(manifest.source)
        || !isRecord(manifest.retainedPixelDimensions)
        || !isValidPixelSize(manifest.retainedPixelDimensions.nominal)
        || !isValidPixelSize(manifest.retainedPixelDimensions.chunkGrid)
        || !isRecord(manifest.attribution)
        || manifest.attribution.required !== true
        || !isNonEmptyString(manifest.attribution.text)
        || !isNonEmptyString(manifest.attribution.html)
        || !/OneMap/i.test(manifest.attribution.html)
        || !/Singapore Land Authority/i.test(manifest.attribution.html)
        || !normalizeHttpUrl(manifest.attribution.logoUrl)
        || !hasAcceptedGenericIntegrity(manifest.integrity)
        || !isRecord(manifest.transport)
        || !Number.isSafeInteger(manifest.transport.chunkCount)
        || !Number.isSafeInteger(manifest.transport.totalBytes)
        || manifest.transport.chunkCount <= 0
        || manifest.transport.totalBytes <= 0
        || !Array.isArray(manifest.chunks)
        || manifest.chunks.length !== manifest.transport.chunkCount
        || manifest.integrity.chunkCount !== manifest.chunks.length
        || manifest.integrity.chunkBytes !== manifest.transport.totalBytes
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
    ) {
        return false;
    }

    if (
        (manifest.map.style || 'default') === 'gray'
        && source.style !== 'Grey'
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
            1,
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
        tileGrid.columns !== expectedTileColumns
        || tileGrid.rows !== expectedTileRows
        || !Number.isSafeInteger(tileGrid.sourceTiles)
        || tileGrid.sourceTiles <= 0
        || tileGrid.sourceTiles > expectedTileColumns * expectedTileRows
        || !Number.isSafeInteger(tileGrid.chunkColumns)
        || !Number.isSafeInteger(tileGrid.chunkRows)
        || !Number.isSafeInteger(tileGrid.chunkCount)
        || tileGrid.chunkColumns <= 0
        || tileGrid.chunkRows <= 0
        || tileGrid.chunkCount !== manifest.chunks.length
        || tileGrid.chunkColumns * tileGrid.chunkRows !== manifest.chunks.length
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
            || !arraysNearlyEqual(chunk.pixelSize, expectedPixelSize, 1)
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

export function validateFixedTownSurfaceManifest(manifest) {
    if (!isRecord(manifest)) return false;
    if (manifest?.map?.id === ACCEPTED_W01_DEFAULT.id) {
        const acceptedManifests = manifest?.map?.style === 'gray'
            ? ACCEPTED_W01_MANIFESTS.gray
            : ACCEPTED_W01_MANIFESTS.default;
        return acceptedManifests.some(
            (accepted) => validateFixedTownSurfaceManifestAgainst(manifest, accepted),
        );
    }
    return validateFixedTownSurfaceManifestGeneric(manifest);
}

export function parseFixedTownSurfaceManifest(manifest) {
    return validateFixedTownSurfaceManifest(manifest) ? manifest : null;
}

function readSurfaceIndexEntryBounds(surface) {
    if (!isRecord(surface)) return null;
    if (readWsenBounds(surface.bounds?.surface)) return surface.bounds.surface;
    if (readWsenBounds(surface.bounds?.nominal)) return surface.bounds.nominal;
    return readWsenBounds(surface.bounds) ? surface.bounds : null;
}

function readSurfaceIndexManifestPath(surface) {
    if (!isRecord(surface)) return '';
    const manifestPath = surface.manifestPath || surface.manifestUrl;
    const normalizedPath = normalizeAssetReference(manifestPath);
    if (!normalizedPath) return '';
    return normalizedPath;
}

function readSurfaceIndexAssetBasePath(surface) {
    if (!isRecord(surface)) return '';
    const explicitBasePath = normalizeAssetReference(surface.assetBasePath || surface.assetBaseUrl);
    if (explicitBasePath) return explicitBasePath;

    const manifestPath = readSurfaceIndexManifestPath(surface);
    if (!manifestPath || URL_SCHEME_PATTERN.test(manifestPath)) return '';
    const slashIndex = manifestPath.lastIndexOf('/');
    return slashIndex > 0 ? manifestPath.slice(0, slashIndex) : '';
}

function validateFixedTownSurfaceIndexEntry(surface, collectionStyle, collectionBounds) {
    const bounds = readSurfaceIndexEntryBounds(surface);
    if (
        !isRecord(surface)
        || !FIXED_TOWN_SURFACE_ID_PATTERN.test(String(surface.id || ''))
        || !isNonEmptyString(surface.name)
        || !readSurfaceIndexManifestPath(surface)
        || !readSurfaceIndexAssetBasePath(surface)
        || !bounds
        || (collectionBounds && !areBoundsContained(bounds, collectionBounds))
        || !['default', 'gray'].includes(surface.style || collectionStyle || 'default')
        || (collectionStyle && (surface.style || collectionStyle) !== collectionStyle)
    ) {
        return false;
    }

    if (surface.version !== undefined && !FIXED_TOWN_SURFACE_VERSION_PATTERN.test(String(surface.version || ''))) {
        return false;
    }
    if (surface.profile !== undefined && !ACCEPTED_PROFILES.includes(surface.profile)) {
        return false;
    }
    if (surface.retainedScale !== undefined && !ACCEPTED_RETAINED_SCALES.includes(surface.retainedScale)) {
        return false;
    }
    if (surface.retainedPixelDimensions !== undefined && !isValidPixelSize(surface.retainedPixelDimensions)) {
        return false;
    }
    if (surface.chunkCount !== undefined && (!Number.isSafeInteger(surface.chunkCount) || surface.chunkCount <= 0)) {
        return false;
    }
    if (surface.totalBytes !== undefined && (!Number.isSafeInteger(surface.totalBytes) || surface.totalBytes <= 0)) {
        return false;
    }
    if (surface.chunkSetSha256 !== undefined && !SHA256_PATTERN.test(String(surface.chunkSetSha256 || ''))) {
        return false;
    }
    if (surface.manifestSha256 !== undefined && !SHA256_PATTERN.test(String(surface.manifestSha256 || ''))) {
        return false;
    }
    if (surface.planningAreas !== undefined) {
        return Array.isArray(surface.planningAreas)
            && surface.planningAreas.every(isNonEmptyString);
    }
    return true;
}

export function validateFixedTownSurfaceIndex(index) {
    if (
        !isRecord(index)
        || index.schema !== FIXED_TOWN_SURFACE_INDEX_SCHEMA
        || index.schemaVersion !== FIXED_TOWN_SURFACE_INDEX_SCHEMA_VERSION
        || !isRecord(index.collection)
        || !isNonEmptyString(index.collection.id)
        || !FIXED_TOWN_SURFACE_VERSION_PATTERN.test(String(index.collection.version || ''))
        || !['default', 'gray'].includes(index.collection.style || 'default')
        || !Array.isArray(index.surfaces)
        || index.surfaces.length < 1
        || index.surfaces.length > 100
    ) {
        return false;
    }

    const collectionBounds = readWsenBounds(index.bounds?.surface)
        ? index.bounds.surface
        : (readWsenBounds(index.bounds) ? index.bounds : null);
    if (index.bounds !== undefined && !collectionBounds) return false;

    if (index.source !== undefined) {
        const source = index.source;
        if (
            !isRecord(source)
            || source.provider !== 'OneMap'
            || source.crs !== 'EPSG:3857'
            || source.zoom !== WEB_MERCATOR_ZOOM
            || source.tileSize !== WEB_MERCATOR_TILE_SIZE
            || source.readabilityPercent !== 175
        ) {
            return false;
        }
    }

    if (index.attribution !== undefined) {
        if (
            !isRecord(index.attribution)
            || index.attribution.required !== true
            || !isNonEmptyString(index.attribution.text)
            || !isNonEmptyString(index.attribution.html)
            || !/OneMap/i.test(index.attribution.html)
            || !/Singapore Land Authority/i.test(index.attribution.html)
            || !normalizeHttpUrl(index.attribution.logoUrl)
        ) {
            return false;
        }
    }

    const seenIds = new Set();
    let chunkCount = 0;
    let totalBytes = 0;
    for (const surface of index.surfaces) {
        if (!validateFixedTownSurfaceIndexEntry(surface, index.collection.style || 'default', collectionBounds)) {
            return false;
        }
        if (seenIds.has(surface.id)) return false;
        seenIds.add(surface.id);
        chunkCount += Number(surface.chunkCount || 0);
        totalBytes += Number(surface.totalBytes || 0);
        if (!Number.isSafeInteger(chunkCount) || !Number.isSafeInteger(totalBytes)) return false;
    }

    if (index.transport !== undefined) {
        if (
            !isRecord(index.transport)
            || index.transport.surfaceCount !== index.surfaces.length
            || (index.transport.chunkCount !== undefined && index.transport.chunkCount !== chunkCount)
            || (index.transport.totalBytes !== undefined && index.transport.totalBytes !== totalBytes)
        ) {
            return false;
        }
    }

    if (index.integrity !== undefined) {
        if (
            !isRecord(index.integrity)
            || index.integrity.algorithm !== 'sha256'
            || ![
                index.integrity.indexSha256,
                index.integrity.islandwidePlanSha256,
                index.integrity.readabilityValidationSha256,
                index.integrity.collectionValidationSha256,
                index.integrity.surfaceSetSha256,
            ].every(isValidIntegrityHash)
        ) {
            return false;
        }
    }

    return true;
}

export function parseFixedTownSurfaceIndex(index) {
    return validateFixedTownSurfaceIndex(index) ? index : null;
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

function createFixedTownAbortError() {
    const error = new Error('Fixed town surface request was aborted.');
    error.name = 'AbortError';
    return error;
}

function waitForFixedTownRetry(delayMs, signal) {
    const normalizedDelay = Math.max(0, Number(delayMs) || 0);
    if (signal?.aborted) return Promise.reject(createFixedTownAbortError());
    if (normalizedDelay === 0) return Promise.resolve();

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            signal?.removeEventListener?.('abort', handleAbort);
            resolve();
        }, normalizedDelay);
        const handleAbort = () => {
            clearTimeout(timeout);
            reject(createFixedTownAbortError());
        };
        signal?.addEventListener?.('abort', handleAbort, { once: true });
    });
}

function isRetryableFixedTownManifestStatus(status) {
    const normalizedStatus = Number(status);
    return normalizedStatus === 408
        || normalizedStatus === 425
        || normalizedStatus === 429
        || normalizedStatus >= 500;
}

export async function fetchFixedTownSurfaceManifest(assetBaseUrl, {
    manifestPath = 'manifest.json',
    signal,
    fetchImpl = globalThis.fetch,
    retryDelaysMs = [0, 800, 2400, 8000],
} = {}) {
    const manifestUrl = resolveFixedTownManifestUrl(assetBaseUrl, manifestPath);
    if (!manifestUrl || typeof fetchImpl !== 'function') {
        throw new Error('Fixed town surface manifest URL is unavailable.');
    }

    const attempts = Array.isArray(retryDelaysMs) && retryDelaysMs.length
        ? retryDelaysMs
        : [0];
    let lastError = null;

    for (let index = 0; index < attempts.length; index += 1) {
        await waitForFixedTownRetry(attempts[index], signal);
        try {
            const response = await fetchImpl(manifestUrl, {
                signal,
                cache: 'no-store',
            });
            if (!response?.ok) {
                const error = new Error(`Town map manifest request failed (${response?.status || 'network'}).`);
                error.retryable = isRetryableFixedTownManifestStatus(response?.status);
                throw error;
            }
            const manifest = parseFixedTownSurfaceManifest(await response.json());
            if (!manifest) {
                const error = new Error('Town map manifest is invalid.');
                error.retryable = false;
                throw error;
            }
            return manifest;
        } catch (error) {
            if (error?.name === 'AbortError' || signal?.aborted) throw error;
            lastError = error;
            if (error?.retryable === false || index === attempts.length - 1) break;
        }
    }

    throw lastError || new Error('Town map manifest could not load.');
}

export async function fetchFixedTownSurfaceSource(assetBaseUrl, {
    signal,
    fetchImpl = globalThis.fetch,
    retryDelaysMs = [0, 800, 2400, 8000],
} = {}) {
    const manifestUrl = resolveFixedTownManifestUrl(assetBaseUrl);
    if (!manifestUrl || typeof fetchImpl !== 'function') {
        throw new Error('Fixed town surface source URL is unavailable.');
    }

    const attempts = Array.isArray(retryDelaysMs) && retryDelaysMs.length
        ? retryDelaysMs
        : [0];
    let lastError = null;

    for (let index = 0; index < attempts.length; index += 1) {
        await waitForFixedTownRetry(attempts[index], signal);
        try {
            const response = await fetchImpl(manifestUrl, {
                signal,
                cache: 'no-store',
            });
            if (!response?.ok) {
                const error = new Error(`Town map source request failed (${response?.status || 'network'}).`);
                error.retryable = isRetryableFixedTownManifestStatus(response?.status);
                throw error;
            }
            const payload = await response.json();
            const manifest = parseFixedTownSurfaceManifest(payload);
            if (manifest) return { type: 'manifest', manifest };
            const indexPayload = parseFixedTownSurfaceIndex(payload);
            if (indexPayload) return { type: 'index', index: indexPayload };
            const error = new Error('Town map source is invalid.');
            error.retryable = false;
            throw error;
        } catch (error) {
            if (error?.name === 'AbortError' || signal?.aborted) throw error;
            lastError = error;
            if (error?.retryable === false || index === attempts.length - 1) break;
        }
    }

    throw lastError || new Error('Town map source could not load.');
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

export function resolveFixedTownSurfaceManifestPath(surface) {
    return readSurfaceIndexManifestPath(surface);
}

export function resolveFixedTownSurfaceAssetBaseUrl(assetBaseUrl, surface) {
    const basePath = readSurfaceIndexAssetBasePath(surface);
    return basePath ? resolveFixedTownAssetUrl(assetBaseUrl, basePath) : '';
}

export function selectFixedTownSurfaceForViewport(surfacesOrIndex, viewportBounds, preferredPoints = []) {
    const surfaces = Array.isArray(surfacesOrIndex)
        ? surfacesOrIndex
        : surfacesOrIndex?.surfaces;
    const candidates = Array.isArray(surfaces)
        ? surfaces.filter((surface) => readSurfaceIndexEntryBounds(surface))
        : [];
    if (!candidates.length) return null;

    const normalizedViewport = readWsenBounds(viewportBounds) ? viewportBounds : null;
    const viewportCenter = normalizedViewport ? getWsenBoundsCenter(normalizedViewport) : null;
    const points = Array.isArray(preferredPoints) ? preferredPoints : [];
    let bestSurface = null;
    let bestScore = null;

    for (const surface of candidates) {
        const surfaceBounds = readSurfaceIndexEntryBounds(surface);
        const pointHits = points.filter((point) => isPointWithinWsenBounds(point, surfaceBounds)).length;
        const centerHit = viewportCenter && isPointWithinWsenBounds(viewportCenter, surfaceBounds) ? 1 : 0;
        const intersectionArea = normalizedViewport
            ? getWsenIntersectionArea(surfaceBounds, normalizedViewport)
            : 0;
        const viewportContained = normalizedViewport && areBoundsContained(normalizedViewport, surfaceBounds) ? 1 : 0;
        if (normalizedViewport && intersectionArea <= 0 && !centerHit) {
            continue;
        }
        if (!normalizedViewport && pointHits <= 0 && bestSurface) {
            continue;
        }

        const score = {
            pointHits,
            centerHit,
            viewportContained,
            intersectionArea,
            area: getWsenIntersectionArea(surfaceBounds, surfaceBounds),
        };
        const isBetterWithViewport = normalizedViewport && (
            !bestScore
            || score.viewportContained > bestScore.viewportContained
            || (
                score.viewportContained === bestScore.viewportContained
                && score.centerHit > bestScore.centerHit
            )
            || (
                score.viewportContained === bestScore.viewportContained
                && score.centerHit === bestScore.centerHit
                && score.intersectionArea > bestScore.intersectionArea
            )
            || (
                score.viewportContained === bestScore.viewportContained
                && score.centerHit === bestScore.centerHit
                && score.intersectionArea === bestScore.intersectionArea
                && score.area < bestScore.area
            )
            || (
                score.viewportContained === bestScore.viewportContained
                && score.centerHit === bestScore.centerHit
                && score.intersectionArea === bestScore.intersectionArea
                && score.area === bestScore.area
                && score.pointHits > bestScore.pointHits
            )
        );
        const isBetterWithoutViewport = !normalizedViewport && (
            !bestScore
            || score.pointHits > bestScore.pointHits
            || (score.pointHits === bestScore.pointHits && score.area < bestScore.area)
        );
        if (isBetterWithViewport || isBetterWithoutViewport) {
            bestSurface = surface;
            bestScore = score;
        }
    }

    return bestSurface;
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

export function normalizeFixedTownStandardZoom(zoom, minZoom) {
    const normalizedZoom = Number(zoom);
    if (minZoom === null || minZoom === undefined || minZoom === '') {
        return normalizedZoom;
    }
    const normalizedMinZoom = Math.round(Number(minZoom));
    if (!Number.isFinite(normalizedZoom) || !Number.isFinite(normalizedMinZoom)) {
        return normalizedZoom;
    }

    const maximumStandardZoom = normalizedMinZoom - 1;
    const detailedThreshold = normalizedMinZoom - 0.5;
    return normalizedZoom > maximumStandardZoom && normalizedZoom < detailedThreshold
        ? maximumStandardZoom
        : normalizedZoom;
}

export function resolveFixedTownMinimumZoomSnap({
    enabled = false,
    zoom,
    minZoom,
    viewportEligible = null,
} = {}) {
    const normalizedZoom = Number(zoom);
    const normalizedMinZoom = Math.round(Number(minZoom));
    if (
        !enabled
        || viewportEligible !== false
        || !Number.isFinite(normalizedZoom)
        || !Number.isFinite(normalizedMinZoom)
        || normalizedZoom >= normalizedMinZoom
        || !isFixedTownSurfaceZoomEligible(normalizedZoom, normalizedMinZoom)
    ) {
        return null;
    }

    return normalizedMinZoom;
}

export function shouldRetryFixedTownSurfaceMemoryFallback({
    currentZoom,
    fallbackZoom,
} = {}) {
    if (
        currentZoom === null
        || currentZoom === undefined
        || currentZoom === ''
        || fallbackZoom === null
        || fallbackZoom === undefined
        || fallbackZoom === ''
    ) {
        return false;
    }
    const normalizedCurrentZoom = Number(currentZoom);
    const normalizedFallbackZoom = Number(fallbackZoom);
    return Number.isFinite(normalizedCurrentZoom)
        && Number.isFinite(normalizedFallbackZoom)
        && normalizedCurrentZoom - normalizedFallbackZoom >= 0.05;
}

export function shouldCapFixedTownRequestedLiveTiles({
    townRequested = false,
    surfaceConfigured = false,
    viewportEligible = null,
    surfaceFaulted = false,
} = {}) {
    return Boolean(
        townRequested
        && surfaceConfigured
        && viewportEligible !== false
        && !surfaceFaulted
    );
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
