import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function assertCmsContentNotReverted(local, live) {
    if (!live || typeof live.version !== 'string') throw new Error('Published Help content could not be verified.');
    if (!live.version.includes('.help-cms.')) return;
    if (local.version !== live.version || local.contentDigest !== live.contentDigest) {
        throw new Error('Release stopped: this build would replace newer CMS content. Use the private content release adapter to carry the published library into this application release.');
    }
}
export async function verifyCmsLiveContent({ fetchImpl = fetch, root = fileURLToPath(new URL('..', import.meta.url)) } = {}) {
    const local = JSON.parse(readFileSync(`${root}/client/src/generated/helpArticles.json`, 'utf8'));
    const response = await fetchImpl('https://api.carearound.sg/api/help/articles', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Published Help content could not be verified before release.');
    assertCmsContentNotReverted(local, await response.json());
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const pages = process.argv.includes('--pages-build');
    if (!pages || process.env.CF_PAGES === '1' && process.env.CF_PAGES_BRANCH === 'main') {
        try { await verifyCmsLiveContent(); } catch (error) { console.error(error.message); process.exitCode = 1; }
    }
}
