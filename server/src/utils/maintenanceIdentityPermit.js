// Temporary, single maintenance attempt. Retain the private record when removing this helper.
// It contains deployment metadata only; no credentials, Help prose or database query results.
export const maintenanceIdentityPermitKey = 'maintenance/identity-permit-20261109-v3.json';
const attempt = 'maintenance-identity-20261109-v3';
const duration = 15 * 60 * 1000;
const fields = 'schema attempt state ownerId publicSourceRevision buildSourceRevision releaseId jobId version snapshotDigest compiledContentDigest workerVersionId pagesDeploymentId publishedAt expiresAt consumedAt'.split(' ');
const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
const releaseId = value => typeof value === 'string' && /^\d{13}-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
const instant = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)) return NaN;
    const time = Date.parse(value);
    return Number.isFinite(time) && new Date(time).toISOString() === value ? time : NaN;
};
const clockFor = now => typeof now === 'function' ? now : () => now;
const open = (record, time) => Number.isFinite(time) && instant(record.publishedAt) <= time && time < instant(record.expiresAt);
const hold = () => ({ state: 'hold' });
const closed = () => ({ ok: false, code: 'observation_closed', status: 403 });
const unavailable = () => ({ ok: false, code: 'identity_unavailable', status: 503 });
const metadata = { contentType: 'application/json', cacheControl: 'private, no-store' };
function validRecord(record) {
    if (!record || Object.keys(record).sort().join('|') !== [...fields].sort().join('|')
        || record.schema !== 1 || record.attempt !== attempt || !['armed', 'consumed'].includes(record.state)
        || !Number.isSafeInteger(record.ownerId) || record.ownerId <= 0 || !sha(record.publicSourceRevision)
        || !sha(record.buildSourceRevision) || !releaseId(record.releaseId) || !uuid(record.jobId)
        || typeof record.version !== 'string' || !/^\d{4}-\d\d-\d\d\.help-cms\.\d{13}$/.test(record.version)
        || !digest(record.snapshotDigest) || !digest(record.compiledContentDigest)
        || !uuid(record.workerVersionId) || !uuid(record.pagesDeploymentId)
        || instant(record.expiresAt) - instant(record.publishedAt) !== duration) return false;
    return record.state === 'armed' ? record.consumedAt === null
        : open(record, instant(record.consumedAt));
}
function matchesRuntime(record, env, runtime, ownerId) {
    return env.HELP_CMS_ENABLED === 'true' && Number.isSafeInteger(ownerId) && ownerId > 0
        && ownerId === Number(env.HELP_CMS_OWNER_ID) && record.ownerId === ownerId
        && record.publicSourceRevision === env.HELP_CMS_SOURCE_REVISION
        && runtime?.schemaVersion === 1 && runtime.application === 'carearound-sg' && runtime.target === 'server'
        && runtime.sourceClean === true && runtime.provenance === 'git-build+worker-version'
        && runtime.sourceRevision === record.buildSourceRevision && runtime.deploymentId === record.workerVersionId;
}
async function readMetadata(bucket, key) {
    const object = await bucket.get(key);
    if (!object) return null;
    if (typeof object.etag !== 'string' || !object.etag || !Number.isFinite(object.size)
        || object.size <= 0 || object.size > 16384 || typeof object.json !== 'function') throw new Error('Permit metadata unavailable');
    return { value: await object.json(), etag: object.etag };
}
async function matchesPublication(bucket, record) {
    const [pointer, status, lock] = await Promise.all([
        readMetadata(bucket, 'published/current.json'),
        readMetadata(bucket, `release-status/${record.releaseId}.json`),
        readMetadata(bucket, 'publication/active.json'),
    ]);
    const p = pointer?.value, s = status?.value;
    return p?.releaseId === record.releaseId && p.version === record.version && p.snapshotDigest === record.snapshotDigest
        && lock?.value.releaseId === null && s?.state === 'published'
        && s.readiness?.help === true && s.readiness.guide === true && s.readiness.client === true
        && ['jobId', 'version', 'snapshotDigest', 'compiledContentDigest', 'buildSourceRevision', 'workerVersionId', 'pagesDeploymentId', 'publishedAt'].every(key => s[key] === record[key])
        && s.id === record.releaseId && s.baseSourceRevision === record.publicSourceRevision;
}

