#!/usr/bin/env node

import { performance } from "node:perf_hooks";
import { validatePrintMasterManifest } from "../../client/src/lib/printMasterSurface.js";
import {
  DEFAULT_PRINT_MASTER_PUBLIC_BASE_URL,
  invariant,
  mapWithConcurrency,
  sha256,
  validatePrintMasterWebIndexBuffer,
} from "./r2-print-master-lib.mjs";

function argumentValue(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((argument) => argument.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}
const STYLE = argumentValue("style", process.env.TOWN_MAP_STYLE || "default");
const BASE_URL = String(argumentValue("base-url", process.env.TOWN_MAP_PUBLIC_BASE_URL || `${DEFAULT_PRINT_MASTER_PUBLIC_BASE_URL}/${STYLE}`)).replace(/\/+$/, "");
const ORIGIN = process.env.TOWN_MAP_VERIFY_ORIGIN || "https://app.carearound.sg";
const FULL = process.argv.includes("--full");
const SAMPLE_SIZE = Number(argumentValue("sample-size", process.env.TOWN_MAP_VERIFY_SAMPLE_SIZE || "3"));
const CONCURRENCY = Number(process.env.TOWN_MAP_VERIFY_CONCURRENCY || "8");
invariant(BASE_URL.startsWith("https://") || process.argv.includes("--allow-http"), "Public print-master base URL must use HTTPS");

async function fetchObject(url, expected = {}, cors = false) {
  const started = performance.now();
  const response = await fetch(url, { headers: { "Cache-Control": "no-cache", ...(cors ? { Origin: ORIGIN } : {}) } });
  invariant(response.ok, `${url} returned HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (expected.byteSize !== undefined) invariant(buffer.length === expected.byteSize, `${url} byte size drifted`);
  if (expected.sha256) invariant(sha256(buffer) === expected.sha256, `${url} SHA-256 drifted`);
  return { buffer, durationMs: performance.now() - started, contentType: response.headers.get("content-type") || "", cacheControl: response.headers.get("cache-control") || "", cors: response.headers.get("access-control-allow-origin") || "" };
}
function sample(chunks) {
  if (FULL || chunks.length <= SAMPLE_SIZE) return chunks;
  const indexes = new Set([0, chunks.length - 1, Math.floor(chunks.length / 2)]);
  return [...indexes].slice(0, SAMPLE_SIZE).sort((a, b) => a - b).map((index) => chunks[index]);
}

const indexResult = await fetchObject(`${BASE_URL}/manifest.json`, {}, true);
invariant([ORIGIN, "*"].includes(indexResult.cors), `Index CORS did not allow ${ORIGIN}`);
invariant(indexResult.contentType.toLowerCase().includes("application/json"), "Index content type is not JSON");
const { index, indexSha256 } = validatePrintMasterWebIndexBuffer(indexResult.buffer, { style: STYLE });
let chunksVerified = 0; let bytesVerified = 0; const timings = [];
await mapWithConcurrency(index.surfaces, Math.min(CONCURRENCY, 8), async (surface, surfaceIndex) => {
  const manifestResult = await fetchObject(`${BASE_URL}/${surface.manifest}`, { byteSize: surface.manifest_bytes, sha256: surface.manifest_sha256 }, surfaceIndex === 0);
  const manifest = validatePrintMasterManifest(JSON.parse(manifestResult.buffer.toString("utf8")), { expectedSurfaceId: surface.id });
  await mapWithConcurrency(sample(manifest.chunks), Math.min(CONCURRENCY, manifest.chunks.length), async (chunk, chunkIndex) => {
    const result = await fetchObject(`${BASE_URL}/${chunk.url}`, { byteSize: Number(chunk.bytes), sha256: chunk.sha256 }, surfaceIndex === 0 && chunkIndex === 0);
    invariant(result.contentType.toLowerCase().includes("image/jpeg"), `${chunk.url} content type is not JPEG`);
    invariant(/max-age=31536000/i.test(result.cacheControl) && /immutable/i.test(result.cacheControl), `${chunk.url} lacks immutable caching`);
    chunksVerified += 1; bytesVerified += Number(chunk.bytes); timings.push(result.durationMs);
  });
});
timings.sort((a, b) => a - b);
const percentile = (p) => timings[Math.min(timings.length - 1, Math.max(0, Math.ceil((p / 100) * timings.length) - 1))] || 0;
console.log(JSON.stringify({ status: "verified", style: STYLE, mode: FULL ? "full" : "sampled", baseUrl: BASE_URL, version: index.version, indexSha256, surfaces: index.surface_count, chunksInIndex: index.chunk_count, chunkBytesInIndex: index.total_bytes, chunksVerified, bytesVerified, corsAllowOrigin: indexResult.cors, performanceMs: { index: Number(indexResult.durationMs.toFixed(1)), chunkMedian: Number(percentile(50).toFixed(1)), chunkP95: Number(percentile(95).toFixed(1)), chunkMax: Number(Math.max(0, ...timings).toFixed(1)) } }, null, 2));
