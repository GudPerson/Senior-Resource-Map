#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const DEFAULT_SOURCE_ROOT = "/Users/sweetbuns/Documents/SG MAP";
const DEFAULT_OUTPUT_PATH = path.join(
  REPO_ROOT,
  "output/town-map-proof/assets/v1/w01/manifest.json",
);

const SOURCE_ROOT = path.resolve(
  process.env.TOWN_MAP_SOURCE_ROOT || DEFAULT_SOURCE_ROOT,
);
const OUTPUT_PATH = path.resolve(
  process.env.TOWN_MAP_MANIFEST_OUTPUT || DEFAULT_OUTPUT_PATH,
);

const SOURCE_PATHS = {
  plan: path.join(
    SOURCE_ROOT,
    "output/static-town-maps/islandwide-town-plate-plan.json",
  ),
  manifest: path.join(
    SOURCE_ROOT,
    "output/static-town-maps/production-pilots/manifests/w01-static-town-map.json",
  ),
  readabilityValidation: path.join(
    SOURCE_ROOT,
    "output/static-town-maps/readability-175/readability-175-validation.json",
  ),
  readabilityReport: path.join(
    SOURCE_ROOT,
    "output/static-town-maps/readability-175/READABILITY-175-REPORT.md",
  ),
  chunks: path.join(
    SOURCE_ROOT,
    "output/static-town-maps/production-pilots/chunks/W01-s50-q95",
  ),
};

const ACCEPTED_SOURCE = {
  mapId: "W01",
  sourceManifestSha256:
    "10228b774ed45b540394ae5541039c9d90d136616fb8c2cbb6830a5083410334",
  readabilityValidationSha256:
    "db02729149cb5e3e08bd434360011f3760414102ea1c142baea1e3f92f065809",
  chunkSetSha256:
    "81bd26441edaff1d761f9e395575f8e00b9303f25e1d7896307f7f3036bbc8c6",
  sourceZoom: 19,
  retainedScale: 0.5,
  jpegQuality: 95,
  generatorVersion: 3,
  readabilityScale: 1.75,
  chunkCount: 300,
};

const SCHEMA = "carearound.fixed-town-surface";
const SCHEMA_VERSION = 1;
const TILE_SIZE = 256;
const CRS = "EPSG:3857";
const ATTRIBUTION = "OneMap © contributors | Singapore Land Authority";
const ATTRIBUTION_LOGO_URL =
  "https://www.onemap.gov.sg/web-assets/images/logo/om_logo.png";
const CHUNK_NAME_PATTERN =
  /^z(?<zoom>\d+)-(?<xStart>\d+)-(?<yStart>\d+)-(?<xEnd>\d+)-(?<yEnd>\d+)\.jpg$/;

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function readJsonWithBuffer(filePath) {
  const buffer = await readFile(filePath);
  return {
    buffer,
    value: JSON.parse(buffer.toString("utf8")),
  };
}

function lonLatToWorldPixel(longitude, latitude, zoom) {
  const sinLatitude = Math.sin((latitude * Math.PI) / 180);
  const worldSize = TILE_SIZE * 2 ** zoom;
  return [
    ((longitude + 180) / 360) * worldSize,
    (0.5 -
      Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI)) *
      worldSize,
  ];
}

