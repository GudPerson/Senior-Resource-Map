#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_HIGH_DETAIL_DOWNLOADS_OUTPUT_ROOT,
  DEFAULT_HIGH_DETAIL_DOWNLOADS_R2_BUCKET,
  DEFAULT_HIGH_DETAIL_DOWNLOADS_R2_PREFIX,
  DEFAULT_HIGH_DETAIL_DOWNLOADS_SOURCE_ROOT,
  HIGH_DETAIL_DOWNLOADS_ALLOWED_ORIGINS,
  assertRemoteObjectVacant,
  assertRemotePrefixVacant,
  invariant,
  loadHighDetailDownloadsPlan,
  mapWithConcurrency,
} from "./high-detail-downloads-lib.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const APPLY = process.argv.includes("--apply");

function argumentValue(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((argument) => argument.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

const BUCKET = argumentValue("bucket", process.env.TOWN_MAP_DOWNLOAD_R2_BUCKET || DEFAULT_HIGH_DETAIL_DOWNLOADS_R2_BUCKET);
const PREFIX = argumentValue("prefix", process.env.TOWN_MAP_DOWNLOAD_R2_PREFIX || DEFAULT_HIGH_DETAIL_DOWNLOADS_R2_PREFIX);
const SOURCE_ROOT = argumentValue("source-root", process.env.TOWN_MAP_DOWNLOAD_SOURCE_ROOT || DEFAULT_HIGH_DETAIL_DOWNLOADS_SOURCE_ROOT);
const OUTPUT_ROOT = argumentValue("output-root", process.env.TOWN_MAP_DOWNLOAD_OUTPUT_ROOT || DEFAULT_HIGH_DETAIL_DOWNLOADS_OUTPUT_ROOT);
const PUBLIC_BASE_URL = argumentValue("public-base-url", process.env.TOWN_MAP_DOWNLOAD_PUBLIC_BASE_URL);
const CONCURRENCY = Number(argumentValue("concurrency", process.env.TOWN_MAP_DOWNLOAD_R2_CONCURRENCY || "2"));
const PUT_RETRIES = Number(argumentValue("put-retries", process.env.TOWN_MAP_DOWNLOAD_R2_PUT_RETRIES || "3"));
const CANARY_TIMEOUT_MS = Number(argumentValue("canary-timeout-ms", process.env.TOWN_MAP_DOWNLOAD_CANARY_TIMEOUT_MS || "240000"));
const WRANGLER_BIN = argumentValue("wrangler-bin", process.env.WRANGLER_BIN || "npx");

invariant(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(BUCKET), `Unsafe R2 bucket name: ${BUCKET}`);
invariant(Number.isSafeInteger(CONCURRENCY) && CONCURRENCY >= 1 && CONCURRENCY <= 4, "Upload concurrency must be between 1 and 4");
invariant(Number.isSafeInteger(PUT_RETRIES) && PUT_RETRIES >= 0 && PUT_RETRIES <= 8, "PUT retries must be between 0 and 8");
invariant(Number.isSafeInteger(CANARY_TIMEOUT_MS) && CANARY_TIMEOUT_MS >= 60000 && CANARY_TIMEOUT_MS <= 600000, "Canary timeout must be between 60 and 600 seconds");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runCommand(command, args, { inherit = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: REPO_ROOT,
      env: process.env,
      stdio: inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    if (!inherit) {
      child.stdout.on("data", (chunk) => { stdout += chunk; });
      child.stderr.on("data", (chunk) => { stderr += chunk; });
    }
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`${command} exited ${code}\n${stdout}\n${stderr}`));
    });
  });
}

async function verifyWranglerAuthentication() {
  const args = path.basename(WRANGLER_BIN) === "npx" ? ["wrangler", "whoami"] : ["whoami"];
  await runCommand(WRANGLER_BIN, args, { inherit: true });
}

function wranglerPutArgs(object) {
  const args = [
    "r2", "object", "put", `${BUCKET}/${object.key}`,
    "--remote",
    "--file", object.filePath,
    "--content-type", object.contentType,
    "--cache-control", object.cacheControl,
    "--force",
  ];
  if (object.contentDisposition) {
    args.push("--content-disposition", object.contentDisposition);
  }
  return path.basename(WRANGLER_BIN) === "npx" ? ["wrangler", ...args] : args;
}

