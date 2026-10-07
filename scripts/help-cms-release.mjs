import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync, lstatSync, rmSync, mkdtempSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const SHA = /^[a-f0-9]{40}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const RELEASE = /^\d{13}-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ARTICLE = /^HC-\d{2,3}$/;
export const PUBLIC_SOURCE_REPOSITORY = 'GudPerson/Senior-Resource-Map';
export const REVIEWED_WRANGLER_VERSION = '4.145.0';
export const GENERATED_CONTENT_PATHS = Object.freeze([
    'client/src/generated/helpArticles.json', 'server/src/generated/helpKnowledge.js',
    'client/public/help-content-status.json',
]);
const PRIVATE_CMS_SEED_PATH = 'server/src/generated/helpCmsSeed.js';
const CONTENT_FILES = new Set(['content/help/manifest.json', 'content/help/editorial-corrections.json', ...GENERATED_CONTENT_PATHS]);
const CONTROL_FILES = new Set(['_headers', '_redirects', '_routes.json', '_worker.js', '_worker.js.map']);
const MIMES = {
    '.html': ['text/html'], '.js': ['application/javascript', 'text/javascript'], '.mjs': ['application/javascript', 'text/javascript'],
    '.css': ['text/css'], '.json': ['application/json'], '.png': ['image/png'], '.jpg': ['image/jpeg'], '.jpeg': ['image/jpeg'],
    '.webp': ['image/webp'], '.svg': ['image/svg+xml'], '.gif': ['image/gif'], '.ico': ['image/x-icon', 'image/vnd.microsoft.icon'],
    '.woff': ['font/woff', 'application/font-woff'], '.woff2': ['font/woff2'], '.ttf': ['font/ttf'], '.otf': ['font/otf'],
    '.txt': ['text/plain'], '.xml': ['application/xml', 'text/xml'], '.pdf': ['application/pdf'],
    '.webmanifest': ['application/manifest+json', 'application/json'], '.map': ['application/json', 'application/octet-stream'],
};
const FAILURE_CODES = new Set(['release-check-failed', 'public-configuration-invalid', 'public-source-unavailable',
    'public-source-mismatch', 'public-content-unavailable', 'public-content-version-mismatch', 'public-content-digest-mismatch',
    'public-content-disagreement', 'public-verification-failed', 'public-artifact-verification-failed',
    'ordinary-html-verification-failed', 'public-media-verification-failed']);
const check = (condition, message, failureCode) => {
    if (!condition) {
        const error = new Error('Help release: ' + message);
        if (FAILURE_CODES.has(failureCode)) error.releaseFailureCode = failureCode;
        throw error;
    }
};
const safeFailureCode = (error, fallback = 'release-check-failed') => FAILURE_CODES.has(error?.releaseFailureCode) ? error.releaseFailureCode : fallback;
const safePublicObservations = records => Array.isArray(records) ? records.slice(0, 4).filter(record => Number.isSafeInteger(record?.attempt)
    && record.attempt >= 1 && record.attempt <= 4 && (FAILURE_CODES.has(record.code) || record.code === 'public-observation-verified'))
    .map(record => ({ attempt: record.attempt, passed: record.code === 'public-observation-verified', code: record.code })) : [];
const isText = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 16000;
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const jsonFile = file => JSON.parse(readFileSync(file, 'utf8'));
export const sha256Bytes = bytes => createHash('sha256').update(bytes).digest('hex');
export const digestValue = value => sha256Bytes(JSON.stringify(value));
const normalizedMime = value => String(value || '').split(';')[0].trim().toLowerCase();
const HTML_PROOFS = Object.freeze({ 'index.html': '/__help-release-proof/home', 'offline.html': '/__help-release-proof/offline' });
const HTML_SECURITY_HEADERS = Object.freeze(['content-security-policy', 'strict-transport-security', 'x-frame-options',
    'x-content-type-options', 'referrer-policy', 'permissions-policy']);

