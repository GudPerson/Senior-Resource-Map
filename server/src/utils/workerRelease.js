// The revision is compiled into the Worker by the guarded release command.
// Runtime variables, request JSON and the version tag alone cannot replace it.
export function compiledWorkerRevision() {
    return typeof __CAREAROUND_SOURCE_REVISION__ === 'string' ? __CAREAROUND_SOURCE_REVISION__ : null;
}

export function makeWorkerReleaseManifest(revision, metadata) {
    if (!/^[a-f0-9]{40}$/.test(revision || '') || metadata?.tag !== `git-${revision}`
        || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(metadata?.id || '')
        || !Number.isFinite(Date.parse(metadata?.timestamp || ''))) return null;
    return { schemaVersion: 1, application: 'carearound-sg', target: 'server',
        sourceRevision: revision, sourceClean: true, provenance: 'git-build+worker-version',
        deploymentId: metadata.id, uploadedAt: metadata.timestamp };
}

export function currentWorkerRelease(env) {
    return makeWorkerReleaseManifest(compiledWorkerRevision(), env?.CF_VERSION_METADATA);
}
