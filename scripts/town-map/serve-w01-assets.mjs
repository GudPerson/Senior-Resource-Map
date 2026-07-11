#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const DEFAULT_SOURCE_ROOT = "/Users/sweetbuns/Documents/SG MAP";
const DEFAULT_MANIFEST_PATH = path.join(
  REPO_ROOT,
  "output/town-map-proof/assets/v1/w01/manifest.json",
);
const MANIFEST_ROUTE = "/v1/w01/manifest.json";
const CHUNK_ROUTE_PREFIX = "/v1/w01/chunks/";
const EXPECTED_SCHEMA = "carearound.fixed-town-surface";
const EXPECTED_SCHEMA_VERSION = 1;

const SOURCE_ROOT = path.resolve(
  process.env.TOWN_MAP_SOURCE_ROOT || DEFAULT_SOURCE_ROOT,
);
const CHUNK_ROOT = path.join(
  SOURCE_ROOT,
  "output/static-town-maps/production-pilots/chunks/W01-s50-q95",
);
const MANIFEST_PATH = path.resolve(
  process.env.TOWN_MAP_MANIFEST_PATH || DEFAULT_MANIFEST_PATH,
);
const HOST = process.env.TOWN_MAP_ASSET_HOST || "127.0.0.1";
const PORT = Number(process.env.TOWN_MAP_ASSET_PORT || 4174);

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  response.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, If-None-Match",
  );
  response.setHeader(
    "Access-Control-Expose-Headers",
    "Cache-Control, Content-Length, ETag",
  );
  response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  response.setHeader("Timing-Allow-Origin", "*");
  response.setHeader("X-Content-Type-Options", "nosniff");
}

function sendError(response, statusCode, message) {
  const body = Buffer.from(`${message}\n`, "utf8");
  setCorsHeaders(response);
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": body.length,
  });
  response.end(response.req?.method === "HEAD" ? undefined : body);
}

function notModified(request, response, etag, cacheControl) {
  if (request.headers["if-none-match"] !== etag) {
    return false;
  }
  setCorsHeaders(response);
  response.writeHead(304, {
    "Cache-Control": cacheControl,
    ETag: etag,
  });
  response.end();
  return true;
}

function sendBuffer(request, response, buffer, options) {
  if (notModified(request, response, options.etag, options.cacheControl)) {
    return;
  }
  setCorsHeaders(response);
  response.writeHead(200, {
    "Cache-Control": options.cacheControl,
    "Content-Type": options.contentType,
    "Content-Length": buffer.length,
    ETag: options.etag,
  });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  response.end(buffer);
}

function sendFile(request, response, filePath, metadata) {
  if (notModified(request, response, metadata.etag, metadata.cacheControl)) {
    return;
  }
  setCorsHeaders(response);
  response.writeHead(200, {
    "Cache-Control": metadata.cacheControl,
    "Content-Type": metadata.contentType,
    "Content-Length": metadata.byteSize,
    ETag: metadata.etag,
  });
  if (request.method === "HEAD") {
    response.end();
    return;
  }

  const stream = createReadStream(filePath);
  stream.on("error", (error) => {
    if (response.headersSent) {
      response.destroy(error);
      return;
    }
    sendError(response, 500, "Unable to read W01 asset");
  });
  stream.pipe(response);
}

