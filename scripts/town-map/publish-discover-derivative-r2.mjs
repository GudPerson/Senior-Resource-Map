#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_ISLANDWIDE_R2_BUCKET,
  invariant,
  loadIslandwideR2DeploymentPlan,
  mapWithConcurrency,
} from './r2-islandwide-lib.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_OUTPUT_ROOT = path.join(
  REPO_ROOT,
  'output',
  'town-map-proof',
  'discover-derivative-v1-80-20260906',
);
const DEFAULT_RELEASE_ROOT = 'v5/discover-derivative-v1-80-20260906';
const PUBLIC_HOST = 'https://maps.carearound.sg';
const ALLOWED_ORIGIN = 'https://app.carearound.sg';
const APPLY = process.argv.includes('--apply');

function argumentValue(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((argument) => argument.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

const OUTPUT_ROOT = path.resolve(argumentValue('output-root', DEFAULT_OUTPUT_ROOT));
const RELEASE_ROOT = argumentValue('release-root', DEFAULT_RELEASE_ROOT).replace(/^\/+|\/+$/g, '');
const BUCKET = argumentValue('bucket', DEFAULT_ISLANDWIDE_R2_BUCKET);
const CONCURRENCY = Number(argumentValue('concurrency', '10'));
const PREFLIGHT_CONCURRENCY = Number(argumentValue('preflight-concurrency', '16'));
const PUT_RETRIES = Number(argumentValue('put-retries', '3'));
const WRANGLER_BIN = argumentValue('wrangler-bin', process.env.WRANGLER_BIN || 'npx');
let vacancyCheckSequence = 0;

invariant(
  /^v5\/discover-derivative-v1-80-\d{8}(?:-r\d+)?$/.test(RELEASE_ROOT),
  `Unsafe Discover derivative release root: ${RELEASE_ROOT}`,
);
invariant(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(BUCKET), `Unsafe R2 bucket name: ${BUCKET}`);
invariant(Number.isSafeInteger(CONCURRENCY) && CONCURRENCY >= 1 && CONCURRENCY <= 12, 'Upload concurrency must be between 1 and 12');
invariant(Number.isSafeInteger(PREFLIGHT_CONCURRENCY) && PREFLIGHT_CONCURRENCY >= 1 && PREFLIGHT_CONCURRENCY <= 24, 'Preflight concurrency must be between 1 and 24');
invariant(Number.isSafeInteger(PUT_RETRIES) && PUT_RETRIES >= 0 && PUT_RETRIES <= 8, 'PUT retries must be between 0 and 8');
invariant(typeof WRANGLER_BIN === 'string' && WRANGLER_BIN.trim(), 'Wrangler command is required');

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runCommand(command, args, { inherit = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: REPO_ROOT,
      env: process.env,
      stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    if (!inherit) {
      child.stdout.on('data', (chunk) => { stdout += chunk; });
      child.stderr.on('data', (chunk) => { stderr += chunk; });
    }
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`${command} exited ${code}\n${stdout}\n${stderr}`));
    });
  });
}

async function verifyWranglerAuthentication() {
  const args = path.basename(WRANGLER_BIN) === 'npx' ? ['wrangler', 'whoami'] : ['whoami'];
  await runCommand(WRANGLER_BIN, args, { inherit: true });
}

function publicUrlForObject(object, suffix = '') {
  invariant(object.key.startsWith(`${RELEASE_ROOT}/`), `Object escapes release root: ${object.key}`);
  return `${PUBLIC_HOST}/${object.key}${suffix}`;
}

async function fetchWithRetries(url, options, attempts = 3) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(20000),
      });
      if (response.status < 500 || attempt + 1 === attempts) return response;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt + 1 === attempts) break;
    }
    await wait(500 * (2 ** attempt));
  }
  throw lastError;
}

async function assertRemoteObjectVacant(object) {
  vacancyCheckSequence += 1;
  const suffix = `?carearound-vacancy-check=${object.sha256.slice(0, 16)}-${Date.now()}-${vacancyCheckSequence}`;
  const response = await fetchWithRetries(publicUrlForObject(object, suffix), {
    method: 'HEAD',
    cache: 'no-store',
    redirect: 'manual',
    headers: {
      'Cache-Control': 'no-cache',
      Origin: ALLOWED_ORIGIN,
    },
  });
  invariant(
    response.status === 404,
    response.ok || (response.status >= 300 && response.status < 400)
      ? `R2 publication aborted because ${object.key} already exists`
      : `R2 vacancy check for ${object.key} returned HTTP ${response.status}`,
  );
}

function wranglerPutArgs(object) {
  const args = [
    'r2', 'object', 'put', `${BUCKET}/${object.key}`,
    '--remote',
    '--file', object.filePath,
    '--content-type', object.contentType,
    '--cache-control', object.cacheControl,
    '--force',
  ];
  return path.basename(WRANGLER_BIN) === 'npx' ? ['wrangler', ...args] : args;
}

async function putObject(object) {
  let lastError;
  for (let attempt = 0; attempt <= PUT_RETRIES; attempt += 1) {
    await assertRemoteObjectVacant(object);
    try {
      await runCommand(WRANGLER_BIN, wranglerPutArgs(object));
      return;
    } catch (error) {
      lastError = error;
      if (attempt >= PUT_RETRIES) break;
      await wait(Math.min(8000, 1000 * (2 ** attempt)));
    }
  }
  throw new Error(`R2 upload failed for ${object.key}: ${lastError?.message || 'unknown error'}`);
}

