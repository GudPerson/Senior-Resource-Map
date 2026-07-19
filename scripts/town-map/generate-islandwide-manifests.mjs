#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const SOURCE_ROOT = path.resolve(process.env.TOWN_MAP_SOURCE_ROOT || "/Users/sweetbuns/Documents/SG MAP");
const OUTPUT_ROOT = path.resolve(
  process.env.TOWN_MAP_ISLANDWIDE_OUTPUT_ROOT ||
    path.join(REPO_ROOT, "output/town-map-proof/assets/v1/islandwide"),
);

const SCHEMA = "carearound.fixed-town-surface";
const INDEX_SCHEMA = "carearound.fixed-town-surface-index";
const SCHEMA_VERSION = 1;
const TILE_SIZE = 256;
const CRS = "EPSG:3857";
const ZOOM = 19;
const ATTRIBUTION = "OneMap © contributors | Singapore Land Authority";
const ATTRIBUTION_HTML =
  '<a href="https://www.onemap.gov.sg/" target="_blank" rel="noopener noreferrer">OneMap</a> © contributors | Singapore Land Authority';
const ATTRIBUTION_LOGO_URL =
  "https://www.onemap.gov.sg/web-assets/images/logo/om_logo.png";
const CHUNK_NAME_PATTERN =
  /^z(?<zoom>\d+)-(?<xStart>\d+)-(?<yStart>\d+)-(?<xEnd>\d+)-(?<yEnd>\d+)\.jpg$/;
const CHUNK_SET_CANONICALIZATION =
  'UTF-8 lines "<sha256>  <filename>\\n", sorted by filename';

const SOURCE_PATHS = {
  plan: path.join(SOURCE_ROOT, "output/static-town-maps/islandwide-town-plate-plan.json"),
  defaultManifests: path.join(SOURCE_ROOT, "output/static-town-maps/production-pilots/manifests"),
  defaultChunks: path.join(SOURCE_ROOT, "output/static-town-maps/production-pilots/chunks"),
  grayManifests: path.join(SOURCE_ROOT, "output/static-town-maps-grey/assets/manifests"),
  grayChunks: path.join(SOURCE_ROOT, "output/static-town-maps-grey/assets/chunks"),
  readabilityValidation: path.join(
    SOURCE_ROOT,
    "output/static-town-maps/readability-175/readability-175-validation.json",
  ),
  readabilityReport: path.join(
    SOURCE_ROOT,
    "output/static-town-maps/readability-175/READABILITY-175-REPORT.md",
  ),
  grayValidation: path.join(
    SOURCE_ROOT,
    "output/static-town-maps-grey/assets/grey-surface-validation.json",
  ),
  grayAlignment: path.join(
    SOURCE_ROOT,
    "output/static-town-maps-grey/assets/qa/source-comparison/source-comparison.json",
  ),
};

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function readJsonWithBuffer(filePath) {
  const buffer = await readFile(filePath);
  return { buffer, value: JSON.parse(buffer.toString("utf8")) };
}

function lonLatToWorldPixel(longitude, latitude, zoom = ZOOM) {
  const sinLatitude = Math.sin((latitude * Math.PI) / 180);
  const worldSize = TILE_SIZE * 2 ** zoom;
  return [
    ((longitude + 180) / 360) * worldSize,
    (0.5 -
      Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI)) *
      worldSize,
  ];
}

function worldPixelToLonLat(x, y, zoom = ZOOM) {
  const worldSize = TILE_SIZE * 2 ** zoom;
  const longitude = (x / worldSize) * 360 - 180;
  const mercatorY = Math.PI - (2 * Math.PI * y) / worldSize;
  const latitude = (Math.atan(Math.sinh(mercatorY)) * 180) / Math.PI;
  return [longitude, latitude];
}

