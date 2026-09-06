#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseFixedTownSurfaceIndex,
  parseFixedTownSurfaceManifest,
} from '../../client/src/lib/fixedTownSurface.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_OUTPUT_ROOT = path.join(
  REPO_ROOT,
  'output',
  'town-map-proof',
  'discover-derivative-v1-80-20260906',
);
const FULL_NATIVE_SURFACE_IDS = Object.freeze([
  'C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C08',
  'E01', 'E02', 'E03', 'E04', 'E05', 'E06',
  'N01', 'N02',
  'NE01', 'NE02', 'NE03', 'NE04', 'NE05',
  'NW01', 'NW02', 'NW03',
  'S01',
  'W01', 'W02', 'W03', 'W04', 'W05', 'W06', 'W07',
]);
const PILOT_EXPECTED = Object.freeze([
  Object.freeze({ tier: 'native', style: 'default', ids: ['C02', 'W04'] }),
  Object.freeze({ tier: 'native', style: 'gray', ids: ['C02', 'W04'] }),
  Object.freeze({ tier: 'overview', style: 'default', ids: ['SG14'] }),
  Object.freeze({ tier: 'overview', style: 'gray', ids: ['SG14'] }),
]);
const FULL_EXPECTED = Object.freeze([
  Object.freeze({ tier: 'native', style: 'default', ids: FULL_NATIVE_SURFACE_IDS }),
  Object.freeze({ tier: 'native', style: 'gray', ids: FULL_NATIVE_SURFACE_IDS }),
  Object.freeze({ tier: 'overview', style: 'default', ids: ['SG14'] }),
  Object.freeze({ tier: 'overview', style: 'gray', ids: ['SG14'] }),
]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function safeJoin(root, relativePath, label) {
  invariant(typeof relativePath === 'string' && relativePath.length > 0, `${label} is missing`);
  invariant(!path.isAbsolute(relativePath) && !relativePath.includes('\\'), `${label} is unsafe`);
  const resolvedRoot = path.resolve(root);
  const resolvedPath = path.resolve(resolvedRoot, relativePath);
  invariant(
    resolvedPath.startsWith(`${resolvedRoot}${path.sep}`),
    `${label} escapes its collection root`,
  );
  return resolvedPath;
}

async function readJsonBuffer(filePath, label) {
  const buffer = await readFile(filePath);
  let value;
  try {
    value = JSON.parse(buffer.toString('utf8'));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
  return { buffer, value };
}

function readJpegDimensions(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 <= buffer.length) {
    while (offset < buffer.length && buffer[offset] === 0xff) offset += 1;
    if (offset >= buffer.length) break;
    const marker = buffer[offset];
    offset += 1;
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01) continue;
    if (marker >= 0xd0 && marker <= 0xd7) continue;
    if (offset + 2 > buffer.length) break;
    const length = buffer.readUInt16BE(offset);
    invariant(length >= 2 && offset + length <= buffer.length, 'JPEG segment is truncated');
    const isStartOfFrame = [
      0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
      0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
    ].includes(marker);
    if (isStartOfFrame) {
      invariant(length >= 7, 'JPEG start-of-frame segment is invalid');
      return [buffer.readUInt16BE(offset + 5), buffer.readUInt16BE(offset + 3)];
    }
    offset += length;
  }
  return null;
}

function buildChunkSetSha256(chunks) {
  const canonical = [...chunks]
    .sort((left, right) => path.basename(left.url).localeCompare(path.basename(right.url), 'en'))
    .map((chunk) => `${chunk.sha256}  ${path.basename(chunk.url)}\n`)
    .join('');
  return sha256(Buffer.from(canonical, 'utf8'));
}

function buildSurfaceSetSha256(rows) {
  const canonical = [...rows]
    .sort((left, right) => left.id.localeCompare(right.id, 'en'))
    .map((row) => `${row.id}  ${row.version}  ${row.manifestSha256}  ${row.chunkSetSha256}\n`)
    .join('');
  return sha256(Buffer.from(canonical, 'utf8'));
}

