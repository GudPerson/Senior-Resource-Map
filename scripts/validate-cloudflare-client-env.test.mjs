import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VALIDATOR = path.join(REPO_ROOT, 'scripts', 'validate-cloudflare-client-env.mjs');
const BASE_ENV = Object.freeze({
  VITE_API_URL: 'https://api.carearound.sg/api',
  VITE_TOWN_MAP_PROOF_ENABLED: 'true',
  VITE_TOWN_MAP_ASSET_BASE_URL: 'https://maps.carearound.sg/v2/native-scale-20260722/default',
  VITE_TOWN_MAP_GRAY_ASSET_BASE_URL: 'https://maps.carearound.sg/v2/native-scale-20260722/gray',
  VITE_TOWN_MAP_ZOOM14_OVERVIEW_ENABLED: 'true',
  VITE_TOWN_MAP_OVERVIEW_ASSET_BASE_URL: 'https://maps.carearound.sg/v3/zoom14-atlas-20260730/default',
  VITE_TOWN_MAP_GRAY_OVERVIEW_ASSET_BASE_URL: 'https://maps.carearound.sg/v3/zoom14-atlas-20260730/gray',
  VITE_TOWN_MAP_PRINT_MASTER_ASSET_BASE_URL: 'https://maps.carearound.sg/v2/print-master-100-20260723/default',
  VITE_TOWN_MAP_GRAY_PRINT_MASTER_ASSET_BASE_URL: 'https://maps.carearound.sg/v2/print-master-100-20260723/gray',
});
const DERIVATIVE_ENV = Object.freeze({
  VITE_DISCOVER_DETAILED_MAP_ENABLED: 'true',
  VITE_DISCOVER_DETAILED_DERIVATIVE_ENABLED: 'true',
  VITE_DISCOVER_DETAILED_DERIVATIVE_NATIVE_ASSET_BASE_URL: 'https://maps.carearound.sg/v5/discover-derivative-v1-80-20260906/native/default',
  VITE_DISCOVER_DETAILED_DERIVATIVE_GRAY_NATIVE_ASSET_BASE_URL: 'https://maps.carearound.sg/v5/discover-derivative-v1-80-20260906/native/gray',
  VITE_DISCOVER_DETAILED_DERIVATIVE_OVERVIEW_ASSET_BASE_URL: 'https://maps.carearound.sg/v5/discover-derivative-v1-80-20260906/overview/default',
  VITE_DISCOVER_DETAILED_DERIVATIVE_GRAY_OVERVIEW_ASSET_BASE_URL: 'https://maps.carearound.sg/v5/discover-derivative-v1-80-20260906/overview/gray',
});

function runValidator(overrides = {}) {
  return spawnSync(process.execPath, [VALIDATOR], {
    cwd: REPO_ROOT,
    env: { ...process.env, ...BASE_ENV, ...overrides },
    encoding: 'utf8',
  });
}

test('production client validation accepts the exact Discover derivative release roots', () => {
  const result = runValidator(DERIVATIVE_ENV);
  assert.equal(result.status, 0, result.stderr);
});

test('production client validation rejects incomplete derivative roots', () => {
  const result = runValidator({
    ...DERIVATIVE_ENV,
    VITE_DISCOVER_DETAILED_DERIVATIVE_GRAY_OVERVIEW_ASSET_BASE_URL: '',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /VITE_DISCOVER_DETAILED_DERIVATIVE_GRAY_OVERVIEW_ASSET_BASE_URL/);
});

test('production client validation rejects the obsolete 384 MiB ceiling with derivatives', () => {
  const result = runValidator({
    ...DERIVATIVE_ENV,
    VITE_DISCOVER_DETAILED_MAP_UAT_384_MIB_ENABLED: 'true',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /384 MiB Discover UAT ceiling/);
});
