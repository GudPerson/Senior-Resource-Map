import assert from "node:assert/strict";
import { readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  CATALOGUE_CACHE_CONTROL,
  DEFAULT_HIGH_DETAIL_DOWNLOADS_PUBLIC_BASE_URL,
  DEFAULT_HIGH_DETAIL_DOWNLOADS_R2_PREFIX,
  HIGH_DETAIL_DOWNLOADS_ALLOWED_ORIGINS,
  HIGH_DETAIL_DOWNLOADS_ATTRIBUTION,
  HIGH_DETAIL_DOWNLOADS_MAP_IDS,
  HIGH_DETAIL_DOWNLOADS_SCHEMA,
  HIGH_DETAIL_DOWNLOADS_VERSION,
  assertRemoteObjectVacant,
  assertRemotePrefixVacant,
  loadHighDetailDownloadsPlan,
  normalizeHighDetailDownloadsPrefix,
  validateHighDetailDownloadsCatalogue,
} from "./high-detail-downloads-lib.mjs";

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const OUTPUT_ROOT = path.join(tmpdir(), `carearound-town-map-downloads-test-${process.pid}`);

let planPromise;
function getPlan() {
  if (!planPromise) {
    planPromise = loadHighDetailDownloadsPlan({ outputRoot: OUTPUT_ROOT, writeMetadata: true });
  }
  return planPromise;
}

test.after(async () => {
  await rm(OUTPUT_ROOT, { recursive: true, force: true });
});

