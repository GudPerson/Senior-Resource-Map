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
export const ADDRESS_PUBLICATION_PROTOCOL = Object.freeze({ maxConcurrency: 4, readAttempts: 3, readBackoffMs: Object.freeze([250, 1000]), canary: 'First index and matching row pack, each GET-verified before bulk', putAttempts: 1 });

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
        protocol: ADDRESS_PUBLICATION_PROTOCOL, canaryKeys: objects.slice(0, 2).map(object => object.key),
        ordering: 'Two verified canaries; bounded create-and-readback workers; all data verified; manifest LAST; manifest proof; complete prefix inventory.',
        overwritePolicy: 'Atomic create-only; no PUT retries, deletes or partial-prefix resume. Bounded transient retries are read-only.', objects: inventory };
    return { directory, objects, manifest: manifestObject, publicPlan, digest: sha(JSON.stringify(publicPlan)) };
}

export class AddressPublicationError extends Error {
    constructor(code, { phase, object, status, errorClass } = {}) {
        super(`Address operation stopped: ${code}.`);
        this.name = 'AddressPublicationError'; this.code = code; this.phase = phase;
        this.errorClass = errorClass || (/MISMATCH/.test(code) ? 'integrity' : code === 'PUT_OUTCOME_UNKNOWN' ? 'unknown-put' : code === 'JOURNAL_FAILURE' ? 'journal' : 'protocol');
        if (object) { this.key = object.key; this.sha256 = object.sha256; }
        if (Number.isInteger(status)) this.status = status;
    }
}
function readFailure(error) {
    const message = String(error?.message || '').slice(0, 2048);
    const directStatus = Number(error?.status ?? error?.statusCode ?? error?.response?.status ?? error?.cause?.status ?? error?.cause?.statusCode);
    const match = message.match(/\b(?:HTTP(?:\/[0-9.]+)?|status(?:\s*code)?|returned|response)\s*[:=]?\s*(\d{3})\b/i)
        || message.match(/\b(500|502|503|504)\b/i);
    const status = Number.isInteger(directStatus) && directStatus >= 100 && directStatus <= 599 ? directStatus : match ? Number(match[1]) : undefined;
    const network = ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ECONNREFUSED', 'UND_ERR_SOCKET', 'UND_ERR_CONNECT_TIMEOUT'].some(code => code === error?.code || code === error?.cause?.code)
        || error?.name === 'TypeError' && /fetch|network|socket|connection/i.test(message);
    return { status, transient: !(error instanceof AddressPublicationError) && (status !== undefined ? [500, 502, 503, 504].includes(status) : network),
        errorClass: status !== undefined ? 'http' : network ? 'network' : 'unclassified' };
}
export function addressPublicationFailure(error) {
    return error instanceof AddressPublicationError
        ? { code: error.code, phase: error.phase, errorClass: error.errorClass, ...(error.key ? { key: error.key, sha256: error.sha256 } : {}), ...(error.status ? { status: error.status } : {}), ...error.counts }
        : { code: 'PREPARATION_OR_OPERATOR_FAILURE', phase: 'preparation-or-session' };
}
function journal(checkpoint = async () => {}) {
    let tail = Promise.resolve();
    return event => {
        const next = tail.then(async () => {
            const { object, ...fields } = event;
            const descriptor = object ? { key: object.key, bytes: object.bytes, sha256: object.sha256, contentType: object.contentType } : undefined;
            try { await checkpoint({ atUTC: new Date().toISOString(), ...fields, ...(descriptor ? { object: descriptor } : {}) }); }
            catch { throw new AddressPublicationError('JOURNAL_FAILURE', { phase: 'journal', object: event.object }); }
        });
        tail = next; next.catch(() => {}); return next;
    };
}
const defaultSleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function readOnly(action, { emit, phase, operation, object, sleep = defaultSleep }) {
    for (let attempt = 1; attempt <= ADDRESS_PUBLICATION_PROTOCOL.readAttempts; attempt++) {
        const started = Date.now();
        await emit({ stage: 'read-intent', phase, operation, object, attempt });
        try {
            const value = await action();
            await emit({ stage: 'read-ack', phase, operation, object, attempt, durationMs: Date.now() - started });
            return value;
        } catch (error) {
            if (error instanceof AddressPublicationError) throw error;
            const failure = readFailure(error);
            if (!failure.transient || attempt === ADDRESS_PUBLICATION_PROTOCOL.readAttempts) {
                throw new AddressPublicationError(failure.transient ? 'TRANSIENT_READ_EXHAUSTED' : 'READ_FAILED', { phase, object, status: failure.status, errorClass: failure.errorClass });
            }
            await emit({ stage: 'read-retry', phase, operation, object, attempt, errorClass: failure.errorClass,
                ...(failure.status ? { status: failure.status } : {}), backoffMs: ADDRESS_PUBLICATION_PROTOCOL.readBackoffMs[attempt - 1] });
            await sleep(ADDRESS_PUBLICATION_PROTOCOL.readBackoffMs[attempt - 1]);
        }
    }
}
async function workers(items, action, concurrency) {
    requireValue(Number.isSafeInteger(concurrency) && concurrency >= 1 && concurrency <= ADDRESS_PUBLICATION_PROTOCOL.maxConcurrency, 'Worker concurrency must be from1 to4.');
    let next = 0, failed;
    async function worker() {
        while (!failed && next < items.length) {
            const item = items[next++];
            try { await action(item, () => Boolean(failed)); }
            catch (error) { failed ||= error; }
        }
    }
    // Every started read/PUT and its journal acknowledgment settles before exit.
    await Promise.allSettled(Array.from({ length: Math.min(concurrency, items.length) }, worker));
    if (failed) throw failed;
}
export async function verifyAddressObject(bucket, object, { checkpoint, emit = journal(checkpoint), sleep, phase = 'data-verify' } = {}) {
    return readOnly(async () => {
        const remote = await bucket.get(object.key);
        if (!remote || remote.size !== object.bytes || remote.httpMetadata?.contentType !== object.contentType
            || remote.httpMetadata?.cacheControl !== 'private, no-store') throw new AddressPublicationError('REMOTE_METADATA_MISMATCH', { phase, object });
        const bytes = new Uint8Array(await remote.arrayBuffer());
        if (bytes.byteLength !== object.bytes || sha(bytes) !== object.sha256) throw new AddressPublicationError('REMOTE_HASH_MISMATCH', { phase, object });
        return true;
    }, { emit, phase, operation: 'get-and-verify', object, sleep });
}
async function verifyInventory(bucket, plan, { emit, sleep }) {
    const keys = [], seenCursors = new Set(); let cursor;
    do {
        const page = await readOnly(() => bucket.list({ prefix: plan.publicPlan.prefix, limit: 1000, ...(cursor ? { cursor } : {}) }),
            { emit, sleep, phase: 'inventory', operation: 'list' });
        keys.push(...page.objects.map(o => o.key));
        if (keys.length > plan.publicPlan.objectCount) throw new AddressPublicationError('REMOTE_INVENTORY_MISMATCH', { phase: 'inventory' });
        cursor = page.truncated ? page.cursor : undefined;
        if (page.truncated && !(typeof cursor === 'string' && cursor && !seenCursors.has(cursor))) throw new AddressPublicationError('REMOTE_INVENTORY_CURSOR_INVALID', { phase: 'inventory' });
        if (cursor) seenCursors.add(cursor);
    } while (cursor);
    if (JSON.stringify(keys.sort()) !== JSON.stringify(plan.publicPlan.objects.map(o => o.key).sort())) throw new AddressPublicationError('REMOTE_INVENTORY_MISMATCH', { phase: 'inventory' });
}
export async function verifyAddressPublication(bucket, plan, { checkpoint, sleep, concurrency = 4 } = {}) {
    const emit = journal(checkpoint); let verified = 0;
    await workers([...plan.objects, plan.manifest], async object => {
        await verifyAddressObject(bucket, object, { emit, sleep });
        await emit({ stage: 'verify-ack', phase: 'independent-verification', object, verified: ++verified });
    }, concurrency);
    await verifyInventory(bucket, plan, { emit, sleep });
    return { verified: true, objectCount: plan.publicPlan.objectCount, planDigest: plan.digest };
}
export async function publishAddressSnapshot(bucket, plan, { checkpoint, sleep, concurrency = 4 } = {}) {
    requireValue(Number.isSafeInteger(concurrency) && concurrency >= 1 && concurrency <= ADDRESS_PUBLICATION_PROTOCOL.maxConcurrency, 'Worker concurrency must be from1 to4.');
    const emit = journal(checkpoint), verifiedKeys = new Set(); let uploaded = 0;
    const stopped = (isStopped, object) => {
        if (isStopped?.()) throw new AddressPublicationError('STOPPED_BEFORE_PUT', { phase: 'bulk-stop', object });
    };
    async function create(object, isStopped) {
        stopped(isStopped, object);
        const existing = await readOnly(() => bucket.head(object.key), { emit, sleep, phase: 'vacancy', operation: 'head', object });
        if (existing !== null) throw new AddressPublicationError('OBJECT_ALREADY_EXISTS', { phase: 'vacancy', object });
        stopped(isStopped, object);
        const bytes = await readFile(object.file);
        if (bytes.length !== object.bytes || sha(bytes) !== object.sha256) throw new AddressPublicationError('LOCAL_ARTIFACT_CHANGED', { phase: 'local-read', object });
        stopped(isStopped, object);
        await emit({ stage: 'write-intent', phase: object === plan.manifest ? 'manifest' : 'data', uploaded, verified: verifiedKeys.size, object });
        if (isStopped?.()) {
            await emit({ stage: 'write-not-started', phase: 'bulk-stop', object });
            stopped(isStopped, object);
        }
        let result;
        try { result = await bucket.put(object.key, bytes, { onlyIf: { etagDoesNotMatch: '*' }, sha256: object.sha256,
            httpMetadata: { contentType: object.contentType, cacheControl: 'private, no-store' } }); }
        catch (error) { throw new AddressPublicationError('PUT_OUTCOME_UNKNOWN', { phase: 'put', object, status: readFailure(error).status }); }
        if (!result) throw new AddressPublicationError('ATOMIC_CREATE_REJECTED', { phase: 'put', object });
        uploaded++;
        await emit({ stage: 'write-ack', phase: object === plan.manifest ? 'manifest' : 'data', uploaded, verified: verifiedKeys.size, object });
    }
    async function createAndVerify(object, isStopped, phase = 'data-verify') {
        await create(object, isStopped);
        await verifyAddressObject(bucket, object, { emit, sleep, phase });
        verifiedKeys.add(object.key);
        await emit({ stage: 'verify-ack', phase, uploaded, verified: verifiedKeys.size, object });
    }
    try {
        const vacant = await readOnly(() => bucket.list({ prefix: plan.publicPlan.prefix, limit: 1 }), { emit, sleep, phase: 'prefix-check', operation: 'list' });
        if (vacant.objects.length !== 0 || vacant.truncated !== false) throw new AddressPublicationError('PREFIX_OCCUPIED', { phase: 'prefix-check' });
        await emit({ stage: 'vacant', uploaded: 0, verified: 0 });
        const canaries = plan.objects.slice(0, 2);
        requireValue(canaries.length === 2 && canaries[0].key.endsWith('/index.bin') && canaries[1].key === canaries[0].key.replace(/index\.bin$/, 'rows.json'), 'Canaries must be the first matching index/row pair.');
        for (const object of canaries) await createAndVerify(object, undefined, 'canary-verify');
        await emit({ stage: 'canaries-verified', uploaded, verified: verifiedKeys.size });
        await workers(plan.objects.slice(2), createAndVerify, concurrency);
        if (verifiedKeys.size !== plan.objects.length || !plan.objects.every(object => verifiedKeys.has(object.key))) throw new AddressPublicationError('DATA_VERIFICATION_INCOMPLETE', { phase: 'manifest-barrier' });
        await emit({ stage: 'data-verified-manifest-absent', uploaded, verified: verifiedKeys.size });
        await create(plan.manifest);
        await verifyAddressObject(bucket, plan.manifest, { emit, sleep, phase: 'manifest-verify' });
        await verifyInventory(bucket, plan, { emit, sleep });
        await emit({ stage: 'verified', uploaded, verified: verifiedKeys.size + 1 });
        return { verified: true, objectCount: uploaded, planDigest: plan.digest };
    } catch (error) {
        const failure = error instanceof AddressPublicationError ? error : new AddressPublicationError('LOCAL_OR_PROTOCOL_FAILURE', { phase: 'preparation' });
        failure.counts = { uploaded, verified: verifiedKeys.size };
        await emit({ stage: 'stopped', ...addressPublicationFailure(failure) }).catch(() => {});
        throw failure;
    }
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
    let operator, result, primaryError;
    const checkpoint = async value => {
        const record = { state: value.stage === 'stopped' ? 'failed-or-unknown' : 'in-progress-or-unknown', planDigest: plan.digest, ...value };
        await appendFile(options['--receipt'] + '.objects.jsonl', JSON.stringify(record) + '\n');
        await writeFile(options['--receipt'], JSON.stringify(record) + '\n');
        if (value.stage === 'write-ack' && value.uploaded % 100 === 0) console.log(JSON.stringify({ stage: 'upload-progress', uploaded: value.uploaded, total: plan.publicPlan.objectCount }));
        if (value.stage === 'verify-ack' && value.verified % 100 === 0) console.log(JSON.stringify({ stage: 'verification-progress', verified: value.verified, total: plan.publicPlan.objectCount }));
    };
    try {
        await checkpoint({ stage: 'session-open-intent', phase: 'session-open' });
        operator = await openAddressOperator({ wranglerModule: options['--wrangler-module'], operatorConfig: options['--operator-config'] });
        await checkpoint({ stage: 'session-open-ack', phase: 'session-open' });
        result = options['--verify'] ? await verifyAddressPublication(operator.bucket, plan, { checkpoint }) : await publishAddressSnapshot(operator.bucket, plan, { checkpoint });
    } catch (error) {
        primaryError = error instanceof AddressPublicationError ? error : new AddressPublicationError('OPERATOR_OR_LOCAL_FAILURE', { phase: operator ? 'local-operation' : 'session-open' });
        await checkpoint({ stage: 'stopped', ...addressPublicationFailure(primaryError) }).catch(() => {});
        throw primaryError;
    } finally {
        if (operator) {
            try { await operator.dispose(); }
            catch {
                const disposal = new AddressPublicationError('OPERATOR_DISPOSE_FAILURE', { phase: 'session-dispose' });
                await checkpoint({ stage: 'cleanup-failed', ...addressPublicationFailure(disposal), dataVerified: result?.verified === true }).catch(() => {});
                if (!primaryError) throw disposal;
            }
        }
    }
    await writeFile(options['--receipt'], JSON.stringify({ state: 'verified', mode: options['--verify'] ? 'read-only-verification' : 'publication', ...result }) + '\n');
    return result;
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
    try { console.log(JSON.stringify(await runAddressPublisher())); }
    catch (error) { console.error(JSON.stringify({ state: 'stopped', ...addressPublicationFailure(error), rawOutputWithheld: true })); process.exitCode = 1; }
}
