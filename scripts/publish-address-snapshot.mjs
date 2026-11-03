import { createHash } from 'node:crypto';
import { readFile, lstat, realpath, writeFile, appendFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ADDRESS_SNAPSHOT_CONFIG } from '../server/src/utils/addressSnapshotConfig.js';
import { createAddressSnapshotRepository } from '../server/src/utils/addressSnapshotRepository.js';

export const ADDRESS_SNAPSHOT_BUCKET = 'carearound-help-content-private';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const requireValue = (value, message) => { if (!value) throw new Error(message); };
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Local inspection only. Dataset files stay external to the public repository.
export async function loadAddressPublicationPlan(artifactRoot, { expected = ADDRESS_SNAPSHOT_CONFIG } = {}) {
    requireValue(isAbsolute(artifactRoot || ''), 'Use an absolute external artifact directory.');
    const directory = await realpath(artifactRoot), outside = relative(root, directory);
    requireValue(outside === '..' || outside.startsWith(`..${sep}`), 'Address payloads must remain outside the repository.');
    const manifestFile = join(directory, 'manifest.json');
    requireValue((await lstat(manifestFile)).isFile() && !(await lstat(manifestFile)).isSymbolicLink(), 'Manifest must be a regular file.');
    const manifestBytes = await readFile(manifestFile);
    requireValue(manifestBytes.length === expected.manifestBytes && sha(manifestBytes) === expected.manifestSha256, 'Manifest differs from the approved pin.');
    const manifest = JSON.parse(manifestBytes);
    const manifestObject = { key: `${expected.prefix}/manifest.json`, bytes: manifestBytes.length, sha256: expected.manifestSha256, contentType: 'application/json', file: manifestFile };
    // Reuse the serving validator; do not invent a second admitted manifest format.
    await createAddressSnapshotRepository({ get: async key => key === manifestObject.key ? {
        size: manifestBytes.length, httpMetadata: { contentType: 'application/json' }, body: new Response(manifestBytes).body,
    } : null }, { config: expected }).metadata();
    const objects = manifest.tiles.flatMap(tile => ['index', 'rows'].map(kind => ({ ...tile[kind], contentType: kind === 'index' ? 'application/octet-stream' : 'application/json' })));
    for (const object of objects) {
        const suffix = object.key.slice(expected.prefix.length + 1);
        requireValue(object.key.startsWith(`${expected.prefix}/`) && !suffix.split('/').includes('..'), 'Object escaped the approved prefix.');
        object.file = join(directory, suffix);
        const stat = await lstat(object.file);
        requireValue(stat.isFile() && !stat.isSymbolicLink() && stat.size === object.bytes && (await realpath(object.file)).startsWith(directory + sep), 'Artifact file is missing, replaced or outside its directory.');
        requireValue(sha(await readFile(object.file)) === object.sha256, 'Artifact hash differs from the manifest.');
    }
    const inventory = [...objects, manifestObject].map(({ key, bytes, sha256, contentType }) => ({ key, bytes, sha256, contentType }));
    requireValue(new Set(inventory.map(o => o.key)).size === inventory.length && inventory.length === expected.tileCount * 2 + 1
        && inventory.reduce((n, o) => n + o.bytes, 0) === expected.totalBytes, 'Artifact inventory is incomplete.');
    const publicPlan = { schemaVersion: 1, bucket: ADDRESS_SNAPSHOT_BUCKET, prefix: expected.prefix + '/', sourceSha256: expected.sourceSha256,
        manifestSha256: expected.manifestSha256, objectCount: inventory.length, dataObjectCount: objects.length, totalBytes: expected.totalBytes,
        ordering: 'All data objects; independent data GET size/MIME/hash/cache proof; manifest LAST; manifest proof; complete prefix inventory.',
        overwritePolicy: 'Atomic create-only; no deletes, automatic retry or partial-prefix resume.', objects: inventory };
    return { directory, objects, manifest: manifestObject, publicPlan, digest: sha(JSON.stringify(publicPlan)) };
}