function jpegPixelSize(buffer, fileName) {
  invariant(
    buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8,
    `${fileName} is not a JPEG image`,
  );

  const startOfFrameMarkers = new Set([
    0xc0,
    0xc1,
    0xc2,
    0xc3,
    0xc5,
    0xc6,
    0xc7,
    0xc9,
    0xca,
    0xcb,
    0xcd,
    0xce,
    0xcf,
  ]);
  let offset = 2;

  while (offset < buffer.length) {
    while (offset < buffer.length && buffer[offset] !== 0xff) offset += 1;
    while (offset < buffer.length && buffer[offset] === 0xff) offset += 1;
    invariant(offset < buffer.length, `${fileName} has no JPEG frame header`);

    const marker = buffer[offset];
    offset += 1;

    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;

    invariant(offset + 2 <= buffer.length, `${fileName} has a truncated JPEG segment`);
    const segmentLength = buffer.readUInt16BE(offset);
    invariant(
      segmentLength >= 2 && offset + segmentLength <= buffer.length,
      `${fileName} has an invalid JPEG segment length`,
    );

    if (startOfFrameMarkers.has(marker)) {
      invariant(segmentLength >= 7, `${fileName} has an invalid JPEG frame`);
      const height = buffer.readUInt16BE(offset + 3);
      const width = buffer.readUInt16BE(offset + 5);
      invariant(width > 0 && height > 0, `${fileName} has an empty JPEG frame`);
      return [width, height];
    }

    offset += segmentLength;
  }

  throw new Error(`${fileName} has no supported JPEG frame header`);
}

function boundsEqual(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === 4 &&
    right.length === 4 &&
    left.every((value, index) => value === right[index])
  );
}

function parseChunkName(fileName, mapId) {
  const match = CHUNK_NAME_PATTERN.exec(fileName);
  invariant(match?.groups, `Unexpected ${mapId} chunk filename: ${fileName}`);
  const parsed = Object.fromEntries(
    Object.entries(match.groups).map(([key, value]) => [key, Number(value)]),
  );
  invariant(
    Object.values(parsed).every(Number.isSafeInteger),
    `Unsafe numeric value in ${mapId} chunk filename: ${fileName}`,
  );
  invariant(
    parsed.xStart <= parsed.xEnd && parsed.yStart <= parsed.yEnd,
    `Invalid ${mapId} chunk tile range: ${fileName}`,
  );
  return parsed;
}

function surfaceWorldFromBounds(bounds, zoom = ZOOM) {
  const [west, south, east, north] = bounds;
  const [nominalLeft, nominalTop] = lonLatToWorldPixel(west, north, zoom);
  const [nominalRight, nominalBottom] = lonLatToWorldPixel(east, south, zoom);
  const surfaceWorldPixelBounds = [
    Math.floor(nominalLeft),
    Math.floor(nominalTop),
    Math.ceil(nominalRight),
    Math.ceil(nominalBottom),
  ];
  const [surfaceWest, surfaceNorth] = worldPixelToLonLat(
    surfaceWorldPixelBounds[0],
    surfaceWorldPixelBounds[1],
    zoom,
  );
  const [surfaceEast, surfaceSouth] = worldPixelToLonLat(
    surfaceWorldPixelBounds[2],
    surfaceWorldPixelBounds[3],
    zoom,
  );

  return {
    nominalWorldPixelBounds: [nominalLeft, nominalTop, nominalRight, nominalBottom],
    surfaceWorldPixelBounds,
    surfaceBounds: [surfaceWest, surfaceSouth, surfaceEast, surfaceNorth],
  };
}

