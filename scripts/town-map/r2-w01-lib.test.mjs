import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_W01_MANIFEST_PATH,
  normalizeR2Prefix,
  validateW01ManifestBuffer,
} from "./r2-w01-lib.mjs";
import {
  DEFAULT_W01_GRAY_MANIFEST_PATH,
  validateW01GrayManifestBuffer,
} from "./r2-w01-gray-lib.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

test("committed W01 manifest passes the R2 deployment contract", async () => {
  const manifestBuffer = await readFile(DEFAULT_W01_MANIFEST_PATH);
  const validated = validateW01ManifestBuffer(manifestBuffer);

  assert.equal(validated.manifest.map.id, "W01");
  assert.equal(validated.manifest.chunks.length, 300);
  assert.equal(validated.totalBytes, 53590423);
  assert.equal(
    validated.manifestSha256,
    "be5f6ed4dfdea33606354f4457aebdc513c0f274f4ea7cb429bdce5d73056c76",
  );
});

test("committed Gray W01 manifest passes its isolated R2 deployment contract", async () => {
  const manifestBuffer = await readFile(DEFAULT_W01_GRAY_MANIFEST_PATH);
  const validated = validateW01GrayManifestBuffer(manifestBuffer);

  assert.equal(validated.manifest.map.style, "gray");
  assert.equal(validated.manifest.chunks.length, 88);
  assert.equal(validated.totalBytes, 48817738);
  assert.equal(
    validated.manifestSha256,
    "58bb3880ee09b9b6bac938545048694b8d6a38728ddaf874db5e606971603640",
  );
});

test("R2 deployment contract rejects a manifest chunk URL outside the allowlist", async () => {
  const manifest = JSON.parse(await readFile(DEFAULT_W01_MANIFEST_PATH, "utf8"));
  manifest.chunks[0].url = "chunks/../private.jpg";

  assert.throws(
    () => validateW01ManifestBuffer(Buffer.from(JSON.stringify(manifest))),
    /Unsafe W01 chunk URL/,
  );
});

test("R2 object prefix stays versioned and traversal-safe", () => {
  assert.equal(normalizeR2Prefix("/v1/w01/"), "v1/w01");
  assert.throws(() => normalizeR2Prefix("v1/../private"), /Unsafe R2 object prefix/);
  assert.throws(() => normalizeR2Prefix(""), /required/);
});

test("R2 CORS stays read-only and limited to CareAround release origins", async () => {
  const cors = JSON.parse(
    await readFile(path.join(SCRIPT_DIR, "r2-cors.json"), "utf8"),
  );

  assert.deepEqual(cors.rules[0].allowed.methods, ["GET", "HEAD"]);
  assert.deepEqual(cors.rules[0].allowed.origins, [
    "https://app.carearound.sg",
    "https://codex-cck-w01-town-map-proof.senior-resource-map.pages.dev",
    "https://codex-map-style-preference.senior-resource-map.pages.dev",
  ]);
  assert.ok(cors.rules[0].allowed.headers.includes("Cache-Control"));
  assert.ok(cors.rules[0].allowed.headers.includes("Pragma"));
  assert.equal(cors.rules[0].allowed.methods.includes("PUT"), false);
  assert.equal(cors.rules[0].allowed.origins.includes("*"), false);
});