export async function verifyAddressObject(bucket, object) {
    const remote = await bucket.get(object.key);
    requireValue(remote && remote.size === object.bytes && remote.httpMetadata?.contentType === object.contentType
        && remote.httpMetadata?.cacheControl === 'private, no-store', 'Remote size/MIME/cache verification failed.');
    const bytes = new Uint8Array(await remote.arrayBuffer());
    requireValue(bytes.byteLength === object.bytes && sha(bytes) === object.sha256, 'Remote object hash verification failed.');
    return true;
}
async function verifyInventory(bucket, plan) {
    const keys = [], seenCursors = new Set(); let cursor;
    do {
        const page = await bucket.list({ prefix: plan.publicPlan.prefix, limit: 1000, ...(cursor ? { cursor } : {}) });
        keys.push(...page.objects.map(o => o.key));
        requireValue(keys.length <= plan.publicPlan.objectCount, 'Remote prefix has unexpected objects.');
        cursor = page.truncated ? page.cursor : undefined;
        requireValue(!page.truncated || typeof cursor === 'string' && cursor && !seenCursors.has(cursor), 'Invalid remote inventory cursor.');
        if (cursor) seenCursors.add(cursor);
    } while (cursor);
    requireValue(JSON.stringify(keys.sort()) === JSON.stringify(plan.publicPlan.objects.map(o => o.key).sort()), 'Remote prefix inventory differs from the approved plan.');
}
export async function verifyAddressPublication(bucket, plan) {
    for (const object of [...plan.objects, plan.manifest]) await verifyAddressObject(bucket, object);
    await verifyInventory(bucket, plan);
    return { verified: true, objectCount: plan.publicPlan.objectCount, planDigest: plan.digest };
}
export async function publishAddressSnapshot(bucket, plan, { checkpoint = async () => {} } = {}) {
    const vacant = await bucket.list({ prefix: plan.publicPlan.prefix, limit: 1 });
    requireValue(vacant.objects.length === 0 && vacant.truncated === false, 'Prefix is occupied or uncertain; do not resume, overwrite or delete it.');
    await checkpoint({ stage: 'vacant', uploaded: 0 });
    let uploaded = 0;
    async function create(object) {
        requireValue(await bucket.head(object.key) === null, 'Object appeared after the prefix check. Stop.');
        const bytes = await readFile(object.file);
        requireValue(bytes.length === object.bytes && sha(bytes) === object.sha256, 'Local artifact changed after plan review.');
        // Checkpoint before every write preserves unknown outcomes. There is no retry.
        await checkpoint({ stage: 'write-intent', uploaded, nextKey: object.key });
        const result = await bucket.put(object.key, bytes, { onlyIf: { etagDoesNotMatch: '*' }, sha256: object.sha256,
            httpMetadata: { contentType: object.contentType, cacheControl: 'private, no-store' } });
        requireValue(result, 'Atomic create-only condition failed. Stop without overwriting.');
        uploaded++;
    }
    for (const object of plan.objects) await create(object);
    for (const object of plan.objects) await verifyAddressObject(bucket, object);
    await checkpoint({ stage: 'data-verified-manifest-absent', uploaded });
    await create(plan.manifest);
    await verifyAddressObject(bucket, plan.manifest);
    await verifyInventory(bucket, plan);
    await checkpoint({ stage: 'verified', uploaded });
    return { verified: true, objectCount: uploaded, planDigest: plan.digest };
}

export function validateAddressOperatorConfig(config) {
    const permitted = new Set(['name', 'compatibility_date', 'compatibility_flags', 'account_id', 'dev', 'r2_buckets']);
    requireValue(Object.keys(config).every(key => permitted.has(key)) && config.compatibility_date === '2026-03-12'
        && JSON.stringify(config.compatibility_flags) === JSON.stringify(['nodejs_compat'])
        && config.dev?.ip === '127.0.0.1' && Object.keys(config.dev).length === 1
        && /^[a-f0-9]{32}$/.test(config.account_id || '') && Array.isArray(config.r2_buckets) && config.r2_buckets.length === 1,
    'Use a reviewed single-binding operator config with no environment files or other resources.');
    const binding = config.r2_buckets[0];
    requireValue(JSON.stringify(Object.keys(binding).sort()) === JSON.stringify(['binding', 'bucket_name', 'remote'])
        && binding.binding === 'SNAPSHOT_OPERATOR_BUCKET' && binding.bucket_name === ADDRESS_SNAPSHOT_BUCKET && binding.remote === true,
    'Operator binding differs from the approved private bucket.');
    return true;
}