function hasUnsafeRawPath(requestUrl) {
  const rawPath = String(requestUrl || "/").split(/[?#]/, 1)[0];
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(rawPath);
  } catch {
    return true;
  }
  if (decodedPath.includes("\\") || decodedPath.includes("\0")) {
    return true;
  }
  return decodedPath.split("/").some((segment) => segment === "." || segment === "..");
}

async function loadAssets() {
  invariant(
    Number.isSafeInteger(PORT) && PORT >= 1 && PORT <= 65535,
    `Invalid TOWN_MAP_ASSET_PORT: ${process.env.TOWN_MAP_ASSET_PORT}`,
  );

  const manifestBuffer = await readFile(MANIFEST_PATH);
  const manifest = JSON.parse(manifestBuffer.toString("utf8"));
  invariant(
    manifest.schema === EXPECTED_SCHEMA &&
      manifest.schemaVersion === EXPECTED_SCHEMA_VERSION,
    `Expected ${EXPECTED_SCHEMA} v${EXPECTED_SCHEMA_VERSION} manifest`,
  );
  invariant(
    manifest.map?.id === "W01",
    `Expected W01, received ${manifest.map?.id}`,
  );
  invariant(
    Array.isArray(manifest.chunks) && manifest.chunks.length === 300,
    "W01 manifest must contain exactly 300 chunks",
  );

  const chunksByFileName = new Map();
  for (const chunk of manifest.chunks) {
    invariant(
      typeof chunk.url === "string" &&
        /^chunks\/z19-\d+-\d+-\d+-\d+\.jpg$/.test(chunk.url),
      `Unsafe W01 chunk URL in manifest: ${chunk.url}`,
    );
    const fileName = chunk.url.slice("chunks/".length);
    invariant(
      fileName === path.posix.basename(fileName) && !fileName.includes("\\"),
      `Unsafe W01 chunk filename in manifest: ${fileName}`,
    );
    invariant(!chunksByFileName.has(fileName), `Duplicate W01 chunk: ${fileName}`);

    const filePath = path.join(CHUNK_ROOT, fileName);
    const fileStats = await stat(filePath);
    invariant(fileStats.isFile(), `Missing W01 source chunk: ${fileName}`);
    invariant(
      fileStats.size === chunk.byteSize,
      `${fileName} byte size differs from the generated manifest`,
    );
    const fileBuffer = await readFile(filePath);
    invariant(
      sha256(fileBuffer) === chunk.sha256,
      `${fileName} content differs from the generated manifest`,
    );
    chunksByFileName.set(fileName, {
      filePath,
      byteSize: chunk.byteSize,
      etag: `"${chunk.sha256}"`,
      cacheControl: "public, max-age=31536000, immutable",
      contentType: "image/jpeg",
    });
  }

  return {
    manifest,
    manifestBuffer,
    manifestEtag: `"${sha256(manifestBuffer)}"`,
    chunksByFileName,
  };
}

async function main() {
  const assets = await loadAssets();
  const server = http.createServer((request, response) => {
    if (request.method === "OPTIONS") {
      setCorsHeaders(response);
      response.writeHead(204, {
        "Cache-Control": "no-store",
        Allow: "GET, HEAD, OPTIONS",
      });
      response.end();
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      setCorsHeaders(response);
      response.setHeader("Allow", "GET, HEAD, OPTIONS");
      sendError(response, 405, "Method not allowed");
      return;
    }

    if (hasUnsafeRawPath(request.url)) {
      sendError(response, 404, "W01 asset not found");
      return;
    }

    let pathname;
    try {
      pathname = new URL(request.url || "/", `http://${HOST}:${PORT}`).pathname;
    } catch {
      sendError(response, 400, "Invalid request URL");
      return;
    }

    if (pathname === MANIFEST_ROUTE) {
      sendBuffer(request, response, assets.manifestBuffer, {
        contentType: "application/json; charset=utf-8",
        cacheControl: "no-cache",
        etag: assets.manifestEtag,
      });
      return;
    }

    if (!pathname.startsWith(CHUNK_ROUTE_PREFIX)) {
      sendError(response, 404, "W01 asset not found");
      return;
    }

    let fileName;
    try {
      fileName = decodeURIComponent(pathname.slice(CHUNK_ROUTE_PREFIX.length));
    } catch {
      sendError(response, 400, "Invalid W01 asset path");
      return;
    }
    if (
      fileName !== path.posix.basename(fileName) ||
      fileName.includes("\\") ||
      fileName.includes("\0")
    ) {
      sendError(response, 404, "W01 asset not found");
      return;
    }

    const metadata = assets.chunksByFileName.get(fileName);
    if (!metadata) {
      sendError(response, 404, "W01 asset not found");
      return;
    }
    sendFile(request, response, metadata.filePath, metadata);
  });

  server.on("clientError", (_error, socket) => {
    socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
  });
  server.on("error", (error) => {
    console.error(`W01 asset server failed: ${error.message}`);
    process.exitCode = 1;
  });

  server.listen(PORT, HOST, () => {
    console.log(
      [
        `W01 asset server: http://${HOST}:${PORT}/v1/w01`,
        `Manifest: ${MANIFEST_PATH}`,
        `Source chunks (read-only): ${CHUNK_ROOT}`,
        `Version: ${assets.manifest.map.version}`,
      ].join("\n"),
    );
  });

  const close = () => server.close(() => process.exit());
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
}

main().catch((error) => {
  console.error(`W01 asset server failed: ${error.message}`);
  process.exitCode = 1;
});
