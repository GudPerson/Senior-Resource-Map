#!/usr/bin/env node

import { createReadStream } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

const HOST = process.env.TOWN_MAP_PRINT_ASSET_HOST || '127.0.0.1';
const PORT = Number(process.env.TOWN_MAP_PRINT_ASSET_PORT || 4175);
const ROOTS = {
  default: path.resolve(process.env.TOWN_MAP_PRINT_DEFAULT_ROOT || '/Users/sweetbuns/CareAroundSG-print-assets/default'),
  gray: path.resolve(process.env.TOWN_MAP_PRINT_GRAY_ROOT || '/Users/sweetbuns/Documents/SG MAP/output/static-town-maps-grey/print-master-100'),
};

function cors(response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  response.setHeader('X-Content-Type-Options', 'nosniff');
}

function sendError(response, status, message) {
  const body = Buffer.from(`${message}\n`);
  cors(response);
  response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': body.length, 'Cache-Control': 'no-store' });
  response.end(response.req?.method === 'HEAD' ? undefined : body);
}

async function loadObjects() {
  const objects = new Map();
  for (const [style, root] of Object.entries(ROOTS)) {
    const manifestRoot = path.join(root, 'manifests');
    const names = (await readdir(manifestRoot)).filter((name) => name.endsWith('-print-master-100.json'));
    for (const name of names) {
      const manifestPath = path.join(manifestRoot, name);
      const buffer = await readFile(manifestPath);
      const manifest = JSON.parse(buffer.toString('utf8'));
      objects.set(`/${style}/manifests/${name}`, {
        kind: 'buffer', buffer, type: 'application/json; charset=utf-8', cache: 'no-cache',
      });
      for (const chunk of manifest.chunks || []) {
        const chunkPath = path.resolve(root, chunk.url);
        if (!chunkPath.startsWith(`${root}${path.sep}`)) throw new Error(`Unsafe chunk path: ${chunk.url}`);
        const metadata = await stat(chunkPath);
        objects.set(`/${style}/${chunk.url}`, {
          kind: 'file', filePath: chunkPath, size: metadata.size, type: 'image/jpeg', cache: 'public, max-age=31536000, immutable',
        });
      }
    }
    console.log(`${style}: ${names.length} print-master manifests from ${root}`);
  }
  return objects;
}

async function main() {
  if (!Number.isSafeInteger(PORT) || PORT < 1 || PORT > 65535) throw new Error(`Invalid port: ${PORT}`);
  const objects = await loadObjects();
  const server = http.createServer((request, response) => {
    if (request.method === 'OPTIONS') {
      cors(response);
      response.writeHead(204, { Allow: 'GET, HEAD, OPTIONS' });
      response.end();
      return;
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
      sendError(response, 405, 'Method not allowed');
      return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url || '/', `http://${HOST}:${PORT}`).pathname);
    } catch {
      sendError(response, 400, 'Invalid request path');
      return;
    }
    if (pathname.includes('..') || pathname.includes('\\') || pathname.includes('\0')) {
      sendError(response, 404, 'Print master asset not found');
      return;
    }
    const object = objects.get(pathname);
    if (!object) {
      sendError(response, 404, 'Print master asset not found');
      return;
    }
    cors(response);
    const length = object.kind === 'buffer' ? object.buffer.length : object.size;
    response.writeHead(200, { 'Content-Type': object.type, 'Content-Length': length, 'Cache-Control': object.cache });
    if (request.method === 'HEAD') {
      response.end();
    } else if (object.kind === 'buffer') {
      response.end(object.buffer);
    } else {
      createReadStream(object.filePath).pipe(response);
    }
  });
  server.listen(PORT, HOST, () => {
    console.log(`Print master assets: http://${HOST}:${PORT}/default and http://${HOST}:${PORT}/gray`);
  });
  const close = () => server.close(() => process.exit());
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
}

main().catch((error) => {
  console.error(`Print master asset server failed: ${error.message}`);
  process.exitCode = 1;
});
