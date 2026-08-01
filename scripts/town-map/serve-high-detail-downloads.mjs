#!/usr/bin/env node

import { createReadStream } from "node:fs";
import { createServer } from "node:http";

import {
  DEFAULT_HIGH_DETAIL_DOWNLOADS_OUTPUT_ROOT,
  DEFAULT_HIGH_DETAIL_DOWNLOADS_R2_PREFIX,
  DEFAULT_HIGH_DETAIL_DOWNLOADS_SOURCE_ROOT,
  invariant,
  loadHighDetailDownloadsPlan,
} from "./high-detail-downloads-lib.mjs";

function argumentValue(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((argument) => argument.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

const HOST = argumentValue("host", "127.0.0.1");
const PORT = Number(argumentValue("port", "4176"));
const PREFIX = argumentValue("prefix", DEFAULT_HIGH_DETAIL_DOWNLOADS_R2_PREFIX);
invariant(Number.isSafeInteger(PORT) && PORT >= 1024 && PORT <= 65535, "Local server port is invalid");

const plan = await loadHighDetailDownloadsPlan({
  sourceRoot: argumentValue("source-root", process.env.TOWN_MAP_DOWNLOAD_SOURCE_ROOT || DEFAULT_HIGH_DETAIL_DOWNLOADS_SOURCE_ROOT),
  outputRoot: argumentValue("output-root", process.env.TOWN_MAP_DOWNLOAD_OUTPUT_ROOT || DEFAULT_HIGH_DETAIL_DOWNLOADS_OUTPUT_ROOT),
  prefix: PREFIX,
  publicBaseUrl: `https://maps.carearound.sg/${PREFIX}`,
  writeMetadata: true,
});
const objects = new Map(
  [
    ...plan.downloadObjects,
    ...plan.thumbnailObjects,
    ...plan.metadataObjects,
    plan.catalogueObject,
  ].map((object) => [object.key, object]),
);

function writeHeaders(response, object, { contentLength = object.byteSize, range } = {}) {
  response.setHeader("Content-Type", object.contentType);
  response.setHeader("Content-Length", String(contentLength));
  response.setHeader("Cache-Control", object.cacheControl);
  response.setHeader("ETag", `"${object.sha256}"`);
  response.setHeader("Accept-Ranges", "bytes");
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Expose-Headers", "Cache-Control, Content-Disposition, Content-Length, Content-Range, ETag");
  if (object.contentDisposition) response.setHeader("Content-Disposition", object.contentDisposition);
  if (range) response.setHeader("Content-Range", `bytes ${range.start}-${range.end}/${object.byteSize}`);
}

function parseRange(value, totalBytes) {
  const match = /^bytes=(\d+)-(\d*)$/.exec(String(value || ""));
  if (!match) return null;
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : totalBytes - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || end >= totalBytes) return null;
  return { start, end };
}

const server = createServer((request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Cache-Control, Range",
      "Access-Control-Max-Age": "86400",
    });
    response.end();
    return;
  }
  if (!["GET", "HEAD"].includes(request.method || "")) {
    response.writeHead(405, { Allow: "GET, HEAD, OPTIONS" });
    response.end();
    return;
  }

  const url = new URL(request.url || "/", `http://${HOST}:${PORT}`);
  const key = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  const object = objects.get(key);
  if (!object) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  const requestedRange = request.headers.range;
  const range = requestedRange ? parseRange(requestedRange, object.byteSize) : null;
  if (requestedRange && !range) {
    response.writeHead(416, { "Content-Range": `bytes */${object.byteSize}` });
    response.end();
    return;
  }

  const contentLength = range ? range.end - range.start + 1 : object.byteSize;
  response.statusCode = range ? 206 : 200;
  writeHeaders(response, object, { contentLength, range });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  createReadStream(object.filePath, range || undefined).pipe(response);
});

server.listen(PORT, HOST, () => {
  console.log(JSON.stringify({
    status: "serving",
    origin: `http://${HOST}:${PORT}`,
    catalogueUrl: `http://${HOST}:${PORT}/${plan.prefix}/catalogue.json`,
    maps: plan.mapCount,
    objects: objects.size,
  }, null, 2));
});
