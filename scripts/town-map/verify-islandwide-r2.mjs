#!/usr/bin/env node

import { performance } from "node:perf_hooks";
import {
  DEFAULT_ISLANDWIDE_PUBLIC_BASE_URL,
  invariant,
  mapWithConcurrency,
  sha256,
  validateIslandwideIndexBuffer,
  validateIslandwideSurfaceManifestBuffer,
} from "./r2-islandwide-lib.mjs";

function argumentValue(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((argument) => argument.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

const STYLE = argumentValue("style", process.env.TOWN_MAP_STYLE || "default");
invariant(["default", "gray"].includes(STYLE), `Unsupported islandwide map style: ${STYLE}`);
const FULL = process.argv.includes("--full");
const SAMPLE_SIZE = Number(argumentValue("sample-size", process.env.TOWN_MAP_VERIFY_SAMPLE_SIZE || "3"));
const BASE_URL = String(
  argumentValue(
    "base-url",
    process.env.TOWN_MAP_PUBLIC_BASE_URL ||
      (STYLE === "gray"
        ? `${DEFAULT_ISLANDWIDE_PUBLIC_BASE_URL}/gray`
        : DEFAULT_ISLANDWIDE_PUBLIC_BASE_URL),
  ),
).replace(/\/+$/, "");
const ORIGIN = process.env.TOWN_MAP_VERIFY_ORIGIN || "https://app.carearound.sg";
const CONCURRENCY = Number(process.env.TOWN_MAP_VERIFY_CONCURRENCY || "8");
const EXPECTED_SURFACE_COUNT = Number(argumentValue(
  "surface-count",
  process.env.TOWN_MAP_EXPECTED_SURFACE_COUNT || "32",
));

invariant(BASE_URL.startsWith("https://") || process.argv.includes("--allow-http"), `Public islandwide base URL must use HTTPS: ${BASE_URL}`);
invariant(Number.isSafeInteger(CONCURRENCY) && CONCURRENCY >= 1 && CONCURRENCY <= 16, "Verify concurrency must be between 1 and 16");
invariant(Number.isSafeInteger(SAMPLE_SIZE) && SAMPLE_SIZE >= 1 && SAMPLE_SIZE <= 20, "Sample size must be between 1 and 20");
invariant(
  Number.isSafeInteger(EXPECTED_SURFACE_COUNT)
    && EXPECTED_SURFACE_COUNT >= 1
    && EXPECTED_SURFACE_COUNT <= 100,
  "Expected surface count must be between 1 and 100",
);

function percentile(values, percentileValue) {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1),
  );
  return sorted[index] || 0;
}

async function fetchObject(url, expected = {}, { cors = false } = {}) {
  const start = performance.now();
  const response = await fetch(url, {
    headers: {
      "Cache-Control": "no-cache",
      ...(cors ? { Origin: ORIGIN } : {}),
    },
  });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (expected.byteSize !== undefined && buffer.length !== expected.byteSize) {
    throw new Error(`${url} returned ${buffer.length} bytes; expected ${expected.byteSize}`);
  }
  if (expected.sha256 && sha256(buffer) !== expected.sha256) {
    throw new Error(`${url} failed SHA-256 verification`);
  }
  return {
    buffer,
    durationMs: performance.now() - start,
    contentType: response.headers.get("content-type") || "",
    cacheControl: response.headers.get("cache-control") || "",
    corsAllowOrigin: response.headers.get("access-control-allow-origin") || "",
    etag: response.headers.get("etag") || "",
  };
}

function sampleChunks(chunks) {
  if (FULL || chunks.length <= SAMPLE_SIZE) return chunks;
  const indexes = new Set([0, chunks.length - 1]);
  if (SAMPLE_SIZE > 2) indexes.add(Math.floor(chunks.length / 2));
  let cursor = 1;
  while (indexes.size < SAMPLE_SIZE && indexes.size < chunks.length) {
    indexes.add(Math.floor((cursor / (SAMPLE_SIZE - 1)) * (chunks.length - 1)));
    cursor += 1;
  }
  return [...indexes].sort((left, right) => left - right).map((index) => chunks[index]);
}

