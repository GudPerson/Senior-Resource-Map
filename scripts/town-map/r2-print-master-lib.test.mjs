import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  preparePrintMasterWebAssets,
  sanitizePrintMasterManifest,
  sha256,
  validatePrintMasterWebIndexBuffer,
} from "./r2-print-master-lib.mjs";

function manifest(chunkBuffer) {
  return {
    schema: "carearound.grey-print-master/v1",
    edition: "test",
    generated_at: "2026-07-23T00:00:00Z",
    id: "W01",
    name: "Test",
    planning_areas: ["TEST"],
    bounds: [103.7, 1.3, 103.8, 1.4],
    source_retention_scale: 1,
    source: { provider: "OneMap", style: "Grey", detail_equivalent_zoom: 19, raw_cache_root: "/private/cache" },
    pdf: "/private/qa.pdf",
    chunks: [{ id: "z19-1-2-3-4", path: "/private/chunk.jpg", source_section: "/private/source.png", url: "chunks/W01-s100-q95/z19-1-2-3-4.jpg", left: 1, top: 2, right: 3, bottom: 4, width: 2, height: 2, bytes: chunkBuffer.length, sha256: sha256(chunkBuffer) }],
  };
}

test("print-master packaging removes local paths and keeps the strict 100% contract", () => {
  const sanitized = sanitizePrintMasterManifest(manifest(Buffer.from("jpeg")), { style: "gray", expectedSurfaceId: "W01" });
  const serialized = JSON.stringify(sanitized);
  assert.equal(sanitized.source_retention_scale, 1);
  assert.equal(sanitized.chunks.length, 1);
  assert.doesNotMatch(serialized, /private|raw_cache_root|source_section|\"pdf\"/);
});

test("print-master deployment package validates every source chunk and writes index last", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "print-master-source-"));
  const output = await mkdtemp(path.join(os.tmpdir(), "print-master-output-"));
  const chunkBuffer = Buffer.from("jpeg");
  await mkdir(path.join(root, "manifests"), { recursive: true });
  await mkdir(path.join(root, "chunks/W01-s100-q95"), { recursive: true });
  await writeFile(path.join(root, "chunks/W01-s100-q95/z19-1-2-3-4.jpg"), chunkBuffer);
  await writeFile(path.join(root, "manifests/w01-grey-print-master-100.json"), `${JSON.stringify(manifest(chunkBuffer))}\n`);
  const prepared = await preparePrintMasterWebAssets({ style: "gray", sourceRoot: root, packageRoot: output, expectedSurfaceCount: 1 });
  const indexBuffer = await readFile(prepared.indexPath);
  const validated = validatePrintMasterWebIndexBuffer(indexBuffer, { style: "gray", expectedSurfaceCount: 1 });
  assert.equal(validated.index.chunk_count, 1);
  assert.equal(prepared.chunkObjects[0].sha256, sha256(chunkBuffer));
});
