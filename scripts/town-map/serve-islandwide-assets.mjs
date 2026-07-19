#!/usr/bin/env node

import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import {
  DEFAULT_ISLANDWIDE_MANIFEST_ROOT,
  DEFAULT_ISLANDWIDE_R2_PREFIX,
  DEFAULT_ISLANDWIDE_SOURCE_ROOT,
  invariant,
  loadIslandwideR2DeploymentPlan,
  sha256,
} from "./r2-islandwide-lib.mjs";

const SOURCE_ROOT = path.resolve(process.env.TOWN_MAP_SOURCE_ROOT || DEFAULT_ISLANDWIDE_SOURCE_ROOT);
const MANIFEST_ROOT = path.resolve(process.env.TOWN_MAP_MANIFEST_ROOT || DEFAULT_ISLANDWIDE_MANIFEST_ROOT);
const HOST = process.env.TOWN_MAP_ASSET_HOST || "127.0.0.1";
const PORT = Number(process.env.TOWN_MAP_ASSET_PORT || 4174);
const PREFIX = process.env.TOWN_MAP_R2_PREFIX || DEFAULT_ISLANDWIDE_R2_PREFIX;

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, If-None-Match");
  response.setHeader("Access-Control-Expose-Headers", "Cache-Control, Content-Length, ETag");
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

function hasUnsafeRawPath(requestUrl) {
  const rawPath = String(requestUrl || "/").split(/[?#]/, 1)[0];
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(rawPath);
  } catch {
    return true;
  }
  if (decodedPath.includes("\\") || decodedPath.includes("\0")) return true;
  return decodedPath.split("/").some((segment) => segment === "." || segment === "..");
}

function notModified(request, response, etag, cacheControl) {
  if (request.headers["if-none-match"] !== etag) return false;
  setCorsHeaders(response);
  response.writeHead(304, { "Cache-Control": cacheControl, ETag: etag });
  response.end();
  return true;
}

function sendBuffer(request, response, buffer, metadata) {
  if (notModified(request, response, metadata.etag, metadata.cacheControl)) return;
  setCorsHeaders(response);
  response.writeHead(200, {
    "Cache-Control": metadata.cacheControl,
    "Content-Type": metadata.contentType,
    "Content-Length": buffer.length,
    ETag: metadata.etag,
  });
  response.end(request.method === "HEAD" ? undefined : buffer);
}

function sendFile(request, response, metadata) {
  if (notModified(request, response, metadata.etag, metadata.cacheControl)) return;
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
  const stream = createReadStream(metadata.filePath);
  stream.on("error", (error) => {
    if (response.headersSent) {
      response.destroy(error);
      return;
    }
    sendError(response, 500, "Unable to read islandwide map asset");
  });
  stream.pipe(response);
}

async function loadObjects() {
  const [defaultPlan, grayPlan] = await Promise.all([
    loadIslandwideR2DeploymentPlan({
      style: "default",
      sourceRoot: SOURCE_ROOT,
      manifestRoot: MANIFEST_ROOT,
      prefix: PREFIX,
    }),
    loadIslandwideR2DeploymentPlan({
      style: "gray",
      sourceRoot: SOURCE_ROOT,
      manifestRoot: MANIFEST_ROOT,
      prefix: PREFIX,
    }),
  ]);
  const objects = new Map();
  const addJsonObject = async (object) => {
    const buffer = await readFile(object.filePath);
    objects.set(`/${object.key}`, {
      kind: "buffer",
      buffer,
      etag: `"${sha256(buffer)}"`,
      contentType: object.contentType,
      cacheControl: "no-cache",
    });
  };
  for (const object of [defaultPlan.indexObject, ...defaultPlan.manifestObjects, grayPlan.indexObject, ...grayPlan.manifestObjects]) {
    await addJsonObject(object);
  }
  for (const object of [...defaultPlan.chunkObjects, ...grayPlan.chunkObjects]) {
    objects.set(`/${object.key}`, {
      kind: "file",
      filePath: object.filePath,
      byteSize: object.byteSize,
      etag: `"${object.sha256}"`,
      contentType: object.contentType,
      cacheControl: object.cacheControl,
    });
  }

  return { objects, defaultPlan, grayPlan };
}

async function main() {
  invariant(Number.isSafeInteger(PORT) && PORT >= 1 && PORT <= 65535, `Invalid TOWN_MAP_ASSET_PORT: ${process.env.TOWN_MAP_ASSET_PORT}`);
  const { objects, defaultPlan, grayPlan } = await loadObjects();
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
      sendError(response, 404, "Islandwide map asset not found");
      return;
    }

    let pathname;
    try {
      pathname = new URL(request.url || "/", `http://${HOST}:${PORT}`).pathname;
    } catch {
      sendError(response, 400, "Invalid request URL");
      return;
    }
    let object;
    try {
      object = objects.get(decodeURIComponent(pathname));
    } catch {
      sendError(response, 400, "Invalid islandwide map asset path");
      return;
    }
    if (!object) {
      sendError(response, 404, "Islandwide map asset not found");
      return;
    }
    if (object.kind === "buffer") {
      sendBuffer(request, response, object.buffer, object);
      return;
    }
    sendFile(request, response, object);
  });

  server.on("clientError", (_error, socket) => {
    socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
  });
  server.on("error", (error) => {
    console.error(`Islandwide asset server failed: ${error.message}`);
    process.exitCode = 1;
  });

  server.listen(PORT, HOST, () => {
    console.log([
      `Islandwide asset server: http://${HOST}:${PORT}/${PREFIX}`,
      `Default: ${defaultPlan.version} (${defaultPlan.surfaceCount} surfaces, ${defaultPlan.chunkCount} chunks)`,
      `Gray: ${grayPlan.version} (${grayPlan.surfaceCount} surfaces, ${grayPlan.chunkCount} chunks)`,
      `Source chunks remain read-only under ${SOURCE_ROOT}`,
    ].join("\n"));
  });

  const close = () => server.close(() => process.exit());
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
}

main().catch((error) => {
  console.error(`Islandwide asset server failed: ${error.message}`);
  process.exitCode = 1;
});
