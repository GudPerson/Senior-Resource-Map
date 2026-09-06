import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { readGitReleaseSource } from './release-provenance.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const allowedPath = (value) => /^\/assets\/[a-zA-Z0-9._-]+\.(?:js|css)$/.test(value)
    || value === '/app-shell-recovery-20260721-1.js';

export async function buildClientReleaseManifest({ html, source, readAsset }) {
    const text = html.toString('utf8');
    const paths = [...new Set([...text.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((match) => match[1]))];
    if (!paths.length || paths.length > 4 || paths.some((value) => !allowedPath(value))
        || !paths.some((value) => /^\/assets\/.+\.js$/.test(value))) throw new Error('Client entry files are missing or unexpected.');
    const entryAssets = await Promise.all(paths.map(async (assetPath) => {
        const bytes = await readAsset(assetPath);
        if (!bytes.length || bytes.length > 2 * 1024 * 1024) throw new Error('Client entry file exceeds the release verification limit.');
        return { path: assetPath, sha256: sha256(bytes), bytes: bytes.length };
    }));
    return { schemaVersion: 1, application: 'carearound-sg', target: 'client',
        sourceRevision: source.sourceRevision, sourceClean: source.sourceClean,
        provenance: 'git-build', htmlSha256: sha256(html), entryAssets };
}

export function clientReleasePlugin({ readSource = readGitReleaseSource } = {}) {
    let config;
    let startedSource;
    return {
        name: 'carearound-release-evidence', apply: 'build', enforce: 'post',
        configResolved(resolved) { config = resolved; startedSource = readSource(); },
        // Unlike closeBundle, this hook does not run after a failed build.
        async writeBundle() {
            const finishedSource = readSource();
            if (JSON.stringify(startedSource) !== JSON.stringify(finishedSource)) throw new Error('Source changed while the client was building. Build again.');
            const output = path.resolve(config.root, config.build.outDir);
            const html = await readFile(path.join(output, 'index.html'));
            const manifest = await buildClientReleaseManifest({ html, source: finishedSource,
                readAsset: (assetPath) => readFile(path.join(output, assetPath.slice(1))) });
            // Generated build output, never a checked-in or hand-maintained claim.
            await writeFile(path.join(output, 'release.json'), `${JSON.stringify(manifest)}\n`);
        },
    };
}
