import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    invariant,
    mapWithConcurrency,
    normalizeR2Prefix,
    sha256,
} from './r2-w01-lib.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../..');

export const DEFAULT_W01_GRAY_SOURCE_ROOT = '/Users/sweetbuns/Documents/SG MAP';
export const DEFAULT_W01_GRAY_MANIFEST_PATH = path.join(
    REPO_ROOT,
    'output/town-map-proof/assets/v1/w01/gray/manifest.json',
);
export const DEFAULT_W01_GRAY_R2_BUCKET = 'carearound-town-map-assets';
export const DEFAULT_W01_GRAY_R2_PREFIX = 'v1/w01/gray';
export const DEFAULT_W01_GRAY_PUBLIC_BASE_URL = 'https://maps.carearound.sg/v1/w01/gray';

const EXPECTED_VERSION = 'w01-grey-s50-q95-g1-5456cd4fb905dcca';
const EXPECTED_CHUNK_COUNT = 88;
const EXPECTED_CHUNK_BYTES = 48817738;
const EXPECTED_CHUNK_SET_SHA256 = '5456cd4fb905dccaea7ba7f30610a34750163bff225bfc09634eb370600cb281';
const EXPECTED_SOURCE_MANIFEST_SHA256 = 'c1f4bd12830ec9659a5d4b3240acd5455555e8282f834d1e9687cbc5f5208d0e';
const CHUNK_URL_PATTERN = /^chunks\/(?<fileName>z19-\d+-\d+-\d+-\d+\.jpg)$/;

export function validateW01GrayManifestBuffer(manifestBuffer) {
    const manifest = JSON.parse(Buffer.from(manifestBuffer).toString('utf8'));
    invariant(
        manifest.schema === 'carearound.fixed-town-surface' && manifest.schemaVersion === 1,
        'Expected carearound.fixed-town-surface v1',
    );
    invariant(manifest.map?.id === 'W01' && manifest.map?.style === 'gray', 'Expected the Gray W01 map manifest');
    invariant(manifest.map?.version === EXPECTED_VERSION, 'Gray W01 manifest version is not accepted');
    invariant(
        Array.isArray(manifest.chunks) && manifest.chunks.length === EXPECTED_CHUNK_COUNT,
        `Gray W01 manifest must contain ${EXPECTED_CHUNK_COUNT} chunks`,
    );
    invariant(manifest.integrity?.chunkSetSha256 === EXPECTED_CHUNK_SET_SHA256, 'Gray W01 chunk set is not accepted');
    invariant(manifest.integrity?.sourceManifestSha256 === EXPECTED_SOURCE_MANIFEST_SHA256, 'Gray W01 source manifest is not accepted');

    const seen = new Set();
    const canonicalEntries = [];
    let totalBytes = 0;
    for (const chunk of manifest.chunks) {
        const match = CHUNK_URL_PATTERN.exec(chunk.url || '');
        invariant(match?.groups?.fileName, `Unsafe Gray W01 chunk URL: ${chunk.url}`);
        const fileName = match.groups.fileName;
        invariant(!seen.has(fileName), `Duplicate Gray W01 chunk: ${fileName}`);
        invariant(Number.isSafeInteger(chunk.byteSize) && chunk.byteSize > 0, `Invalid Gray W01 chunk size: ${fileName}`);
        invariant(/^[a-f0-9]{64}$/.test(chunk.sha256 || ''), `Invalid Gray W01 chunk hash: ${fileName}`);
        seen.add(fileName);
        totalBytes += chunk.byteSize;
        canonicalEntries.push({ fileName, sha256: chunk.sha256 });
    }

    const chunkSetHash = sha256(
        canonicalEntries
            .sort((left, right) => left.fileName.localeCompare(right.fileName, 'en'))
            .map((entry) => `${entry.sha256}  ${entry.fileName}\n`)
            .join(''),
    );
    invariant(chunkSetHash === EXPECTED_CHUNK_SET_SHA256, 'Gray W01 manifest chunk-set hash drifted');
    invariant(
        totalBytes === EXPECTED_CHUNK_BYTES
            && totalBytes === manifest.transport?.totalBytes
            && totalBytes === manifest.integrity?.chunkBytes,
        'Gray W01 manifest byte totals do not agree',
    );
    return { manifest, manifestSha256: sha256(manifestBuffer), totalBytes };
}

export async function loadW01GrayR2DeploymentPlan({
    manifestPath = DEFAULT_W01_GRAY_MANIFEST_PATH,
    sourceRoot = DEFAULT_W01_GRAY_SOURCE_ROOT,
    prefix = DEFAULT_W01_GRAY_R2_PREFIX,
} = {}) {
    const normalizedPrefix = normalizeR2Prefix(prefix);
    const resolvedManifestPath = path.resolve(manifestPath);
    const chunkRoot = path.join(
        path.resolve(sourceRoot),
        'output/static-town-maps-grey/assets/chunks/W01-s50-q95',
    );
    const manifestBuffer = await readFile(resolvedManifestPath);
    const validated = validateW01GrayManifestBuffer(manifestBuffer);
    const sourceFileNames = (await readdir(chunkRoot)).filter((fileName) => fileName.endsWith('.jpg')).sort();
    const manifestFileNames = validated.manifest.chunks.map((chunk) => chunk.url.slice('chunks/'.length)).sort();
    invariant(JSON.stringify(sourceFileNames) === JSON.stringify(manifestFileNames), 'Gray W01 source directory does not match the manifest allowlist');

    const chunkObjects = [];
    for (const chunk of validated.manifest.chunks) {
        const fileName = chunk.url.slice('chunks/'.length);
        const filePath = path.join(chunkRoot, fileName);
        const fileStats = await stat(filePath);
        invariant(fileStats.isFile() && fileStats.size === chunk.byteSize, `Gray W01 source size drifted: ${fileName}`);
        invariant(sha256(await readFile(filePath)) === chunk.sha256, `Gray W01 source hash drifted: ${fileName}`);
        chunkObjects.push({
            key: `${normalizedPrefix}/chunks/${fileName}`,
            filePath,
            byteSize: chunk.byteSize,
            sha256: chunk.sha256,
            contentType: 'image/jpeg',
            cacheControl: 'public, max-age=31536000, immutable',
        });
    }

    return {
        mapId: validated.manifest.map.id,
        version: validated.manifest.map.version,
        prefix: normalizedPrefix,
        manifestSha256: validated.manifestSha256,
        totalBytes: validated.totalBytes,
        chunkObjects,
        manifestObject: {
            key: `${normalizedPrefix}/manifest.json`,
            filePath: resolvedManifestPath,
            byteSize: manifestBuffer.length,
            sha256: validated.manifestSha256,
            contentType: 'application/json; charset=utf-8',
            cacheControl: 'public, max-age=300, must-revalidate',
        },
    };
}

export { invariant, mapWithConcurrency, sha256 };
