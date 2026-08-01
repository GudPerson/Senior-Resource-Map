import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  mkdir,
  open,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

import {
  invariant,
  mapWithConcurrency,
  normalizeR2Prefix,
  sha256,
} from "./r2-w01-lib.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");

export const HIGH_DETAIL_DOWNLOADS_SCHEMA = "carearound.town-map-download-catalogue/v1";
export const HIGH_DETAIL_DOWNLOADS_VERSION = "town-map-downloads-20260801-r2-default";
export const HIGH_DETAIL_DOWNLOADS_ATTRIBUTION = "OneMap (c) contributors | Singapore Land Authority";
export const DEFAULT_HIGH_DETAIL_DOWNLOADS_SOURCE_ROOT = "/Users/sweetbuns/Documents/SG MAP";
export const DEFAULT_HIGH_DETAIL_DOWNLOADS_PDF_ROOT = path.join(
  DEFAULT_HIGH_DETAIL_DOWNLOADS_SOURCE_ROOT,
  "output/pdf/default-native-scale-readability-175-clean",
);
export const DEFAULT_HIGH_DETAIL_DOWNLOADS_PNG_ROOT = path.join(
  DEFAULT_HIGH_DETAIL_DOWNLOADS_SOURCE_ROOT,
  "output/png/default-native-scale-readability-175-clean-powerpoint",
);
export const DEFAULT_HIGH_DETAIL_DOWNLOADS_OUTPUT_ROOT = path.join(
  REPO_ROOT,
  "output/town-map-downloads/v4/town-map-downloads-20260801-r2/default",
);
export const DEFAULT_HIGH_DETAIL_DOWNLOADS_R2_BUCKET = "carearound-town-map-assets";
export const DEFAULT_HIGH_DETAIL_DOWNLOADS_R2_PREFIX = "v4/town-map-downloads-20260801-r2/default";
export const DEFAULT_HIGH_DETAIL_DOWNLOADS_PUBLIC_BASE_URL =
  "https://maps.carearound.sg/v4/town-map-downloads-20260801-r2/default";
export const HIGH_DETAIL_DOWNLOADS_ALLOWED_ORIGINS = Object.freeze([
  "https://app.carearound.sg",
]);

export const HIGH_DETAIL_DOWNLOADS_MAP_IDS = Object.freeze([
  "C01", "C02", "C03", "C04", "C05", "C06", "C07", "C08",
  "E01", "E02", "E03", "E04", "E05", "E06",
  "N01", "N02",
  "NE01", "NE02", "NE03", "NE04", "NE05",
  "NW01", "NW02", "NW03",
  "S01",
  "W01", "W02", "W03", "W04", "W05", "W06", "W07",
]);

const EXPECTED_PDF_SCHEMA = "carearound.default-native-scale-readability-print-index/v1";
const EXPECTED_PDF_VALIDATION_SCHEMA = "carearound.default-native-scale-readability-print-validation/v1";
const EXPECTED_PNG_SCHEMA = "carearound.powerpoint-clean-png-index/v1";
const EXPECTED_PNG_VALIDATION_SCHEMA = "carearound.powerpoint-clean-png-validation/v1";
const EXPECTED_PNG_DIMENSIONS = Object.freeze([10000, 7000]);
const EXPECTED_PDF_PAGE_MM = Object.freeze([1750, 1225]);
const EXPECTED_THUMBNAIL_DIMENSIONS = Object.freeze([1000, 700]);
const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";
const CATALOGUE_CACHE_CONTROL = "public, max-age=300, must-revalidate";
const JSON_CONTENT_TYPE = "application/json; charset=utf-8";
const PDF_TAIL_BYTES = 8 * 1024 * 1024;
const VERSIONED_PREFIX_PATTERN = /^v[1-9]\d*\/town-map-downloads-\d{8}(?:-r[1-9]\d*)?\/default$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function compareIds(actualIds) {
  return JSON.stringify([...actualIds].sort()) === JSON.stringify([...HIGH_DETAIL_DOWNLOADS_MAP_IDS].sort());
}

function safeRelativePath(value, label) {
  const normalized = String(value || "").trim();
  invariant(normalized && !normalized.startsWith("/") && !normalized.includes("\\"), `Unsafe ${label}: ${value}`);
  invariant(
    !normalized.split("/").some((segment) => !segment || segment === "." || segment === ".."),
    `Unsafe ${label}: ${value}`,
  );
  return normalized;
}

function safeJoin(root, relativePath, label) {
  return path.join(root, safeRelativePath(relativePath, label));
}

function slugify(value) {
  const slug = String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  invariant(slug, `Unable to build a safe slug from ${value}`);
  return slug;
}

function contentDisposition(fileName) {
  invariant(/^[a-z0-9][a-z0-9.-]+$/.test(fileName), `Unsafe download filename: ${fileName}`);
  return `attachment; filename="${fileName}"`;
}

export function normalizeHighDetailDownloadsPrefix(value) {
  const normalized = normalizeR2Prefix(value);
  invariant(
    VERSIONED_PREFIX_PATTERN.test(normalized),
    `High-detail download prefix must be an immutable versioned root: ${value}`,
  );
  return normalized;
}

