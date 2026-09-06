#!/usr/bin/env node

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const RELEASE_ROOT = 'v5/discover-derivative-v1-80-20260906';
const PUBLIC_HOST = 'https://maps.carearound.sg';
const FULL = !process.argv.includes('--sampled');

function runNode(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: REPO_ROOT,
      env: process.env,
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Remote derivative verification exited ${code}`));
    });
  });
}

async function main() {
  for (const tier of ['native', 'overview']) {
    for (const style of ['default', 'gray']) {
      const args = [
        'scripts/town-map/verify-islandwide-r2.mjs',
        `--style=${style}`,
        `--surface-count=${tier === 'native' ? 32 : 1}`,
        `--base-url=${PUBLIC_HOST}/${RELEASE_ROOT}/${tier}/${style}`,
      ];
      if (FULL) args.push('--full');
      await runNode(args);
    }
  }
  console.log(`Discover derivative remote ${FULL ? 'full' : 'sampled'} verification passed for ${PUBLIC_HOST}/${RELEASE_ROOT}`);
}

main().catch((error) => {
  console.error(`Discover derivative remote verification failed: ${error.message}`);
  process.exitCode = 1;
});
