import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { validateWorkerReleaseLine } from './validate-worker-release-line.mjs';
import { readGitReleaseSource, releaseRepoRoot } from './release-provenance.mjs';

export function workerReleaseArgs(source, extraArgs = []) {
    if (extraArgs.length) throw new Error('Worker release overrides are not accepted. Review the release configuration instead.');
    if (!source.sourceClean || !/^[a-f0-9]{40}$/.test(source.sourceRevision || '')) throw new Error('Worker release requires clean, identifiable source, including untracked files.');
    return ['wrangler', 'deploy', '--config', 'wrangler.toml', '--tag', `git-${source.sourceRevision}`,
        '--define', `__CAREAROUND_SOURCE_REVISION__:${JSON.stringify(source.sourceRevision)}`];
}

export function deployWorkerRelease({ validate = validateWorkerReleaseLine, readSource = readGitReleaseSource,
    run = spawnSync, extraArgs = process.argv.slice(2) } = {}) {
    if (extraArgs.length) throw new Error('Worker release overrides are not accepted.');
    validate();
    const args = workerReleaseArgs(readSource(), extraArgs);
    const result = run('npx', args, { cwd: path.join(releaseRepoRoot, 'server'), stdio: 'inherit', shell: false });
    if (result.error || result.status !== 0) throw new Error('Worker release command did not complete successfully. Check its output before retrying.');
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
    try { deployWorkerRelease(); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
}