function normalizePublicBaseUrl(value, prefix) {
  const url = new URL(String(value || ""));
  invariant(url.protocol === "https:", `High-detail download base URL must use HTTPS: ${value}`);
  invariant(url.hostname === "maps.carearound.sg", `Unexpected high-detail download host: ${url.hostname}`);
  invariant(url.username === "" && url.password === "" && url.search === "" && url.hash === "", "Download base URL must not contain credentials, query, or hash");
  const pathname = url.pathname.replace(/^\/+|\/+$/g, "");
  invariant(pathname === prefix, `Download base URL path must match ${prefix}`);
  return url.toString().replace(/\/+$/, "");
}

export async function sha256File(filePath) {
  const hash = createHash("sha256");
  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  return hash.digest("hex");
}

function readUInt32(buffer, offset) {
  invariant(offset + 4 <= buffer.length, "Unexpected end of image metadata");
  return buffer.readUInt32BE(offset);
}

export function inspectPngMetadata(buffer) {
  const value = Buffer.from(buffer);
  invariant(value.length >= 33, "PNG file is too small");
  invariant(value.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), "Invalid PNG signature");

  let offset = 8;
  let width;
  let height;
  let bitDepth;
  let colourType;
  let pixelsPerMetreX;
  let pixelsPerMetreY;
  let physicalUnit;

  while (offset + 12 <= value.length) {
    const length = readUInt32(value, offset);
    const type = value.subarray(offset + 4, offset + 8).toString("ascii");
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (type === "IDAT" || type === "IEND") break;
    invariant(dataEnd + 4 <= value.length, `Truncated PNG ${type} chunk`);

    if (type === "IHDR") {
      invariant(length === 13, "PNG IHDR has an unexpected size");
      width = readUInt32(value, dataStart);
      height = readUInt32(value, dataStart + 4);
      bitDepth = value[dataStart + 8];
      colourType = value[dataStart + 9];
    } else if (type === "pHYs") {
      invariant(length === 9, "PNG pHYs has an unexpected size");
      pixelsPerMetreX = readUInt32(value, dataStart);
      pixelsPerMetreY = readUInt32(value, dataStart + 4);
      physicalUnit = value[dataStart + 8];
    }

    offset = dataEnd + 4;
  }

  invariant(Number.isSafeInteger(width) && Number.isSafeInteger(height), "PNG is missing IHDR dimensions");
  invariant(Number.isSafeInteger(pixelsPerMetreX) && Number.isSafeInteger(pixelsPerMetreY), "PNG is missing pHYs density metadata");
  const dpiX = pixelsPerMetreX * 0.0254;
  const dpiY = pixelsPerMetreY * 0.0254;
  return {
    width,
    height,
    bitDepth,
    colourType,
    pixelsPerMetreX,
    pixelsPerMetreY,
    physicalUnit,
    dpi: [dpiX, dpiY],
  };
}

export function inspectJpegMetadata(buffer) {
  const value = Buffer.from(buffer);
  invariant(value.length >= 4 && value[0] === 0xff && value[1] === 0xd8, "Invalid JPEG signature");
  let offset = 2;
  while (offset + 4 <= value.length) {
    while (offset < value.length && value[offset] === 0xff) offset += 1;
    const marker = value[offset];
    offset += 1;
    if (marker === 0xd9 || marker === 0xda) break;
    const length = value.readUInt16BE(offset);
    invariant(length >= 2 && offset + length <= value.length, "Truncated JPEG marker");
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return {
        height: value.readUInt16BE(offset + 3),
        width: value.readUInt16BE(offset + 5),
      };
    }
    offset += length;
  }
  throw new Error("JPEG dimensions were not found");
}

function decodeAscii85(value) {
  const input = String(value || "").replace(/\s+/g, "").replace(/^<~/, "").replace(/~>$/, "");
  const bytes = [];
  let group = [];

  const flush = (values, byteCount = 4) => {
    let number = 0;
    for (const item of values) number = (number * 85) + item;
    const decoded = [
      Math.floor(number / 16777216) % 256,
      Math.floor(number / 65536) % 256,
      Math.floor(number / 256) % 256,
      number % 256,
    ];
    bytes.push(...decoded.slice(0, byteCount));
  };

  for (const character of input) {
    if (character === "z" && group.length === 0) {
      bytes.push(0, 0, 0, 0);
      continue;
    }
    const number = character.charCodeAt(0) - 33;
    invariant(number >= 0 && number <= 84, "PDF ASCII85 stream contains an invalid character");
    group.push(number);
    if (group.length === 5) {
      flush(group);
      group = [];
    }
  }

  if (group.length > 0) {
    const sourceLength = group.length;
    while (group.length < 5) group.push(84);
    flush(group, sourceLength - 1);
  }
  return Buffer.from(bytes);
}

