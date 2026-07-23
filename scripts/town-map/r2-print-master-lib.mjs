import { readdir, readFile, stat, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { validatePrintMasterManifest } from "../../client/src/lib/printMasterSurface.js";
import {
  invariant,
  mapWithConcurrency,
  normalizeR2Prefix,
  sha256,
} from "./r2-w01-lib.mjs";

export const DEFAULT_PRINT_MASTER_SOURCE_ROOTS = {
  default: "/Users/sweetbuns/CareAroundSG-print-assets/default",
  gray: "/Users/sweetbuns/Documents/SG MAP/output/static-town-maps-grey/print-master-100",
};
export const DEFAULT_PRINT_MASTER_PACKAGE_ROOT =
  "/Users/sweetbuns/CareAroundSG-print-assets/web/v2/print-master-100-20260723";
export const DEFAULT_PRINT_MASTER_R2_BUCKET = "carearound-town-map-assets";
export const DEFAULT_PRINT_MASTER_R2_PREFIX = "v2/print-master-100-20260723";
export const DEFAULT_PRINT_MASTER_PUBLIC_BASE_URL =
  "https://maps.carearound.sg/v2/print-master-100-20260723";

const MANIFEST_SCHEMAS = {
  default: "carearound.print-master/v1",
  gray: "carearound.grey-print-master/v1",
};
const STYLE_SLUGS = { default: "default", gray: "grey" };
const CHUNK_PATTERN = /^chunks\/(?<surface>[A-Z0-9]+)-s100-q95\/(?<file>z19-\d+-\d+-\d+-\d+\.jpg)$/;

export function normalizePrintMasterStyle(style) {
  const normalized = String(style || "default").trim().toLowerCase();
  invariant(["default", "gray"].includes(normalized), `Unsupported print-master style: ${style}`);
  return normalized;
}

function normalizeSourceRoot(sourceRoot, style) {
  if (sourceRoot) return path.resolve(sourceRoot);
  return path.resolve(DEFAULT_PRINT_MASTER_SOURCE_ROOTS[style]);
}

function normalizePackageRoot(packageRoot, style) {
  const root = path.resolve(packageRoot || DEFAULT_PRINT_MASTER_PACKAGE_ROOT);
  return path.basename(root).toLowerCase() === style ? root : path.join(root, style);
}

function safeSourcePath(root, relativePath) {
  invariant(typeof relativePath === "string" && CHUNK_PATTERN.test(relativePath), `Unsafe print-master chunk URL: ${relativePath}`);
  const resolved = path.resolve(root, relativePath);
  invariant(resolved.startsWith(`${root}${path.sep}`), `Unsafe print-master chunk path: ${relativePath}`);
  return resolved;
}

function sanitizeSource(source = {}) {
  return Object.fromEntries([
    ["provider", source.provider],
    ["style", source.style],
    ["layer", source.layer],
    ["zoom", source.zoom],
    ["detail_equivalent_zoom", source.detail_equivalent_zoom],
    ["display_grid", source.display_grid],
    ["documentation", source.documentation],
  ].filter(([, value]) => value !== undefined && value !== null && value !== ""));
}

export function sanitizePrintMasterManifest(value, { style, expectedSurfaceId = "" } = {}) {
  const normalizedStyle = normalizePrintMasterStyle(style);
  invariant(value?.schema === MANIFEST_SCHEMAS[normalizedStyle], `Unexpected ${normalizedStyle} print-master schema`);
  const validated = validatePrintMasterManifest(value, { expectedSurfaceId });
  const chunkUrls = new Set();
  const chunks = validated.chunks.map((chunk) => {
    const match = CHUNK_PATTERN.exec(chunk.url);
    invariant(match?.groups?.surface === validated.id, `${validated.id} chunk path does not match its surface`);
    invariant(!chunkUrls.has(chunk.url), `${validated.id} contains duplicate chunk URL ${chunk.url}`);
    invariant(Number.isSafeInteger(Number(chunk.bytes)) && Number(chunk.bytes) > 0, `${validated.id}/${chunk.id} has invalid bytes`);
    invariant(/^[a-f0-9]{64}$/.test(chunk.sha256 || ""), `${validated.id}/${chunk.id} has invalid SHA-256`);
    chunkUrls.add(chunk.url);
    return {
      id: chunk.id,
      url: chunk.url,
      left: chunk.worldPixelBounds[0],
      top: chunk.worldPixelBounds[1],
      right: chunk.worldPixelBounds[2],
      bottom: chunk.worldPixelBounds[3],
      width: chunk.pixelSize[0],
      height: chunk.pixelSize[1],
      ...(Array.isArray(chunk.bounds) ? { bounds: chunk.bounds.map(Number) } : {}),
      bytes: Number(chunk.bytes),
      sha256: chunk.sha256,
    };
  });
  const totalBytes = chunks.reduce((sum, chunk) => sum + chunk.bytes, 0);
  return {
    schema: value.schema,
    edition: String(value.edition || ""),
    generated_at: value.generated_at,
    id: validated.id,
    name: String(value.name || validated.id),
    planning_areas: Array.isArray(value.planning_areas) ? value.planning_areas.map(String) : [],
    bounds: validated.bounds,
    source_retention_scale: 1,
    source: sanitizeSource(value.source),
    presentation: {
      backgroundColor: String(value.presentation?.backgroundColor || (normalizedStyle === "gray" ? "#f5f5f5" : "#f4f2ed")),
    },
    attribution: {
      text: String(value.attribution?.text || "OneMap (c) contributors | Singapore Land Authority"),
      ...(value.attribution?.logo_url ? { logo_url: String(value.attribution.logo_url) } : {}),
      required_visible: true,
    },
    jpeg_quality: Number(value.jpeg_quality || 95),
    ...(Number.isFinite(Number(value.native_width_px)) ? { native_width_px: Number(value.native_width_px) } : {}),
    ...(Number.isFinite(Number(value.native_height_px)) ? { native_height_px: Number(value.native_height_px) } : {}),
    chunks,
    integrity: {
      algorithm: "sha256",
      chunk_count: chunks.length,
      total_bytes: totalBytes,
    },
  };
}

export function validatePrintMasterWebIndexBuffer(indexBuffer, { style, expectedSurfaceCount = 32 } = {}) {
  const normalizedStyle = normalizePrintMasterStyle(style);
  const index = JSON.parse(Buffer.from(indexBuffer).toString("utf8"));
  invariant(index.schema === "carearound.print-master-web-collection/v1", "Unsupported print-master web index schema");
  invariant(index.style === normalizedStyle, `Expected ${normalizedStyle} print-master web index`);
  invariant(Array.isArray(index.surfaces) && index.surfaces.length === expectedSurfaceCount, `Expected ${expectedSurfaceCount} print-master surfaces`);
  invariant(index.surface_count === index.surfaces.length, "Print-master surface count drifted");
  invariant(index.chunk_count === index.surfaces.reduce((sum, surface) => sum + surface.chunk_count, 0), "Print-master chunk count drifted");
  invariant(index.total_bytes === index.surfaces.reduce((sum, surface) => sum + surface.total_bytes, 0), "Print-master byte total drifted");
  return { index, indexSha256: sha256(indexBuffer) };
}

export async function preparePrintMasterWebAssets({
  style = "default",
  sourceRoot = "",
  packageRoot = DEFAULT_PRINT_MASTER_PACKAGE_ROOT,
  expectedSurfaceCount = 32,
  verifyChunks = true,
} = {}) {
  const normalizedStyle = normalizePrintMasterStyle(style);
  const resolvedSourceRoot = normalizeSourceRoot(sourceRoot, normalizedStyle);
  const resolvedPackageRoot = normalizePackageRoot(packageRoot, normalizedStyle);
  const sourceManifestRoot = path.join(resolvedSourceRoot, "manifests");
  const outputManifestRoot = path.join(resolvedPackageRoot, "manifests");
  const suffix = `-${STYLE_SLUGS[normalizedStyle]}-print-master-100.json`;
  const manifestNames = (await readdir(sourceManifestRoot))
    .filter((name) => name.endsWith(suffix))
    .sort((left, right) => left.localeCompare(right, "en"));
  invariant(manifestNames.length === expectedSurfaceCount, `Expected ${expectedSurfaceCount} ${normalizedStyle} print-master manifests; found ${manifestNames.length}`);
  await mkdir(outputManifestRoot, { recursive: true });

  const surfaces = [];
  const chunkObjects = [];
  const seenChunkUrls = new Set();
  for (const manifestName of manifestNames) {
    const sourceManifest = JSON.parse(await readFile(path.join(sourceManifestRoot, manifestName), "utf8"));
    const sanitized = sanitizePrintMasterManifest(sourceManifest, { style: normalizedStyle });
    const expectedManifestName = `${sanitized.id.toLowerCase()}${suffix}`;
    invariant(manifestName === expectedManifestName, `Unexpected print-master manifest name: ${manifestName}`);
    for (const chunk of sanitized.chunks) {
      invariant(!seenChunkUrls.has(chunk.url), `Duplicate print-master chunk URL: ${chunk.url}`);
      seenChunkUrls.add(chunk.url);
      const filePath = safeSourcePath(resolvedSourceRoot, chunk.url);
      const metadata = await stat(filePath);
      invariant(metadata.isFile(), `Missing print-master chunk: ${chunk.url}`);
      invariant(metadata.size === chunk.bytes, `Print-master chunk size drifted: ${chunk.url}`);
      if (verifyChunks) {
        invariant(sha256(await readFile(filePath)) === chunk.sha256, `Print-master chunk hash drifted: ${chunk.url}`);
      }
      chunkObjects.push({
        key: chunk.url,
        filePath,
        byteSize: chunk.bytes,
        sha256: chunk.sha256,
        contentType: "image/jpeg",
        cacheControl: "public, max-age=31536000, immutable",
      });
    }
    const manifestBuffer = Buffer.from(`${JSON.stringify(sanitized, null, 2)}\n`);
    const outputPath = path.join(outputManifestRoot, expectedManifestName);
    await writeFile(outputPath, manifestBuffer);
    surfaces.push({
      id: sanitized.id,
      bounds: sanitized.bounds,
      manifest: `manifests/${expectedManifestName}`,
      manifest_bytes: manifestBuffer.length,
      manifest_sha256: sha256(manifestBuffer),
      chunk_count: sanitized.chunks.length,
      total_bytes: sanitized.integrity.total_bytes,
    });
  }
  surfaces.sort((left, right) => left.id.localeCompare(right.id, "en"));
  const collectionDigest = sha256(Buffer.from(surfaces.map((surface) => `${surface.id}:${surface.manifest_sha256}\n`).join("")));
  const index = {
    schema: "carearound.print-master-web-collection/v1",
    style: normalizedStyle,
    version: `print-master-100-${collectionDigest.slice(0, 16)}`,
    source_retention_scale: 1,
    surface_count: surfaces.length,
    chunk_count: chunkObjects.length,
    total_bytes: surfaces.reduce((sum, surface) => sum + surface.total_bytes, 0),
    attribution: "OneMap (c) contributors | Singapore Land Authority",
    surfaces,
    integrity: { algorithm: "sha256", surface_manifest_set_sha256: collectionDigest },
  };
  const indexBuffer = Buffer.from(`${JSON.stringify(index, null, 2)}\n`);
  const indexPath = path.join(resolvedPackageRoot, "manifest.json");
  await writeFile(indexPath, indexBuffer);
  return {
    style: normalizedStyle,
    sourceRoot: resolvedSourceRoot,
    packageRoot: resolvedPackageRoot,
    version: index.version,
    surfaces,
    chunkObjects,
    index,
    indexPath,
    indexBuffer,
    indexSha256: sha256(indexBuffer),
  };
}

export async function loadPrintMasterR2DeploymentPlan(options = {}) {
  const prefixRoot = normalizeR2Prefix(options.prefix || DEFAULT_PRINT_MASTER_R2_PREFIX);
  const prepared = await preparePrintMasterWebAssets(options);
  const prefix = `${prefixRoot}/${prepared.style}`;
  const manifestObjects = prepared.surfaces.map((surface) => ({
    key: `${prefix}/${surface.manifest}`,
    filePath: path.join(prepared.packageRoot, surface.manifest),
    byteSize: surface.manifest_bytes,
    sha256: surface.manifest_sha256,
    contentType: "application/json; charset=utf-8",
    cacheControl: "public, max-age=300, must-revalidate",
  }));
  return {
    ...prepared,
    prefix,
    chunkObjects: prepared.chunkObjects.map((object) => ({ ...object, key: `${prefix}/${object.key}` })),
    manifestObjects,
    indexObject: {
      key: `${prefix}/manifest.json`,
      filePath: prepared.indexPath,
      byteSize: prepared.indexBuffer.length,
      sha256: prepared.indexSha256,
      contentType: "application/json; charset=utf-8",
      cacheControl: "public, max-age=300, must-revalidate",
    },
  };
}

export { invariant, mapWithConcurrency, sha256 };