export async function armMaintenanceIdentityPermit({ bucket, env, release, publishedStatus, runtime,
    workspacePromoted, lockCompleted, now = Date.now }) {
    try {
        const clock = clockFor(now), status = publishedStatus;
        if (!bucket || workspacePromoted !== true || lockCompleted !== true || status?.state !== 'published'
            || status.readiness?.help !== true || status.readiness.guide !== true || status.readiness.client !== true
            || release?.id !== status.id || release.jobId !== status.jobId || release.version !== status.version
            || release.snapshotDigest !== status.snapshotDigest || release.baseSourceRevision !== status.baseSourceRevision) return hold();
        const publishedAt = instant(status.publishedAt);
        if (!Number.isFinite(publishedAt)) return hold();
        const record = { schema: 1, attempt, state: 'armed', ownerId: release.ownerId,
            publicSourceRevision: release.baseSourceRevision, buildSourceRevision: status.buildSourceRevision,
            releaseId: release.id, jobId: release.jobId, version: release.version, snapshotDigest: release.snapshotDigest,
            compiledContentDigest: status.compiledContentDigest, workerVersionId: status.workerVersionId,
            pagesDeploymentId: status.pagesDeploymentId, publishedAt: status.publishedAt,
            expiresAt: new Date(publishedAt + duration).toISOString(), consumedAt: null };
        if (!validRecord(record) || !matchesRuntime(record, env, runtime, release.ownerId) || !open(record, clock())
            || !await matchesPublication(bucket, record) || !open(record, clock())) return hold();
        const result = await bucket.put(maintenanceIdentityPermitKey, JSON.stringify(record), {
            onlyIf: new Headers({ 'If-None-Match': '*' }), httpMetadata: metadata,
        });
        // No acknowledgement is HOLD, including a write whose acknowledgement was lost.
        // Never delete/rewrite the attempt or make an observation here.
        return typeof result?.etag === 'string' && result.etag ? { state: 'armed', expiresAt: record.expiresAt } : hold();
    } catch { return hold(); }
}

export async function claimMaintenanceIdentityPermit({ bucket, env, ownerId, runtime, now = Date.now }) {
    try {
        const clock = clockFor(now), stored = await readMetadata(bucket, maintenanceIdentityPermitKey), record = stored?.value;
        if (!validRecord(record) || record.state !== 'armed' || !matchesRuntime(record, env, runtime, ownerId)
            || !open(record, clock()) || !await matchesPublication(bucket, record)) return closed();
        const claimedAt = clock();
        if (!open(record, claimedAt)) return closed();
        const consumed = { ...record, state: 'consumed', consumedAt: new Date(claimedAt).toISOString() };
        const acknowledgement = await bucket.put(maintenanceIdentityPermitKey, JSON.stringify(consumed), {
            onlyIf: { etagMatches: stored.etag }, httpMetadata: metadata,
        });
        if (typeof acknowledgement?.etag !== 'string' || !acknowledgement.etag) return unavailable();
        return { ok: true, publishedAt: record.publishedAt, expiresAt: record.expiresAt };
    } catch { return unavailable(); }
}

// Read-only owner UI metadata. Reuse the claim's checks without a conditional write or SQL.
export async function readMaintenanceIdentityPermitStatus({ bucket, env, ownerId, runtime, now = Date.now }) {
    const closedStatus = () => ({ armed: false, expiresAt: null });
    try {
        const clock = clockFor(now), stored = await readMetadata(bucket, maintenanceIdentityPermitKey), record = stored?.value;
        if (!validRecord(record) || record.state !== 'armed' || !matchesRuntime(record, env, runtime, ownerId)
            || !open(record, clock()) || !await matchesPublication(bucket, record) || !open(record, clock())) return closedStatus();
        return { armed: true, expiresAt: record.expiresAt };
    } catch { return closedStatus(); }
}