function extractPdfTextStreams(buffer) {
  const source = Buffer.from(buffer).toString("latin1");
  const streamPattern = /stream\r?\n([\s\S]*?)endstream/g;
  const decoded = [];
  let match;
  while ((match = streamPattern.exec(source))) {
    try {
      decoded.push(inflateSync(decodeAscii85(match[1])).toString("latin1"));
    } catch {
      // Most streams are JPEG images; only the ReportLab text stream uses ASCII85 + Flate.
    }
  }
  return decoded.join("\n")
    .replaceAll("\\(", "(")
    .replaceAll("\\)", ")")
    .replaceAll("\\\\", "\\");
}

export function inspectPdfTail(buffer) {
  const value = Buffer.from(buffer);
  const source = value.toString("latin1");
  invariant(source.includes("%PDF-"), "PDF header is missing from inspection buffer");
  const pageCountMatch = source.match(/\/Count\s+(\d+)\s+\/Kids\s*\[/);
  invariant(pageCountMatch, "PDF page tree was not found");
  const pageCount = Number(pageCountMatch[1]);
  const mediaBoxMatch = source.match(/\/MediaBox\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\]/);
  invariant(mediaBoxMatch, "PDF MediaBox was not found");
  const [left, bottom, right, top] = mediaBoxMatch.slice(1).map(Number);
  const pageSizePoints = [right - left, top - bottom];
  const pageSizeMm = pageSizePoints.map((points) => (points * 25.4) / 72);
  const extractedText = extractPdfTextStreams(value);
  return {
    pageCount,
    pageSizePoints,
    pageSizeMm,
    attributionPresent: extractedText.includes(HIGH_DETAIL_DOWNLOADS_ATTRIBUTION),
  };
}

async function readPdfInspectionBuffer(filePath) {
  const fileStats = await stat(filePath);
  invariant(fileStats.isFile() && fileStats.size > 0, `Missing PDF source: ${filePath}`);
  const headerSize = Math.min(16, fileStats.size);
  const tailSize = Math.min(PDF_TAIL_BYTES, fileStats.size);
  const handle = await open(filePath, "r");
  try {
    const header = Buffer.alloc(headerSize);
    await handle.read(header, 0, headerSize, 0);
    const tail = Buffer.alloc(tailSize);
    await handle.read(tail, 0, tailSize, fileStats.size - tailSize);
    return Buffer.concat([header, Buffer.from("\n"), tail]);
  } finally {
    await handle.close();
  }
}

