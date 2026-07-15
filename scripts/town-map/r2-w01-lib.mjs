import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");

export const DEFAULT_W01_SOURCE_ROOT = "/Users/sweetbuns/Documents/SG MAP";
export const DEFAULT_W01_MANIFEST_PATH = path.join(
  REPO_ROOT,
  "output/town-map-proof/assets/v1/w01/manifest.json",
);
export const DEFAULT_W01_R2_BUCKET = "carearound-town-map-assets";
export const DEFAULT_W01_R2_PREFIX = "v1/w01";
export const DEFAULT_W01_PUBLIC_BASE_URL = "https://maps.carearound.sg/v1/w01";

const EXPECTED_SCHEMA = "carearound.fixed-town-surface";
const EXPECTED_SCHEMA_VERSION = 1;
const EXPECTED_MAP_ID = "W01";
const EXPECTED_CHUNK_COUNT = 300;
const EXPECTED_CHUNK_SET_SHA256 =
  "81bd26441edaff1d761f9e395575f8e00b9303f25e1d7896307f7f3036bbc8c6";
const CHUNK_URL_PATTERN = /^chunks\/(?<fileName>z19-\d+-\d+-\d+-\d+\.jpg)$/;

export function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeR2Prefix(value) {
  const normalized = String(value || "")
    .trim()
    .replace(/^\/+|\/+$/g, "");
  invariant(normalized, "R2 object prefix is required");
  invariant(
    /^[a-z0-9][a-z0-9/_-]*[a-z0-9]$/.test(normalized),
    `Unsafe R2 object prefix: ${value}`,
  );
  invariant(
    !normalized.split("/").some((segment) => !segment || segment === "." || segment === ".."),
    `Unsafe R2 object prefix: ${value}`,
  );
  return normalized;
}

export function validateW01ManifestBuffer(manifestBuffer) {
  const manifest = JSON.parse(Buffer.from(manifestBuffer).toString("utf8"));
  invariant(
    manifest.schema === EXPECTED_SCHEMA &&
      manifest.schemaVersion === EXPECTED_SCHEMA_VERSION,
    `Expected ${EXPECTED_SCHEMA} v${EXPECTED_SCHEMA_VERSION}`,
  );
  invariant(manifest.map?.id === EXPECTED_MAP_ID, "Expected the W01 map manifest");
  invariant(
    /^w01-[a-z0-9-]+$/.test(manifest.map?.version || ""),
    "W01 manifest version is missing or unsafe",
  );
  invariant(
    Array.isArray(manifest.chunks) && manifest.chunks.length === EXPECTED_CHUNK_COUNT,
    `W01 manifest must contain ${EXPECTED_CHUNK_COUNT} chunks`,
  );
  invariant(
    manifest.integrity?.chunkSetSha256 === EXPECTED_CHUNK_SET_SHA256,
    "W01 chunk-set integrity version is not accepted",
  );

  const seenFileNames = new Set();
  let totalBytes = 0;
  const canonicalEntries = [];

  for (const chunk of manifest.chunks) {
    const match = CHUNK_URL_PATTERN.exec(chunk.url || "");
    invariant(match?.groups?.fileName, `Unsafe W01 chunk URL: ${chunk.url}`);
    const fileName = match.groups.fileName;
    invariant(!seenFileNames.has(fileName), `Duplicate W01 chunk: ${fileName}`);
    invariant(
      Number.isSafeInteger(chunk.byteSize) && chunk.byteSize > 0,
      `Invalid W01 chunk size: ${fileName}`,
    );
    invariant(/^[a-f0-9]{64}$/.test(chunk.sha256 || ""), `Invalid W01 chunk hash: ${fileName}`);
    seenFileNames.add(fileName);
    totalBytes += chunk.byteSize;
    canonicalEntries.push({ fileName, sha256: chunk.sha256 });
  }

  const chunkSetHash = sha256(
    canonicalEntries
      .sort((left, right) => left.fileName.localeCompare(right.fileName, "en"))
      .map((entry) => `${entry.sha256}  ${entry.fileName}\n`)
      .join(""),
  );
  invariant(chunkSetHash === EXPECTED_CHUNK_SET_SHA256, "W01 manifest chunk-set hash drifted");
  invariant(
    totalBytes === manifest.transport?.totalBytes &&
      totalBytes === manifest.integrity?.chunkBytes,
    "W01 manifest byte totals do not agree",
  );

  return {
    manifest,
    manifestSha256: sha256(manifestBuffer),
    totalBytes,
  };
}

export async function loadW01R2DeploymentPlan({
  manifestPath = DEFAULT_W01_MANIFEST_PATH,
  sourceRoot = DEFAULT_W01_SOURCE_ROOT,
  prefix = DEFAULT_W01_R2_PREFIX,
} = {}) {
  const normalizedPrefix = normalizeR2Prefix(prefix);
  const resolvedManifestPath = path.resolve(manifestPath);
  const resolvedSourceRoot = path.resolve(sourceRoot);
  const chunkRoot = path.join(
    resolvedSourceRoot,
    "output/static-town-maps/production-pilots/chunks/W01-s50-q95",
  );
  const manifestBuffer = await readFile(resolvedManifestPath);
  const validated = validateW01ManifestBuffer(manifestBuffer);
  const sourceFileNames = (await readdir(chunkRoot))
    .filter((fileName) => fileName.endsWith(".jpg"))
    .sort();
  const manifestFileNames = validated.manifest.chunks
    .map((chunk) => chunk.url.slice("chunks/".length))
    .sort();
  invariant(
    JSON.stringify(sourceFileNames) === JSON.stringify(manifestFileNames),
    "The W01 source directory does not exactly match the manifest allowlist",
  );

  const chunkObjects = [];
  for (const chunk of validated.manifest.chunks) {
    const fileName = chunk.url.slice("chunks/".length);
    const filePath = path.join(chunkRoot, fileName);
    const fileStats = await stat(filePath);
    invariant(fileStats.isFile(), `Missing W01 source chunk: ${fileName}`);
    invariant(fileStats.size === chunk.byteSize, `W01 source size drifted: ${fileName}`);
    const fileBuffer = await readFile(filePath);
    invariant(sha256(fileBuffer) === chunk.sha256, `W01 source hash drifted: ${fileName}`);
    chunkObjects.push({
      key: `${normalizedPrefix}/chunks/${fileName}`,
      filePath,
      byteSize: chunk.byteSize,
      sha256: chunk.sha256,
      contentType: "image/jpeg",
      cacheControl: "public, max-age=31536000, immutable",
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
      contentType: "application/json; charset=utf-8",
      cacheControl: "public, max-age=300, must-revalidate",
    },
  };
}

export async function mapWithConcurrency(items, concurrency, worker) {
  invariant(Number.isSafeInteger(concurrency) && concurrency >= 1, "Concurrency must be positive");
  const results = new Array(items.length);
  let nextIndex = 0;

  async function run() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => run()),
  );
  return results;
}