test("validated source libraries produce one strict 32-map download catalogue", async () => {
  const plan = await getPlan();

  assert.equal(plan.prefix, DEFAULT_HIGH_DETAIL_DOWNLOADS_R2_PREFIX);
  assert.equal(plan.publicBaseUrl, DEFAULT_HIGH_DETAIL_DOWNLOADS_PUBLIC_BASE_URL);
  assert.equal(plan.version, HIGH_DETAIL_DOWNLOADS_VERSION);
  assert.equal(plan.mapCount, 32);
  assert.equal(plan.downloadObjects.length, 64);
  assert.equal(plan.thumbnailObjects.length, 32);
  assert.equal(plan.metadataObjects.length, 2);
  assert.equal(plan.catalogue.schema, HIGH_DETAIL_DOWNLOADS_SCHEMA);
  assert.equal(plan.catalogue.attribution, HIGH_DETAIL_DOWNLOADS_ATTRIBUTION);
  assert.deepEqual(plan.catalogue.allowedOrigins, HIGH_DETAIL_DOWNLOADS_ALLOWED_ORIGINS);
  assert.deepEqual(plan.records.map((record) => record.code).sort(), [...HIGH_DETAIL_DOWNLOADS_MAP_IDS].sort());
  assert.equal(plan.validation.status, "pass");
  assert.equal(plan.validation.validatedMapCount, 32);
  assert.equal(plan.validation.png.totalBytes, 1061303600);
  assert.equal(plan.validation.pdf.totalBytes, 1797082183);
  assert.equal(plan.catalogueObject.cacheControl, CATALOGUE_CACHE_CONTROL);
  assert.match(plan.publishOrder, /PNG\/PDF binaries and thumbnails[\s\S]*validation\/provenance[\s\S]*catalogue\.json/);
  assert.doesNotMatch(JSON.stringify(plan.provenance), /\/Users\//);

  for (const record of plan.records) {
    assert.equal(record.png.width, 10000);
    assert.equal(record.png.height, 7000);
    assert.ok(record.png.dpi.every((value) => Math.abs(value - 300) < 0.05));
    assert.equal(record.pdf.pageCount, 1);
    assert.ok(Math.abs(record.pdf.pageSizeMm[0] - 1750) < 0.02);
    assert.ok(Math.abs(record.pdf.pageSizeMm[1] - 1225) < 0.02);
    assert.equal(record.thumbnail.width, 1000);
    assert.equal(record.thumbnail.height, 700);
    assert.match(record.png.sha256, /^[a-f0-9]{64}$/);
    assert.match(record.pdf.sha256, /^[a-f0-9]{64}$/);
    assert.match(record.thumbnail.sha256, /^[a-f0-9]{64}$/);
    assert.ok(record.png.url.startsWith(`${DEFAULT_HIGH_DETAIL_DOWNLOADS_PUBLIC_BASE_URL}/png/`));
    assert.ok(record.pdf.url.startsWith(`${DEFAULT_HIGH_DETAIL_DOWNLOADS_PUBLIC_BASE_URL}/pdf/`));
  }

  for (const fileName of ["catalogue.json", "validation.json", "provenance.json"]) {
    const fileStats = await stat(path.join(OUTPUT_ROOT, fileName));
    assert.ok(fileStats.size > 0, `${fileName} should be generated outside the client bundle`);
  }
});

test("catalogue parser rejects incomplete, untrusted, or non-versioned assets", async () => {
  const plan = await getPlan();
  assert.equal(validateHighDetailDownloadsCatalogue(plan.catalogue), plan.catalogue);

  const missingMap = structuredClone(plan.catalogue);
  missingMap.maps.pop();
  assert.throws(() => validateHighDetailDownloadsCatalogue(missingMap), /32 maps/);

  const wrongOrigin = structuredClone(plan.catalogue);
  wrongOrigin.allowedOrigins = ["*"];
  assert.throws(() => validateHighDetailDownloadsCatalogue(wrongOrigin), /allowed origins/);

  const wrongUrl = structuredClone(plan.catalogue);
  wrongUrl.maps[0].png.url = "https://example.com/map.png";
  assert.throws(() => validateHighDetailDownloadsCatalogue(wrongUrl), /outside the versioned root/);

  const wrongMime = structuredClone(plan.catalogue);
  wrongMime.maps[0].pdf.mimeType = "application/octet-stream";
  assert.throws(() => validateHighDetailDownloadsCatalogue(wrongMime), /MIME type/);

  const wrongHash = structuredClone(plan.catalogue);
  wrongHash.maps[0].thumbnail.sha256 = "not-a-hash";
  assert.throws(() => validateHighDetailDownloadsCatalogue(wrongHash), /SHA-256/);
});

test("publication prefixes stay immutable, versioned, and traversal-safe", () => {
  assert.equal(
    normalizeHighDetailDownloadsPrefix("/v4/town-map-downloads-20260801-r2/default/"),
    DEFAULT_HIGH_DETAIL_DOWNLOADS_R2_PREFIX,
  );
  assert.equal(
    normalizeHighDetailDownloadsPrefix("/v4/town-map-downloads-20260801/default/"),
    "v4/town-map-downloads-20260801/default",
  );
  assert.throws(() => normalizeHighDetailDownloadsPrefix("v4/town-map-downloads-20260801-r0/default"), /immutable versioned root/);
  assert.throws(() => normalizeHighDetailDownloadsPrefix("v4/town-map-downloads/default"), /immutable versioned root/);
  assert.throws(() => normalizeHighDetailDownloadsPrefix("v4/../private/default"), /Unsafe R2 object prefix/);
  assert.throws(() => normalizeHighDetailDownloadsPrefix("v2/native-scale-20260722/default"), /immutable versioned root/);
});

test("apply preflight accepts only a completely vacant prefix", async () => {
  const plan = await getPlan();
  let requests = 0;
  await assertRemotePrefixVacant(plan, {
    concurrency: 4,
    fetchImpl: async (_url, options) => {
      requests += 1;
      assert.equal(options.method, "HEAD");
      assert.equal(options.headers.Origin, "https://app.carearound.sg");
      return new Response(null, { status: 404 });
    },
  });
  assert.equal(requests, 99);

  await assert.rejects(
    assertRemotePrefixVacant(plan, {
      concurrency: 1,
      fetchImpl: async () => new Response(null, { status: 200 }),
    }),
    /already exists/,
  );
});

test("each PUT attempt independently fails closed when its object key exists", async () => {
  const plan = await getPlan();
  const object = plan.downloadObjects[0];
  await assertRemoteObjectVacant(plan, object, {
    fetchImpl: async (_url, options) => {
      assert.equal(options.method, "HEAD");
      return new Response(null, { status: 404 });
    },
  });
  await assert.rejects(
    assertRemoteObjectVacant(plan, object, {
      fetchImpl: async () => new Response(null, { status: 200 }),
    }),
    /already exists/,
  );
});

test("upload tooling is dry-run by default, catalogue-last, and contains no delete path", async () => {
  const source = await readFile(path.join(REPO_ROOT, "scripts/town-map/upload-high-detail-downloads-r2.mjs"), "utf8");
  assert.match(source, /const APPLY = process\.argv\.includes\("--apply"\)/);
  assert.match(source, /if \(!APPLY\)[\s\S]*Dry run complete/);
  assert.match(source, /assertRemotePrefixVacant\(plan\)[\s\S]*putObject\(plan, canaryObject\)[\s\S]*verifyCanaryFullDownload\(plan, canaryObject\)[\s\S]*uploadGroup\(plan, "remaining immutable PNG\/PDF files and thumbnails"[\s\S]*uploadGroup\(plan, "immutable validation\/provenance metadata"[\s\S]*putObject\(plan, plan\.catalogueObject\)/);
  assert.match(source, /async function putObject\(plan, object\)[\s\S]*assertRemoteObjectVacant\(plan, object\)[\s\S]*runCommand/);
  assert.match(source, /C08 canary passed/);
  assert.match(source, /waitForPublicObject[\s\S]*"Accept-Encoding": "identity"[\s\S]*AbortSignal\.timeout\(15000\)[\s\S]*lastError/);
  assert.doesNotMatch(source, /\brm\b|\.delete\(|r2[\s\S]{0,40}object[\s\S]{0,40}delete/i);
});

test("remote verification uses real PNG GETs, bounded PDF range hashing, and can audit an unpublished catalogue root", async () => {
  const source = await readFile(path.join(REPO_ROOT, "scripts/town-map/verify-high-detail-downloads-r2.mjs"), "utf8");
  assert.match(source, /const WITHOUT_CATALOGUE = process\.argv\.includes\("--without-catalogue"\)/);
  assert.match(source, /Range: `bytes=\$\{start\}-\$\{end\}`/);
  assert.doesNotMatch(source, /range-hash=.*\$\{attempt\}/);
  assert.match(source, /AbortSignal\.timeout\(120000\)/);
  assert.match(source, /"Accept-Encoding": "identity"/);
  assert.match(source, /object\.contentType === "application\/pdf"[\s\S]*verifyObjectWithRanges[\s\S]*verifyObjectWithFullGet/);
  assert.match(source, /full GET could not be verified/);
  assert.match(source, /HEAD verification failed/);
  assert.match(source, /catalogueResponse\.status === 404/);
});

test("bucket CORS remains read-only, range-aware, and limited to CareAround origins", async () => {
  const cors = JSON.parse(await readFile(path.join(REPO_ROOT, "scripts/town-map/r2-cors.json"), "utf8"));
  const rule = cors.rules[0];
  assert.deepEqual(rule.allowed.methods, ["GET", "HEAD"]);
  assert.ok(rule.allowed.origins.includes("https://app.carearound.sg"));
  assert.equal(rule.allowed.origins.includes("*"), false);
  assert.ok(rule.allowed.headers.includes("Range"));
  assert.ok(rule.exposeHeaders.includes("Content-Range"));
  assert.ok(rule.exposeHeaders.includes("Content-Length"));
});