async function loadJson(filePath, label) {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Unable to read ${label} at ${filePath}: ${error.message}`);
  }
  return parsed;
}

async function validateSourceFile({ filePath, expectedBytes, expectedSha256, label }) {
  invariant(Number.isSafeInteger(expectedBytes) && expectedBytes > 0, `${label} has an invalid expected byte size`);
  invariant(SHA256_PATTERN.test(expectedSha256 || ""), `${label} has an invalid expected SHA-256`);
  const fileStats = await stat(filePath);
  invariant(fileStats.isFile(), `${label} is not a regular file`);
  invariant(fileStats.size === expectedBytes, `${label} byte size drifted: expected ${expectedBytes}, received ${fileStats.size}`);
  const actualSha256 = await sha256File(filePath);
  invariant(actualSha256 === expectedSha256, `${label} SHA-256 drifted`);
  return fileStats;
}

function assertApproximate(actual, expected, tolerance, label) {
  invariant(Math.abs(actual - expected) <= tolerance, `${label} drifted: expected ${expected}, received ${actual}`);
}

function makeObject({ key, filePath, byteSize, digest, contentType, cacheControl = IMMUTABLE_CACHE_CONTROL, disposition }) {
  invariant(key && !key.includes("..") && !key.includes("\\"), `Unsafe object key: ${key}`);
  invariant(Number.isSafeInteger(byteSize) && byteSize > 0, `Invalid object size: ${key}`);
  invariant(SHA256_PATTERN.test(digest || ""), `Invalid object SHA-256: ${key}`);
  return {
    key,
    filePath,
    byteSize,
    sha256: digest,
    contentType,
    cacheControl,
    ...(disposition ? { contentDisposition: disposition } : {}),
  };
}

function urlFor(baseUrl, key, prefix) {
  invariant(key.startsWith(`${prefix}/`), `Object key is outside ${prefix}: ${key}`);
  return `${baseUrl}/${key.slice(prefix.length + 1)}`;
}

export function validateHighDetailDownloadsCatalogue(catalogue, {
  expectedBaseUrl = DEFAULT_HIGH_DETAIL_DOWNLOADS_PUBLIC_BASE_URL,
} = {}) {
  invariant(catalogue && typeof catalogue === "object" && !Array.isArray(catalogue), "Catalogue must be an object");
  invariant(catalogue.schema === HIGH_DETAIL_DOWNLOADS_SCHEMA, `Expected ${HIGH_DETAIL_DOWNLOADS_SCHEMA}`);
  invariant(catalogue.version === HIGH_DETAIL_DOWNLOADS_VERSION, `Expected catalogue version ${HIGH_DETAIL_DOWNLOADS_VERSION}`);
  invariant(catalogue.style === "default", "Catalogue must contain Default-colour maps only");
  invariant(catalogue.attribution === HIGH_DETAIL_DOWNLOADS_ATTRIBUTION, "Catalogue attribution is invalid");
  invariant(catalogue.mapCount === HIGH_DETAIL_DOWNLOADS_MAP_IDS.length, "Catalogue map count is invalid");
  invariant(Array.isArray(catalogue.allowedOrigins), "Catalogue allowed origins are missing");
  invariant(
    JSON.stringify(catalogue.allowedOrigins) === JSON.stringify(HIGH_DETAIL_DOWNLOADS_ALLOWED_ORIGINS),
    "Catalogue allowed origins drifted",
  );
  invariant(Array.isArray(catalogue.maps) && catalogue.maps.length === HIGH_DETAIL_DOWNLOADS_MAP_IDS.length, "Catalogue must contain 32 maps");
  invariant(compareIds(catalogue.maps.map((map) => map.code)), "Catalogue map IDs are incomplete or duplicated");

  const normalizedBaseUrl = String(expectedBaseUrl).replace(/\/+$/, "");
  const seenUrls = new Set();
  for (const map of catalogue.maps) {
    invariant(HIGH_DETAIL_DOWNLOADS_MAP_IDS.includes(map.code), `Unexpected catalogue map ID: ${map.code}`);
    invariant(typeof map.name === "string" && map.name.trim(), `${map.code} name is missing`);
    invariant(Array.isArray(map.planningAreas) && map.planningAreas.length >= 1, `${map.code} planning areas are missing`);
    invariant(map.attribution === HIGH_DETAIL_DOWNLOADS_ATTRIBUTION, `${map.code} attribution is invalid`);

    const expected = [
      [map.thumbnail, "image/jpeg", "thumbnail"],
      [map.png, "image/png", "PNG"],
      [map.pdf, "application/pdf", "PDF"],
    ];
    for (const [asset, mimeType, label] of expected) {
      invariant(asset && typeof asset === "object", `${map.code} ${label} metadata is missing`);
      invariant(asset.mimeType === mimeType, `${map.code} ${label} MIME type is invalid`);
      invariant(Number.isSafeInteger(asset.bytes) && asset.bytes > 0, `${map.code} ${label} byte size is invalid`);
      invariant(SHA256_PATTERN.test(asset.sha256 || ""), `${map.code} ${label} SHA-256 is invalid`);
      invariant(typeof asset.url === "string" && asset.url.startsWith(`${normalizedBaseUrl}/`), `${map.code} ${label} URL is outside the versioned root`);
      const parsedUrl = new URL(asset.url);
      invariant(parsedUrl.protocol === "https:" && parsedUrl.hostname === "maps.carearound.sg", `${map.code} ${label} URL is not a CareAround HTTPS URL`);
      invariant(parsedUrl.search === "" && parsedUrl.hash === "", `${map.code} ${label} URL must not contain query or hash data`);
      invariant(!seenUrls.has(asset.url), `Duplicate catalogue asset URL: ${asset.url}`);
      seenUrls.add(asset.url);
    }

    invariant(map.thumbnail.width === 1000 && map.thumbnail.height === 700, `${map.code} thumbnail dimensions are invalid`);
    invariant(map.png.width === 10000 && map.png.height === 7000, `${map.code} PNG dimensions are invalid`);
    invariant(Array.isArray(map.png.dpi) && map.png.dpi.every((value) => Math.abs(value - 300) < 0.05), `${map.code} PNG DPI is invalid`);
    invariant(map.png.lossless === true, `${map.code} PNG must be lossless`);
    invariant(map.pdf.pageCount === 1, `${map.code} PDF must contain one page`);
    invariant(
      Array.isArray(map.pdf.pageSizeMm)
        && Math.abs(map.pdf.pageSizeMm[0] - EXPECTED_PDF_PAGE_MM[0]) < 0.05
        && Math.abs(map.pdf.pageSizeMm[1] - EXPECTED_PDF_PAGE_MM[1]) < 0.05,
      `${map.code} PDF page geometry is invalid`,
    );
    invariant(map.pdf.readabilityPercent === 175, `${map.code} PDF readability scale is invalid`);
    invariant(/^[a-z0-9][a-z0-9.-]+\.png$/.test(map.png.fileName), `${map.code} PNG filename is unsafe`);
    invariant(/^[a-z0-9][a-z0-9.-]+\.pdf$/.test(map.pdf.fileName), `${map.code} PDF filename is unsafe`);
  }
  return catalogue;
}

export async function loadHighDetailDownloadsPlan({
  sourceRoot = DEFAULT_HIGH_DETAIL_DOWNLOADS_SOURCE_ROOT,
  pdfRoot,
  pngRoot,
  outputRoot = DEFAULT_HIGH_DETAIL_DOWNLOADS_OUTPUT_ROOT,
  prefix = DEFAULT_HIGH_DETAIL_DOWNLOADS_R2_PREFIX,
  publicBaseUrl,
  writeMetadata = true,
  concurrency = 2,
} = {}) {
  const resolvedSourceRoot = path.resolve(sourceRoot);
  const resolvedPdfRoot = path.resolve(pdfRoot || path.join(resolvedSourceRoot, "output/pdf/default-native-scale-readability-175-clean"));
  const resolvedPngRoot = path.resolve(pngRoot || path.join(resolvedSourceRoot, "output/png/default-native-scale-readability-175-clean-powerpoint"));
  const resolvedOutputRoot = path.resolve(outputRoot);
  const normalizedPrefix = normalizeHighDetailDownloadsPrefix(prefix);
  const normalizedBaseUrl = normalizePublicBaseUrl(
    publicBaseUrl || `https://maps.carearound.sg/${normalizedPrefix}`,
    normalizedPrefix,
  );
  invariant(Number.isSafeInteger(concurrency) && concurrency >= 1 && concurrency <= 4, "Source validation concurrency must be between 1 and 4");
  invariant(!resolvedPdfRoot.includes("compression-pilot") && !resolvedPngRoot.includes("compression-pilot"), "Compression-pilot sources are forbidden");

  const pdfIndexPath = path.join(resolvedPdfRoot, "index.json");
  const pdfValidationPath = path.join(resolvedPdfRoot, "validation.json");
  const pngIndexPath = path.join(resolvedPngRoot, "index.json");
  const pngValidationPath = path.join(resolvedPngRoot, "validation.json");
  const [pdfIndex, pdfValidation, pngIndex, pngValidation] = await Promise.all([
    loadJson(pdfIndexPath, "PDF index"),
    loadJson(pdfValidationPath, "PDF validation"),
    loadJson(pngIndexPath, "PNG index"),
    loadJson(pngValidationPath, "PNG validation"),
  ]);

  invariant(pdfIndex.schema === EXPECTED_PDF_SCHEMA, "Unexpected PDF index schema");
  invariant(pdfValidation.schema === EXPECTED_PDF_VALIDATION_SCHEMA, "Unexpected PDF validation schema");
  invariant(pngIndex.schema === EXPECTED_PNG_SCHEMA, "Unexpected PNG index schema");
  invariant(pngValidation.schema === EXPECTED_PNG_VALIDATION_SCHEMA, "Unexpected PNG validation schema");
  for (const [label, collection] of [["PDF", pdfValidation], ["PNG", pngValidation]]) {
    invariant(collection.status === "pass" && collection.complete === true, `${label} validation did not pass`);
    invariant(collection.expectedMapCount === 32 && collection.validatedMapCount === 32, `${label} validation is incomplete`);
    invariant(Array.isArray(collection.missingMapIds) && collection.missingMapIds.length === 0, `${label} validation reports missing maps`);
    invariant(compareIds(collection.maps.map((map) => map.id)), `${label} validation map set drifted`);
  }
  invariant(pdfIndex.complete === true && pdfIndex.mapCount === 32 && compareIds(pdfIndex.maps.map((map) => map.id)), "PDF index is incomplete");
  invariant(pngIndex.complete === true && pngIndex.mapCount === 32 && compareIds(pngIndex.maps.map((map) => map.id)), "PNG index is incomplete");
  invariant(pdfIndex.attribution === HIGH_DETAIL_DOWNLOADS_ATTRIBUTION, "PDF index attribution drifted");
  invariant(pngIndex.attribution === HIGH_DETAIL_DOWNLOADS_ATTRIBUTION, "PNG index attribution drifted");
  invariant(pdfValidation.maps.every((map) => map.attribution === HIGH_DETAIL_DOWNLOADS_ATTRIBUTION), "A PDF validation record is missing attribution");
  invariant(pngValidation.maps.every((map) => map.attribution === HIGH_DETAIL_DOWNLOADS_ATTRIBUTION && map.sourceAttributionVerified === true), "A PNG validation record is missing attribution provenance");

  const pdfIndexById = new Map(pdfIndex.maps.map((map) => [map.id, map]));
  const pdfValidationById = new Map(pdfValidation.maps.map((map) => [map.id, map]));
  const pngIndexById = new Map(pngIndex.maps.map((map) => [map.id, map]));
  const pngValidationById = new Map(pngValidation.maps.map((map) => [map.id, map]));

  const records = await mapWithConcurrency(HIGH_DETAIL_DOWNLOADS_MAP_IDS, concurrency, async (code) => {
    const pdfIndexRecord = pdfIndexById.get(code);
    const pdfRecord = pdfValidationById.get(code);
    const pngIndexRecord = pngIndexById.get(code);
    const pngRecord = pngValidationById.get(code);
    invariant(pdfIndexRecord && pdfRecord && pngIndexRecord && pngRecord, `${code} source metadata is incomplete`);
    invariant(pdfRecord.status === "pass" && pngRecord.status === "pass", `${code} source validation did not pass`);
    invariant(pdfRecord.name === pngRecord.name && pdfRecord.name === pdfIndexRecord.name && pdfRecord.name === pngIndexRecord.name, `${code} source names do not agree`);
    invariant(pngRecord.sourcePdfSha256 === pdfRecord.pdfSha256, `${code} PNG provenance does not reference the validated PDF`);
    invariant(pdfIndexRecord.pdfSha256 === pdfRecord.pdfSha256 && pdfIndexRecord.pdfBytes === pdfRecord.pdfBytes, `${code} PDF index drifted from validation`);
    invariant(pngIndexRecord.pngSha256 === pngRecord.pngSha256 && pngIndexRecord.pngBytes === pngRecord.pngBytes, `${code} PNG index drifted from validation`);

    const pdfPath = safeJoin(resolvedPdfRoot, pdfIndexRecord.pdf, `${code} PDF path`);
    const pngPath = safeJoin(resolvedPngRoot, pngIndexRecord.png, `${code} PNG path`);
    const thumbnailPath = safeJoin(resolvedPngRoot, pngIndexRecord.thumbnail, `${code} thumbnail path`);

    await validateSourceFile({
      filePath: pdfPath,
      expectedBytes: pdfRecord.pdfBytes,
      expectedSha256: pdfRecord.pdfSha256,
      label: `${code} PDF`,
    });
    await validateSourceFile({
      filePath: pngPath,
      expectedBytes: pngRecord.pngBytes,
      expectedSha256: pngRecord.pngSha256,
      label: `${code} PNG`,
    });

    const pngHandle = await open(pngPath, "r");
    let pngHeader;
    try {
      pngHeader = Buffer.alloc(256);
      const { bytesRead } = await pngHandle.read(pngHeader, 0, pngHeader.length, 0);
      pngHeader = pngHeader.subarray(0, bytesRead);
    } finally {
      await pngHandle.close();
    }
    const pngMetadata = inspectPngMetadata(pngHeader);
    invariant(pngMetadata.width === EXPECTED_PNG_DIMENSIONS[0] && pngMetadata.height === EXPECTED_PNG_DIMENSIONS[1], `${code} PNG dimensions drifted`);
    invariant(pngMetadata.bitDepth === 8 && pngMetadata.colourType === 2, `${code} PNG must be 8-bit RGB`);
    invariant(pngMetadata.physicalUnit === 1, `${code} PNG density must use metres`);
    assertApproximate(pngMetadata.dpi[0], 300, 0.05, `${code} PNG horizontal DPI`);
    assertApproximate(pngMetadata.dpi[1], 300, 0.05, `${code} PNG vertical DPI`);
    invariant(pngRecord.losslessEncoding === true, `${code} PNG validation is not lossless`);

    const pdfMetadata = inspectPdfTail(await readPdfInspectionBuffer(pdfPath));
    invariant(pdfMetadata.pageCount === 1 && pdfRecord.pageCount === 1, `${code} PDF must contain one page`);
    assertApproximate(pdfMetadata.pageSizeMm[0], EXPECTED_PDF_PAGE_MM[0], 0.02, `${code} PDF width`);
    assertApproximate(pdfMetadata.pageSizeMm[1], EXPECTED_PDF_PAGE_MM[1], 0.02, `${code} PDF height`);
    invariant(pdfMetadata.attributionPresent, `${code} PDF does not contain the required attribution text`);
    invariant(pdfRecord.scaleFactor === 1.75 && pdfRecord.readabilityPercent === 175, `${code} PDF scale is not the clean 175% edition`);

    const thumbnailBuffer = await readFile(thumbnailPath);
    const thumbnailStats = await stat(thumbnailPath);
    const thumbnailMetadata = inspectJpegMetadata(thumbnailBuffer);
    invariant(
      thumbnailMetadata.width === EXPECTED_THUMBNAIL_DIMENSIONS[0]
        && thumbnailMetadata.height === EXPECTED_THUMBNAIL_DIMENSIONS[1],
      `${code} thumbnail dimensions drifted`,
    );
    const thumbnailSha256 = sha256(thumbnailBuffer);

    const slug = slugify(pdfRecord.name);
    const codeSlug = code.toLowerCase();
    const pngFileName = `${codeSlug}-${slug}-high-detail-town-map-10000x7000.png`;
    const pdfFileName = `${codeSlug}-${slug}-high-detail-town-map-175.pdf`;
    const thumbnailFileName = `${codeSlug}-${slug}-preview.jpg`;
    const pngKey = `${normalizedPrefix}/png/${pngFileName}`;
    const pdfKey = `${normalizedPrefix}/pdf/${pdfFileName}`;
    const thumbnailKey = `${normalizedPrefix}/thumbnails/${thumbnailFileName}`;

    return {
      code,
      name: pdfRecord.name,
      planningAreas: [...pdfRecord.planningAreas],
      png: {
        filePath: pngPath,
        key: pngKey,
        fileName: pngFileName,
        bytes: pngRecord.pngBytes,
        sha256: pngRecord.pngSha256,
        url: urlFor(normalizedBaseUrl, pngKey, normalizedPrefix),
        width: pngMetadata.width,
        height: pngMetadata.height,
        dpi: pngMetadata.dpi.map((value) => Number(value.toFixed(3))),
      },
      pdf: {
        filePath: pdfPath,
        key: pdfKey,
        fileName: pdfFileName,
        bytes: pdfRecord.pdfBytes,
        sha256: pdfRecord.pdfSha256,
        url: urlFor(normalizedBaseUrl, pdfKey, normalizedPrefix),
        pageCount: pdfMetadata.pageCount,
        pageSizeMm: pdfMetadata.pageSizeMm.map((value) => Number(value.toFixed(3))),
      },
      thumbnail: {
        filePath: thumbnailPath,
        key: thumbnailKey,
        fileName: thumbnailFileName,
        bytes: thumbnailStats.size,
        sha256: thumbnailSha256,
        url: urlFor(normalizedBaseUrl, thumbnailKey, normalizedPrefix),
        width: thumbnailMetadata.width,
        height: thumbnailMetadata.height,
      },
      source: {
        pdfManifestSha256: pdfRecord.sourceManifestSha256,
        sourceChunkSetSha256: pdfRecord.sourceChunkSetSha256,
        sourceCollectionVersion: pdfRecord.sourceCollectionVersion,
      },
    };
  });

  records.sort((left, right) => left.code.localeCompare(right.code, "en"));
  const sourceMetadata = {
    pdfIndex: { source: path.relative(resolvedSourceRoot, pdfIndexPath), sha256: await sha256File(pdfIndexPath) },
    pdfValidation: { source: path.relative(resolvedSourceRoot, pdfValidationPath), sha256: await sha256File(pdfValidationPath) },
    pngIndex: { source: path.relative(resolvedSourceRoot, pngIndexPath), sha256: await sha256File(pngIndexPath) },
    pngValidation: { source: path.relative(resolvedSourceRoot, pngValidationPath), sha256: await sha256File(pngValidationPath) },
  };

  const catalogue = {
    schema: HIGH_DETAIL_DOWNLOADS_SCHEMA,
    version: HIGH_DETAIL_DOWNLOADS_VERSION,
    releaseDate: "2026-08-01",
    style: "default",
    edition: "clean-175-percent",
    attribution: HIGH_DETAIL_DOWNLOADS_ATTRIBUTION,
    mapCount: records.length,
    allowedOrigins: [...HIGH_DETAIL_DOWNLOADS_ALLOWED_ORIGINS],
    provenanceUrl: `${normalizedBaseUrl}/provenance.json`,
    validationUrl: `${normalizedBaseUrl}/validation.json`,
    maps: records.map((record) => ({
      code: record.code,
      name: record.name,
      planningAreas: record.planningAreas,
      attribution: HIGH_DETAIL_DOWNLOADS_ATTRIBUTION,
      thumbnail: {
        url: record.thumbnail.url,
        mimeType: "image/jpeg",
        bytes: record.thumbnail.bytes,
        sha256: record.thumbnail.sha256,
        width: record.thumbnail.width,
        height: record.thumbnail.height,
      },
      png: {
        url: record.png.url,
        fileName: record.png.fileName,
        mimeType: "image/png",
        bytes: record.png.bytes,
        sha256: record.png.sha256,
        width: record.png.width,
        height: record.png.height,
        dpi: record.png.dpi,
        lossless: true,
      },
      pdf: {
        url: record.pdf.url,
        fileName: record.pdf.fileName,
        mimeType: "application/pdf",
        bytes: record.pdf.bytes,
        sha256: record.pdf.sha256,
        pageCount: record.pdf.pageCount,
        pageSizeMm: record.pdf.pageSizeMm,
        readabilityPercent: 175,
      },
    })),
  };
  validateHighDetailDownloadsCatalogue(catalogue, { expectedBaseUrl: normalizedBaseUrl });

  const provenance = {
    schema: "carearound.town-map-download-provenance/v1",
    version: HIGH_DETAIL_DOWNLOADS_VERSION,
    releaseDate: "2026-08-01",
    sourceLibrary: "SG MAP read-only source library",
    sourceCollections: sourceMetadata,
    forbiddenSource: "output/compression-pilot",
    attribution: HIGH_DETAIL_DOWNLOADS_ATTRIBUTION,
    maps: records.map((record) => ({ code: record.code, ...record.source })),
  };
  const validation = {
    schema: "carearound.town-map-download-validation/v1",
    version: HIGH_DETAIL_DOWNLOADS_VERSION,
    status: "pass",
    complete: true,
    expectedMapCount: 32,
    validatedMapCount: records.length,
    missingMapIds: [],
    attribution: HIGH_DETAIL_DOWNLOADS_ATTRIBUTION,
    png: {
      format: "PNG",
      mimeType: "image/png",
      pixelDimensions: [...EXPECTED_PNG_DIMENSIONS],
      dpi: [300, 300],
      lossless: true,
      totalBytes: records.reduce((sum, record) => sum + record.png.bytes, 0),
    },
    pdf: {
      format: "PDF",
      mimeType: "application/pdf",
      pageCount: 1,
      pageSizeMm: [...EXPECTED_PDF_PAGE_MM],
      readabilityPercent: 175,
      totalBytes: records.reduce((sum, record) => sum + record.pdf.bytes, 0),
    },
    thumbnails: {
      format: "JPEG",
      mimeType: "image/jpeg",
      pixelDimensions: [...EXPECTED_THUMBNAIL_DIMENSIONS],
      totalBytes: records.reduce((sum, record) => sum + record.thumbnail.bytes, 0),
    },
    maps: records.map((record) => ({
      code: record.code,
      pngBytes: record.png.bytes,
      pngSha256: record.png.sha256,
      pdfBytes: record.pdf.bytes,
      pdfSha256: record.pdf.sha256,
      thumbnailBytes: record.thumbnail.bytes,
      thumbnailSha256: record.thumbnail.sha256,
      attributionVerified: true,
    })),
  };

  const generatedFiles = [
    ["catalogue.json", catalogue, CATALOGUE_CACHE_CONTROL],
    ["provenance.json", provenance, IMMUTABLE_CACHE_CONTROL],
    ["validation.json", validation, IMMUTABLE_CACHE_CONTROL],
  ];
  if (writeMetadata) {
    await mkdir(resolvedOutputRoot, { recursive: true });
    for (const [fileName, payload] of generatedFiles) {
      await writeFile(path.join(resolvedOutputRoot, fileName), canonicalJson(payload), "utf8");
    }
  }

  const generatedObjects = new Map();
  for (const [fileName, payload, cacheControl] of generatedFiles) {
    const buffer = Buffer.from(canonicalJson(payload));
    const filePath = path.join(resolvedOutputRoot, fileName);
    generatedObjects.set(fileName, makeObject({
      key: `${normalizedPrefix}/${fileName}`,
      filePath,
      byteSize: buffer.length,
      digest: sha256(buffer),
      contentType: JSON_CONTENT_TYPE,
      cacheControl,
    }));
  }

  const thumbnailObjects = records.map((record) => makeObject({
    key: record.thumbnail.key,
    filePath: record.thumbnail.filePath,
    byteSize: record.thumbnail.bytes,
    digest: record.thumbnail.sha256,
    contentType: "image/jpeg",
  }));
  const downloadObjects = records.flatMap((record) => [
    makeObject({
      key: record.png.key,
      filePath: record.png.filePath,
      byteSize: record.png.bytes,
      digest: record.png.sha256,
      contentType: "image/png",
      disposition: contentDisposition(record.png.fileName),
    }),
    makeObject({
      key: record.pdf.key,
      filePath: record.pdf.filePath,
      byteSize: record.pdf.bytes,
      digest: record.pdf.sha256,
      contentType: "application/pdf",
      disposition: contentDisposition(record.pdf.fileName),
    }),
  ]);

  return {
    bucket: DEFAULT_HIGH_DETAIL_DOWNLOADS_R2_BUCKET,
    prefix: normalizedPrefix,
    publicBaseUrl: normalizedBaseUrl,
    version: HIGH_DETAIL_DOWNLOADS_VERSION,
    mapCount: records.length,
    catalogue,
    validation,
    provenance,
    records,
    thumbnailObjects,
    downloadObjects,
    metadataObjects: [generatedObjects.get("validation.json"), generatedObjects.get("provenance.json")],
    catalogueObject: generatedObjects.get("catalogue.json"),
    totalBytes: [...thumbnailObjects, ...downloadObjects, ...generatedObjects.values()]
      .reduce((sum, object) => sum + object.byteSize, 0),
    publishOrder: "C08 PNG canary and exact public download proof, then remaining PNG/PDF binaries and thumbnails, then validation/provenance metadata, then catalogue.json",
  };
}

