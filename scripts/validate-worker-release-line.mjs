import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

function git(args, options = {}) {
    const output = execFileSync('git', args, {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: options.inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    });
    return typeof output === 'string' ? output.trim() : '';
}

export function getWorkerReleaseLineErrors({
    branch,
    head,
    originMain,
    trackedChanges,
}) {
    const errors = [];

    if (branch !== 'main') {
        errors.push(`current branch is "${branch || 'detached HEAD'}"; production Worker deploys must run from main`);
    }
    if (!head || !originMain || head !== originMain) {
        errors.push('local HEAD does not match the fetched origin/main release commit');
    }
    if (String(trackedChanges || '').trim()) {
        errors.push('tracked files contain uncommitted changes');
    }

    return errors;
}

export function validateWorkerReleaseLine() {
    try {
        git(['fetch', '--quiet', 'origin', 'main'], { inherit: true });
    } catch {
        throw new Error('Production Worker deploy blocked: origin/main could not be fetched.');
    }

    const state = {
        branch: git(['branch', '--show-current']),
        head: git(['rev-parse', 'HEAD']),
        originMain: git(['rev-parse', 'origin/main']),
        trackedChanges: git(['status', '--porcelain', '--untracked-files=no']),
    };
    const errors = getWorkerReleaseLineErrors(state);

    if (errors.length) {
        throw new Error(`Production Worker deploy blocked:\n- ${errors.join('\n- ')}`);
    }

    console.log(`Worker release line verified: main at ${state.head.slice(0, 10)} matches origin/main.`);
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (invokedPath === import.meta.url) {
    try {
        validateWorkerReleaseLine();
    } catch (err) {
        console.error(err?.message || err);
        process.exit(1);
    }
}