function buildChunksFromParsedFiles({
  mapId,
  chunkFiles,
  chunkRoot,
  surfaceWorldPixelBounds,
  retainedScale,
  zoom,
  readPixelSizeFromManifest = null,
}) {
  const parsedFiles = chunkFiles.map((fileName) => ({
    fileName,
    ...parseChunkName(fileName, mapId),
  }));
  invariant(
    parsedFiles.every((file) => file.zoom === zoom),
    `${mapId} chunk filenames do not all use z${zoom}`,
  );

  const xStarts = [...new Set(parsedFiles.map(({ xStart }) => xStart))].sort(
    (left, right) => left - right,
  );
  const yStarts = [...new Set(parsedFiles.map(({ yStart }) => yStart))].sort(
    (left, right) => left - right,
  );
  invariant(
    xStarts.length * yStarts.length === chunkFiles.length,
    `${mapId} chunk filenames do not form a complete rectangular grid`,
  );
  const columns = new Map(xStarts.map((value, index) => [value, index]));
  const rows = new Map(yStarts.map((value, index) => [value, index]));
  const occupiedCells = new Set();

  return {
    xStarts,
    yStarts,
    chunksPromise: Promise.all(
      parsedFiles.map(async (parsed) => {
        const column = columns.get(parsed.xStart);
        const row = rows.get(parsed.yStart);
        const cellKey = `${row}:${column}`;
        invariant(!occupiedCells.has(cellKey), `Duplicate ${mapId} chunk cell ${cellKey}`);
        occupiedCells.add(cellKey);

        const [surfaceLeft, surfaceTop, surfaceRight, surfaceBottom] = surfaceWorldPixelBounds;
        const worldPixelBounds = [
          Math.max(surfaceLeft, parsed.xStart * TILE_SIZE),
          Math.max(surfaceTop, parsed.yStart * TILE_SIZE),
          Math.min(surfaceRight, (parsed.xEnd + 1) * TILE_SIZE),
          Math.min(surfaceBottom, (parsed.yEnd + 1) * TILE_SIZE),
        ];
        const [left, top, right, bottom] = worldPixelBounds;
        invariant(left < right && top < bottom, `${mapId} chunk falls outside the surface: ${parsed.fileName}`);

        const buffer = await readFile(path.join(chunkRoot, parsed.fileName));
        const pixelSize = readPixelSizeFromManifest?.(parsed.fileName) || jpegPixelSize(buffer, parsed.fileName);
        const expectedPixelSize = [
          Math.round((right - left) * retainedScale),
          Math.round((bottom - top) * retainedScale),
        ];
        invariant(
          Math.abs(pixelSize[0] - expectedPixelSize[0]) <= 1 &&
            Math.abs(pixelSize[1] - expectedPixelSize[1]) <= 1,
          `${parsed.fileName} is ${pixelSize.join("x")}; expected ${expectedPixelSize.join("x")}`,
        );

        const [chunkWest, chunkNorth] = worldPixelToLonLat(left, top, zoom);
        const [chunkEast, chunkSouth] = worldPixelToLonLat(right, bottom, zoom);
        return {
          id: parsed.fileName.slice(0, -4),
          url: `chunks/${parsed.fileName}`,
          row,
          column,
          bounds: [chunkWest, chunkSouth, chunkEast, chunkNorth],
          worldPixelBounds,
          pixelSize,
          byteSize: buffer.length,
          sha256: sha256(buffer),
        };
      }),
    ),
  };
}

function summarizeChunkGrid(chunks, xStarts, yStarts) {
  const columnWidths = xStarts.map((_, column) => {
    const widths = new Set(
      chunks
        .filter((chunk) => chunk.column === column)
        .map((chunk) => chunk.pixelSize[0]),
    );
    invariant(widths.size === 1, `Column ${column} has mixed pixel widths`);
    return [...widths][0];
  });
  const rowHeights = yStarts.map((_, row) => {
    const heights = new Set(
      chunks
        .filter((chunk) => chunk.row === row)
        .map((chunk) => chunk.pixelSize[1]),
    );
    invariant(heights.size === 1, `Row ${row} has mixed pixel heights`);
    return [...heights][0];
  });

  return [
    columnWidths.reduce((sum, value) => sum + value, 0),
    rowHeights.reduce((sum, value) => sum + value, 0),
  ];
}

function buildChunkSetHash(chunks) {
  return sha256(
    Buffer.from(
      [...chunks]
        .sort((left, right) => left.url.localeCompare(right.url, "en"))
        .map((chunk) => `${chunk.sha256}  ${path.posix.basename(chunk.url)}\n`)
        .join(""),
      "utf8",
    ),
  );
}

async function writeJson(filePath, value) {
  const buffer = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, buffer);
  return { byteSize: buffer.length, sha256: sha256(buffer) };
}

function buildSurfaceIndexEntry(manifest, manifestMeta, manifestPath, assetBasePath) {
  return {
    id: manifest.map.id,
    name: manifest.map.name,
    style: manifest.map.style || "default",
    version: manifest.map.version,
    planningAreas: manifest.planningAreas,
    profile: manifest.source.profile,
    retainedScale: manifest.source.retainedScale,
    retainedPixelDimensions: manifest.retainedPixelDimensions.chunkGrid,
    bounds: manifest.bounds,
    manifestPath,
    assetBasePath,
    manifestSha256: manifestMeta.sha256,
    manifestBytes: manifestMeta.byteSize,
    chunkCount: manifest.transport.chunkCount,
    totalBytes: manifest.transport.totalBytes,
    chunkSetSha256: manifest.integrity.chunkSetSha256,
  };
}