export async function assertRemoteObjectVacant(plan, object, {
  fetchImpl = globalThis.fetch,
} = {}) {
  invariant(typeof fetchImpl === "function", "A fetch implementation is required for R2 preflight");
  invariant(object?.key?.startsWith(`${plan.prefix}/`), "R2 preflight object is outside the publication prefix");
  const relativeKey = object.key.slice(plan.prefix.length + 1);
  const url = new URL(`${plan.publicBaseUrl}/${relativeKey}`);
  url.searchParams.set("carearound-vacancy-check", object.sha256.slice(0, 16));
  const response = await fetchImpl(url, {
    method: "HEAD",
    cache: "no-store",
    redirect: "manual",
    headers: {
      "Cache-Control": "no-cache",
      Origin: HIGH_DETAIL_DOWNLOADS_ALLOWED_ORIGINS[0],
    },
  });
  invariant(
    response.status === 404,
    response.ok || (response.status >= 300 && response.status < 400)
      ? `R2 publication aborted because ${object.key} already exists`
      : `R2 vacancy check for ${object.key} returned HTTP ${response.status}`,
  );
  return true;
}

export async function assertRemotePrefixVacant(plan, {
  fetchImpl = globalThis.fetch,
  concurrency = 8,
} = {}) {
  invariant(typeof fetchImpl === "function", "A fetch implementation is required for R2 preflight");
  const objects = [
    ...plan.downloadObjects,
    ...plan.thumbnailObjects,
    ...plan.metadataObjects,
    plan.catalogueObject,
  ];
  await mapWithConcurrency(objects, concurrency, (object) => (
    assertRemoteObjectVacant(plan, object, { fetchImpl })
  ));
  return true;
}

export { IMMUTABLE_CACHE_CONTROL, CATALOGUE_CACHE_CONTROL, JSON_CONTENT_TYPE, invariant, mapWithConcurrency, sha256 };