async function waitForPublicObject(object) {
  let lastStatus = 0;
  let lastError = '';
  for (let attempt = 0; attempt < 14; attempt += 1) {
    try {
      const response = await fetchWithRetries(
        publicUrlForObject(object, `?carearound-publish-check=${object.sha256.slice(0, 16)}-${attempt}`),
        {
          method: 'HEAD',
          cache: 'no-store',
          headers: {
            'Accept-Encoding': 'identity',
            'Cache-Control': 'no-cache',
            Origin: ALLOWED_ORIGIN,
          },
        },
        2,
      );
      lastStatus = response.status;
      if (response.ok) {
        invariant(Number(response.headers.get('content-length')) === object.byteSize, `${object.key} public byte size is incorrect`);
        invariant((response.headers.get('content-type') || '').toLowerCase().includes(object.contentType.split(';')[0]), `${object.key} public MIME type is incorrect`);
        invariant((response.headers.get('cache-control') || '').toLowerCase() === object.cacheControl.toLowerCase(), `${object.key} public cache metadata is incorrect`);
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

async function verifyCanary(object) {
  await waitForPublicObject(object);
  const response = await fetchWithRetries(publicUrlForObject(object), {
    cache: 'no-store',
    headers: {
      'Accept-Encoding': 'identity',
      Origin: ALLOWED_ORIGIN,
    },
  });
  invariant(response.ok, `${object.key} canary returned HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  invariant(bytes.length === object.byteSize, `${object.key} canary byte size is incorrect`);
  invariant(createHash('sha256').update(bytes).digest('hex') === object.sha256, `${object.key} canary SHA-256 is incorrect`);
}

async function uploadGroup(label, objects, logEvery = 100) {
  let uploaded = 0;
  await mapWithConcurrency(objects, CONCURRENCY, async (object) => {
    await putObject(object);
    uploaded += 1;
    if (uploaded === 1 || uploaded % logEvery === 0 || uploaded === objects.length) {
      console.log(`Uploaded ${uploaded}/${objects.length} ${label}`);
    }
  });
}

async function loadPlans() {
  const plans = [];
  for (const tier of ['native', 'overview']) {
    for (const style of ['default', 'gray']) {
      const surfaceCount = tier === 'native' ? 32 : 1;
      const prefix = `${RELEASE_ROOT}/${tier}/${style}`;
      plans.push(await loadIslandwideR2DeploymentPlan({
        style,
        manifestRoot: path.join(OUTPUT_ROOT, tier, 'default'),
        sourceRoot: OUTPUT_ROOT,
        prefix,
        expectedSurfaceCount: surfaceCount,
      }));
    }
  }
  return plans;
}

async function main() {
  const plans = await loadPlans();
  const chunks = plans.flatMap((plan) => plan.chunkObjects);
  const manifests = plans.flatMap((plan) => plan.manifestObjects);
  const indexes = plans.map((plan) => plan.indexObject);
  const objects = [...chunks, ...manifests, ...indexes];
  const uniqueKeys = new Set(objects.map((object) => object.key));
  invariant(uniqueKeys.size === objects.length, 'Discover derivative publication contains duplicate object keys');
  const summary = {
    apply: APPLY,
    bucket: BUCKET,
    releaseRoot: RELEASE_ROOT,
    outputRoot: OUTPUT_ROOT,
    collections: plans.map((plan) => ({
      prefix: plan.prefix,
      version: plan.version,
      surfaces: plan.surfaceCount,
      chunks: plan.chunkCount,
      bytes: plan.totalBytes,
      indexSha256: plan.indexSha256,
    })),
    chunks: chunks.length,
    surfaceManifests: manifests.length,
    indexes: indexes.length,
    totalObjects: objects.length,
    totalBytes: objects.reduce((sum, object) => sum + object.byteSize, 0),
    uploadConcurrency: CONCURRENCY,
    overwritePolicy: 'abort if any planned object already exists; never overwrite or delete',
    publishOrder: 'one verified JPEG canary per collection, remaining chunks, surface manifests, indexes last',
  };
  console.log(JSON.stringify(summary, null, 2));

  if (!APPLY) {
    console.log('Dry run complete. Re-run with --apply only for the approved immutable release root.');
    return;
  }

  await verifyWranglerAuthentication();
  console.log(`Checking all ${objects.length} object keys are vacant before the first PUT...`);
  await mapWithConcurrency(objects, PREFLIGHT_CONCURRENCY, assertRemoteObjectVacant);
  console.log('Vacancy check passed. An interrupted publication must use a new release root.');

  const canaries = plans.map((plan) => plan.chunkObjects[0]);
  const canaryKeys = new Set(canaries.map((object) => object.key));
  const remainingChunks = chunks.filter((object) => !canaryKeys.has(object.key));
  await uploadGroup('JPEG canaries', canaries, 1);
  await mapWithConcurrency(canaries, canaries.length, verifyCanary);
  console.log('All four public JPEG canaries passed exact byte and SHA-256 verification.');

  await uploadGroup('immutable derivative chunks', remainingChunks, 100);
  await uploadGroup('surface manifests', manifests, 8);
  await uploadGroup('collection indexes', indexes, 1);
  await mapWithConcurrency([...manifests, ...indexes], 12, waitForPublicObject);

  console.log(JSON.stringify({
    status: 'published',
    bucket: BUCKET,
    releaseRoot: RELEASE_ROOT,
    objects: objects.length,
    bytes: summary.totalBytes,
    publicRoots: plans.map((plan) => `${PUBLIC_HOST}/${plan.prefix}`),
  }, null, 2));
}

main().catch((error) => {
  console.error(`Discover derivative R2 publication failed: ${error.message}`);
  process.exitCode = 1;
});
