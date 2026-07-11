#!/usr/bin/env node

import { performance } from "node:perf_hooks";
import {
  DEFAULT_W01_PUBLIC_BASE_URL,
  mapWithConcurrency,
  sha256,
  validateW01ManifestBuffer,
} from "./r2-w01-lib.mjs";
import {
  DEFAULT_W01_GRAY_PUBLIC_BASE_URL,
  validateW01GrayManifestBuffer,
} from "./r2-w01-gray-lib.mjs";

const STYLE = process.argv.find((argument) => argument.startsWith("--style="))?.slice(8)
  || process.env.TOWN_MAP_STYLE
  || "default";
if (!["default", "gray"].includes(STYLE)) {
  throw new Error(`Unsupported town-map style: ${STYLE}`);
}
const gray = STYLE === "gray";

const BASE_URL = String(
  process.argv.find((argument) => argument.startsWith("--base-url="))?.slice(11) ||
    process.env.TOWN_MAP_PUBLIC_BASE_URL ||
    (gray ? DEFAULT_W01_GRAY_PUBLIC_BASE_URL : DEFAULT_W01_PUBLIC_BASE_URL),
).replace(/\/+$/, "");
const ORIGIN =
  process.env.TOWN_MAP_VERIFY_ORIGIN || "https://app.carearound.sg";
const CONCURRENCY = Number(process.env.TOWN_MAP_VERIFY_CONCURRENCY || "8");

if (!BASE_URL.startsWith("https://")) {
  throw new Error(`Public W01 base URL must use HTTPS: ${BASE_URL}`);
}

function percentile(values, percentileValue) {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1),
  );
  return sorted[index];
}

async function fetchObject(url, expected, { cors = false } = {}) {
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

async function main() {
  const manifestUrl = `${BASE_URL}/manifest.json`;
  const manifestResult = await fetchObject(manifestUrl, {}, { cors: true });
  const validateManifest = gray ? validateW01GrayManifestBuffer : validateW01ManifestBuffer;
  const validated = validateManifest(manifestResult.buffer);
  if (![ORIGIN, "*"].includes(manifestResult.corsAllowOrigin)) {
    throw new Error(
      `Manifest CORS did not allow ${ORIGIN}; received ${manifestResult.corsAllowOrigin || "no header"}`,
    );
  }
  if (!manifestResult.contentType.toLowerCase().includes("application/json")) {
    throw new Error(`Unexpected manifest content type: ${manifestResult.contentType}`);
  }
  if (!/max-age=300/i.test(manifestResult.cacheControl)) {
    throw new Error(`Manifest is missing the short rollback cache policy: ${manifestResult.cacheControl}`);
  }

  const timings = [];
  let totalBytes = 0;
  const results = await mapWithConcurrency(
    validated.manifest.chunks,
    CONCURRENCY,
    async (chunk, index) => {
      const result = await fetchObject(`${BASE_URL}/${chunk.url}`, chunk, {
        cors: index === 0,
      });
      if (!result.contentType.toLowerCase().includes("image/jpeg")) {
        throw new Error(`Unexpected chunk content type for ${chunk.url}: ${result.contentType}`);
      }
      if (!/max-age=31536000/i.test(result.cacheControl) || !/immutable/i.test(result.cacheControl)) {
        throw new Error(`Chunk is missing immutable cache metadata: ${chunk.url}`);
      }
      if (index === 0 && ![ORIGIN, "*"].includes(result.corsAllowOrigin)) {
        throw new Error(`Chunk CORS did not allow ${ORIGIN}`);
      }
      timings.push(result.durationMs);
      totalBytes += result.buffer.length;
      return result;
    },
  );

  if (totalBytes !== validated.totalBytes) {
    throw new Error(`Downloaded ${totalBytes} chunk bytes; expected ${validated.totalBytes}`);
  }

  console.log(
    JSON.stringify(
      {
        status: "verified",
        style: STYLE,
        baseUrl: BASE_URL,
        mapId: validated.manifest.map.id,
        version: validated.manifest.map.version,
        manifestSha256: validated.manifestSha256,
        manifestCacheControl: manifestResult.cacheControl,
        corsAllowOrigin: manifestResult.corsAllowOrigin,
        chunks: results.length,
        chunkBytes: totalBytes,
        chunkSetSha256: validated.manifest.integrity.chunkSetSha256,
        performanceMs: {
          manifest: Number(manifestResult.durationMs.toFixed(1)),
          chunkMedian: Number(percentile(timings, 50).toFixed(1)),
          chunkP95: Number(percentile(timings, 95).toFixed(1)),
          chunkMax: Number(Math.max(...timings).toFixed(1)),
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(`W01 public verification failed: ${error.message}`);
  process.exitCode = 1;
});