async function main() {
  const indexResult = await fetchObject(`${BASE_URL}/manifest.json`, {}, { cors: true });
  const validatedIndex = validateIslandwideIndexBuffer(indexResult.buffer, {
    style: STYLE,
    expectedSurfaceCount: EXPECTED_SURFACE_COUNT,
  });
  if (![ORIGIN, "*"].includes(indexResult.corsAllowOrigin)) {
    throw new Error(`Index CORS did not allow ${ORIGIN}; received ${indexResult.corsAllowOrigin || "no header"}`);
  }
  if (!indexResult.contentType.toLowerCase().includes("application/json")) {
    throw new Error(`Unexpected index content type: ${indexResult.contentType}`);
  }
  if (!/max-age=300|no-cache/i.test(indexResult.cacheControl)) {
    throw new Error(`Index is missing the short rollback cache policy: ${indexResult.cacheControl}`);
  }

  const chunkTimings = [];
  let verifiedChunkBytes = 0;
  let verifiedChunkCount = 0;
  const surfaceResults = await mapWithConcurrency(
    validatedIndex.index.surfaces,
    Math.min(CONCURRENCY, 8),
    async (surface, surfaceIndex) => {
      const manifestResult = await fetchObject(`${BASE_URL}/${surface.manifestPath}`, {
        byteSize: surface.manifestBytes,
        sha256: surface.manifestSha256,
      }, { cors: surfaceIndex === 0 });
      const validatedManifest = validateIslandwideSurfaceManifestBuffer(manifestResult.buffer, {
        style: STYLE,
      });
      const chunks = sampleChunks(validatedManifest.manifest.chunks);
      await mapWithConcurrency(chunks, Math.min(CONCURRENCY, chunks.length), async (chunk, chunkIndex) => {
        const chunkResult = await fetchObject(`${BASE_URL}/${surface.assetBasePath}/${chunk.url}`, chunk, {
          cors: surfaceIndex === 0 && chunkIndex === 0,
        });
        if (!chunkResult.contentType.toLowerCase().includes("image/jpeg")) {
          throw new Error(`Unexpected chunk content type for ${surface.id}/${chunk.url}: ${chunkResult.contentType}`);
        }
        if (!/max-age=31536000/i.test(chunkResult.cacheControl) || !/immutable/i.test(chunkResult.cacheControl)) {
          throw new Error(`Chunk is missing immutable cache metadata: ${surface.id}/${chunk.url}`);
        }
        chunkTimings.push(chunkResult.durationMs);
        verifiedChunkBytes += chunk.byteSize;
        verifiedChunkCount += 1;
      });
      return {
        id: surface.id,
        version: validatedManifest.manifest.map.version,
        chunksVerified: chunks.length,
        chunkBytes: chunks.reduce((sum, chunk) => sum + chunk.byteSize, 0),
      };
    },
  );

  console.log(JSON.stringify({
    status: "verified",
    style: STYLE,
    mode: FULL ? "full" : "sampled",
    baseUrl: BASE_URL,
    version: validatedIndex.index.collection.version,
    indexSha256: validatedIndex.indexSha256,
    indexCacheControl: indexResult.cacheControl,
    corsAllowOrigin: indexResult.corsAllowOrigin,
    surfaces: surfaceResults.length,
    chunksInIndex: validatedIndex.chunkCount,
    chunkBytesInIndex: validatedIndex.totalBytes,
    chunksVerified: verifiedChunkCount,
    chunkBytesVerified: verifiedChunkBytes,
    performanceMs: {
      index: Number(indexResult.durationMs.toFixed(1)),
      chunkMedian: Number(percentile(chunkTimings, 50).toFixed(1)),
      chunkP95: Number(percentile(chunkTimings, 95).toFixed(1)),
      chunkMax: Number(Math.max(0, ...chunkTimings).toFixed(1)),
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(`Islandwide public verification failed: ${error.message}`);
  process.exitCode = 1;
});
