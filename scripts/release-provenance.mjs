import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const releaseRepoRoot = fileURLToPath(new URL('..', import.meta.url));

export function readGitReleaseSource({ cwd = releaseRepoRoot, env = process.env,
    git = (args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() } = {}) {
    let revision = '';
    let changes = 'unavailable';
    try {
        revision = git(['rev-parse', 'HEAD']);
        // Installed dependencies are generated from the committed lockfile. All
        // other tracked AND untracked changes make this an unverified local build.
        changes = git(['status', '--porcelain', '--untracked-files=normal', '--', '.', ':(exclude)node_modules/**']);
    } catch { /* A source-less archive is usable locally, not release evidence. */ }
    const sourceClean = /^[a-f0-9]{40}$/.test(revision) && changes === '';
    const providerRevision = env.CF_PAGES_COMMIT_SHA;
    if (providerRevision && providerRevision !== revision) throw new Error('Pages commit metadata does not match the checked-out source.');
    if (env.CF_PAGES === '1' && !sourceClean) throw new Error('Pages release requires clean, identifiable source.');
    return { sourceRevision: sourceClean ? revision : null, sourceClean };
}
