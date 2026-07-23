#!/usr/bin/env node

import {
  DEFAULT_PRINT_MASTER_PACKAGE_ROOT,
  preparePrintMasterWebAssets,
} from "./r2-print-master-lib.mjs";

function argumentValue(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((argument) => argument.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

const style = argumentValue("style", process.env.TOWN_MAP_STYLE || "default");
const sourceRoot = argumentValue("source-root", process.env.TOWN_MAP_PRINT_SOURCE_ROOT || "");
const packageRoot = argumentValue("package-root", process.env.TOWN_MAP_PRINT_PACKAGE_ROOT || DEFAULT_PRINT_MASTER_PACKAGE_ROOT);
const prepared = await preparePrintMasterWebAssets({ style, sourceRoot, packageRoot });
console.log(JSON.stringify({
  status: "prepared",
  style: prepared.style,
  version: prepared.version,
  packageRoot: prepared.packageRoot,
  indexSha256: prepared.indexSha256,
  surfaces: prepared.surfaces.length,
  chunks: prepared.chunkObjects.length,
  chunkBytes: prepared.index.total_bytes,
  publicFieldsOnly: true,
}, null, 2));
