import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateClientReleaseLine } from './validate-client-release-line.mjs';
import { readGitReleaseSource, releaseRepoRoot } from './release-provenance.mjs';

export function clientReleaseArgs(source, extraArgs = []) {
    if (extraArgs.length) throw new Error('Pages release overrides are not accepted. Review the release configuration instead.');
    if (!source.sourceClean || !/^[a-f0-9]{40}$/.test(source.sourceRevision || '')) {
        throw new Error('Pages release requires clean, identifiable source, including untracked files.');
    }
    return [
        'wrangler', 'pages', 'deploy', 'dist',
        '--project-name', 'senior-resource-map',
        '--branch', 'main',
        '--commit-hash', source.sourceRevision,
        '--commit-dirty=false',
        '--skip-caching',
    ];
}

export function deployClientRelease({
    validate = validateClientReleaseLine,
    readSource = readGitReleaseSource,
    run = spawnSync,
    extraArgs = process.argv.slice(2),
} = {}) {
    if (extraArgs.length) throw new Error('Pages release overrides are not accepted.');
    const startedLine = validate();

    const startedSource = readSource();
    clientReleaseArgs(startedSource, extraArgs);
    if (startedLine?.head && startedLine.head !== startedSource.sourceRevision) {
        throw new Error('The validated Pages release commit does not match the build source.');
    }
    const build = run('npm', ['run', 'build:client:discover-derivative'], {
        cwd: releaseRepoRoot,
        stdio: 'inherit',
        shell: false,
    });
    if (build.error || build.status !== 0) {
        throw new Error('Pages production build did not complete successfully. Check its output before retrying.');
    }

    const finishedSource = readSource();
    if (JSON.stringify(finishedSource) !== JSON.stringify(startedSource)) {
        throw new Error('Source changed while the Pages artifact was building. Build again from a clean main checkout.');
    }
    const finishedLine = validate();
    if (finishedLine?.head && finishedLine.head !== finishedSource.sourceRevision) {
        throw new Error('The fetched origin/main release commit changed while the Pages artifact was building. Build again.');
    }

    const deploy = run('npx', clientReleaseArgs(finishedSource, extraArgs), {
        cwd: path.join(releaseRepoRoot, 'client'),
        stdio: 'inherit',
        shell: false,
    });
    if (deploy.error || deploy.status !== 0) {
        throw new Error('Pages release command did not complete successfully. Check its output before retrying.');
    }

    const deployedLine = validate();
    if (deployedLine?.head && deployedLine.head !== finishedSource.sourceRevision) {
        throw new Error('origin/main changed while Pages was uploading. Rebuild and publish the current release immediately.');
    }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
    try {
        deployClientRelease();
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