async function validateCollection(outputRoot, expected) {
  const collectionRoot = path.join(outputRoot, expected.tier, expected.style);
  const indexSource = await readJsonBuffer(path.join(collectionRoot, 'manifest.json'), `${expected.tier}/${expected.style} index`);
  const index = parseFixedTownSurfaceIndex(indexSource.value);
  invariant(index, `${expected.tier}/${expected.style} index fails the client contract`);
  invariant(index.collection.style === expected.style, `${expected.tier}/${expected.style} style drifted`);
  invariant(
    JSON.stringify(index.surfaces.map((surface) => surface.id)) === JSON.stringify(expected.ids),
    `${expected.tier}/${expected.style} derivative surface set drifted`,
  );

  const rows = [];
  const records = [];
  for (const surface of index.surfaces) {
    const manifestPath = safeJoin(collectionRoot, surface.manifestPath, `${surface.id} manifest path`);
    const manifestSource = await readJsonBuffer(manifestPath, `${surface.id} manifest`);
    const manifest = parseFixedTownSurfaceManifest(manifestSource.value);
    invariant(manifest, `${expected.tier}/${expected.style}/${surface.id} fails the client contract`);
    invariant(manifestSource.buffer.length === surface.manifestBytes, `${surface.id} manifest byte size drifted`);
    invariant(sha256(manifestSource.buffer) === surface.manifestSha256, `${surface.id} manifest hash drifted`);
    invariant(manifest.map.style === expected.style, `${surface.id} manifest style drifted`);
    invariant(manifest.source.derivative?.scope === 'discover-only', `${surface.id} is not Discover-only`);
    invariant(manifest.source.derivative?.linearScale === 0.8, `${surface.id} linear scale drifted`);
    invariant(
      manifest.integrity.chunkSetSha256 === buildChunkSetSha256(manifest.chunks),
      `${surface.id} chunk-set hash drifted`,
    );

    let derivativeDecodedBytes = 0;
    for (const chunk of manifest.chunks) {
      const chunkPath = safeJoin(path.dirname(manifestPath), chunk.url, `${surface.id}/${chunk.id}`);
      const chunkBuffer = await readFile(chunkPath);
      invariant(chunkBuffer.length === chunk.byteSize, `${surface.id}/${chunk.id} byte size drifted`);
      invariant(sha256(chunkBuffer) === chunk.sha256, `${surface.id}/${chunk.id} hash drifted`);
      invariant(
        JSON.stringify(readJpegDimensions(chunkBuffer)) === JSON.stringify(chunk.pixelSize),
        `${surface.id}/${chunk.id} JPEG dimensions drifted`,
      );
      derivativeDecodedBytes += chunk.pixelSize[0] * chunk.pixelSize[1] * 4;
    }
    const sourceDecodedBytes = manifest.chunks.reduce((sum, chunk) => {
      const [left, top, right, bottom] = chunk.worldPixelBounds;
      const sourceScale = manifest.source.derivative.sourceRetainedScale;
      return sum + Math.round((right - left) * sourceScale)
        * Math.round((bottom - top) * sourceScale) * 4;
    }, 0);
    const decodedRatio = derivativeDecodedBytes / sourceDecodedBytes;
    invariant(decodedRatio >= 0.639 && decodedRatio <= 0.641, `${surface.id} decoded ratio is ${decodedRatio}`);

    rows.push({
      id: surface.id,
      version: surface.version,
      manifestSha256: surface.manifestSha256,
      chunkSetSha256: surface.chunkSetSha256,
    });
    records.push({
      tier: expected.tier,
      style: expected.style,
      id: surface.id,
      chunks: manifest.chunks.length,
      decodedMiB: derivativeDecodedBytes / (1024 * 1024),
      decodedRatio,
      transportMiB: manifest.transport.totalBytes / (1024 * 1024),
    });
  }

  invariant(
    buildSurfaceSetSha256(rows) === index.integrity.surfaceSetSha256,
    `${expected.tier}/${expected.style} surface-set hash drifted`,
  );
  return records;
}

async function main() {
  const outputArgument = process.argv.find((argument) => argument.startsWith('--output-root='));
  const outputRoot = path.resolve(outputArgument?.slice('--output-root='.length) || DEFAULT_OUTPUT_ROOT);
  const scopeArgument = process.argv.find((argument) => argument.startsWith('--scope='));
  const scope = scopeArgument?.slice('--scope='.length) || 'full';
  invariant(['pilot', 'full'].includes(scope), `Unsupported derivative scope: ${scope}`);
  const expectedCollections = scope === 'pilot' ? PILOT_EXPECTED : FULL_EXPECTED;
  const expectedRecordCount = expectedCollections.reduce((sum, collection) => sum + collection.ids.length, 0);
  const validation = await readJsonBuffer(path.join(outputRoot, 'validation.json'), 'derivative validation');
  invariant(
    validation.value.schema === 'carearound.discover-derivative-validation',
    'Derivative validation schema drifted',
  );
  invariant(validation.value.mode === scope, `Derivative validation mode is not ${scope}`);
  invariant(validation.value.linearScale === 0.8, 'Derivative validation scale drifted');
  invariant(
    JSON.stringify(validation.value.scope?.nativeSurfaceIds) === JSON.stringify(expectedCollections[0].ids),
    'Derivative validation native surface set drifted',
  );
  invariant(
    JSON.stringify(validation.value.scope?.overviewSurfaceIds) === JSON.stringify(expectedCollections[2].ids),
    'Derivative validation overview surface set drifted',
  );

  const records = [];
  for (const expected of expectedCollections) {
    records.push(...await validateCollection(outputRoot, expected));
  }
  invariant(
    records.length === expectedRecordCount,
    `Expected ${expectedRecordCount} derivative surface/style records, received ${records.length}`,
  );
  for (const record of records) {
    console.log(
      `${record.tier}/${record.style}/${record.id}: ${record.chunks} chunks, `
      + `${record.decodedMiB.toFixed(2)} decoded MiB (${(record.decodedRatio * 100).toFixed(2)}%), `
      + `${record.transportMiB.toFixed(2)} transport MiB`,
    );
  }
  const transportMiB = records.reduce((sum, record) => sum + record.transportMiB, 0);
  console.log(
    `Discover derivative ${scope} verification passed: ${records.length} surface/style records, `
    + `${transportMiB.toFixed(2)} transport MiB at ${outputRoot}`,
  );
}

main().catch((error) => {
  console.error(`Discover derivative verification failed: ${error.message}`);
  process.exitCode = 1;
});
