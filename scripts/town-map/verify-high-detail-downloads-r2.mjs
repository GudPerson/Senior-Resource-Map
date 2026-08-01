#!/usr/bin/env node

import { createHash } from "node:crypto";

import {
  DEFAULT_HIGH_DETAIL_DOWNLOADS_OUTPUT_ROOT,
  DEFAULT_HIGH_DETAIL_DOWNLOADS_PUBLIC_BASE_URL,
  DEFAULT_HIGH_DETAIL_DOWNLOADS_R2_PREFIX,
  DEFAULT_HIGH_DETAIL_DOWNLOADS_SOURCE_ROOT,
  HIGH_DETAIL_DOWNLOADS_ALLOWED_ORIGINS,
  invariant,
  loadHighDetailDownloadsPlan,
  mapWithConcurrency,
  validateHighDetailDownloadsCatalogue,
} from "./high-detail-downloads-lib.mjs";

function argumentValue(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((argument) => argument.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

const FULL = process.argv.includes("--full");
const WITHOUT_CATALOGUE = process.argv.includes("--without-catalogue");
const PREFIX = argumentValue("prefix", process.env.TOWN_MAP_DOWNLOAD_R2_PREFIX || DEFAULT_HIGH_DETAIL_DOWNLOADS_R2_PREFIX);
const BASE_URL = String(argumentValue("base-url", process.env.TOWN_MAP_DOWNLOAD_PUBLIC_BASE_URL || DEFAULT_HIGH_DETAIL_DOWNLOADS_PUBLIC_BASE_URL)).replace(/\/+$/, "");
const CONCURRENCY = Number(argumentValue("concurrency", process.env.TOWN_MAP_DOWNLOAD_VERIFY_CONCURRENCY || "2"));
const ORIGIN = argumentValue("origin", process.env.TOWN_MAP_DOWNLOAD_VERIFY_ORIGIN || HIGH_DETAIL_DOWNLOADS_ALLOWED_ORIGINS[0]);
const RANGE_BYTES = Number(argumentValue("range-bytes", process.env.TOWN_MAP_DOWNLOAD_VERIFY_RANGE_BYTES || String(8 * 1024 * 1024)));
const FULL_GET_TIMEOUT_MS = Number(argumentValue("full-get-timeout-ms", process.env.TOWN_MAP_DOWNLOAD_VERIFY_FULL_GET_TIMEOUT_MS || "300000"));
invariant(Number.isSafeInteger(CONCURRENCY) && CONCURRENCY >= 1 && CONCURRENCY <= 4, "Verification concurrency must be between 1 and 4");
invariant(Number.isSafeInteger(RANGE_BYTES) && RANGE_BYTES >= 1024 * 1024 && RANGE_BYTES <= 32 * 1024 * 1024, "Verification range size must be between 1 MiB and 32 MiB");
invariant(Number.isSafeInteger(FULL_GET_TIMEOUT_MS) && FULL_GET_TIMEOUT_MS >= 60000 && FULL_GET_TIMEOUT_MS <= 900000, "Full GET timeout must be between 60 and 900 seconds");
invariant(!WITHOUT_CATALOGUE || FULL, "Partial-prefix verification requires --full");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertCommonHeaders(response, object) {
  invariant(response.ok, `${object.key} returned HTTP ${response.status}`);
  invariant(Number(response.headers.get("content-length")) === object.byteSize, `${object.key} Content-Length is incorrect`);
  invariant((response.headers.get("content-type") || "").toLowerCase().includes(object.contentType.split(";")[0]), `${object.key} MIME type is incorrect`);
  invariant((response.headers.get("cache-control") || "").toLowerCase() === object.cacheControl.toLowerCase(), `${object.key} cache policy is incorrect`);
  invariant([ORIGIN, "*"].includes(response.headers.get("access-control-allow-origin") || ""), `${object.key} CORS does not allow ${ORIGIN}`);
  if (object.contentDisposition) {
    invariant(response.headers.get("content-disposition") === object.contentDisposition, `${object.key} Content-Disposition is incorrect`);
  }
}

async function headObject(plan, object) {
  const relative = object.key.slice(plan.prefix.length + 1);
  let lastError;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const response = await fetch(`${plan.publicBaseUrl}/${relative}?carearound-verify=${object.sha256.slice(0, 16)}-${attempt}`, {
        method: "HEAD",
        cache: "no-store",
        headers: { "Accept-Encoding": "identity", "Cache-Control": "no-cache", Origin: ORIGIN },
        signal: AbortSignal.timeout(15000),
      });
      assertCommonHeaders(response, object);
      return;
    } catch (error) {
      lastError = error;
      await wait(Math.min(4000, 500 * (attempt + 1)));
    }
  }
  throw new Error(`${object.key} HEAD verification failed: ${lastError.message}`);
}