async function buildDefaultSurface({
  plate,
  planHash,
  readability,
  readabilityHash,
  readabilityReportHash,
}) {
  const mapId = plate.id;
  const manifestSource = await readJsonWithBuffer(
    path.join(SOURCE_PATHS.defaultManifests, `${mapId.toLowerCase()}-static-town-map.json`),
  );
  const sourceManifest = manifestSource.value;
  const readabilityPlate = readability.value.plates?.find((item) => item.id === mapId);

  invariant(readabilityPlate, `${mapId} is missing from readability validation`);
  invariant(sourceManifest.id === mapId, `Expected ${mapId}, received ${sourceManifest.id}`);
  invariant(boundsEqual(sourceManifest.bounds, plate.bounds), `${mapId} source-manifest and plate-plan bounds disagree`);
  invariant(sourceManifest.zoom === ZOOM, `${mapId} is not a z${ZOOM} source`);
  invariant([0.4, 0.5].includes(sourceManifest.scale), `${mapId} has an unsupported retained scale`);
  invariant(sourceManifest.jpeg_quality === 95, `${mapId} does not use q95 JPEG chunks`);
  invariant(sourceManifest.onemap_native_labels === true, `${mapId} must preserve OneMap native labels`);
  invariant(sourceManifest.hdb_overlay === false, `${mapId} must not include the HDB overlay`);
  invariant(
    readability.value.status === "pass" &&
      readability.value.scale_factor === 1.75 &&
      readabilityPlate.status === "pass" &&
      readabilityPlate.content_preserved === true,
    `${mapId} readability-175 validation is not a preserved passing result`,
  );

  const geometry = surfaceWorldFromBounds(sourceManifest.bounds, sourceManifest.zoom);
  const chunkRoot = path.join(
    SOURCE_PATHS.defaultChunks,
    `${mapId}-s${Math.round(sourceManifest.scale * 100)}-q${sourceManifest.jpeg_quality}`,
  );
  const chunkFiles = (await readdir(chunkRoot))
    .filter((fileName) => fileName.endsWith(".jpg"))
    .sort();
  const chunkBuild = buildChunksFromParsedFiles({
    mapId,
    chunkFiles,
    chunkRoot,
    surfaceWorldPixelBounds: geometry.surfaceWorldPixelBounds,
    retainedScale: sourceManifest.scale,
    zoom: sourceManifest.zoom,
  });
  const chunks = (await chunkBuild.chunksPromise).sort(
    (left, right) => left.row - right.row || left.column - right.column,
  );
  const chunkSetHash = buildChunkSetHash(chunks);
  const chunkBytes = chunks.reduce((sum, chunk) => sum + chunk.byteSize, 0);
  const chunkGridPixelDimensions = summarizeChunkGrid(chunks, chunkBuild.xStarts, chunkBuild.yStarts);
  const version = [
    mapId.toLowerCase(),
    `s${Math.round(sourceManifest.scale * 100)}`,
    `q${sourceManifest.jpeg_quality}`,
    `g${sourceManifest.generator_version}`,
    chunkSetHash.slice(0, 16),
  ].join("-");

  return {
    schema: SCHEMA,
    schemaVersion: SCHEMA_VERSION,
    map: {
      id: mapId,
      version,
      name: sourceManifest.name,
      style: "default",
    },
    planningAreas: sourceManifest.planning_areas,
    bounds: {
      nominal: sourceManifest.bounds,
      surface: geometry.surfaceBounds,
    },
    retainedPixelDimensions: {
      nominal: [sourceManifest.retained_width_px, sourceManifest.retained_height_px],
      chunkGrid: chunkGridPixelDimensions,
    },
    source: {
      provider: "OneMap",
      crs: CRS,
      zoom: sourceManifest.zoom,
      tileSize: TILE_SIZE,
      retainedScale: sourceManifest.scale,
      jpegQuality: sourceManifest.jpeg_quality,
      jpegChromaSubsampling: "4:4:4",
      generatorVersion: sourceManifest.generator_version,
      profile: sourceManifest.profile,
      profileLabel: sourceManifest.profile_label,
      onemapNativeLabels: sourceManifest.onemap_native_labels,
      hdbOverlay: sourceManifest.hdb_overlay,
      nativePixelDimensions: [sourceManifest.native_width_px, sourceManifest.native_height_px],
      worldPixelBounds: {
        nominal: geometry.nominalWorldPixelBounds,
        surface: geometry.surfaceWorldPixelBounds,
      },
      tileGrid: {
        columns: sourceManifest.tile_columns,
        rows: sourceManifest.tile_rows,
        sourceTiles: sourceManifest.tiles_used || sourceManifest.tile_columns * sourceManifest.tile_rows,
        chunkColumns: chunkBuild.xStarts.length,
        chunkRows: chunkBuild.yStarts.length,
        chunkCount: chunks.length,
      },
      readability: {
        edition: readabilityPlate.edition,
        scaleFactor: readabilityPlate.scale_factor,
        rasterResampled: false,
        embeddedImageStreamsPreserved: readability.value.embedded_image_streams_preserved,
        textPreserved: readability.value.text_preserved,
        contentPreserved: readabilityPlate.content_preserved,
      },
      readabilityPercent: Math.round(readabilityPlate.scale_factor * 100),
    },
    attribution: {
      text: ATTRIBUTION,
      html: ATTRIBUTION_HTML,
      logoUrl: ATTRIBUTION_LOGO_URL,
      required: true,
    },
    presentation: { backgroundColor: "#f4f2ed" },
    transport: {
      chunkCount: chunks.length,
      totalBytes: chunkBytes,
    },
    integrity: {
      algorithm: "sha256",
      chunkCount: chunks.length,
      chunkBytes,
      chunkSetSha256: chunkSetHash,
      chunkSetCanonicalization: CHUNK_SET_CANONICALIZATION,
      sourceManifestSha256: sha256(manifestSource.buffer),
      islandwidePlanSha256: planHash,
      readabilityValidationSha256: readabilityHash,
      readabilityReportSha256: readabilityReportHash,
      validatedSourcePdfSha256: readabilityPlate.source_pdf_sha256,
      validatedReadabilityPdfSha256: readabilityPlate.pdf_sha256,
      embeddedImageStreamSignature: readabilityPlate.target_image_stream_signature,
      extractedTextSignature: readabilityPlate.target_text_signature,
    },
    chunks,
  };
}

