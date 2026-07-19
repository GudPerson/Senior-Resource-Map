#!/usr/bin/env node

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_ISLANDWIDE_MANIFEST_ROOT,
  DEFAULT_ISLANDWIDE_R2_BUCKET,
  DEFAULT_ISLANDWIDE_R2_PREFIX,
  DEFAULT_ISLANDWIDE_SOURCE_ROOT,
  invariant,
  loadIslandwideR2DeploymentPlan,
  mapWithConcurrency,
} from "./r2-islandwide-lib.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const APPLY = process.argv.includes("--apply");

function argumentValue(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((argument) => argument.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

const STYLE = argumentValue("style", process.env.TOWN_MAP_STYLE || "default");
invariant(["default", "gray"].includes(STYLE), `Unsupported islandwide town-map style: ${STYLE}`);
const BUCKET = argumentValue("bucket", process.env.TOWN_MAP_R2_BUCKET || DEFAULT_ISLANDWIDE_R2_BUCKET);
const PREFIX = argumentValue("prefix", process.env.TOWN_MAP_R2_PREFIX || DEFAULT_ISLANDWIDE_R2_PREFIX);
const CONCURRENCY = Number(argumentValue("concurrency", process.env.TOWN_MAP_R2_CONCURRENCY || "4"));
const SOURCE_ROOT = argumentValue("source-root", process.env.TOWN_MAP_SOURCE_ROOT || DEFAULT_ISLANDWIDE_SOURCE_ROOT);
const MANIFEST_ROOT = argumentValue("manifest-root", process.env.TOWN_MAP_MANIFEST_ROOT || DEFAULT_ISLANDWIDE_MANIFEST_ROOT);

invariant(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(BUCKET), `Unsafe R2 bucket name: ${BUCKET}`);
invariant(Number.isSafeInteger(CONCURRENCY) && CONCURRENCY >= 1 && CONCURRENCY <= 12, "Concurrency must be between 1 and 12");

function runWranglerPut(object) {
  const objectPath = `${BUCKET}/${object.key}`;
  const args = [
    "wrangler",
    "r2",
    "object",
    "put",
    objectPath,
    "--remote",
    "--file",
    object.filePath,
    "--content-type",
    object.contentType,
    "--cache-control",
    object.cacheControl,
    "--force",
  ];

  return new Promise((resolve, reject) => {
    const child = spawn("npx", args, {
      cwd: REPO_ROOT,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ objectPath });
        return;
      }
      reject(
        new Error(
          `R2 upload failed for ${object.key} (exit ${code})\n${stdout}\n${stderr}`,
        ),
      );
    });
  });
}

async function uploadObjects(label, objects, logEvery) {
  let uploaded = 0;
  await mapWithConcurrency(objects, CONCURRENCY, async (object) => {
    const result = await runWranglerPut(object);
    uploaded += 1;
    if (uploaded === 1 || uploaded % logEvery === 0 || uploaded === objects.length) {
      console.log(`Uploaded ${uploaded}/${objects.length} ${label}`);
    }
    return result;
  });
  return uploaded;
}

async function main() {
  const plan = await loadIslandwideR2DeploymentPlan({
    style: STYLE,
    sourceRoot: SOURCE_ROOT,
    manifestRoot: MANIFEST_ROOT,
    prefix: PREFIX,
  });
  const summary = {
    apply: APPLY,
    style: plan.style,
    bucket: BUCKET,
    prefix: plan.prefix,
    version: plan.version,
    surfaces: plan.surfaceCount,
    chunks: plan.chunkCount,
    chunkBytes: plan.totalBytes,
    indexSha256: plan.indexSha256,
    surfaceManifests: plan.manifestObjects.length,
    concurrency: CONCURRENCY,
    publishOrder: "all chunks, then surface manifests, then islandwide index",
  };
  console.log(JSON.stringify(summary, null, 2));

  if (!APPLY) {
    console.log("Dry run complete. Re-run with --apply only after the target bucket/prefix is confirmed.");
    return;
  }

  const uploadedChunks = await uploadObjects("immutable chunks", plan.chunkObjects, 100);
  const uploadedManifests = await uploadObjects("surface manifests", plan.manifestObjects, 8);
  await runWranglerPut(plan.indexObject);
  console.log(
    JSON.stringify(
      {
        status: "published",
        style: plan.style,
        bucket: BUCKET,
        indexKey: plan.indexObject.key,
        chunks: uploadedChunks,
        surfaceManifests: uploadedManifests,
        bytes: plan.totalBytes + plan.indexObject.byteSize + plan.manifestObjects.reduce((sum, object) => sum + object.byteSize, 0),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(`Islandwide R2 upload failed: ${error.message}`);
  process.exitCode = 1;
});