async function putObject(plan, object) {
  let lastError;
  for (let attempt = 0; attempt <= PUT_RETRIES; attempt += 1) {
    await assertRemoteObjectVacant(plan, object);
    try {
      await runCommand(WRANGLER_BIN, wranglerPutArgs(object));
      return;
    } catch (error) {
      lastError = error;
      if (attempt >= PUT_RETRIES) break;
      const delayMs = Math.min(8000, 1000 * (2 ** attempt));
      console.warn(`Retrying ${object.key} after failed PUT attempt ${attempt + 1}/${PUT_RETRIES + 1}`);
      await wait(delayMs);
    }
  }
  throw new Error(`R2 upload failed for ${object.key}: ${lastError.message}`);
}

async function uploadGroup(plan, label, objects) {
  let uploaded = 0;
  await mapWithConcurrency(objects, CONCURRENCY, async (object) => {
    await putObject(plan, object);
    uploaded += 1;
    if (uploaded === 1 || uploaded % 8 === 0 || uploaded === objects.length) {
      console.log(`Uploaded ${uploaded}/${objects.length} ${label}`);
    }
  });
}

async function waitForPublicObject(plan, object) {
  const relativeKey = object.key.slice(plan.prefix.length + 1);
  const url = `${plan.publicBaseUrl}/${relativeKey}`;
  let lastStatus = 0;
  let lastError = "";
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      const response = await fetch(`${url}?carearound-publish-check=${object.sha256.slice(0, 16)}-${attempt}`, {
        method: "HEAD",
        cache: "no-store",
        headers: {
          "Accept-Encoding": "identity",
          "Cache-Control": "no-cache",
          Origin: HIGH_DETAIL_DOWNLOADS_ALLOWED_ORIGINS[0],
        },
        signal: AbortSignal.timeout(15000),
      });
      lastStatus = response.status;
      if (response.ok) {
        const length = Number(response.headers.get("content-length"));
        invariant(length === object.byteSize, `${object.key} public byte size is ${length}; expected ${object.byteSize}`);
        invariant((response.headers.get("content-type") || "").toLowerCase().includes(object.contentType.split(";")[0]), `${object.key} public MIME type is incorrect`);
        invariant((response.headers.get("cache-control") || "").toLowerCase() === object.cacheControl.toLowerCase(), `${object.key} public cache metadata is incorrect`);
        if (object.contentDisposition) {
          invariant(response.headers.get("content-disposition") === object.contentDisposition, `${object.key} public download filename metadata is incorrect`);
        }
        return;
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error.message;
    }
    await wait(Math.min(5000, 500 * (attempt + 1)));
  }
  throw new Error(`${object.key} did not become publicly available; last HTTP status ${lastStatus}; ${lastError}`);
}

async function verifyPublicGroup(plan, label, objects) {
  await mapWithConcurrency(objects, Math.min(CONCURRENCY * 2, 8), (object) => waitForPublicObject(plan, object));
  console.log(`Verified ${objects.length}/${objects.length} public ${label}`);
}

async function verifyCanaryFullDownload(plan, object) {
  const relativeKey = object.key.slice(plan.prefix.length + 1);
  const url = `${plan.publicBaseUrl}/${relativeKey}`;
  const startedAt = Date.now();
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "Accept-Encoding": "identity",
      Origin: HIGH_DETAIL_DOWNLOADS_ALLOWED_ORIGINS[0],
    },
    signal: AbortSignal.timeout(CANARY_TIMEOUT_MS),
  });
  invariant(response.ok, `${object.key} canary returned HTTP ${response.status}`);
  invariant(Number(response.headers.get("content-length")) === object.byteSize, `${object.key} canary Content-Length is incorrect`);
  invariant((response.headers.get("content-type") || "").toLowerCase().includes(object.contentType), `${object.key} canary MIME type is incorrect`);
  invariant((response.headers.get("cache-control") || "").toLowerCase() === object.cacheControl.toLowerCase(), `${object.key} canary cache policy is incorrect`);
  invariant(response.headers.get("content-disposition") === object.contentDisposition, `${object.key} canary filename metadata is incorrect`);
  invariant([HIGH_DETAIL_DOWNLOADS_ALLOWED_ORIGINS[0], "*"].includes(response.headers.get("access-control-allow-origin") || ""), `${object.key} canary CORS is incorrect`);
  invariant(response.body, `${object.key} canary body is missing`);
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of response.body) {
    hash.update(chunk);
    bytes += chunk.length;
  }
  invariant(bytes === object.byteSize, `${object.key} canary body size is ${bytes}; expected ${object.byteSize}`);
  invariant(hash.digest("hex") === object.sha256, `${object.key} canary SHA-256 is incorrect`);
  return { bytes, elapsedMs: Date.now() - startedAt };
}

