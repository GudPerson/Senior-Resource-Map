#!/usr/bin/env node

import {
  DEFAULT_HIGH_DETAIL_DOWNLOADS_OUTPUT_ROOT,
  DEFAULT_HIGH_DETAIL_DOWNLOADS_R2_PREFIX,
  DEFAULT_HIGH_DETAIL_DOWNLOADS_SOURCE_ROOT,
  loadHighDetailDownloadsPlan,
} from "./high-detail-downloads-lib.mjs";

function argumentValue(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((argument) => argument.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

const plan = await loadHighDetailDownloadsPlan({
  sourceRoot: argumentValue("source-root", process.env.TOWN_MAP_DOWNLOAD_SOURCE_ROOT || DEFAULT_HIGH_DETAIL_DOWNLOADS_SOURCE_ROOT),
  outputRoot: argumentValue("output-root", process.env.TOWN_MAP_DOWNLOAD_OUTPUT_ROOT || DEFAULT_HIGH_DETAIL_DOWNLOADS_OUTPUT_ROOT),
  prefix: argumentValue("prefix", process.env.TOWN_MAP_DOWNLOAD_R2_PREFIX || DEFAULT_HIGH_DETAIL_DOWNLOADS_R2_PREFIX),
  publicBaseUrl: argumentValue("public-base-url", process.env.TOWN_MAP_DOWNLOAD_PUBLIC_BASE_URL),
  writeMetadata: true,
});

console.log(JSON.stringify({
  status: "prepared",
  version: plan.version,
  sourceRoot: argumentValue("source-root", process.env.TOWN_MAP_DOWNLOAD_SOURCE_ROOT || DEFAULT_HIGH_DETAIL_DOWNLOADS_SOURCE_ROOT),
  outputRoot: argumentValue("output-root", process.env.TOWN_MAP_DOWNLOAD_OUTPUT_ROOT || DEFAULT_HIGH_DETAIL_DOWNLOADS_OUTPUT_ROOT),
  prefix: plan.prefix,
  publicBaseUrl: plan.publicBaseUrl,
  mapCount: plan.mapCount,
  pngCount: plan.records.length,
  pdfCount: plan.records.length,
  thumbnailCount: plan.thumbnailObjects.length,
  totalBytes: plan.totalBytes,
  catalogueSha256: plan.catalogueObject.sha256,
  validationSha256: plan.metadataObjects[0].sha256,
  provenanceSha256: plan.metadataObjects[1].sha256,
  publishOrder: plan.publishOrder,
}, null, 2));
