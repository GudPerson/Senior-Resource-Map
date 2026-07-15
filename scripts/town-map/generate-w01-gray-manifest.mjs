#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../..');
const SOURCE_ROOT = path.resolve(process.env.TOWN_MAP_SOURCE_ROOT || '/Users/sweetbuns/Documents/SG MAP');
const OUTPUT_PATH = path.resolve(
    process.env.TOWN_MAP_GRAY_MANIFEST_OUTPUT
        || path.join(REPO_ROOT, 'output/town-map-proof/assets/v1/w01/gray/manifest.json'),
);
const SOURCE_MANIFEST_PATH = path.join(
    SOURCE_ROOT,
    'output/static-town-maps-grey/assets/manifests/w01-grey-surface.json',
);
const SOURCE_VALIDATION_PATH = path.join(
    SOURCE_ROOT,
    'output/static-town-maps-grey/assets/grey-surface-validation.json',
);
const SOURCE_ALIGNMENT_PATH = path.join(
    SOURCE_ROOT,
    'output/static-town-maps-grey/assets/qa/source-comparison/source-comparison.json',
);
const SOURCE_CHUNK_ROOT = path.join(
    SOURCE_ROOT,
    'output/static-town-maps-grey/assets/chunks/W01-s50-q95',
);

const ACCEPTED = Object.freeze({
    sourceManifestSha256: 'c1f4bd12830ec9659a5d4b3240acd5455555e8282f834d1e9687cbc5f5208d0e',
    validationSha256: 'b67566aa234d8fe22cea40f1a1e03f0018b11d6858f86823ead1415811c80b0a',
    sourceAlignmentSha256: 'a43a0e16458dc15e160968631a3d0c45d3e23f6d27142a2eda6ef52c4ff3718f',
    chunkSetSha256: '5456cd4fb905dccaea7ba7f30610a34750163bff225bfc09634eb370600cb281',
    chunkCount: 88,
    chunkBytes: 48817738,
});

const TILE_SIZE = 256;
const ZOOM = 19;
const RETAINED_SCALE = 0.5;

function invariant(condition, message) {
    if (!condition) throw new Error(message);
}

function sha256(value) {
    return createHash('sha256').update(value).digest('hex');
}

function worldPixelToLonLat(x, y) {
    const worldSize = TILE_SIZE * (2 ** ZOOM);
    const longitude = (x / worldSize) * 360 - 180;
    const mercatorY = Math.PI - (2 * Math.PI * y) / worldSize;
    const latitude = (Math.atan(Math.sinh(mercatorY)) * 180) / Math.PI;
    return [longitude, latitude];
}

function lonLatToWorldPixel(longitude, latitude) {
    const worldSize = TILE_SIZE * (2 ** ZOOM);
    const sinLatitude = Math.sin((latitude * Math.PI) / 180);
    return [
        ((longitude + 180) / 360) * worldSize,
        (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI)) * worldSize,
    ];
}

async function readAcceptedJson(filePath, expectedHash, label) {
    const buffer = await readFile(filePath);
    invariant(sha256(buffer) === expectedHash, `${label} drifted from its accepted SHA-256`);
    return { buffer, value: JSON.parse(buffer.toString('utf8')) };
}