async function buildGraySurface({ plate, planHash, grayValidation, grayValidationHash, grayAlignmentHash }) {
  const mapId = plate.id;
  const manifestSource = await readJsonWithBuffer(
    path.join(SOURCE_PATHS.grayManifests, `${mapId.toLowerCase()}-grey-surface.json`),
  );
  const sourceManifest = manifestSource.value;
  const validationRecord = grayValidation.value.surfaces?.find((surface) => surface.id === mapId);
  invariant(sourceManifest.id === mapId, `Expected ${mapId}, received ${sourceManifest.id}`);
  invariant(sourceManifest.schema === "carearound.fixed-map-surface/v1", `${mapId} has an unexpected gray schema`);
  invariant(sourceManifest.edition === "onemap-grey-fixed-surface-v1", `${mapId} has an unexpected gray edition`);
  invariant(sourceManifest.source?.style === "Grey", `${mapId} is not a OneMap Grey source`);
  invariant(sourceManifest.surface?.runtime_zoom_pyramid === false, `${mapId} gray source must be one fixed surface`);
  invariant(boundsEqual(sourceManifest.bounds, plate.bounds), `${mapId} gray source-manifest and plate-plan bounds disagree`);
  invariant(grayValidation.value.status === "pass" && validationRecord?.status === "pass", `${mapId} gray validation is not passing`);
  invariant(sourceManifest.presentation_presets?.readability_175?.scale === 1.75, `${mapId} gray readability profile is not 175%`);

  const retainedScale = sourceManifest.source.retained_scale;
  const jpegQuality = 95;
  const geometry = surfaceWorldFromBounds(sourceManifest.bounds, ZOOM);
  const chunkRoot = path.join(
    SOURCE_PATHS.grayChunks,
    `${mapId}-s${Math.round(retainedScale * 100)}-q${jpegQuality}`,
  );
  const chunkByFileName = new Map(
    sourceManifest.chunks.map((chunk) => [path.posix.basename(chunk.url), chunk]),
  );
  const chunkFiles = (await readdir(chunkRoot))
    .filter((fileName) => fileName.endsWith(".jpg"))
    .sort();
  invariant(chunkFiles.length === sourceManifest.chunk_count, `${mapId} gray chunk count drifted`);
  invariant(
    JSON.stringify([...chunkByFileName.keys()].sort()) === JSON.stringify(chunkFiles),
    `${mapId} gray chunk directory differs from the manifest allowlist`,
  );
  const chunkBuild = buildChunksFromParsedFiles({
    mapId,
    chunkFiles,
    chunkRoot,
    surfaceWorldPixelBounds: geometry.surfaceWorldPixelBounds,
    retainedScale,
    zoom: ZOOM,
    readPixelSizeFromManifest: (fileName) => {
      const sourceChunk = chunkByFileName.get(fileName);
      return sourceChunk ? [sourceChunk.width, sourceChunk.height] : null;
    },
  });
  const chunks = (await chunkBuild.chunksPromise).sort(
    (left, right) => left.row - right.row || left.column - right.column,
  );
  for (const chunk of chunks) {
    const sourceChunk = chunkByFileName.get(path.posix.basename(chunk.url));
    invariant(sourceChunk, `${mapId} gray source chunk is missing: ${chunk.url}`);
    invariant(sourceChunk.bytes === chunk.byteSize, `${mapId} gray byte size drifted: ${chunk.url}`);
    invariant(sourceChunk.sha256 === chunk.sha256, `${mapId} gray chunk hash drifted: ${chunk.url}`);
  }

  const chunkSetHash = buildChunkSetHash(chunks);
  const chunkBytes = chunks.reduce((sum, chunk) => sum + chunk.byteSize, 0);
  invariant(chunkBytes === sourceManifest.total_chunk_bytes, `${mapId} gray byte total drifted`);
  const chunkGridPixelDimensions = summarizeChunkGrid(chunks, chunkBuild.xStarts, chunkBuild.yStarts);
  const styleVersionToken = mapId === "W01" ? "grey" : "gray";
  const version = [
    mapId.toLowerCase(),
    styleVersionToken,
    `s${Math.round(retainedScale * 100)}`,
    `q${jpegQuality}`,
    `g${sourceManifest.generator_version}`,
    chunkSetHash.slice(0, 16),
  ].join("-");

  return {
    schema: SCHEMA,
    schemaVersion: SCHEMA_VERSION,
    map: {
      id: mapId,
      version,
      name: sourceManifest.name,
      style: "gray",
    },
    planningAreas: sourceManifest.planning_areas,
    bounds: {
      nominal: sourceManifest.bounds,
      surface: geometry.surfaceBounds,
    },
    retainedPixelDimensions: {
      nominal: [sourceManifest.surface.width, sourceManifest.surface.height],
      chunkGrid: chunkGridPixelDimensions,
    },
    source: {
      provider: "OneMap",
      style: "Grey",
      crs: CRS,
      zoom: ZOOM,
      tileSize: TILE_SIZE,
      retainedScale,
      jpegQuality,
      jpegChromaSubsampling: "4:4:4",
      generatorVersion: sourceManifest.generator_version,
      profile: sourceManifest.profile,
      profileLabel: `${Math.round(retainedScale * 100)}% z19 ${sourceManifest.profile === "sparse-40" ? "sparse" : "residential"}`,
      onemapNativeLabels: true,
      hdbOverlay: false,
      nativePixelDimensions: [
        Math.round(geometry.nominalWorldPixelBounds[2] - geometry.nominalWorldPixelBounds[0]),
        Math.round(geometry.nominalWorldPixelBounds[3] - geometry.nominalWorldPixelBounds[1]),
      ],
      worldPixelBounds: {
        nominal: geometry.nominalWorldPixelBounds,
        surface: geometry.surfaceWorldPixelBounds,
      },
      tileGrid: {
        columns: Math.ceil(geometry.surfaceWorldPixelBounds[2] / TILE_SIZE) - Math.floor(geometry.surfaceWorldPixelBounds[0] / TILE_SIZE),
        rows: Math.ceil(geometry.surfaceWorldPixelBounds[3] / TILE_SIZE) - Math.floor(geometry.surfaceWorldPixelBounds[1] / TILE_SIZE),
        sourceTiles: (
          Math.ceil(geometry.surfaceWorldPixelBounds[2] / TILE_SIZE) - Math.floor(geometry.surfaceWorldPixelBounds[0] / TILE_SIZE)
        ) * (
          Math.ceil(geometry.surfaceWorldPixelBounds[3] / TILE_SIZE) - Math.floor(geometry.surfaceWorldPixelBounds[1] / TILE_SIZE)
        ),
        chunkColumns: chunkBuild.xStarts.length,
        chunkRows: chunkBuild.yStarts.length,
        chunkCount: chunks.length,
      },
      readability: {
        edition: "readability-175",
        scaleFactor: 1.75,
        rasterResampled: false,
        embeddedImageStreamsPreserved: true,
        textPreserved: true,
        contentPreserved: true,
      },
      readabilityPercent: 175,
    },
    attribution: {
      text: ATTRIBUTION,
      html: ATTRIBUTION_HTML,
      logoUrl: sourceManifest.attribution.logo_url || ATTRIBUTION_LOGO_URL,
      required: true,
    },
    presentation: { backgroundColor: "#f8f8f7" },
    transport: {
      chunkCount: chunks.length,
      totalBytes: chunkBytes,
    },
    integrity: {
      algorithm: "sha256",
      chunkCount: chunks.length,
      chunkBytes,
      chunkSetSha256: chunkSetHash,
      chunkSetCanonicalization: CHUNK_SET_CANONICALIZATION,
      sourceManifestSha256: sha256(manifestSource.buffer),
      islandwidePlanSha256: planHash,
      collectionValidationSha256: grayValidationHash,
      sourceAlignmentSha256: grayAlignmentHash,
    },
    chunks,
  };
}