async function fetchObjectRange(plan, object, start, end) {
  const relative = object.key.slice(plan.prefix.length + 1);
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(`${plan.publicBaseUrl}/${relative}?carearound-range-hash=${object.sha256.slice(0, 16)}-${start}`, {
        cache: "no-store",
        headers: {
          "Accept-Encoding": "identity",
          "Cache-Control": "no-cache",
          Origin: ORIGIN,
          Range: `bytes=${start}-${end}`,
        },
        signal: AbortSignal.timeout(120000),
      });
      const expectedBytes = end - start + 1;
      invariant(response.status === 206, `${object.key} range ${start}-${end} returned HTTP ${response.status}`);
      invariant(response.headers.get("content-range") === `bytes ${start}-${end}/${object.byteSize}`, `${object.key} range ${start}-${end} Content-Range is incorrect`);
      invariant(Number(response.headers.get("content-length")) === expectedBytes, `${object.key} range ${start}-${end} Content-Length is incorrect`);
      invariant((response.headers.get("content-type") || "").toLowerCase().includes(object.contentType.split(";")[0]), `${object.key} MIME type is incorrect`);
      invariant((response.headers.get("cache-control") || "").toLowerCase() === object.cacheControl.toLowerCase(), `${object.key} cache policy is incorrect`);
      invariant([ORIGIN, "*"].includes(response.headers.get("access-control-allow-origin") || ""), `${object.key} CORS does not allow ${ORIGIN}`);
      if (object.contentDisposition) {
        invariant(response.headers.get("content-disposition") === object.contentDisposition, `${object.key} Content-Disposition is incorrect`);
      }
      const body = Buffer.from(await response.arrayBuffer());
      invariant(body.length === expectedBytes, `${object.key} range ${start}-${end} body length is incorrect`);
      return body;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`${object.key} range ${start}-${end} could not be verified: ${lastError.message}`);
}

async function verifyObjectWithRanges(plan, object) {
  const hash = createHash("sha256");
  let receivedBytes = 0;
  for (let start = 0; start < object.byteSize; start += RANGE_BYTES) {
    const end = Math.min(object.byteSize - 1, start + RANGE_BYTES - 1);
    const body = await fetchObjectRange(plan, object, start, end);
    hash.update(body);
    receivedBytes += body.length;
  }
  invariant(receivedBytes === object.byteSize, `${object.key} downloaded byte size is incorrect`);
  invariant(hash.digest("hex") === object.sha256, `${object.key} downloaded SHA-256 is incorrect`);
  return receivedBytes;
}

async function verifyObjectWithFullGet(plan, object) {
  const relative = object.key.slice(plan.prefix.length + 1);
  const url = `${plan.publicBaseUrl}/${relative}`;
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        headers: { "Accept-Encoding": "identity", Origin: ORIGIN },
        signal: AbortSignal.timeout(FULL_GET_TIMEOUT_MS),
      });
      assertCommonHeaders(response, object);
      invariant(response.body, `${object.key} response body is missing`);
      const hash = createHash("sha256");
      let receivedBytes = 0;
      for await (const chunk of response.body) {
        hash.update(chunk);
        receivedBytes += chunk.length;
      }
      invariant(receivedBytes === object.byteSize, `${object.key} downloaded byte size is incorrect`);
      invariant(hash.digest("hex") === object.sha256, `${object.key} downloaded SHA-256 is incorrect`);
      return receivedBytes;
    } catch (error) {
      lastError = error;
      await wait(Math.min(4000, 1000 * (attempt + 1)));
    }
  }
  throw new Error(`${object.key} full GET could not be verified: ${lastError.message}`);
}

async function verifyFullObject(plan, object) {
  return object.contentType === "application/pdf"
    ? verifyObjectWithRanges(plan, object)
    : verifyObjectWithFullGet(plan, object);
}

async function verifyPdfRange(plan, object) {
  const body = await fetchObjectRange(plan, object, 0, 1023);
  invariant(body.length === 1024 && body.subarray(0, 5).toString("ascii") === "%PDF-", `${object.key} range body is not a PDF`);
}

function representativeDownloads(objects) {
  const pngs = objects.filter((object) => object.contentType === "image/png");
  const pdfs = objects.filter((object) => object.contentType === "application/pdf");
  const sample = (items) => [items[0], items[Math.floor(items.length / 2)], items.at(-1)];
  return [...sample(pngs), ...sample(pdfs)];
}

