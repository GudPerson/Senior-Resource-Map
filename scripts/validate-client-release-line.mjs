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

export function getClientReleaseLineErrors({
    branch,
    head,
    originMain,
    changes,
}) {
    const errors = [];

    if (branch !== 'main') {
        errors.push(`current branch is "${branch || 'detached HEAD'}"; production Pages deploys must run from main`);
    }
    if (!head || !originMain || head !== originMain) {
        errors.push('local HEAD does not match the fetched origin/main release commit');
    }
    if (String(changes || '').trim()) {
        errors.push('the worktree contains uncommitted tracked or untracked files');
    }

    return errors;
}

export function validateClientReleaseLine() {
    try {
        git(['fetch', '--quiet', 'origin', 'main'], { inherit: true });
    } catch {
        throw new Error('Production Pages deploy blocked: origin/main could not be fetched.');
    }

    const state = {
        branch: git(['branch', '--show-current']),
        head: git(['rev-parse', 'HEAD']),
        originMain: git(['rev-parse', 'origin/main']),
        changes: git(['status', '--porcelain', '--untracked-files=normal', '--', '.', ':(exclude)node_modules/**']),
    };
    const errors = getClientReleaseLineErrors(state);

    if (errors.length) {
        throw new Error(`Production Pages deploy blocked:\n- ${errors.join('\n- ')}`);
    }

    console.log(`Pages release line verified: main at ${state.head.slice(0, 10)} matches origin/main.`);
    return state;
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (invokedPath === import.meta.url) {
    try {
        validateClientReleaseLine();
    } catch (err) {
        console.error(err?.message || err);
        process.exit(1);
    }
}