export function httpsOrigin(value) {
    let url;
    try { url = new URL(value); } catch { throw new Error('Help release: a configured HTTPS origin is required.'); }
    check(url.protocol === 'https:' && !url.username && !url.password && !url.port
        && url.pathname === '/' && !url.search && !url.hash, 'a configured HTTPS origin is required.');
    return url.origin;
}
export function readReleaseConfiguration(env = process.env) {
    check(RELEASE.test(env.HELP_CMS_RELEASE_ID || '') && UUID.test(env.HELP_CMS_JOB_ID || ''), 'invalid release or job identity.');
    check(DIGEST.test(env.HELP_CMS_CONTENT_DIGEST || '') && SHA.test(env.HELP_CMS_BASE_SOURCE_REVISION || ''), 'invalid dispatched digest or source revision.');
    check(typeof env.HELP_CMS_RELEASE_TOKEN === 'string' && env.HELP_CMS_RELEASE_TOKEN.length >= 32, 'the private release token is unavailable.');
    check(env.GITHUB_ACTIONS === 'true' && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(env.GITHUB_REPOSITORY || '')
        && env.GITHUB_REPOSITORY.toLowerCase() !== PUBLIC_SOURCE_REPOSITORY.toLowerCase(), 'only the private automation repository may run this adapter.');
    check(isText(env.GITHUB_TOKEN), 'the private runner identity cannot be verified.');
    check((env.HELP_CMS_WRANGLER_VERSION || REVIEWED_WRANGLER_VERSION) === REVIEWED_WRANGLER_VERSION, 'the configured Wrangler version is not the reviewed release version.');
    return {
        releaseId: env.HELP_CMS_RELEASE_ID, jobId: env.HELP_CMS_JOB_ID,
        snapshotDigest: env.HELP_CMS_CONTENT_DIGEST, baseSourceRevision: env.HELP_CMS_BASE_SOURCE_REVISION,
        apiOrigin: httpsOrigin(env.HELP_CMS_API_ORIGIN), appOrigin: httpsOrigin(env.HELP_CMS_PUBLIC_APP_ORIGIN || 'https://app.carearound.sg'),
        releaseToken: env.HELP_CMS_RELEASE_TOKEN, githubToken: env.GITHUB_TOKEN, automationRepository: env.GITHUB_REPOSITORY,
        cloudflareAccountId: env.CLOUDFLARE_ACCOUNT_ID, cloudflareToken: env.CLOUDFLARE_API_TOKEN,
        wranglerVersion: REVIEWED_WRANGLER_VERSION,
    };
}
async function boundedFetch(fetchImpl, url, options = {}) {
    return fetchImpl(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(20000) });
}
export async function readBoundedBytes(response, limit) {
    check(response.ok, 'a required HTTP request did not succeed.');
    if (!response.body?.getReader) {
        const bytes = Buffer.from(await response.arrayBuffer());
        check(bytes.length <= limit, 'the HTTP response exceeds its size limit.');
        return bytes;
    }
    const reader = response.body.getReader(), chunks = [];
    let total = 0;
    try {
        while (true) {
            const part = await reader.read();
            if (part.done) break;
            total += part.value.length;
            check(total <= limit, 'the HTTP response exceeds its size limit.');
            chunks.push(Buffer.from(part.value));
        }
    } catch (error) {
        await reader.cancel().catch(() => {});
        throw error;
    }
    return Buffer.concat(chunks, total);
}
async function fetchJson(url, { fetchImpl = fetch, headers = {}, maximumBytes = 5 * 1024 * 1024, allowMissing = false } = {}) {
    const response = await boundedFetch(fetchImpl, url, { headers: { Accept: 'application/json', ...headers } });
    if (allowMissing && response.status === 404) return null;
    check(normalizedMime(response.headers.get('Content-Type')) === 'application/json', 'a required response is not JSON.');
    const bytes = await readBoundedBytes(response, maximumBytes);
    try { return JSON.parse(bytes.toString('utf8')); } catch { throw new Error('Help release: a required response contains invalid JSON.'); }
}
export async function assertPrivateAutomation(config, fetchImpl = fetch) {
    const repository = await fetchJson('https://api.github.com/repos/' + config.automationRepository, {
        fetchImpl, maximumBytes: 128 * 1024,
        headers: { Authorization: 'Bearer ' + config.githubToken, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'CareAround-Help-Release' },
    });
    check(repository.private === true && String(repository.full_name || '').toLowerCase() === config.automationRepository.toLowerCase()
        && config.automationRepository.toLowerCase() !== PUBLIC_SOURCE_REPOSITORY.toLowerCase(), 'GitHub did not confirm the private automation repository.');
}
export function validateOwnerReview(review, baseSourceRevision) {
    check(object(review) && review.method === 'owner-cms-review' && isText(review.owner)
        && /^\d{4}-\d{2}-\d{2}$/.test(review.date || '') && Number.isFinite(Date.parse(review.date))
        && review.sourceRevision === baseSourceRevision
        && Array.isArray(review.evidence) && review.evidence.length > 0 && review.evidence.every(isText), 'explicit owner review evidence is required.');
    return { reviewedAt: review.date, reviewer: review.owner, reason: review.evidence.join('; '), evidence: [...review.evidence] };
}
export function validateSnapshot(envelope, expected) {
    check(object(envelope) && (envelope.releaseId || envelope.id) === expected.releaseId && envelope.jobId === expected.jobId,
        'snapshot identity does not match the dispatched job.');
    check(envelope.baseSourceRevision === expected.baseSourceRevision && SHA.test(envelope.baseSourceRevision), 'snapshot source revision does not match the dispatched job.');
    const publication = envelope.publication;
    check(object(publication) && publication.schemaVersion === 1 && isText(publication.version) && publication.version.length <= 160
        && publication.version === envelope.version && object(publication.manifest) && publication.manifest.version === publication.version
        && isText(publication.baseContentVersion) && publication.baseContentVersion !== publication.version
        && Array.isArray(publication.articles) && publication.articles.length > 0 && publication.articles.length <= 200, 'snapshot publication schema is invalid.');
    check(envelope.snapshotDigest === expected.snapshotDigest && DIGEST.test(envelope.snapshotDigest)
        && digestValue(publication) === envelope.snapshotDigest, 'snapshot digest does not match the approved publication.');
    validateOwnerReview(publication.review, envelope.baseSourceRevision);
    const ids = new Set(), slugs = new Set();
    for (const article of publication.articles) {
        check(object(article) && ARTICLE.test(article.id) && SLUG.test(article.slug)
            && !ids.has(article.id) && !slugs.has(article.slug), 'snapshot article identity or path is invalid.');
        check(['approved', 'retired'].includes(article.status), 'unpublished drafts cannot enter a release snapshot.');
        check(Array.isArray(article.sections), 'snapshot sections are invalid.');
        ids.add(article.id); slugs.add(article.slug);
        for (const section of article.sections) for (const media of section.media || []) {
            check(article.visibility === 'public', 'restricted media cannot enter a release.');
            if (media.type === 'image') check(DIGEST.test(media.assetId || ''), 'snapshot image identity is invalid.');
        }
    }
    check(Array.isArray(publication.manifest.articleOrder) && publication.manifest.articleOrder.length === ids.size
        && new Set(publication.manifest.articleOrder).size === ids.size
        && publication.manifest.articleOrder.every(id => ids.has(id)), 'snapshot article order is incomplete.');
    return publication;
}
export function assertContentOnlyPaths(paths) {
    check(Array.isArray(paths) && paths.length > 0, 'the content change set is empty.');
    for (const file of paths) {
        check(typeof file === 'string' && !file.includes('\\') && !file.split('/').includes('..')
            && (CONTENT_FILES.has(file) || /^content\/help\/articles\/hc-\d{2,3}-[a-z0-9]+(?:-[a-z0-9]+)*\.json$/.test(file)),
        'the change set contains a path outside canonical/generated Help content.');
    }
}
function canonicalArticlePath(article) { return 'content/help/articles/' + article.id.toLowerCase() + '-' + article.slug + '.json'; }
function sourceSeed(root) {
    return { manifest: jsonFile(join(root, 'content/help/manifest.json')),
        articles: readdirSync(join(root, 'content/help/articles')).filter(file => file.endsWith('.json')).sort()
            .map(file => jsonFile(join(root, 'content/help/articles', file))) };
}
export function validateSourceIdentities(publication, seed) {
    const byId = new Map(publication.articles.map(article => [article.id, article]));
    check(JSON.stringify(publication.manifest.guideFactOrder) === JSON.stringify(seed.manifest.guideFactOrder), 'legacy Guide identities were changed.');
    const topics = new Map((seed.manifest.topics || []).map(topic => [topic.id, topic]));
    const retired = new Set(publication.manifest.retiredFactIds || []);
    for (const topic of publication.manifest.topics || []) check(topics.has(topic.id)
        && JSON.stringify(topic) === JSON.stringify(topics.get(topic.id)), 'legacy topic routing was changed.');
    for (const topic of topics.values()) check((publication.manifest.topics || []).some(item => item.id === topic.id)
        || retired.has('help-' + topic.id), 'a legacy topic disappeared without retirement.');
    for (const original of seed.articles) {
        const next = byId.get(original.id);
        check(next && next.slug === original.slug && next.visibility === original.visibility, 'published article addresses and access rules must be preserved.');
        const sections = new Map(next.sections.map(section => [section.id, section]));
        for (const section of original.sections) {
            if (!section.facts?.length) continue;
            const following = sections.get(section.id);
            check(following && following.facts?.length === section.facts.length, 'existing Guide citation sections must be preserved.');
            for (let index = 0; index < section.facts.length; index++) {
                const { message: oldMessage, reviewed: oldDate, evidence: oldEvidence, ...oldIdentity } = section.facts[index];
                const { message: newMessage, reviewed: newDate, evidence: newEvidence, ...newIdentity } = following.facts[index] || {};
                check(JSON.stringify(oldIdentity) === JSON.stringify(newIdentity), 'existing Guide routing and fact metadata must be preserved.');
            }
        }
    }
}
function registryEntries(registry, type) {
    const entries = registry?.[type] || [];
    check(Array.isArray(entries), 'the prior correction registry is invalid.');
    const ids = new Set();
    for (const entry of entries) {
        check(object(entry) && isText(entry.id) && !ids.has(entry.id) && ['changed', 'retired'].includes(entry.kind)
            && /^\d{4}-\d{2}-\d{2}$/.test(entry.reviewedAt || '') && isText(entry.reviewer) && isText(entry.reason)
            && Array.isArray(entry.evidence) && entry.evidence.length > 0 && entry.evidence.every(isText)
            && (entry.kind !== 'changed' || DIGEST.test(entry.expectedDigest || '')), 'the prior correction registry is invalid.');
        ids.add(entry.id);
    }
    return new Map(entries.map(entry => [entry.id, entry]));
}
export function deriveEditorialCorrections({ baseline, compiled, publication, previous = { facts: [], topics: [] } }) {
    const review = validateOwnerReview(publication.review, publication.review.sourceRevision);
    const facts = new Map(compiled.facts.map(({ articleId, sectionId, articleRoute, visibility, ...fact }) => [fact.id, fact]));
    const topics = new Map(compiled.topics.map(topic => [topic.id, topic]));
    const originalCorrections = new Map((baseline.editorialCorrections || []).map(entry => [entry.id, entry]));
    const retiredFacts = new Set(publication.manifest.retiredFactIds || []);
    const result = { facts: [], topics: [] };
    for (const type of ['facts', 'topics']) {
        const prior = registryEntries(previous, type), current = type === 'facts' ? facts : topics;
        for (const original of baseline[type] || []) {
            const record = current.get(original.id);
            const originalDigest = type === 'facts' ? originalCorrections.get(original.id)?.expectedDigest || original.digest : original.digest;
            const expectedDigest = record ? digestValue(record) : undefined;
            if (record && expectedDigest === originalDigest) continue;
            check(record || retiredFacts.has(type === 'facts' ? original.id : 'help-' + original.id), 'a legacy record disappeared without an explicit archived source.');
            const kind = record ? 'changed' : 'retired', old = prior.get(original.id);
            if (old?.kind === kind && (kind === 'retired' || old.expectedDigest === expectedDigest)) result[type].push(old);
            else result[type].push({ id: original.id, kind, ...(expectedDigest ? { expectedDigest } : {}), ...review });
        }
        result[type].sort((a, b) => a.id.localeCompare(b.id));
    }
    return result;
}
function childEnvironment(env = process.env) {
    return Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'TEMP', 'TMP', 'CI', 'npm_config_cache', 'SystemRoot']
        .filter(key => env[key] !== undefined).map(key => [key, env[key]]));
}
export function command(file, args, { cwd, env = childEnvironment(), maximumBytes = 32 * 1024 * 1024 } = {}) {
    try { return execFileSync(file, args, { cwd, env, encoding: 'utf8', maxBuffer: maximumBytes, stdio: ['ignore', 'pipe', 'pipe'], shell: false }).trim(); }
    catch { throw new Error('Help release: a required command failed (' + (file === process.execPath ? 'node' : file) + '). Private command output is withheld.'); }
}
function git(root, args) { return command('git', args, { cwd: root }); }
export function assertPrivateSeedUntracked(root) {
    check(git(root, ['ls-files', '--', PRIVATE_CMS_SEED_PATH]) === '', 'the private CMS seed must remain untracked.');
    check(git(root, ['check-ignore', '--', PRIVATE_CMS_SEED_PATH]) === PRIVATE_CMS_SEED_PATH,
        'the private CMS seed must be ignored before release preparation.');
}
export function uncommittedContentPaths(root) {
    // Dependency installation is already excluded by readGitReleaseSource.
    // Public main tracks Mac optional packages; Linux npm ci legitimately
    // removes those. This exclusion never stages or commits dependencies.
    const spec = ['--', '.', ':(exclude)node_modules/**'];
    return { changed: git(root, ['diff', '--name-only', ...spec]).split('\n').filter(Boolean),
        untracked: git(root, ['ls-files', '--others', '--exclude-standard', ...spec]).split('\n').filter(Boolean) };
}
function cleanSource(root) {
    return git(root, ['status', '--porcelain', '--untracked-files=normal', '--', '.', ':(exclude)node_modules/**']) === '';
}
export function validateBaseSource({ head, originMain, remote, clean }, expected) {
    check(SHA.test(expected) && head === expected && originMain === expected && clean === true, 'the checkout must be clean and pinned to current public main.');
    check(['https://github.com/' + PUBLIC_SOURCE_REPOSITORY + '.git', 'https://github.com/' + PUBLIC_SOURCE_REPOSITORY,
        'git@github.com:' + PUBLIC_SOURCE_REPOSITORY + '.git'].includes(remote), 'the checkout is not the configured public source repository.');
}
function fetchMain(root) {
    git(root, ['fetch', '--quiet', 'origin', 'main']);
    return git(root, ['rev-parse', 'origin/main']);
}
function assertPreparedSource(root, config, revision) {
    check(fetchMain(root) === config.baseSourceRevision, 'public main changed; the publication must be prepared and reviewed again.');
    check(git(root, ['rev-parse', 'HEAD']) === revision && cleanSource(root), 'the private content build source changed.');
    assertContentOnlyPaths(git(root, ['diff', '--name-only', config.baseSourceRevision, revision]).split('\n').filter(Boolean));
}
async function releaseSnapshot(config, id, fetchImpl, allowMissing = false) {
    return fetchJson(config.apiOrigin + '/api/help/cms/release/' + id, {
        fetchImpl, allowMissing, headers: { Authorization: 'Bearer ' + config.releaseToken },
    });
}
export async function collectApprovedMedia(publication, config, { fetchImpl = fetch, validateImage } = {}) {
    const assets = new Map();
    for (const article of publication.articles) {
        if (article.status !== 'approved') continue;
        for (const section of article.sections) for (const item of section.media || []) {
            check(article.visibility === 'public', 'restricted attachments cannot be released.');
            if (item.type !== 'image' || assets.has(item.assetId)) continue;
            check(DIGEST.test(item.assetId || ''), 'invalid approved image identity.');
            const response = await boundedFetch(fetchImpl, config.apiOrigin + '/api/help/cms/release/' + config.releaseId + '/media/' + item.assetId,
                { headers: { Authorization: 'Bearer ' + config.releaseToken } });
            const mime = normalizedMime(response.headers.get('Content-Type'));
            const bytes = await readBoundedBytes(response, 2 * 1024 * 1024);
            check(sha256Bytes(bytes) === item.assetId, 'the approved media bytes do not match their content identity.');
            check(typeof validateImage === 'function', 'the canonical image validator is unavailable.');
            validateImage(new Uint8Array(bytes), mime);
            assets.set(item.assetId, { assetId: item.assetId, mime, bytes: bytes.length, sha256: item.assetId });
        }
    }
    return [...assets.values()];
}
export function verifiedPreviousContentDigest({ compiler, root, compiled, previousContentDigest }) {
    const normalizedDigest = digestValue(compiled);
    if (previousContentDigest === undefined || previousContentDigest === normalizedDigest) return normalizedDigest;
    check(DIGEST.test(previousContentDigest || ''), 'the previous content digest is invalid.');
    const originalDigest = digestValue(compiler.compileHelpContent({ root, normalizeTerminology: false }));
    check(previousContentDigest === originalDigest,
        'the previous content digest does not match the exact immutable published snapshot.');
    return originalDigest;
}
export async function prepareContentCommit(root, publication, config, { media, basePublication, privateDirectory, previousContentDigest } = {}) {
    assertPrivateSeedUntracked(root);
    const seed = sourceSeed(root);
    validateSourceIdentities(publication, seed);
    const compiler = await import(pathToFileURL(join(root, 'scripts/build-help-content.mjs')).href);
    let previousContentRoot = root;
    let previousCompiled = compiler.compileHelpContent({ root });
    const previousPath = join(root, 'content/help/editorial-corrections.json');
    let previous = existsSync(previousPath) ? jsonFile(previousPath) : { facts: [], topics: [] };
    if (basePublication) {
        validateSourceIdentities(publication, { manifest: { ...basePublication.manifest, topics: seed.manifest.topics }, articles: basePublication.articles });
        check(isText(privateDirectory), 'a private workspace is required for the previously published snapshot.');
        const baseRoot = join(privateDirectory, 'previous-content');
        mkdirSync(join(baseRoot, 'content/help/articles'), { recursive: true, mode: 0o700 });
        writeFileSync(join(baseRoot, 'content/help/manifest.json'), JSON.stringify(basePublication.manifest), { mode: 0o600 });
        for (const article of basePublication.articles) writeFileSync(join(baseRoot, canonicalArticlePath(article)), JSON.stringify(article), { mode: 0o600 });
        previousContentRoot = baseRoot;
        previousCompiled = compiler.compileHelpContent({ root: baseRoot });
        previous = deriveEditorialCorrections({ baseline: jsonFile(join(root, 'server/test/fixtures/helpMigrationBaseline.json')),
            compiled: previousCompiled, publication: basePublication, previous });
    }
    const baseContentDigest = verifiedPreviousContentDigest({ compiler, root: previousContentRoot,
        compiled: previousCompiled, previousContentDigest });
    for (const file of readdirSync(join(root, 'content/help/articles'))) {
        check(/^hc-\d{2,3}-[a-z0-9]+(?:-[a-z0-9]+)*\.json$/.test(file), 'the canonical article directory contains an unexpected path.');
        rmSync(join(root, 'content/help/articles', file));
    }
    for (const article of publication.articles) writeFileSync(join(root, canonicalArticlePath(article)), JSON.stringify(article, null, 2) + '\n', { mode: 0o600 });
    writeFileSync(join(root, 'content/help/manifest.json'), JSON.stringify(publication.manifest, null, 2) + '\n');
    const compiled = compiler.compileHelpContent({ root });
    const registry = deriveEditorialCorrections({ baseline: jsonFile(join(root, 'server/test/fixtures/helpMigrationBaseline.json')), compiled, publication, previous });
    writeFileSync(previousPath, JSON.stringify(registry, null, 2) + '\n', { mode: 0o600 });
    const result = compiler.generateHelpContent({ root });
    assertPrivateSeedUntracked(root);
    const { changed, untracked } = uncommittedContentPaths(root);
    assertContentOnlyPaths([...changed, ...untracked]);
    git(root, ['add', '--', 'content/help/manifest.json', 'content/help/articles', 'content/help/editorial-corrections.json', ...GENERATED_CONTENT_PATHS]);
    assertContentOnlyPaths(git(root, ['diff', '--cached', '--name-only']).split('\n').filter(Boolean));
    git(root, ['-c', 'user.name=CareAround Help Publisher', '-c', 'user.email=help-publisher@users.noreply.github.com',
        'commit', '--no-gpg-sign', '-m', 'Publish approved Help content ' + config.releaseId]);
    const buildSourceRevision = git(root, ['rev-parse', 'HEAD']);
    assertPreparedSource(root, config, buildSourceRevision);
    return { ...result, baseContentDigest, buildSourceRevision, media: media || [] };
}
export function validatedWranglerPath(root, expectedVersion) {
    const file = join(root, 'node_modules/wrangler/bin/wrangler.js');
    check(existsSync(file) && !lstatSync(file).isSymbolicLink(), 'the lockfile-installed Wrangler CLI is unavailable.');
    const packageJson = jsonFile(join(root, 'node_modules/wrangler/package.json'));
    check(packageJson.name === 'wrangler' && /^4\.\d+\.\d+$/.test(expectedVersion || '') && packageJson.version === expectedVersion,
        'the installed Wrangler package does not match the reviewed exact version.');
    return file;
}
export function deploymentArguments(target, revision) {
    check(SHA.test(revision), 'a clean private build commit is required.');
    if (target === 'worker') return ['deploy', '--keep-vars', '--config', 'wrangler.toml', '--tag', 'git-' + revision,
        '--define', '__CAREAROUND_SOURCE_REVISION__:' + JSON.stringify(revision)];
    check(target === 'pages', 'unknown deployment target.');
    return ['pages', 'deploy', 'dist', '--project-name', 'senior-resource-map', '--branch', 'main',
        '--commit-hash', revision, '--commit-dirty=false', '--skip-caching'];
}
export async function runQualityGates(root, config, compiled, privateDirectory, records = []) {
    const gate = (name, action) => {
        try { action(); records.push({ gate: name, passed: true }); }
        catch (error) { records.push({ gate: name, passed: false }); error.releaseStage = name; throw error; }
    };
    const env = { ...childEnvironment(), CF_PAGES: '1', CF_PAGES_COMMIT_SHA: compiled.buildSourceRevision };
    gate('release-adapter-tests', () => command(process.execPath, ['--test', 'scripts/help-cms-release.test.mjs'], { cwd: root, env }));
    for (const args of [['run', 'verify:quality'], ['run', 'test:map-lockdown']]) gate(args[1], () => command('npm', args, { cwd: root, env }));
    const workerArgs = deploymentArguments('worker', compiled.buildSourceRevision);
    gate('worker-dry-run', () => command(process.execPath, [validatedWranglerPath(join(privateDirectory, 'tools'), config.wranglerVersion), ...workerArgs, '--dry-run', '--outdir', join(privateDirectory, 'worker-dry-run')],
        { cwd: join(root, 'server'), env: childEnvironment() }));
    check(existsSync(join(root, 'client/functions')), 'the Pages Functions source is missing.');
    const manifest = jsonFile(join(root, 'client/dist/release.json'));
    check(manifest.sourceRevision === compiled.buildSourceRevision && manifest.sourceClean === true
        && manifest.htmlSha256 === sha256Bytes(readFileSync(join(root, 'client/dist/index.html'))), 'the built Pages provenance does not match the clean private content commit.');
    assertPreparedSource(root, config, compiled.buildSourceRevision);
}
export async function observeContentSurfaces(config, { fetchImpl = fetch } = {}) {
    const nonce = '?help_release_check=' + encodeURIComponent(config.releaseId || 'ordinary-release');
    const targets = [['help', config.apiOrigin + '/api/help/articles'], ['guide', config.apiOrigin + '/api/guide/topics'],
        ['client', config.appOrigin + '/help-content-status.json']];
    return Promise.all(targets.map(async ([target, url]) => {
        const body = await fetchJson(url + nonce, { fetchImpl, headers: { 'Cache-Control': 'no-cache' }, maximumBytes: 5 * 1024 * 1024 });
        check(isText(body.version) && DIGEST.test(body.contentDigest || ''), 'published content status is invalid.');
        return { target, version: body.version, contentDigest: body.contentDigest };
    }));
}
export function validateRecoverySurfaces(surfaces, { baseVersion, baseDigest, targetVersion, targetDigest }) {
    check(Array.isArray(surfaces) && surfaces.length === 3 && new Set(surfaces.map(item => item.target)).size === 3
        && surfaces.every(item => ['help', 'guide', 'client'].includes(item.target)), 'the content readiness surfaces are incomplete.');
    const states = surfaces.map(record => {
        if (record.version === baseVersion && record.contentDigest === baseDigest) return { ...record, stage: 'base' };
        if (record.version === targetVersion && record.contentDigest === targetDigest) return { ...record, stage: 'target' };
        throw new Error('Help release: a live content surface matches neither the approved base nor the exact recovery snapshot.');
    });
    return { surfaces: states, hasTarget: states.some(item => item.stage === 'target'), mixed: new Set(states.map(item => item.stage)).size > 1 };
}
export async function observeContent(config, { fetchImpl = fetch, expectedVersion, expectedDigest } = {}) {
    const records = await observeContentSurfaces(config, { fetchImpl });
    for (const record of records) {
        check(!expectedVersion || record.version === expectedVersion, 'published content version does not match the required version.', 'public-content-version-mismatch');
        check(!expectedDigest || record.contentDigest === expectedDigest, 'published content digest does not match the required digest.', 'public-content-digest-mismatch');
    }
    check(records.every(record => record.version === records[0].version && record.contentDigest === records[0].contentDigest), 'Help, Guide and Pages content versions disagree.', 'public-content-disagreement');
    return { version: records[0].version, contentDigest: records[0].contentDigest, targets: records.map(record => record.target) };
}
export function priorReleaseState(status = {}) {
    const productionAttempted = status.deploymentAttempted === true || status.productionAttempted === true
        || status.state === 'partially-released' || (status.attemptedTargets || []).length > 0
        || Boolean(status.workerVersionId || status.pagesDeploymentId);
    return { state: productionAttempted ? 'partially-released' : 'failed', productionAttempted, attemptedTargets: [],
        workerVersionId: status.workerVersionId || null, pagesDeploymentId: status.pagesDeploymentId || null,
        recovery: status.recovery || null, verification: null, failedStage: null };
}
function publicFiles(root, prefix = '') {
    const files = [];
    for (const entry of readdirSync(join(root, prefix), { withFileTypes: true })) {
        const name = prefix ? prefix + '/' + entry.name : entry.name;
        check(!entry.isSymbolicLink(), 'public artifacts cannot contain symlinks.');
        if (entry.isDirectory()) files.push(...publicFiles(root, name));
        else if (entry.isFile() && !CONTROL_FILES.has(name)) files.push(name);
        else check(entry.isFile(), 'the build contains an unsupported filesystem entry.');
    }
    return files.sort();
}
export async function verifyPublicArtifacts({ dist, appOrigin, releaseId, probeId, fetchImpl = fetch, attempts = 3, delay = ms => new Promise(done => setTimeout(done, ms)) }) {
    const marker = probeId === undefined ? releaseId : probeId;
    check(typeof marker === 'string' && marker.length === 36 && UUID.test(marker), 'invalid public artifact proof identity.');
    const records = [];
    const paths = publicFiles(dist);
    check(paths.includes('index.html') && paths.includes('release.json') && paths.includes('help-content-status.json'), 'the public artifact inventory is incomplete.');
    for (const file of paths) {
        const localBytes = readFileSync(join(dist, file)), expectedDigest = sha256Bytes(localBytes), failures = [];
        const allowedMimes = file === 'pwa/carearound-sw' ? MIMES['.js'] : MIMES[extname(file).toLowerCase()];
        check(allowedMimes, 'the public artifact inventory contains an unsupported MIME type.');
        const proofHtml = Object.hasOwn(HTML_PROOFS, file);
        const deliveryPath = proofHtml ? HTML_PROOFS[file] : '/' + file.split('/').map(encodeURIComponent).join('/');
        let passed = false, securityHeaders = null;
        for (let attempt = 1; attempt <= attempts; attempt++) {
            try {
                const url = appOrigin + deliveryPath + '?help_release_check=' + encodeURIComponent(marker) + '&attempt=' + attempt;
                const response = await boundedFetch(fetchImpl, url, { headers: { 'Cache-Control': 'no-cache' } });
                if (proofHtml) check(response.status === 200 && !response.redirected, 'HTML asset proof delivery mismatch.');
                check(allowedMimes.includes(normalizedMime(response.headers.get('Content-Type'))), 'public artifact MIME mismatch.');
                const bytes = await readBoundedBytes(response, localBytes.length + 1);
                check(bytes.length === localBytes.length && sha256Bytes(bytes) === expectedDigest, 'public artifact byte/digest mismatch.');
                if (proofHtml) {
                    check(response.headers.get('Cache-Control') === 'private, no-store, no-transform', 'HTML asset proof cache policy mismatch.');
                    securityHeaders = Object.fromEntries(HTML_SECURITY_HEADERS.map(name => [name, response.headers.get(name)]));
                    check(Object.values(securityHeaders).every(isText), 'HTML asset proof security headers are incomplete.');
                }
                passed = true; break;
            } catch { failures.push({ attempt, result: 'byte-mime-or-delivery-mismatch' }); }
            if (attempt < attempts) await delay(1500);
        }
        records.push({ path: file, deliveryPath, proofMode: proofHtml ? 'deployed-html-asset' : 'public-artifact',
            bytes: localBytes.length, sha256: expectedDigest, passed, failures, ...(proofHtml ? { securityHeaders } : {}) });
    }
    return { passed: records.every(record => record.passed), checked: records.length, records };
}
function analyticsScriptCount(html) {
    // Inspect element tokens without altering the response or its proof bytes.
    // Skip comments and raw-text/inert containers so text mentioning the beacon
    // cannot establish that an executable analytics script was delivered.
    const tags = /<!--[\s\S]*?-->|<![^>]*>|<\/?([a-z][a-z0-9:-]*)\b((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
    const raw = new Set(['script', 'style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes', 'noscript']);
    let count = 0, templates = 0, foreign = 0, tag;
    while ((tag = tags.exec(html))) {
        if (!tag[1]) continue;
        const name = tag[1].toLowerCase(), closing = tag[0].startsWith('</');
        if (name === 'template') { templates = Math.max(0, templates + (closing ? -1 : 1)); continue; }
        if (['svg', 'math'].includes(name)) { foreign = Math.max(0, foreign + (closing ? -1 : 1)); continue; }
        if (closing) continue;
        if (name === 'plaintext') break;
        if (!raw.has(name)) continue;
        const end = new RegExp('</' + name + '\\s*>', 'gi'); end.lastIndex = tags.lastIndex;
        const close = end.exec(html);
        if (!close) break;
        if (name === 'script' && templates === 0 && foreign === 0) {
            const attributes = /([^\s=/'">]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
            let attribute;
            const values = new Map();
            while ((attribute = attributes.exec(tag[2]))) {
                const name = attribute[1].toLowerCase();
                if (!values.has(name)) values.set(name, attribute[2] ?? attribute[3] ?? attribute[4] ?? '');
            }
            const type = normalizedMime(values.get('type'));
            // Both classic JavaScript MIME types and module tags execute JS.
            if (values.has('nomodule') || !['', 'module', 'text/javascript', 'application/javascript', 'text/ecmascript', 'application/ecmascript'].includes(type)) {
                tags.lastIndex = end.lastIndex; continue;
            }
            try {
                const url = new URL(values.get('src'));
                if (!url.username && !url.password && url.origin === 'https://static.cloudflareinsights.com'
                    && (url.pathname === '/beacon.min.js' || url.pathname.startsWith('/beacon.min.js/'))) count++;
            } catch { /* An invalid/non-absolute source cannot be the analytics script. */ }
        }
        tags.lastIndex = end.lastIndex;
    }
    return count;
}
export async function verifyOrdinaryHtmlDelivery({ appOrigin, artifactProof, probeId, fetchImpl = fetch }) {
    check(typeof probeId === 'string' && probeId.length === 36 && UUID.test(probeId), 'invalid ordinary HTML proof identity.');
    const documents = [{ file: 'index.html', path: '/', cache: 'public, max-age=0, must-revalidate' },
        { file: 'offline.html', path: '/offline', cache: 'no-cache' }];
    const references = documents.map(document => artifactProof?.records?.find(record => record.path === document.file));
    if (artifactProof?.passed !== true || references.some((record, index) => !record?.passed || record.proofMode !== 'deployed-html-asset'
        || record.deliveryPath !== HTML_PROOFS[documents[index].file] || !Number.isSafeInteger(record.bytes) || record.bytes < 0
        || !HTML_SECURITY_HEADERS.every(name => isText(record.securityHeaders?.[name])))) {
        return { passed: false, checked: 0, checks: [], failure: 'complete-html-asset-proof-required' };
    }
    const cases = [{ name: 'bare', query: '' }, { name: 'invalid-marker', query: '?help_release_check=invalid' },
        { name: 'duplicate-marker', query: '?help_release_check=' + probeId + '&help_release_check=' + probeId }];
    const checks = [];
    for (let index = 0; index < documents.length; index++) for (const entry of cases) {
        const document = documents[index], reference = references[index];
        const record = { path: document.path, case: entry.name, passed: false };
        try {
            const response = await boundedFetch(fetchImpl, appOrigin + document.path + entry.query, { headers: {
                'Cache-Control': 'no-cache', 'User-Agent': 'CareAround-Release-Verification', Accept: 'text/html',
            } });
            record.status = response.status; record.mime = normalizedMime(response.headers.get('Content-Type'));
            record.cacheControl = response.headers.get('Cache-Control');
            check(record.status === 200 && record.mime === 'text/html', 'ordinary HTML status/MIME mismatch.');
            check(record.cacheControl === document.cache, 'ordinary HTML cache policy changed.');
            record.securityHeadersMatch = HTML_SECURITY_HEADERS.every(name => response.headers.get(name) === reference.securityHeaders[name]);
            check(record.securityHeadersMatch, 'ordinary HTML security headers changed.');
            const bytes = await readBoundedBytes(response, reference.bytes + 64 * 1024);
            record.beaconCount = analyticsScriptCount(bytes.toString('utf8'));
            check(record.beaconCount === 1, 'ordinary HTML analytics delivery changed.');
            record.passed = true;
        } catch { record.failure = 'ordinary-html-delivery-mismatch'; }
        checks.push(record);
    }
    return { passed: checks.every(record => record.passed), checked: checks.length, checks };
}
async function observeReleases(config, fetchImpl = fetch) {
    const nonce = '?help_release_check=' + encodeURIComponent(config.releaseId);
    const [worker, client] = await Promise.all([
        fetchJson(config.apiOrigin + '/api/release' + nonce, { fetchImpl, maximumBytes: 128 * 1024, headers: { 'Cache-Control': 'no-cache' } }),
        fetchJson(config.appOrigin + '/release.json' + nonce, { fetchImpl, maximumBytes: 128 * 1024, headers: { 'Cache-Control': 'no-cache' } }),
    ]);
    check(worker.sourceClean === true && client.sourceClean === true && SHA.test(worker.sourceRevision || '') && SHA.test(client.sourceRevision || '')
        && UUID.test(worker.deploymentId || ''), 'current production recovery identities are unavailable.');
    return { workerVersionId: worker.deploymentId, workerSourceRevision: worker.sourceRevision, pagesSourceRevision: client.sourceRevision };
}
export async function observeVerifiedPublicRelease(config, compiled, { fetchImpl = fetch, attempts = 4, delay = ms => new Promise(done => setTimeout(done, ms)) } = {}) {
    check(Number.isSafeInteger(attempts) && attempts >= 1 && attempts <= 4 && typeof delay === 'function',
        'public observation retry limits are invalid.', 'public-configuration-invalid');
    check(SHA.test(compiled?.buildSourceRevision || '') && isText(compiled?.version) && DIGEST.test(compiled?.contentDigest || ''),
        'public observation target is incomplete.', 'public-configuration-invalid');
    const publicObservations = [];
    for (let attempt = 1; attempt <= attempts; attempt++) {
        let failureCode = 'public-source-unavailable';
        try {
            const live = await observeReleases(config, fetchImpl);
            check(live.workerSourceRevision === compiled.buildSourceRevision && live.pagesSourceRevision === compiled.buildSourceRevision,
                'paired runtime source revisions disagree.', 'public-source-mismatch');
            failureCode = 'public-content-unavailable';
            const content = await observeContent(config, { fetchImpl, expectedVersion: compiled.version, expectedDigest: compiled.contentDigest });
            publicObservations.push({ attempt, passed: true, code: 'public-observation-verified' });
            return { content, publicObservations };
        } catch (cause) {
            publicObservations.push({ attempt, passed: false, code: safeFailureCode(cause, failureCode) });
            if (attempt === attempts) {
                const error = new Error('Help release: verified public observations did not settle.');
                error.releaseFailureCode = publicObservations.at(-1).code;
                error.publicObservations = publicObservations;
                throw error;
            }
            await delay(1500);
        }
    }
}
export async function pagesDeployment(config, revision, fetchImpl = fetch) {
    check(/^[a-f0-9]{32}$/.test(config.cloudflareAccountId || '') && isText(config.cloudflareToken), 'Cloudflare release verification is not configured.');
    const pageSize = 25, maximumPages = 4, matches = [];
    // The Pages API accepts at most 25 records per page. Keep the original
    // bounded 100-deployment window, including older recovery builds.
    for (let page = 1; page <= maximumPages; page++) {
        const response = await fetchJson('https://api.cloudflare.com/client/v4/accounts/' + config.cloudflareAccountId
            + '/pages/projects/senior-resource-map/deployments?per_page=' + pageSize + '&page=' + page, {
            fetchImpl, maximumBytes: 2 * 1024 * 1024, headers: { Authorization: 'Bearer ' + config.cloudflareToken },
        });
        check(response.success === true && Array.isArray(response.result) && response.result.length <= pageSize,
            'Pages deployment metadata is unavailable.');
        matches.push(...response.result.filter(entry => entry.environment === 'production'
            && entry.deployment_trigger?.metadata?.commit_hash === revision && entry.latest_stage?.status === 'success' && UUID.test(entry.id || '')));
        if (response.result.length < pageSize) break;
    }
    matches.sort((a, b) => Date.parse(b.created_on) - Date.parse(a.created_on));
    check(matches.length > 0, 'Pages has no successful deployment for the private build commit.');
    return matches[0].id;
}
export function runnerReceipt(config, compiled, result) {
    const proof = result.verification, r = result.recovery;
    const recovery = r && UUID.test(r.workerVersionId || '') && UUID.test(r.pagesDeploymentId || '')
        && SHA.test(r.workerSourceRevision || '') && SHA.test(r.pagesSourceRevision || '')
        && isText(r.contentVersion) && r.contentVersion.length <= 160 && DIGEST.test(r.contentDigest || '') ? r : null;
    return { jobId: config.jobId, snapshotDigest: config.snapshotDigest, version: compiled?.version || null,
        baseSourceRevision: config.baseSourceRevision, compiledContentDigest: compiled?.contentDigest || null,
        buildSourceRevision: compiled?.buildSourceRevision || null, workerVersionId: result.workerVersionId || null,
        pagesDeploymentId: result.pagesDeploymentId || null,
        state: result.state === 'partially-released' && (!DIGEST.test(compiled?.contentDigest || '') || !SHA.test(compiled?.buildSourceRevision || '')) ? 'failed' : result.state,
        deploymentAttempted: result.productionAttempted === true || (result.attemptedTargets || []).length > 0,
        attemptedTargets: result.attemptedTargets || [], recovery,
        verification: proof ? { passed: proof.passed, content: proof.content, artifactCount: proof.artifactCount,
            mediaCount: proof.mediaCount, mediaPassed: proof.mediaPassed,
            artifactRetryFailures: (proof.artifactChecks || []).reduce((total, record) => total + record.failures.length, 0) } : null };
}
export async function pairedRelease({ deployWorker, deployPages, observeWorker, observePages, verify, assertSource, recovery, previous = {}, beforeDeploy = async () => {} }) {
    const result = { ...priorReleaseState(previous), recovery, failureCode: null, publicObservations: [] };
    let stage = 'source-check';
    try {
        await assertSource();
        stage = 'worker-checkpoint'; await beforeDeploy(['worker']);
        stage = 'worker-deploy'; result.attemptedTargets.push('worker'); result.productionAttempted = true; result.workerVersionId = null; await deployWorker();
        stage = 'worker-observation'; result.workerVersionId = await observeWorker();
        stage = 'source-recheck'; await assertSource();
        stage = 'pages-checkpoint'; await beforeDeploy(['worker', 'pages']);
        stage = 'pages-deploy'; result.attemptedTargets.push('pages'); result.pagesDeploymentId = null; await deployPages();
        stage = 'pages-observation'; result.pagesDeploymentId = await observePages();
        stage = 'public-verification'; result.verification = await verify();
        result.publicObservations = safePublicObservations(result.verification?.publicObservations);
        if (result.verification?.passed !== true) result.failureCode = safeFailureCode({ releaseFailureCode: result.verification?.failureCode }, 'public-verification-failed');
        check(result.verification?.passed === true, 'paired runtime/artifact verification did not pass.', 'public-verification-failed');
        stage = 'post-release-source-check'; await assertSource();
        result.state = 'published';
    } catch (error) {
        result.state = result.productionAttempted || result.attemptedTargets.length ? 'partially-released' : 'failed';
        result.failedStage = stage;
        result.failureCode ||= safeFailureCode(error, stage === 'public-verification' ? 'public-verification-failed' : 'release-check-failed');
        if (!result.publicObservations.length) result.publicObservations = safePublicObservations(error?.publicObservations);
        // A failed CLI may have uploaded successfully. Keep any observed IDs;
        // never claim that production stayed unchanged after an attempted deploy.
        if (result.attemptedTargets.includes('worker') && !result.workerVersionId) {
            try { result.workerVersionId = await observeWorker(); } catch { /* unknown deployment retained */ }
        }
        if (result.attemptedTargets.includes('pages') && !result.pagesDeploymentId) {
            try { result.pagesDeploymentId = await observePages(); } catch { /* unknown deployment retained */ }
        }
    }
    return result;
}
async function retryObservation(read, attempts = 4) {
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try { return await read(); } catch {
            if (attempt === attempts) throw new Error('Help release: live deployment identity did not settle.');
            await new Promise(done => setTimeout(done, 1500));
        }
    }
}
export async function postCheckpoint(config, compiled, recovery, checkpoint, fetchImpl = fetch) {
    check(['prepared', 'deploying'].includes(checkpoint.stage) && Array.isArray(checkpoint.attemptedTargets)
        && checkpoint.attemptedTargets.length <= 2 && checkpoint.attemptedTargets.every(target => ['worker', 'pages'].includes(target))
        && (checkpoint.stage !== 'prepared' || checkpoint.attemptedTargets.length === 0), 'invalid release checkpoint.');
    const complete = runnerReceipt(config, compiled, { state: 'failed', recovery }).recovery;
    check(complete && DIGEST.test(compiled.contentDigest || '') && SHA.test(compiled.buildSourceRevision || ''), 'complete original recovery is required before deployment.');
    const payload = { jobId: config.jobId, snapshotDigest: config.snapshotDigest, version: compiled.version,
        baseSourceRevision: config.baseSourceRevision, compiledContentDigest: compiled.contentDigest,
        buildSourceRevision: compiled.buildSourceRevision, recovery: complete, stage: checkpoint.stage,
        attemptedTargets: checkpoint.attemptedTargets };
    const response = await boundedFetch(fetchImpl, config.apiOrigin + '/api/help/cms/release/' + config.releaseId + '/checkpoint', {
        method: 'POST', headers: { Authorization: 'Bearer ' + config.releaseToken, 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    check(response.ok && normalizedMime(response.headers.get('Content-Type')) === 'application/json', 'the private recovery checkpoint was not accepted.');
    const reply = JSON.parse((await readBoundedBytes(response, 16384)).toString('utf8'));
    check(reply.release?.id === config.releaseId, 'the API acknowledged a different recovery checkpoint.');
    return reply.release;
}
export async function postReceipt(config, receipt, fetchImpl) {
    const response = await boundedFetch(fetchImpl, config.apiOrigin + '/api/help/cms/release/' + config.releaseId + '/receipt', {
        method: 'POST', headers: { Authorization: 'Bearer ' + config.releaseToken, 'Content-Type': 'application/json' }, body: JSON.stringify(receipt),
    });
    check(response.ok && normalizedMime(response.headers.get('Content-Type')) === 'application/json', 'the private release receipt was not accepted.');
    const body = JSON.parse((await readBoundedBytes(response, 16384)).toString('utf8'));
    check(body.release?.id === config.releaseId && ['published', 'partially-released', 'failed', 'dispatch-unconfirmed'].includes(body.release?.state),
        'the API did not acknowledge a matching release state.');
    return body.release.state;
}
export async function runHelpContentRelease({ root = process.cwd(), env = process.env, fetchImpl = fetch, execute = false } = {}) {
    const config = readReleaseConfiguration(env);
    await assertPrivateAutomation(config, fetchImpl);
    const envelope = await releaseSnapshot(config, config.releaseId, fetchImpl);
    const publication = validateSnapshot(envelope, config);
    const privateDirectory = mkdtempSync(join(tmpdir(), 'carearound-help-release-'));
    const prior = envelope.releaseStatus || {};
    if (envelope.releaseStatus) check(prior.id === config.releaseId && prior.jobId === config.jobId
        && prior.snapshotDigest === config.snapshotDigest && prior.baseSourceRevision === config.baseSourceRevision, 'prior release status belongs to another job.');
    let compiled = DIGEST.test(prior.compiledContentDigest || '') && SHA.test(prior.buildSourceRevision || '')
        ? { version: publication.version, contentDigest: prior.compiledContentDigest, buildSourceRevision: prior.buildSourceRevision } : undefined;
    let result = priorReleaseState(prior);
    const qualityGates = [];
    try {
        const remote = git(root, ['remote', 'get-url', 'origin']);
        validateBaseSource({ head: config.baseSourceRevision, originMain: config.baseSourceRevision, remote, clean: true }, config.baseSourceRevision);
        validateBaseSource({ head: git(root, ['rev-parse', 'HEAD']), originMain: fetchMain(root),
            remote, clean: cleanSource(root) }, config.baseSourceRevision);
        const latest = await releaseSnapshot(config, 'latest', fetchImpl, true);
        if (latest) {
            check(latest.version === publication.baseContentVersion, 'the approved publication is based on an obsolete CMS revision.');
            validateSnapshot(latest, { releaseId: latest.releaseId || latest.id, jobId: latest.jobId,
                snapshotDigest: latest.snapshotDigest, baseSourceRevision: latest.baseSourceRevision });
        }
        const before = await observeContentSurfaces(config, { fetchImpl });
        if (before.some(item => item.version === publication.version)) result.productionAttempted = true;
        const liveBefore = await observeReleases(config, fetchImpl);
        const recovery = prior.recovery || { ...liveBefore, contentVersion: publication.baseContentVersion,
            contentDigest: before.find(item => item.version === publication.baseContentVersion)?.contentDigest || null,
            ...(result.productionAttempted ? { workerVersionId: null, workerSourceRevision: null } : {}) };
        result.recovery = recovery;
        // Only the configured HTTPS origin receives the private token. Media
        // metadata is retained for verification; private image bytes are discarded.
        const shared = await import(pathToFileURL(join(root, 'shared/helpContentCms.js')).href);
        const media = await collectApprovedMedia(publication, config, { fetchImpl, validateImage: shared.validateCmsImage });
        command('npm', ['ci', '--no-audit', '--no-fund'], { cwd: root });
        command('npm', ['install', '--prefix', join(privateDirectory, 'tools'), '--no-audit', '--no-fund',
            '--save-exact', 'wrangler@' + config.wranglerVersion], { cwd: privateDirectory });
        compiled = await prepareContentCommit(root, publication, config, { media, basePublication: latest?.publication,
            privateDirectory, previousContentDigest: recovery.contentDigest });
        const allowedContent = { baseVersion: publication.baseContentVersion, baseDigest: compiled.baseContentDigest,
            targetVersion: compiled.version, targetDigest: compiled.contentDigest };
        const firstReadiness = validateRecoverySurfaces(before, allowedContent);
        if (firstReadiness.hasTarget) result.productionAttempted = true;
        if (DIGEST.test(prior.compiledContentDigest || '')) check(prior.compiledContentDigest === compiled.contentDigest,
            'the recovery compilation differs from the previously attempted immutable snapshot.');
        await runQualityGates(root, config, compiled, privateDirectory, qualityGates);
        if (!execute) return { state: 'prepared', releaseId: config.releaseId, jobId: config.jobId,
            baseSourceRevision: config.baseSourceRevision, ...compiled, qualityGates, productionAttempted: false };
        check(/^[a-f0-9]{32}$/.test(config.cloudflareAccountId || '') && isText(config.cloudflareToken), 'Cloudflare release execution is not configured.');
        if (!recovery.pagesDeploymentId && recovery.pagesSourceRevision && before.find(item => item.target === 'client')?.version === publication.baseContentVersion)
            recovery.pagesDeploymentId = await pagesDeployment(config, recovery.pagesSourceRevision, fetchImpl);
        const finalReadiness = validateRecoverySurfaces(await observeContentSurfaces(config, { fetchImpl }), allowedContent);
        if (finalReadiness.hasTarget) result.productionAttempted = true;
        try { await postCheckpoint(config, compiled, recovery, { stage: 'prepared', attemptedTargets: [] }, fetchImpl); }
        catch (error) { error.releaseStage = 'prepared-checkpoint'; throw error; }
        const wrangler = validatedWranglerPath(join(privateDirectory, 'tools'), config.wranglerVersion);
        const deployEnv = { ...childEnvironment(), CLOUDFLARE_ACCOUNT_ID: config.cloudflareAccountId, CLOUDFLARE_API_TOKEN: config.cloudflareToken };
        result = await pairedRelease({
            recovery, previous: result,
            beforeDeploy: targets => postCheckpoint(config, compiled, recovery, { stage: 'deploying', attemptedTargets: targets }, fetchImpl),
            assertSource: async () => assertPreparedSource(root, config, compiled.buildSourceRevision),
            deployWorker: async () => command(process.execPath, [wrangler, ...deploymentArguments('worker', compiled.buildSourceRevision)], { cwd: join(root, 'server'), env: deployEnv }),
            deployPages: async () => command(process.execPath, [wrangler, ...deploymentArguments('pages', compiled.buildSourceRevision)], { cwd: join(root, 'client'), env: deployEnv }),
            observeWorker: async () => retryObservation(async () => {
                const live = await observeReleases(config, fetchImpl);
                check(live.workerSourceRevision === compiled.buildSourceRevision, 'Worker does not serve the private build commit.');
                return live.workerVersionId;
            }),
            observePages: async () => retryObservation(() => pagesDeployment(config, compiled.buildSourceRevision, fetchImpl)),
            verify: async () => {
                const { content, publicObservations } = await observeVerifiedPublicRelease(config, compiled, { fetchImpl });
                const artifacts = await verifyPublicArtifacts({ dist: join(root, 'client/dist'), appOrigin: config.appOrigin, releaseId: config.releaseId, probeId: config.jobId, fetchImpl });
                const ordinaryHtml = await verifyOrdinaryHtmlDelivery({ appOrigin: config.appOrigin, artifactProof: artifacts, probeId: config.jobId, fetchImpl });
                let mediaPassed = true;
                for (const asset of media) {
                    try {
                        const response = await boundedFetch(fetchImpl, config.apiOrigin + '/api/help/media/' + asset.assetId, { headers: { 'Cache-Control': 'no-cache' } });
                        check(normalizedMime(response.headers.get('Content-Type')) === asset.mime, 'released media MIME mismatch.');
                        const bytes = await readBoundedBytes(response, asset.bytes + 1);
                        check(bytes.length === asset.bytes && sha256Bytes(bytes) === asset.sha256, 'released media bytes mismatch.');
                    } catch { mediaPassed = false; }
                }
                return { passed: artifacts.passed && ordinaryHtml.passed && mediaPassed, content, artifactCount: artifacts.checked, mediaCount: media.length, mediaPassed,
                    artifactChecks: artifacts.records, ordinaryHtml, publicObservations,
                    failureCode: !artifacts.passed ? 'public-artifact-verification-failed' : !ordinaryHtml.passed ? 'ordinary-html-verification-failed'
                        : !mediaPassed ? 'public-media-verification-failed' : null };
            },
        });
    } catch (error) {
        result.failedStage ||= error?.releaseStage || 'preflight-or-quality';
        result.failureCode ||= safeFailureCode(error);
        result.state = result.productionAttempted || result.attemptedTargets.length ? 'partially-released' : 'failed';
    } finally {
        rmSync(privateDirectory, { recursive: true, force: true });
    }
    let receiptAccepted = false, receiptError = null;
    if (execute) {
        try {
            const acknowledged = await postReceipt(config, runnerReceipt(config, compiled || { version: publication.version }, result), fetchImpl);
            receiptAccepted = true;
            if (acknowledged === 'partially-released' || acknowledged === 'dispatch-unconfirmed') {
                result.state = 'partially-released'; result.productionAttempted = true; result.failedStage ||= 'receipt-readiness';
            } else if (result.state === 'published' && acknowledged !== 'published') {
                result.state = 'partially-released'; result.failedStage ||= 'receipt-readiness';
            }
        }
        catch { receiptError = 'receipt-delivery'; result.failedStage ||= receiptError; if (result.state === 'published') result.state = 'partially-released'; }
    }
    return { ...runnerReceipt(config, compiled || { version: publication.version }, result), releaseId: config.releaseId,
        receiptAccepted, receiptError, failedStage: result.failedStage, qualityGates, state: result.state, recoveryObservation: result.recovery || null,
        failureCode: result.failureCode || null, publicObservations: safePublicObservations(result.publicObservations),
        artifactChecks: result.verification?.artifactChecks || [], ordinaryHtml: result.verification?.ordinaryHtml || null,
        productionAttempted: result.productionAttempted || result.attemptedTargets.length > 0 };
}

// Ordinary application releases must call this before building/deploying. It
// fails closed after a CMS publication if the checkout would restore old content.
// Deliberate content restoration uses a new owner-reviewed CMS publication.
export async function assertLatestHelpContentForAppRelease({ root = process.cwd(), env = process.env, fetchImpl = fetch } = {}) {
    const apiOrigin = httpsOrigin(env.HELP_CMS_API_ORIGIN || 'https://api.carearound.sg');
    const appOrigin = httpsOrigin(env.HELP_CMS_PUBLIC_APP_ORIGIN || 'https://app.carearound.sg');
    const local = jsonFile(join(root, 'client/public/help-content-status.json'));
    check(isText(local.version) && DIGEST.test(local.contentDigest || ''), 'the local Help content status is invalid.');
    const config = { apiOrigin, appOrigin, releaseId: 'ordinary-release' };
    if (env.HELP_CMS_RELEASE_TOKEN) {
        const latest = await releaseSnapshot({ ...config, releaseToken: env.HELP_CMS_RELEASE_TOKEN }, 'latest', fetchImpl, true);
        if (latest) {
            check(latest.version === local.version && digestValue(latest.publication) === latest.snapshotDigest, 'latest CMS content is missing; prepare an application release with the published snapshot.');
        }
    }
    const live = await observeContent(config, { fetchImpl });
    check(local.version === live.version && local.contentDigest === live.contentDigest,
        'this application release would replace the latest published Help/Guide content. Integrate the published CMS snapshot first.');
    return live;
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
    const args = process.argv.slice(2);
    if (args.length === 1 && args[0] === '--help') {
        console.log('Private Help content release adapter: --prepare validates and creates a local content commit; --execute also deploys and verifies Worker + Pages. Configuration comes from private runner environment variables.');
    } else {
        try {
            check(args.length === 1 && ['--prepare', '--execute'].includes(args[0]), 'choose --prepare or --execute; arbitrary overrides are not supported.');
            const report = await runHelpContentRelease({ execute: args[0] === '--execute' });
            console.log(JSON.stringify(report));
            if (!['prepared', 'published'].includes(report.state)) process.exitCode = 1;
        } catch {
            console.error('Help content release stopped before validated preparation. Private configuration and content were withheld.');
            process.exitCode = 1;
        }
    }
}