async function main() {
  const plan = await loadHighDetailDownloadsPlan({
    sourceRoot: argumentValue("source-root", process.env.TOWN_MAP_DOWNLOAD_SOURCE_ROOT || DEFAULT_HIGH_DETAIL_DOWNLOADS_SOURCE_ROOT),
    outputRoot: argumentValue("output-root", process.env.TOWN_MAP_DOWNLOAD_OUTPUT_ROOT || DEFAULT_HIGH_DETAIL_DOWNLOADS_OUTPUT_ROOT),
    prefix: PREFIX,
    publicBaseUrl: BASE_URL,
    writeMetadata: true,
  });
  const existingObjects = [...plan.downloadObjects, ...plan.thumbnailObjects, ...plan.metadataObjects];
  const allObjects = WITHOUT_CATALOGUE ? existingObjects : [...existingObjects, plan.catalogueObject];
  await mapWithConcurrency(allObjects, Math.min(CONCURRENCY * 2, 4), (object) => headObject(plan, object));

  let catalogueBytes = 0;
  if (WITHOUT_CATALOGUE) {
    const catalogueResponse = await fetch(`${plan.publicBaseUrl}/catalogue.json?carearound-catalogue-absent=${plan.catalogueObject.sha256.slice(0, 16)}`, {
      method: "HEAD",
      cache: "no-store",
      headers: { "Accept-Encoding": "identity", "Cache-Control": "no-cache", Origin: ORIGIN },
    });
    invariant(catalogueResponse.status === 404, `Unpublished catalogue returned HTTP ${catalogueResponse.status}`);
  } else {
    const catalogueResponse = await fetch(`${plan.publicBaseUrl}/catalogue.json?carearound-catalogue-verify=${plan.catalogueObject.sha256.slice(0, 16)}`, {
      cache: "no-store",
      headers: { "Accept-Encoding": "identity", "Cache-Control": "no-cache", Origin: ORIGIN },
    });
    assertCommonHeaders(catalogueResponse, plan.catalogueObject);
    const catalogueBuffer = Buffer.from(await catalogueResponse.arrayBuffer());
    invariant(createHash("sha256").update(catalogueBuffer).digest("hex") === plan.catalogueObject.sha256, "Remote catalogue SHA-256 is incorrect");
    validateHighDetailDownloadsCatalogue(JSON.parse(catalogueBuffer.toString("utf8")), { expectedBaseUrl: plan.publicBaseUrl });
    catalogueBytes = catalogueBuffer.length;
  }

  const pdfObjects = plan.downloadObjects.filter((object) => object.contentType === "application/pdf");
  await mapWithConcurrency(pdfObjects, Math.min(CONCURRENCY, 3), (object) => verifyPdfRange(plan, object));

  const selectedDownloads = FULL ? plan.downloadObjects : representativeDownloads(plan.downloadObjects);
  const alwaysFull = [...plan.thumbnailObjects, ...plan.metadataObjects];
  let verifiedBytes = catalogueBytes;
  let verifiedObjects = 0;
  await mapWithConcurrency([...alwaysFull, ...selectedDownloads], CONCURRENCY, async (object) => {
    verifiedBytes += await verifyFullObject(plan, object);
    verifiedObjects += 1;
    if (verifiedObjects === 1 || verifiedObjects % 8 === 0 || verifiedObjects === alwaysFull.length + selectedDownloads.length) {
      console.log(`Hash verified ${verifiedObjects}/${alwaysFull.length + selectedDownloads.length} objects`);
    }
  });

  console.log(JSON.stringify({
    status: WITHOUT_CATALOGUE ? "partial-prefix-verified" : "verified",
    mode: FULL ? "complete" : "representative",
    baseUrl: plan.publicBaseUrl,
    prefix: plan.prefix,
    catalogueSha256: plan.catalogueObject.sha256,
    maps: plan.mapCount,
    objectsHeadVerified: allObjects.length,
    thumbnailsHashVerified: plan.thumbnailObjects.length,
    downloadsHashVerified: selectedDownloads.length,
    pdfRangeRequestsVerified: pdfObjects.length,
    bytesHashVerified: verifiedBytes,
    cataloguePublished: !WITHOUT_CATALOGUE,
    corsOrigin: ORIGIN,
  }, null, 2));
}

main().catch((error) => {
  console.error(`High-detail town-map remote verification failed: ${error.message}`);
  process.exitCode = 1;
});
