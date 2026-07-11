#!/usr/bin/env node

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_W01_MANIFEST_PATH,
  DEFAULT_W01_R2_BUCKET,
  DEFAULT_W01_R2_PREFIX,
  DEFAULT_W01_SOURCE_ROOT,
  invariant,
  loadW01R2DeploymentPlan,
  mapWithConcurrency,
} from "./r2-w01-lib.mjs";
import {
  DEFAULT_W01_GRAY_MANIFEST_PATH,
  DEFAULT_W01_GRAY_R2_BUCKET,
  DEFAULT_W01_GRAY_R2_PREFIX,
  DEFAULT_W01_GRAY_SOURCE_ROOT,
  loadW01GrayR2DeploymentPlan,
} from "./r2-w01-gray-lib.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const APPLY = process.argv.includes("--apply");

function argumentValue(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((argument) => argument.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

const STYLE = argumentValue("style", process.env.TOWN_MAP_STYLE || "default");
invariant(["default", "gray"].includes(STYLE), `Unsupported town-map style: ${STYLE}`);
const gray = STYLE === "gray";
const BUCKET = argumentValue("bucket", process.env.TOWN_MAP_R2_BUCKET || (gray ? DEFAULT_W01_GRAY_R2_BUCKET : DEFAULT_W01_R2_BUCKET));
const PREFIX = argumentValue("prefix", process.env.TOWN_MAP_R2_PREFIX || (gray ? DEFAULT_W01_GRAY_R2_PREFIX : DEFAULT_W01_R2_PREFIX));
const CONCURRENCY = Number(argumentValue("concurrency", process.env.TOWN_MAP_R2_CONCURRENCY || "3"));
const SOURCE_ROOT = process.env.TOWN_MAP_SOURCE_ROOT || (gray ? DEFAULT_W01_GRAY_SOURCE_ROOT : DEFAULT_W01_SOURCE_ROOT);
const MANIFEST_PATH = process.env.TOWN_MAP_MANIFEST_PATH || (gray ? DEFAULT_W01_GRAY_MANIFEST_PATH : DEFAULT_W01_MANIFEST_PATH);

invariant(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(BUCKET), `Unsafe R2 bucket name: ${BUCKET}`);
invariant(Number.isSafeInteger(CONCURRENCY) && CONCURRENCY >= 1 && CONCURRENCY <= 8, "Concurrency must be between 1 and 8");

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

async function main() {
  const loadPlan = gray ? loadW01GrayR2DeploymentPlan : loadW01R2DeploymentPlan;
  const plan = await loadPlan({
    manifestPath: MANIFEST_PATH,
    sourceRoot: SOURCE_ROOT,
    prefix: PREFIX,
  });
  const summary = {
    apply: APPLY,
    style: STYLE,
    bucket: BUCKET,
    prefix: plan.prefix,
    mapId: plan.mapId,
    version: plan.version,
    chunks: plan.chunkObjects.length,
    chunkBytes: plan.totalBytes,
    manifestSha256: plan.manifestSha256,
    concurrency: CONCURRENCY,
    publishOrder: "all chunks, then manifest",
  };
  console.log(JSON.stringify(summary, null, 2));

  if (!APPLY) {
    console.log("Dry run complete. Re-run with --apply only after the target bucket is confirmed.");
    return;
  }

  let uploaded = 0;
  await mapWithConcurrency(plan.chunkObjects, CONCURRENCY, async (object) => {
    const result = await runWranglerPut(object);
    uploaded += 1;
    if (uploaded === 1 || uploaded % 25 === 0 || uploaded === plan.chunkObjects.length) {
      console.log(`Uploaded ${uploaded}/${plan.chunkObjects.length} immutable chunks`);
    }
    return result;
  });

  await runWranglerPut(plan.manifestObject);
  console.log(
    JSON.stringify(
      {
        status: "published",
        bucket: BUCKET,
        manifestKey: plan.manifestObject.key,
        chunks: uploaded,
        bytes: plan.totalBytes + plan.manifestObject.byteSize,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(`W01 R2 upload failed: ${error.message}`);
  process.exitCode = 1;
});