function collectionBounds(surfaces) {
  return surfaces.reduce(
    (bounds, surface) => [
      Math.min(bounds[0], surface.bounds.surface[0]),
      Math.min(bounds[1], surface.bounds.surface[1]),
      Math.max(bounds[2], surface.bounds.surface[2]),
      Math.max(bounds[3], surface.bounds.surface[3]),
    ],
    [Infinity, Infinity, -Infinity, -Infinity],
  );
}

function buildIndex({ style, surfaces, planHash, extraIntegrity = {} }) {
  const surfaceRows = surfaces.map(({ manifest, manifestMeta }) => ({
    id: manifest.map.id,
    version: manifest.map.version,
    manifestSha256: manifestMeta.sha256,
    chunkSetSha256: manifest.integrity.chunkSetSha256,
  }));
  const surfaceSetSha256 = sha256(
    Buffer.from(
      surfaceRows
        .sort((left, right) => left.id.localeCompare(right.id, "en"))
        .map((row) => `${row.id}  ${row.version}  ${row.manifestSha256}  ${row.chunkSetSha256}\n`)
        .join(""),
      "utf8",
    ),
  );
  const totalBytes = surfaces.reduce((sum, surface) => sum + surface.manifest.transport.totalBytes, 0);
  const chunkCount = surfaces.reduce((sum, surface) => sum + surface.manifest.transport.chunkCount, 0);

  return {
    schema: INDEX_SCHEMA,
    schemaVersion: SCHEMA_VERSION,
    collection: {
      id: "sg-islandwide-fixed-town-surfaces",
      name: "Singapore Islandwide Detailed Map",
      style,
      version: `sg-islandwide-${style}-${surfaceSetSha256.slice(0, 16)}`,
    },
    bounds: {
      surface: collectionBounds(surfaces.map((surface) => surface.manifest)),
    },
    source: {
      provider: "OneMap",
      crs: CRS,
      zoom: ZOOM,
      tileSize: TILE_SIZE,
      readabilityPercent: 175,
      runtimeZoomPyramid: false,
      assetTransport: "fixed image chunks by town surface",
    },
    attribution: {
      text: ATTRIBUTION,
      html: ATTRIBUTION_HTML,
      logoUrl: ATTRIBUTION_LOGO_URL,
      required: true,
    },
    transport: {
      surfaceCount: surfaces.length,
      chunkCount,
      totalBytes,
    },
    integrity: {
      algorithm: "sha256",
      islandwidePlanSha256: planHash,
      surfaceSetSha256,
      ...extraIntegrity,
    },
    surfaces: surfaces.map(({ manifest, manifestMeta }) => {
      const id = manifest.map.id;
      const basePath = `surfaces/${id}`;
      return buildSurfaceIndexEntry(
        manifest,
        manifestMeta,
        `${basePath}/manifest.json`,
        basePath,
      );
    }),
  };
}

