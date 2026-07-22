import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  parseFixedTownSurfaceIndex,
  parseFixedTownSurfaceManifest,
} from "../../client/src/lib/fixedTownSurface.js";
import {
  invariant,
  mapWithConcurrency,
  normalizeR2Prefix,
  sha256,
} from "./r2-w01-lib.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");

export const DEFAULT_ISLANDWIDE_SOURCE_ROOT = "/Users/sweetbuns/Documents/SG MAP";
export const DEFAULT_ISLANDWIDE_MANIFEST_ROOT = path.join(
  REPO_ROOT,
  "output/town-map-proof/assets/v1/islandwide",
);
export const DEFAULT_ISLANDWIDE_R2_BUCKET = "carearound-town-map-assets";
export const DEFAULT_ISLANDWIDE_R2_PREFIX = "v1/islandwide";
export const DEFAULT_ISLANDWIDE_PUBLIC_BASE_URL = "https://maps.carearound.sg/v1/islandwide";

const CHUNK_URL_PATTERN = /^chunks\/(?<fileName>z19-\d+-\d+-\d+-\d+\.jpg)$/;

function safeJoin(root, relativePath, label) {
  invariant(typeof relativePath === "string" && relativePath.trim(), `${label} is required`);
  invariant(!relativePath.startsWith("/") && !relativePath.includes("\\"), `Unsafe ${label}: ${relativePath}`);
  invariant(
    !relativePath.split("/").some((segment) => !segment || segment === "." || segment === ".."),
    `Unsafe ${label}: ${relativePath}`,
  );
  return path.join(root, relativePath);
}

function normalizeIslandwideStyle(style) {
  const normalized = String(style || "default").trim().toLowerCase();
  invariant(["default", "gray"].includes(normalized), `Unsupported islandwide map style: ${style}`);
  return normalized;
}

function getManifestRootForStyle(manifestRoot, style) {
  const rootName = path.basename(manifestRoot).toLowerCase();
  if (["default", "gray"].includes(rootName)) {
    return path.join(path.dirname(manifestRoot), style);
  }
  return style === "gray" ? path.join(manifestRoot, "gray") : manifestRoot;
}

function getPrefixForStyle(prefix, style) {
  if (style !== "gray") return prefix;
  const normalizedPrefix = normalizeR2Prefix(prefix);
  const prefixName = path.posix.basename(normalizedPrefix).toLowerCase();
  if (prefixName === "gray") return normalizedPrefix;
  if (prefixName === "default") {
    return path.posix.join(path.posix.dirname(normalizedPrefix), "gray");
  }
  return `${normalizedPrefix}/gray`;
}