async function main() {
    const [source, validation, alignment] = await Promise.all([
        readAcceptedJson(SOURCE_MANIFEST_PATH, ACCEPTED.sourceManifestSha256, 'Gray W01 manifest'),
        readAcceptedJson(SOURCE_VALIDATION_PATH, ACCEPTED.validationSha256, 'Gray collection validation'),
        readAcceptedJson(SOURCE_ALIGNMENT_PATH, ACCEPTED.sourceAlignmentSha256, 'Gray source-alignment QA'),
    ]);
    const sourceManifest = source.value;
    const validationRecord = validation.value.surfaces?.find((surface) => surface.id === 'W01');
    invariant(sourceManifest.id === 'W01', 'Expected the W01 gray surface');
    invariant(sourceManifest.schema === 'carearound.fixed-map-surface/v1', 'Unexpected gray source schema');
    invariant(sourceManifest.edition === 'onemap-grey-fixed-surface-v1', 'Unexpected gray edition');
    invariant(sourceManifest.surface?.runtime_zoom_pyramid === false, 'Gray source must be one fixed surface');
    invariant(validation.value.status === 'pass' && validationRecord?.status === 'pass', 'Gray W01 validation is not passing');
    invariant(alignment.value.status === 'pass', 'Gray source alignment is not passing');
    invariant(sourceManifest.presentation_presets?.readability_175?.scale === 1.75, 'Gray readability profile is not 175%');
    invariant(sourceManifest.chunk_count === ACCEPTED.chunkCount, 'Unexpected gray W01 chunk count');
    invariant(sourceManifest.total_chunk_bytes === ACCEPTED.chunkBytes, 'Unexpected gray W01 byte total');

    const sourceFileNames = (await readdir(SOURCE_CHUNK_ROOT))
        .filter((fileName) => fileName.endsWith('.jpg'))
        .sort();
    const manifestFileNames = sourceManifest.chunks
        .map((chunk) => path.posix.basename(chunk.url))
        .sort();
    invariant(JSON.stringify(sourceFileNames) === JSON.stringify(manifestFileNames), 'Gray chunk directory differs from the manifest allowlist');

    const xStarts = [...new Set(sourceManifest.chunks.map((chunk) => chunk.x))].sort((a, b) => a - b);
    const yStarts = [...new Set(sourceManifest.chunks.map((chunk) => chunk.y))].sort((a, b) => a - b);
    invariant(xStarts.length * yStarts.length === ACCEPTED.chunkCount, 'Gray chunks do not form a rectangular grid');
    const columns = new Map(xStarts.map((value, index) => [value, index]));
    const rows = new Map(yStarts.map((value, index) => [value, index]));

    const chunks = sourceManifest.chunks.map((chunk) => {
        const fileName = path.posix.basename(chunk.url);
        const expectedPixelSize = [
            Math.round((chunk.world_pixel_bounds_z19[2] - chunk.world_pixel_bounds_z19[0]) * RETAINED_SCALE),
            Math.round((chunk.world_pixel_bounds_z19[3] - chunk.world_pixel_bounds_z19[1]) * RETAINED_SCALE),
        ];
        invariant(chunk.width === expectedPixelSize[0] && chunk.height === expectedPixelSize[1], `${fileName} pixel dimensions drifted`);
        return {
            id: chunk.id,
            url: `chunks/${fileName}`,
            row: rows.get(chunk.y),
            column: columns.get(chunk.x),
            bounds: chunk.bounds,
            worldPixelBounds: chunk.world_pixel_bounds_z19,
            pixelSize: [chunk.width, chunk.height],
            byteSize: chunk.bytes,
            sha256: chunk.sha256,
        };
    }).sort((left, right) => left.row - right.row || left.column - right.column);

    const chunkRegister = [...chunks]
        .sort((left, right) => left.url.localeCompare(right.url, 'en'))
        .map((chunk) => `${chunk.sha256}  ${path.posix.basename(chunk.url)}\n`)
        .join('');
    invariant(sha256(Buffer.from(chunkRegister)) === ACCEPTED.chunkSetSha256, 'Gray chunk-set hash drifted');

    const [west, south, east, north] = sourceManifest.bounds;
    const [nominalLeft, nominalTop] = lonLatToWorldPixel(west, north);
    const [nominalRight, nominalBottom] = lonLatToWorldPixel(east, south);
    const surfaceWorldPixelBounds = [
        Math.min(...chunks.map((chunk) => chunk.worldPixelBounds[0])),
        Math.min(...chunks.map((chunk) => chunk.worldPixelBounds[1])),
        Math.max(...chunks.map((chunk) => chunk.worldPixelBounds[2])),
        Math.max(...chunks.map((chunk) => chunk.worldPixelBounds[3])),
    ];
    const [surfaceWest, surfaceNorth] = worldPixelToLonLat(surfaceWorldPixelBounds[0], surfaceWorldPixelBounds[1]);
    const [surfaceEast, surfaceSouth] = worldPixelToLonLat(surfaceWorldPixelBounds[2], surfaceWorldPixelBounds[3]);
    const chunkGrid = [
        xStarts.reduce((sum, x) => sum + chunks.find((chunk) => chunk.column === columns.get(x)).pixelSize[0], 0),
        yStarts.reduce((sum, y) => sum + chunks.find((chunk) => chunk.row === rows.get(y)).pixelSize[1], 0),
    ];

    const manifest = {
        schema: 'carearound.fixed-town-surface',
        schemaVersion: 1,
        map: {
            id: 'W01',
            version: `w01-grey-s50-q95-g1-${ACCEPTED.chunkSetSha256.slice(0, 16)}`,
            name: sourceManifest.name,
            style: 'gray',
        },
        planningAreas: sourceManifest.planning_areas,
        bounds: {
            nominal: sourceManifest.bounds,
            surface: [surfaceWest, surfaceSouth, surfaceEast, surfaceNorth],
        },
        retainedPixelDimensions: {
            nominal: [sourceManifest.surface.width, sourceManifest.surface.height],
            chunkGrid,
        },
        source: {
            provider: 'OneMap',
            style: 'Grey',
            crs: 'EPSG:3857',
            zoom: ZOOM,
            tileSize: TILE_SIZE,
            retainedScale: RETAINED_SCALE,
            jpegQuality: 95,
            jpegChromaSubsampling: '4:4:4',
            generatorVersion: 1,
            profile: sourceManifest.profile,
            profileLabel: '50% z19 residential',
            onemapNativeLabels: true,
            hdbOverlay: false,
            nativePixelDimensions: [
                Math.round(nominalRight - nominalLeft),
                Math.round(nominalBottom - nominalTop),
            ],
            worldPixelBounds: {
                nominal: [nominalLeft, nominalTop, nominalRight, nominalBottom],
                surface: surfaceWorldPixelBounds,
            },
            tileGrid: {
                columns: Math.ceil(surfaceWorldPixelBounds[2] / TILE_SIZE) - Math.floor(surfaceWorldPixelBounds[0] / TILE_SIZE),
                rows: Math.ceil(surfaceWorldPixelBounds[3] / TILE_SIZE) - Math.floor(surfaceWorldPixelBounds[1] / TILE_SIZE),
                sourceTiles: 18408,
                chunkColumns: xStarts.length,
                chunkRows: yStarts.length,
                chunkCount: chunks.length,
            },
            readability: {
                edition: 'readability-175',
                scaleFactor: 1.75,
                rasterResampled: false,
                embeddedImageStreamsPreserved: true,
                textPreserved: true,
                contentPreserved: true,
            },
            readabilityPercent: 175,
        },
        attribution: {
            text: 'OneMap © contributors | Singapore Land Authority',
            html: '<a href="https://www.onemap.gov.sg/" target="_blank" rel="noopener noreferrer">OneMap</a> © contributors | Singapore Land Authority',
            logoUrl: sourceManifest.attribution.logo_url,
            required: true,
        },
        presentation: { backgroundColor: '#f8f8f7' },
        transport: { chunkCount: chunks.length, totalBytes: ACCEPTED.chunkBytes },
        integrity: {
            algorithm: 'sha256',
            chunkCount: chunks.length,
            chunkBytes: ACCEPTED.chunkBytes,
            chunkSetSha256: ACCEPTED.chunkSetSha256,
            chunkSetCanonicalization: 'UTF-8 lines "<sha256>  <filename>\\n", sorted by filename',
            sourceManifestSha256: ACCEPTED.sourceManifestSha256,
            collectionValidationSha256: ACCEPTED.validationSha256,
            sourceAlignmentSha256: ACCEPTED.sourceAlignmentSha256,
        },
        chunks,
    };

    const output = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
    await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    await writeFile(OUTPUT_PATH, output);
    console.log(JSON.stringify({
        output: OUTPUT_PATH,
        version: manifest.map.version,
        chunks: chunks.length,
        chunkBytes: ACCEPTED.chunkBytes,
        manifestBytes: output.length,
        manifestSha256: sha256(output),
        chunkSetSha256: ACCEPTED.chunkSetSha256,
    }, null, 2));
}

main().catch((error) => {
    console.error(`Gray W01 manifest generation failed: ${error.message}`);
    process.exitCode = 1;
});
