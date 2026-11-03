import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildAddressSnapshot, compileAddressSnapshotRecords, parseSnapshotBuildArguments } from './build-address-snapshot.mjs';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const records = [['018906', '1', 'A', 'B', 'C', '1.3', '103.8'], ['018906', '1', 'A', 'B', 'C', '1.3', '103.8'],
    ['018906', '2', 'A', 'Another', 'Second', '1.30000000000001', '103.80000000000001']];

test('compiler preserves duplicate source rows, original IDs and exact Float64s in deterministic immutable objects', () => {
    const options = { sourceSha256: 'a'.repeat(64), preparedAt: '2026-11-03T00:00:00.000Z' };
    const first = compileAddressSnapshotRecords(records, options), second = compileAddressSnapshotRecords(records, options);
    assert.equal(first.config.recordCount, 3); assert.equal(first.config.postalCodeCount, 1);
    assert.equal(first.config.manifestSha256, second.config.manifestSha256);
    assert.deepEqual([...first.objects.keys()], [...second.objects.keys()]);
    const tile = first.manifest.tiles[0], tuples = JSON.parse(first.objects.get(tile.rows.key).bytes);
    assert.equal(tuples[0][0], `address_${hash(JSON.stringify(records[0]))}_1`);
    assert.equal(tuples[1][0], `address_${hash(JSON.stringify(records[1]))}_2`);
    assert.equal(tuples[2][1], '018906');
    const indices = first.objects.get(tile.index.key).bytes;
    assert.equal(indices.readDoubleLE(40), Number(records[2][5]));
    assert.equal(indices.readDoubleLE(48), Number(records[2][6]));
    assert.equal(indices.readUInt32LE(56), 2);
    assert.equal([...first.objects.keys()].at(-1), `${first.config.prefix}/manifest.json`);
});

test('invalid, empty or non-string source records cannot become a published snapshot', () => {
    const options = { sourceSha256: 'a'.repeat(64), preparedAt: '2026-11-03T00:00:00.000Z' };
    for (const input of [[], [[...records[0].slice(0, 5), '', '103.8']], [[18906, ...records[0].slice(1)]],
        [['18906', ...records[0].slice(1)]], [[...records[0].slice(0, 5), '103.8', '1.3']]]) assert.throws(() => compileAddressSnapshotRecords(input, options));
});

test('external create-only build reproduces the compiled pin without modifying the CSV or allowing a retry overwrite', async t => {
    const directory = await mkdtemp(join(tmpdir(), 'address-compiler-test-')); t.after(() => rm(directory, { recursive: true, force: true }));
    const contents = 'postal_code,blk_no,road_name,building,address,latitude,longitude\n' + records.map(row => row.join(',')).join('\n') + '\n';
    const csvPath = join(directory, 'source.csv'); await writeFile(csvPath, contents);
    const before = await stat(csvPath), expected = compileAddressSnapshotRecords(records, { sourceSha256: hash(contents), preparedAt: before.mtime.toISOString() }).config;
    const outputRoot = join(directory, 'compiled');
    const result = await buildAddressSnapshot({ csvPath, outputRoot, expected });
    assert.equal(result.objectCount, expected.tileCount * 2 + 1);
    assert.equal(hash(await readFile(join(outputRoot, 'manifest.json'))), expected.manifestSha256);
    await assert.rejects(buildAddressSnapshot({ csvPath, outputRoot, expected }), /exist|EEXIST/);
    const after = await stat(csvPath); assert.equal(after.mtimeMs, before.mtimeMs); assert.equal(hash(await readFile(csvPath)), hash(contents));
    await assert.rejects(buildAddressSnapshot({ csvPath, outputRoot: join(directory, 'bad'), expected: { ...expected, sourceSha256: 'b'.repeat(64) } }), /Source bytes/);
    await assert.rejects(buildAddressSnapshot({ csvPath, outputRoot: join(directory, 'bad'), expected: { ...expected, manifestSha256: 'b'.repeat(64) } }), /Compiled snapshot/);
    const repoOutput = new URL('../output/forbidden-address-payload', import.meta.url).pathname;
    await assert.rejects(buildAddressSnapshot({ csvPath, outputRoot: repoOutput, expected }), /outside the repository/);
});

test('builder CLI only accepts explicit source and fresh external output paths', () => {
    assert.deepEqual(parseSnapshotBuildArguments(['--csv', '/tmp/a.csv', '--out', '/tmp/out']), { csvPath: '/tmp/a.csv', outputRoot: '/tmp/out' });
    for (const args of [['--csv'], ['--overwrite', 'true'], ['--csv', '/tmp/a', '--csv', '/tmp/b']]) assert.throws(() => parseSnapshotBuildArguments(args));
});