async function main() {
  const plan = await loadHighDetailDownloadsPlan({
    sourceRoot: SOURCE_ROOT,
    outputRoot: OUTPUT_ROOT,
    prefix: PREFIX,
    publicBaseUrl: PUBLIC_BASE_URL,
    writeMetadata: true,
  });
  const assetObjects = [...plan.downloadObjects, ...plan.thumbnailObjects];
  const canaryObject = plan.downloadObjects.find((object) => /\/png\/c08-/.test(object.key));
  invariant(canaryObject, "C08 PNG canary is missing from the upload plan");
  const remainingAssetObjects = assetObjects.filter((object) => object !== canaryObject);
  const summary = {
    apply: APPLY,
    bucket: BUCKET,
    prefix: plan.prefix,
    publicBaseUrl: plan.publicBaseUrl,
    version: plan.version,
    maps: plan.mapCount,
    pngFiles: plan.records.length,
    pdfFiles: plan.records.length,
    thumbnails: plan.thumbnailObjects.length,
    metadataFiles: plan.metadataObjects.length,
    totalObjects: assetObjects.length + plan.metadataObjects.length + 1,
    totalBytes: plan.totalBytes,
    catalogueSha256: plan.catalogueObject.sha256,
    concurrency: CONCURRENCY,
    putRetries: PUT_RETRIES,
    canaryKey: canaryObject.key,
    canaryTimeoutMs: CANARY_TIMEOUT_MS,
    publishOrder: plan.publishOrder,
    overwritePolicy: "abort if any planned object already exists; never overwrite or delete",
  };
  console.log(JSON.stringify(summary, null, 2));

  if (!APPLY) {
    console.log("Dry run complete. Re-run with --apply only after the exact prefix and plan are approved.");
    return;
  }

  await verifyWranglerAuthentication();
  console.log(`Checking all ${summary.totalObjects} object keys are vacant before the first PUT...`);
  await assertRemotePrefixVacant(plan);
  console.log("Vacancy check passed. Any interrupted publication must use a new versioned prefix; this tool will not resume into or overwrite a partial root.");

  console.log(`Uploading C08 PNG canary before the remaining ${remainingAssetObjects.length} assets...`);
  await putObject(plan, canaryObject);
  await waitForPublicObject(plan, canaryObject);
  const canary = await verifyCanaryFullDownload(plan, canaryObject);
  console.log(`C08 canary passed: ${canary.bytes} bytes and exact SHA-256 in ${canary.elapsedMs} ms`);

  await uploadGroup(plan, "remaining immutable PNG/PDF files and thumbnails", remainingAssetObjects);
  await verifyPublicGroup(plan, "remaining PNG/PDF files and thumbnails", remainingAssetObjects);
  await uploadGroup(plan, "immutable validation/provenance metadata", plan.metadataObjects);
  await verifyPublicGroup(plan, "validation/provenance metadata", plan.metadataObjects);
  await putObject(plan, plan.catalogueObject);
  await waitForPublicObject(plan, plan.catalogueObject);

  console.log(JSON.stringify({
    status: "published",
    bucket: BUCKET,
    prefix: plan.prefix,
    catalogueUrl: `${plan.publicBaseUrl}/catalogue.json`,
    catalogueSha256: plan.catalogueObject.sha256,
    objects: summary.totalObjects,
    bytes: plan.totalBytes,
  }, null, 2));
}

main().catch((error) => {
  console.error(`High-detail town-map publication failed: ${error.message}`);
  process.exitCode = 1;
});