function worldPixelToLonLat(x, y, zoom) {
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
    while (offset < buffer.length && buffer[offset] !== 0xff) {
      offset += 1;
    }
    while (offset < buffer.length && buffer[offset] === 0xff) {
      offset += 1;
    }
    invariant(offset < buffer.length, `${fileName} has no JPEG frame header`);

    const marker = buffer[offset];
    offset += 1;

    if (marker === 0xd9 || marker === 0xda) {
      break;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }

    invariant(
      offset + 2 <= buffer.length,
      `${fileName} has a truncated JPEG segment`,
    );
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

function parseChunkName(fileName) {
  const match = CHUNK_NAME_PATTERN.exec(fileName);
  invariant(match?.groups, `Unexpected W01 chunk filename: ${fileName}`);
  const parsed = Object.fromEntries(
    Object.entries(match.groups).map(([key, value]) => [key, Number(value)]),
  );
  invariant(
    Object.values(parsed).every(Number.isSafeInteger),
    `Unsafe numeric value in W01 chunk filename: ${fileName}`,
  );
  invariant(
    parsed.xStart <= parsed.xEnd && parsed.yStart <= parsed.yEnd,
    `Invalid W01 chunk tile range: ${fileName}`,
  );
  return parsed;
}

async function main() {
  const [planSource, manifestSource, readabilitySource, readabilityReport] =
    await Promise.all([
      readJsonWithBuffer(SOURCE_PATHS.plan),
      readJsonWithBuffer(SOURCE_PATHS.manifest),
      readJsonWithBuffer(SOURCE_PATHS.readabilityValidation),
      readFile(SOURCE_PATHS.readabilityReport),
    ]);

  const sourceManifestHash = sha256(manifestSource.buffer);
  const readabilityValidationHash = sha256(readabilitySource.buffer);
  invariant(
    sourceManifestHash === ACCEPTED_SOURCE.sourceManifestSha256,
    `W01 source manifest drifted: expected ${ACCEPTED_SOURCE.sourceManifestSha256}, received ${sourceManifestHash}`,
  );
  invariant(
    readabilityValidationHash === ACCEPTED_SOURCE.readabilityValidationSha256,
    `W01 readability validation drifted: expected ${ACCEPTED_SOURCE.readabilityValidationSha256}, received ${readabilityValidationHash}`,
  );

  const sourceManifest = manifestSource.value;
  const planPlate = planSource.value.plates?.find(
    (plate) => plate.id === ACCEPTED_SOURCE.mapId,
  );
  const readabilityPlate = readabilitySource.value.plates?.find(
    (plate) => plate.id === ACCEPTED_SOURCE.mapId,
  );

  invariant(planPlate, "W01 is missing from the islandwide plate plan");
  invariant(readabilityPlate, "W01 is missing from readability validation");
  invariant(
    sourceManifest.id === ACCEPTED_SOURCE.mapId,
    `Expected W01 source manifest, received ${sourceManifest.id}`,
  );
  invariant(
    sourceManifest.zoom === ACCEPTED_SOURCE.sourceZoom &&
      sourceManifest.scale === ACCEPTED_SOURCE.retainedScale &&
      sourceManifest.jpeg_quality === ACCEPTED_SOURCE.jpegQuality &&
      sourceManifest.generator_version === ACCEPTED_SOURCE.generatorVersion,
    "W01 source profile no longer matches the accepted z19/s50/q95/g3 identity",
  );
  invariant(
    readabilitySource.value.status === "pass" &&
      readabilitySource.value.scale_factor === ACCEPTED_SOURCE.readabilityScale &&
      readabilityPlate.status === "pass" &&
      readabilityPlate.content_preserved === true,
    "W01 readability-175 validation is not a preserved passing result",
  );
  invariant(
    boundsEqual(sourceManifest.bounds, planPlate.bounds),
    "W01 source-manifest and plate-plan bounds disagree",
  );

  const [west, south, east, north] = sourceManifest.bounds;
  const [nominalLeft, nominalTop] = lonLatToWorldPixel(
    west,
    north,
    sourceManifest.zoom,
  );
  const [nominalRight, nominalBottom] = lonLatToWorldPixel(
    east,
    south,
    sourceManifest.zoom,
  );
  const surfaceWorldPixelBounds = [
    Math.floor(nominalLeft),
    Math.floor(nominalTop),
    Math.ceil(nominalRight),
    Math.ceil(nominalBottom),
  ];
  const [surfaceLeft, surfaceTop, surfaceRight, surfaceBottom] =
    surfaceWorldPixelBounds;
  const [surfaceWest, surfaceNorth] = worldPixelToLonLat(
    surfaceLeft,
    surfaceTop,
    sourceManifest.zoom,
  );
  const [surfaceEast, surfaceSouth] = worldPixelToLonLat(
    surfaceRight,
    surfaceBottom,
    sourceManifest.zoom,
  );

  const directoryEntries = await readdir(SOURCE_PATHS.chunks, {
    withFileTypes: true,
  });
  const chunkFiles = directoryEntries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".jpg"))
    .map((entry) => entry.name)
    .sort();
  invariant(
    chunkFiles.length === ACCEPTED_SOURCE.chunkCount,
    `Expected ${ACCEPTED_SOURCE.chunkCount} W01 chunks, received ${chunkFiles.length}`,
  );

  const parsedFiles = chunkFiles.map((fileName) => ({
    fileName,
    ...parseChunkName(fileName),
  }));
  invariant(
    parsedFiles.every(({ zoom }) => zoom === sourceManifest.zoom),
    "W01 chunk filenames do not all use the accepted source zoom",
  );

  const xStarts = [...new Set(parsedFiles.map(({ xStart }) => xStart))].sort(
    (left, right) => left - right,
  );
  const yStarts = [...new Set(parsedFiles.map(({ yStart }) => yStart))].sort(
    (left, right) => left - right,
  );
  invariant(
    xStarts.length * yStarts.length === chunkFiles.length,
    "W01 chunk filenames do not form a complete rectangular grid",
  );
  const columns = new Map(xStarts.map((value, index) => [value, index]));
  const rows = new Map(yStarts.map((value, index) => [value, index]));
  const occupiedCells = new Set();

  const chunks = [];
  for (const parsed of parsedFiles) {
    const column = columns.get(parsed.xStart);
    const row = rows.get(parsed.yStart);
    const cellKey = `${row}:${column}`;
    invariant(!occupiedCells.has(cellKey), `Duplicate W01 chunk cell ${cellKey}`);
    occupiedCells.add(cellKey);

    const worldPixelBounds = [
      Math.max(surfaceLeft, parsed.xStart * TILE_SIZE),
      Math.max(surfaceTop, parsed.yStart * TILE_SIZE),
      Math.min(surfaceRight, (parsed.xEnd + 1) * TILE_SIZE),
      Math.min(surfaceBottom, (parsed.yEnd + 1) * TILE_SIZE),
    ];
    const [left, top, right, bottom] = worldPixelBounds;
    invariant(
      left < right && top < bottom,
      `W01 chunk falls outside the accepted surface: ${parsed.fileName}`,
    );

    const buffer = await readFile(path.join(SOURCE_PATHS.chunks, parsed.fileName));
    const pixelSize = jpegPixelSize(buffer, parsed.fileName);
    const expectedPixelSize = [
      Math.round((right - left) * sourceManifest.scale),
      Math.round((bottom - top) * sourceManifest.scale),
    ];
    invariant(
      pixelSize[0] === expectedPixelSize[0] &&
        pixelSize[1] === expectedPixelSize[1],
      `${parsed.fileName} is ${pixelSize.join("x")}; expected ${expectedPixelSize.join("x")}`,
    );

    const [chunkWest, chunkNorth] = worldPixelToLonLat(
      left,
      top,
      sourceManifest.zoom,
    );
    const [chunkEast, chunkSouth] = worldPixelToLonLat(
      right,
      bottom,
      sourceManifest.zoom,
    );

    chunks.push({
      id: parsed.fileName.slice(0, -4),
      url: `chunks/${parsed.fileName}`,
      row,
      column,
      bounds: [chunkWest, chunkSouth, chunkEast, chunkNorth],
      worldPixelBounds,
      pixelSize,
      byteSize: buffer.length,
      sha256: sha256(buffer),
    });
  }

  chunks.sort(
    (left, right) => left.row - right.row || left.column - right.column,
  );

  const columnWidths = xStarts.map((_, column) => {
    const widths = new Set(
      chunks
        .filter((chunk) => chunk.column === column)
        .map((chunk) => chunk.pixelSize[0]),
    );
    invariant(widths.size === 1, `W01 column ${column} has mixed pixel widths`);
    return [...widths][0];
  });
  const rowHeights = yStarts.map((_, row) => {
    const heights = new Set(
      chunks
        .filter((chunk) => chunk.row === row)
        .map((chunk) => chunk.pixelSize[1]),
    );
    invariant(heights.size === 1, `W01 row ${row} has mixed pixel heights`);
    return [...heights][0];
  });
  const chunkGridPixelDimensions = [
    columnWidths.reduce((sum, value) => sum + value, 0),
    rowHeights.reduce((sum, value) => sum + value, 0),
  ];

  const chunksByFileName = [...chunks].sort((left, right) =>
    left.url.localeCompare(right.url, "en"),
  );
  const chunkHashRegister = chunksByFileName
    .map((chunk) => `${chunk.sha256}  ${path.posix.basename(chunk.url)}\n`)
    .join("");
  const chunkSetHash = sha256(Buffer.from(chunkHashRegister, "utf8"));
  invariant(
    chunkSetHash === ACCEPTED_SOURCE.chunkSetSha256,
    `W01 chunk set drifted: expected ${ACCEPTED_SOURCE.chunkSetSha256}, received ${chunkSetHash}`,
  );

  const chunkBytes = chunks.reduce((sum, chunk) => sum + chunk.byteSize, 0);
  const assetVersion = [
    "w01",
    `s${Math.round(sourceManifest.scale * 100)}`,
    `q${sourceManifest.jpeg_quality}`,
    `g${sourceManifest.generator_version}`,
    chunkSetHash.slice(0, 16),
  ].join("-");

  const manifest = {
    schema: SCHEMA,
    schemaVersion: SCHEMA_VERSION,
    map: {
      id: sourceManifest.id,
      version: assetVersion,
      name: sourceManifest.name,
    },
    planningAreas: sourceManifest.planning_areas,
    bounds: {
      nominal: sourceManifest.bounds,
      surface: [surfaceWest, surfaceSouth, surfaceEast, surfaceNorth],
    },
    retainedPixelDimensions: {
      nominal: [
        sourceManifest.retained_width_px,
        sourceManifest.retained_height_px,
      ],
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
      nativePixelDimensions: [
        sourceManifest.native_width_px,
        sourceManifest.native_height_px,
      ],
      worldPixelBounds: {
        nominal: [nominalLeft, nominalTop, nominalRight, nominalBottom],
        surface: surfaceWorldPixelBounds,
      },
      tileGrid: {
        columns: sourceManifest.tile_columns,
        rows: sourceManifest.tile_rows,
        sourceTiles: sourceManifest.tiles_used,
        chunkColumns: xStarts.length,
        chunkRows: yStarts.length,
        chunkCount: chunks.length,
      },
      readability: {
        edition: readabilityPlate.edition,
        scaleFactor: readabilityPlate.scale_factor,
        rasterResampled: false,
        embeddedImageStreamsPreserved:
          readabilitySource.value.embedded_image_streams_preserved,
        textPreserved: readabilitySource.value.text_preserved,
        contentPreserved: readabilityPlate.content_preserved,
      },
      readabilityPercent: Math.round(readabilityPlate.scale_factor * 100),
    },
    attribution: {
      text: ATTRIBUTION,
      html:
        '<a href="https://www.onemap.gov.sg/" target="_blank" rel="noopener noreferrer">OneMap</a> © contributors | Singapore Land Authority',
      logoUrl: ATTRIBUTION_LOGO_URL,
      required: true,
    },
    presentation: {
      backgroundColor: "#f4f2ed",
    },
    transport: {
      chunkCount: chunks.length,
      totalBytes: chunkBytes,
    },
    integrity: {
      algorithm: "sha256",
      chunkCount: chunks.length,
      chunkBytes,
      chunkSetSha256: chunkSetHash,
      chunkSetCanonicalization:
        'UTF-8 lines "<sha256>  <filename>\\n", sorted by filename',
      sourceManifestSha256: sourceManifestHash,
      islandwidePlanSha256: sha256(planSource.buffer),
      readabilityValidationSha256: readabilityValidationHash,
      readabilityReportSha256: sha256(readabilityReport),
      validatedSourcePdfSha256: readabilityPlate.source_pdf_sha256,
      validatedReadabilityPdfSha256: readabilityPlate.pdf_sha256,
      embeddedImageStreamSignature:
        readabilityPlate.target_image_stream_signature,
      extractedTextSignature: readabilityPlate.target_text_signature,
    },
    chunks,
  };

  const manifestBuffer = Buffer.from(
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, manifestBuffer);

  console.log(
    JSON.stringify(
      {
        output: OUTPUT_PATH,
        schema: `${SCHEMA} v${SCHEMA_VERSION}`,
        mapId: manifest.map.id,
        version: manifest.map.version,
        chunks: manifest.chunks.length,
        chunkBytes,
        manifestBytes: manifestBuffer.length,
        manifestSha256: sha256(manifestBuffer),
        chunkSetSha256: chunkSetHash,
        nominalBounds: manifest.bounds.nominal,
        surfaceBounds: manifest.bounds.surface,
        retainedPixelDimensions: manifest.retainedPixelDimensions,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(`W01 manifest generation failed: ${error.message}`);
  process.exitCode = 1;
});