export async function openAddressOperator({ wranglerModule, operatorConfig }) {
    requireValue(isAbsolute(wranglerModule || '') && isAbsolute(operatorConfig || ''), 'Use absolute reviewed Wrangler/config paths.');
    const require = createRequire(import.meta.url), pkg = JSON.parse(await readFile(join(wranglerModule, 'package.json')));
    requireValue(pkg.name === 'wrangler' && pkg.version === '4.145.0', 'Use only the reviewed Wrangler4.145.0.');
    const config = JSON.parse(await readFile(operatorConfig, 'utf8'));
    validateAddressOperatorConfig(config);
    const { getPlatformProxy } = require(wranglerModule);
    const platform = await getPlatformProxy({ configPath: operatorConfig, persist: false, envFiles: [], remoteBindings: true });
    return { bucket: platform.env.SNAPSHOT_OPERATOR_BUCKET, dispose: () => platform.dispose() };
}

export async function runAddressPublisher(args = process.argv.slice(2)) {
    const options = {}; const flags = new Set(['--apply', '--verify']);
    for (let i = 0; i < args.length; i++) {
        const key = args[i];
        requireValue(flags.has(key) || ['--artifacts', '--plan-file', '--approval-plan', '--wrangler-module', '--operator-config', '--receipt'].includes(key), 'Unknown publisher argument.');
        requireValue(options[key] === undefined, 'Duplicate publisher argument.');
        options[key] = flags.has(key) ? true : args[++i];
    }
    requireValue(!(options['--apply'] && options['--verify']), 'Choose publication or read-only verification.');
    const plan = await loadAddressPublicationPlan(options['--artifacts']);
    if (!options['--apply'] && !options['--verify']) {
        requireValue(isAbsolute(options['--plan-file'] || ''), 'Dry run needs an absolute plan-file path.');
        await writeFile(options['--plan-file'], JSON.stringify({ ...plan.publicPlan, planDigest: plan.digest }, null, 2) + '\n', { flag: 'wx' });
        return { mode: 'dry-run', remoteSessionStarted: false, remoteWrites: 0, objectCount: plan.publicPlan.objectCount, totalBytes: plan.publicPlan.totalBytes, planDigest: plan.digest };
    }
    const approved = JSON.parse(await readFile(options['--approval-plan'], 'utf8'));
    requireValue(approved.planDigest === plan.digest && sha(JSON.stringify(Object.fromEntries(Object.entries(approved).filter(([key]) => key !== 'planDigest')))) === plan.digest,
        'Reviewed plan does not match the complete local artifact inventory.');
    requireValue(isAbsolute(options['--receipt'] || ''), 'Use a fresh absolute receipt path.');
    // Exclusive creation means an attempted publication can never auto-resume.
    await writeFile(options['--receipt'], JSON.stringify({ state: 'operator-intent', planDigest: plan.digest }) + '\n', { flag: 'wx' });
    await writeFile(options['--receipt'] + '.objects.jsonl', '', { flag: 'wx' });
    const inventory = new Map(plan.publicPlan.objects.map(object => [object.key, object]));
    let operator;
    try {
        operator = await openAddressOperator({ wranglerModule: options['--wrangler-module'], operatorConfig: options['--operator-config'] });
        const result = options['--verify'] ? await verifyAddressPublication(operator.bucket, plan) : await publishAddressSnapshot(operator.bucket, plan, {
            checkpoint: async value => {
                const record = { state: 'in-progress-or-unknown', planDigest: plan.digest, ...value,
                    ...(value.nextKey ? { object: inventory.get(value.nextKey) } : {}) };
                await appendFile(options['--receipt'] + '.objects.jsonl', JSON.stringify(record) + '\n');
                await writeFile(options['--receipt'], JSON.stringify(record) + '\n');
                if (value.stage === 'write-intent' && value.uploaded % 100 === 0) console.log(JSON.stringify({ stage: 'upload-progress', uploaded: value.uploaded, total: plan.publicPlan.objectCount }));
            },
        });
        await writeFile(options['--receipt'], JSON.stringify({ state: 'verified', mode: options['--verify'] ? 'read-only-verification' : 'publication', ...result }) + '\n');
        return result;
    } finally { await operator?.dispose(); }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
    try { console.log(JSON.stringify(await runAddressPublisher())); }
    catch { console.error('Address snapshot operation stopped. Preserve its receipt and inspect state before any new attempt. Private configuration and content were withheld.'); process.exitCode = 1; }
}
