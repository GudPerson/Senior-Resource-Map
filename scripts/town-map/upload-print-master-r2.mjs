#!/usr/bin/env node

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_PRINT_MASTER_PACKAGE_ROOT,
  DEFAULT_PRINT_MASTER_R2_BUCKET,
  DEFAULT_PRINT_MASTER_R2_PREFIX,
  invariant,
  loadPrintMasterR2DeploymentPlan,
  mapWithConcurrency,
} from "./r2-print-master-lib.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const APPLY = process.argv.includes("--apply");
function argumentValue(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((argument) => argument.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}
const STYLE = argumentValue("style", process.env.TOWN_MAP_STYLE || "default");
const BUCKET = argumentValue("bucket", process.env.TOWN_MAP_R2_BUCKET || DEFAULT_PRINT_MASTER_R2_BUCKET);
const PREFIX = argumentValue("prefix", process.env.TOWN_MAP_R2_PREFIX || DEFAULT_PRINT_MASTER_R2_PREFIX);
const SOURCE_ROOT = argumentValue("source-root", process.env.TOWN_MAP_PRINT_SOURCE_ROOT || "");
const PACKAGE_ROOT = argumentValue("package-root", process.env.TOWN_MAP_PRINT_PACKAGE_ROOT || DEFAULT_PRINT_MASTER_PACKAGE_ROOT);
const CONCURRENCY = Number(argumentValue("concurrency", process.env.TOWN_MAP_R2_CONCURRENCY || "4"));
const CHUNK_START_INDEX = Number(argumentValue("chunk-start-index", process.env.TOWN_MAP_R2_CHUNK_START_INDEX || "1"));
const PUT_RETRIES = Number(argumentValue("put-retries", process.env.TOWN_MAP_R2_PUT_RETRIES || "3"));

invariant(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(BUCKET), `Unsafe R2 bucket name: ${BUCKET}`);
invariant(Number.isSafeInteger(CONCURRENCY) && CONCURRENCY >= 1 && CONCURRENCY <= 12, "Concurrency must be between 1 and 12");
invariant(Number.isSafeInteger(CHUNK_START_INDEX) && CHUNK_START_INDEX >= 1, "Chunk start index must be positive");
invariant(Number.isSafeInteger(PUT_RETRIES) && PUT_RETRIES >= 0 && PUT_RETRIES <= 8, "PUT retries must be between 0 and 8");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function putOnce(object) {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["wrangler", "r2", "object", "put", `${BUCKET}/${object.key}`, "--remote", "--file", object.filePath, "--content-type", object.contentType, "--cache-control", object.cacheControl, "--force"], {
      cwd: REPO_ROOT, env: process.env, stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = ""; let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(object.key) : reject(new Error(`R2 PUT failed for ${object.key} (${code})\n${stdout}\n${stderr}`)));
  });
}
async function put(object) {
  let error;
  for (let attempt = 0; attempt <= PUT_RETRIES; attempt += 1) {
    try { return await putOnce(object); } catch (caught) {
      error = caught;
      if (attempt < PUT_RETRIES) await wait(Math.min(8000, 1000 * 2 ** attempt));
    }
  }
  throw error;
}
async function upload(label, objects, logEvery) {
  let count = 0;
  await mapWithConcurrency(objects, CONCURRENCY, async (object) => {
    await put(object); count += 1;
    if (count === 1 || count % logEvery === 0 || count === objects.length) console.log(`Uploaded ${count}/${objects.length} ${label}`);
  });
  return count;
}

const plan = await loadPrintMasterR2DeploymentPlan({ style: STYLE, sourceRoot: SOURCE_ROOT, packageRoot: PACKAGE_ROOT, prefix: PREFIX });
console.log(JSON.stringify({ apply: APPLY, style: plan.style, bucket: BUCKET, prefix: plan.prefix, version: plan.version, indexSha256: plan.indexSha256, surfaces: plan.surfaces.length, chunks: plan.chunkObjects.length, chunkBytes: plan.index.total_bytes, publishOrder: "chunks, surface manifests, index" }, null, 2));
if (APPLY) {
  invariant(CHUNK_START_INDEX <= plan.chunkObjects.length, "Chunk start index exceeds chunk count");
  const uploadedChunks = await upload("immutable chunks", plan.chunkObjects.slice(CHUNK_START_INDEX - 1), 100);
  const uploadedManifests = await upload("sanitized surface manifests", plan.manifestObjects, 8);
  await put(plan.indexObject);
  console.log(JSON.stringify({ status: "published", style: plan.style, indexKey: plan.indexObject.key, uploadedChunks, uploadedManifests }, null, 2));
}