async function writeSurfaceCollection({ style, outputRoot, manifests, planHash, extraIntegrity }) {
  const surfaces = [];
  for (const manifest of manifests) {
    const id = manifest.map.id;
    const manifestPath = path.join(outputRoot, "surfaces", id, "manifest.json");
    const manifestMeta = await writeJson(manifestPath, manifest);
    surfaces.push({ manifest, manifestMeta });
  }
  const index = buildIndex({ style, surfaces, planHash, extraIntegrity });
  const indexMeta = await writeJson(path.join(outputRoot, "manifest.json"), index);
  return { index, indexMeta, surfaces };
}

async function main() {
  const [plan, readability, readabilityReport, grayValidation, grayAlignment] = await Promise.all([
    readJsonWithBuffer(SOURCE_PATHS.plan),
    readJsonWithBuffer(SOURCE_PATHS.readabilityValidation),
    readFile(SOURCE_PATHS.readabilityReport),
    readJsonWithBuffer(SOURCE_PATHS.grayValidation),
    readJsonWithBuffer(SOURCE_PATHS.grayAlignment),
  ]);
  invariant(plan.value.plate_count === 32 && Array.isArray(plan.value.plates), "Expected the accepted 32-plate islandwide plan");
  invariant(readability.value.status === "pass" && readability.value.validated_plate_count === 32, "Expected passing readability-175 validation for 32 plates");
  invariant(grayValidation.value.status === "pass", "Expected passing gray collection validation");
  invariant(grayAlignment.value.status === "pass", "Expected passing gray source-alignment QA");

  const planHash = sha256(plan.buffer);
  const readabilityHash = sha256(readability.buffer);
  const readabilityReportHash = sha256(readabilityReport);
  const grayValidationHash = sha256(grayValidation.buffer);
  const grayAlignmentHash = sha256(grayAlignment.buffer);

  const defaultManifests = [];
  const grayManifests = [];
  for (const plate of plan.value.plates) {
    defaultManifests.push(await buildDefaultSurface({
      plate,
      planHash,
      readability,
      readabilityHash,
      readabilityReportHash,
    }));
    grayManifests.push(await buildGraySurface({
      plate,
      planHash,
      grayValidation,
      grayValidationHash,
      grayAlignmentHash,
    }));
  }

  const defaultResult = await writeSurfaceCollection({
    style: "default",
    outputRoot: OUTPUT_ROOT,
    manifests: defaultManifests,
    planHash,
    extraIntegrity: {
      readabilityValidationSha256: readabilityHash,
      readabilityReportSha256: readabilityReportHash,
    },
  });
  const grayResult = await writeSurfaceCollection({
    style: "gray",
    outputRoot: path.join(OUTPUT_ROOT, "gray"),
    manifests: grayManifests,
    planHash,
    extraIntegrity: {
      collectionValidationSha256: grayValidationHash,
      sourceAlignmentSha256: grayAlignmentHash,
    },
  });

  console.log(JSON.stringify({
    outputRoot: OUTPUT_ROOT,
    default: {
      version: defaultResult.index.collection.version,
      surfaces: defaultResult.index.transport.surfaceCount,
      chunks: defaultResult.index.transport.chunkCount,
      chunkBytes: defaultResult.index.transport.totalBytes,
      indexSha256: defaultResult.indexMeta.sha256,
    },
    gray: {
      version: grayResult.index.collection.version,
      surfaces: grayResult.index.transport.surfaceCount,
      chunks: grayResult.index.transport.chunkCount,
      chunkBytes: grayResult.index.transport.totalBytes,
      indexSha256: grayResult.indexMeta.sha256,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(`Islandwide manifest generation failed: ${error.message}`);
  process.exitCode = 1;
});