async function getSourceChunkRootForSurface({
  sourceRoot,
  style,
  manifest,
  surface,
  styleManifestRoot,
}) {
  const retainedScale = Number(manifest.source?.retainedScale);
  const jpegQuality = Number(manifest.source?.jpegQuality || 95);
  const mapId = manifest.map?.id;
  invariant(mapId, "Surface manifest is missing a map ID");
  invariant(Number.isFinite(retainedScale), `${mapId} retained scale is missing`);
  invariant(Number.isFinite(jpegQuality), `${mapId} JPEG quality is missing`);

  const packagedChunkRoot = path.join(styleManifestRoot, surface.assetBasePath, "chunks");
  try {
    const packagedChunkRootStats = await stat(packagedChunkRoot);
    if (packagedChunkRootStats.isDirectory()) return packagedChunkRoot;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const collectionChunkRoot = style === "gray"
    ? path.join(sourceRoot, "output/static-town-maps-grey/assets/chunks")
    : path.join(sourceRoot, "output/static-town-maps/production-pilots/chunks");
  return path.join(
    collectionChunkRoot,
    `${mapId}-s${Math.round(retainedScale * 100)}-q${jpegQuality}`,
  );
}

export function validateIslandwideIndexBuffer(indexBuffer, { style = "default" } = {}) {
  const normalizedStyle = normalizeIslandwideStyle(style);
  const index = parseFixedTownSurfaceIndex(JSON.parse(Buffer.from(indexBuffer).toString("utf8")));
  invariant(index, "Islandwide index manifest is invalid");
  invariant(index.collection?.style === normalizedStyle, `Expected ${normalizedStyle} islandwide index`);
  invariant(index.surfaces.length === 32, "Islandwide index must contain 32 town surfaces");
  return {
    index,
    indexSha256: sha256(indexBuffer),
    chunkCount: index.transport?.chunkCount || 0,
    totalBytes: index.transport?.totalBytes || 0,
  };
}

export function validateIslandwideSurfaceManifestBuffer(manifestBuffer, { style = "default" } = {}) {
  const normalizedStyle = normalizeIslandwideStyle(style);
  const manifest = parseFixedTownSurfaceManifest(JSON.parse(Buffer.from(manifestBuffer).toString("utf8")));
  invariant(manifest, "Islandwide surface manifest is invalid");
  invariant((manifest.map?.style || "default") === normalizedStyle, `Expected ${normalizedStyle} surface manifest`);
  return {
    manifest,
    manifestSha256: sha256(manifestBuffer),
    totalBytes: manifest.transport.totalBytes,
  };
}

export async function loadIslandwideR2DeploymentPlan({
  style = "default",
  manifestRoot = DEFAULT_ISLANDWIDE_MANIFEST_ROOT,
  sourceRoot = DEFAULT_ISLANDWIDE_SOURCE_ROOT,
  prefix = DEFAULT_ISLANDWIDE_R2_PREFIX,
} = {}) {
  const normalizedStyle = normalizeIslandwideStyle(style);
  const normalizedPrefix = normalizeR2Prefix(getPrefixForStyle(prefix, normalizedStyle));
  const resolvedManifestRoot = path.resolve(manifestRoot);
  const resolvedStyleManifestRoot = getManifestRootForStyle(resolvedManifestRoot, normalizedStyle);
  const resolvedSourceRoot = path.resolve(sourceRoot);
  const indexPath = path.join(resolvedStyleManifestRoot, "manifest.json");
  const indexBuffer = await readFile(indexPath);
  const validatedIndex = validateIslandwideIndexBuffer(indexBuffer, { style: normalizedStyle });

  const chunkObjects = [];
  const manifestObjects = [];
  const seenKeys = new Set();
  const addObject = (object) => {
    invariant(!seenKeys.has(object.key), `Duplicate R2 object key: ${object.key}`);
    seenKeys.add(object.key);
    return object;
  };

  for (const surface of validatedIndex.index.surfaces) {
    const manifestPath = safeJoin(resolvedStyleManifestRoot, surface.manifestPath, "surface manifest path");
    const manifestBuffer = await readFile(manifestPath);
    const validatedManifest = validateIslandwideSurfaceManifestBuffer(manifestBuffer, {
      style: normalizedStyle,
    });
    const manifest = validatedManifest.manifest;
    invariant(manifest.map.id === surface.id, `Index and manifest ID mismatch for ${surface.id}`);
    invariant(validatedManifest.manifestSha256 === surface.manifestSha256, `${surface.id} manifest hash drifted from index`);
    invariant(manifest.integrity.chunkSetSha256 === surface.chunkSetSha256, `${surface.id} chunk-set hash drifted from index`);
    invariant(manifest.transport.totalBytes === surface.totalBytes, `${surface.id} byte total drifted from index`);

    const chunkRoot = await getSourceChunkRootForSurface({
      sourceRoot: resolvedSourceRoot,
      style: normalizedStyle,
      manifest,
      surface,
      styleManifestRoot: resolvedStyleManifestRoot,
    });
    const sourceFileNames = (await readdir(chunkRoot))
      .filter((fileName) => fileName.endsWith(".jpg"))
      .sort();
    const manifestFileNames = manifest.chunks.map((chunk) => {
      const match = CHUNK_URL_PATTERN.exec(chunk.url || "");
      invariant(match?.groups?.fileName, `Unsafe chunk URL in ${surface.id}: ${chunk.url}`);
      return match.groups.fileName;
    }).sort();
    invariant(
      JSON.stringify(sourceFileNames) === JSON.stringify(manifestFileNames),
      `${surface.id} source directory does not match the manifest allowlist`,
    );

    for (const chunk of manifest.chunks) {
      const fileName = chunk.url.slice("chunks/".length);
      const filePath = path.join(chunkRoot, fileName);
      const fileStats = await stat(filePath);
      invariant(fileStats.isFile(), `Missing source chunk: ${surface.id}/${fileName}`);
      invariant(fileStats.size === chunk.byteSize, `${surface.id}/${fileName} byte size drifted`);
      const fileBuffer = await readFile(filePath);
      invariant(sha256(fileBuffer) === chunk.sha256, `${surface.id}/${fileName} hash drifted`);
      chunkObjects.push(addObject({
        key: `${normalizedPrefix}/${surface.assetBasePath}/chunks/${fileName}`,
        filePath,
        byteSize: chunk.byteSize,
        sha256: chunk.sha256,
        contentType: "image/jpeg",
        cacheControl: "public, max-age=31536000, immutable",
      }));
    }

    manifestObjects.push(addObject({
      key: `${normalizedPrefix}/${surface.manifestPath}`,
      filePath: manifestPath,
      byteSize: manifestBuffer.length,
      sha256: validatedManifest.manifestSha256,
      contentType: "application/json; charset=utf-8",
      cacheControl: "public, max-age=300, must-revalidate",
    }));
  }

  invariant(chunkObjects.length === validatedIndex.chunkCount, "Chunk object count does not match islandwide index");
  invariant(
    chunkObjects.reduce((sum, object) => sum + object.byteSize, 0) === validatedIndex.totalBytes,
    "Chunk object bytes do not match islandwide index",
  );

  return {
    style: normalizedStyle,
    collectionId: validatedIndex.index.collection.id,
    version: validatedIndex.index.collection.version,
    prefix: normalizedPrefix,
    indexSha256: validatedIndex.indexSha256,
    surfaceCount: validatedIndex.index.surfaces.length,
    chunkCount: chunkObjects.length,
    totalBytes: validatedIndex.totalBytes,
    chunkObjects,
    manifestObjects,
    indexObject: addObject({
      key: `${normalizedPrefix}/manifest.json`,
      filePath: indexPath,
      byteSize: indexBuffer.length,
      sha256: validatedIndex.indexSha256,
      contentType: "application/json; charset=utf-8",
      cacheControl: "public, max-age=300, must-revalidate",
    }),
  };
}

export { invariant, mapWithConcurrency, sha256 };
