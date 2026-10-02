import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultManifest = 'output/help-centre/release-candidate.json';
const requiredGates = ['server', 'client', 'builder', 'build', 'static', 'mapLockdown', 'workerDryRun', 'builtBrowser', 'realApiUat', 'personalPlaceUat', 'offline'];
const reportPaths = {
    offline: 'output/help-centre/offline-evaluation.json',
    browser: 'output/playwright/help-centre-ui/report.json',
    api: 'output/help-centre/system-uat.json',
    personal: 'output/help-centre/personal-place-workflow/report.json',
};
const externalGates = ['Human content and complete-answer signoff', 'Named content owner confirmation',
    'Separately authorised live-model evaluation if required for AI acceptance',
    'Explicit commit/push and Worker/Pages release approval',
    'Fresh release recovery and custom-domain artifact/post-release verification'];
const fail = (label, reason) => { throw new Error(`${label}: ${reason}`); };
const requireThat = (condition, label, reason) => { if (!condition) fail(label, reason); };

// All reads stay within the supplied candidate root. Never read credentials,
// environment files, dependencies, Git internals, or execute candidate code.
function safeRelativePath(value, label) {
    requireThat(typeof value === 'string' && value.length > 0 && !isAbsolute(value)
        && !/[\\:\0]/.test(value) && value.split('/').every(part => part && part !== '.' && part !== '..'), label, 'non-portable or escaping path');
    const parts = value.split('/');
    requireThat(!parts.some(part => part.startsWith('.')
        || part === 'node_modules'
        || /^(?:credentials?|secrets?)(?:[._-]|$)/i.test(part)
        || /\.(?:pem|key|p12|pfx)$/i.test(part)), label, 'private or excluded artifact path');
    requireThat(/^(?:client|server|scripts|content|docs|output)\//.test(value)
        || /^package(?:-lock)?\.json$/.test(value), label, 'artifact path is outside the candidate evidence scope');
    return value;
}

export function verifyHelpReleaseCandidate({ root = repoRoot, manifestPath = defaultManifest } = {}) {
    const candidateRoot = realpathSync(root);
    const read = (value, label) => {
        const path = safeRelativePath(value, label);
        try {
            const actual = realpathSync(resolve(candidateRoot, path));
            const inside = relative(candidateRoot, actual);
            requireThat(inside && inside !== '..' && !inside.startsWith('..' + sep) && !isAbsolute(inside), label, 'symlink escapes candidate');
            safeRelativePath(inside.split(sep).join('/'), label);
            requireThat(statSync(actual).isFile(), label, 'artifact is not a regular file');
            return readFileSync(actual);
        } catch (error) {
            if (error.message.startsWith(label + ':')) throw error;
            fail(label, 'artifact is missing or unreadable');
        }
    };
    const parse = (bytes, label) => { try { return JSON.parse(bytes.toString('utf8')); } catch { fail(label, 'invalid JSON'); } };
    const manifest = parse(read(manifestPath, 'manifest'), 'manifest');
    requireThat(manifest?.schemaVersion === 1 && typeof manifest.contentVersion === 'string' && manifest.contentVersion.length > 0, 'manifest', 'unsupported schema or missing content version');
    requireThat(/^[a-f0-9]{64}$/.test(manifest.contentDigest || ''), 'manifest', 'missing content digest');
    const verified = new Map();
    function verifyRecord(record, label) {
        requireThat(record && typeof record === 'object' && !Array.isArray(record)
            && Number.isSafeInteger(record.bytes) && record.bytes >= 0 && /^[a-f0-9]{64}$/.test(record.sha256 || ''), label, 'missing bytes or SHA-256');
        const path = safeRelativePath(record.path, label);
        const prior = verified.get(path);
        if (prior) {
            requireThat(prior.bytes === record.bytes && prior.sha256 === record.sha256, label, 'conflicting artifact records');
            return prior.data;
        }
        const data = read(path, label);
        requireThat(data.length === record.bytes, label, 'byte count drift');
        requireThat(createHash('sha256').update(data).digest('hex') === record.sha256, label, 'SHA-256 drift');
        verified.set(path, { ...record, data });
        return data;
    }
    for (const group of ['sourceFiles', 'clientArtifactFiles', 'evidenceFiles']) {
        requireThat(Array.isArray(manifest[group]) && manifest[group].length > 0, group, 'missing artifact records');
        const unique = new Set();
        for (const [index, record] of manifest[group].entries()) {
            verifyRecord(record, `${group}[${index}]`);
            requireThat(!unique.has(record.path), group, 'duplicate artifact record');
            unique.add(record.path);
        }
    }
    requireThat(manifest.sourceFileCount === manifest.sourceFiles.length, 'sourceFiles', 'source count mismatch');
    // Additional records include the exact patch, audit, rubric and prior receipt.
    function visitRecords(value, label) {
        if (!value || typeof value !== 'object') return;
        if (!Array.isArray(value) && Object.hasOwn(value, 'path') && (Object.hasOwn(value, 'bytes') || Object.hasOwn(value, 'sha256'))) verifyRecord(value, label);
        for (const [key, child] of Object.entries(value)) visitRecords(child, `${label}.${key}`);
    }
    visitRecords(manifest, 'manifest');
    const version = (value, label, field = 'contentVersion') => requireThat(value?.[field] === manifest.contentVersion, label, 'content version differs from candidate');
    for (const [path, field] of [['content/help/manifest.json', 'version'], ['client/src/generated/helpArticles.json', 'version']]) {
        requireThat(verified.has(path), path, 'version artifact is not recorded');
        version(parse(verified.get(path).data, path), path, field);
    }
    const serverPath = 'server/src/generated/helpKnowledge.js';
    requireThat(verified.has(serverPath), serverPath, 'generated knowledge is not recorded');
    const serverVersion = verified.get(serverPath).data.toString('utf8').match(/^export const HELP_CONTENT_VERSION = ("(?:[^"\\]|\\.)*");$/m);
    requireThat(serverVersion && JSON.parse(serverVersion[1]) === manifest.contentVersion, serverPath, 'generated content version differs from candidate');

    requireThat(Array.isArray(manifest.gates), 'gates', 'missing gate records');
    const gateNames = new Set();
    let offlineGateSummary;
    for (const [index, gate] of manifest.gates.entries()) {
        const label = `gates[${index}]`;
        requireThat(requiredGates.includes(gate.gate) && !gateNames.has(gate.gate) && gate.passed === true, label, 'missing, duplicate or failing local gate');
        gateNames.add(gate.gate);
        const path = gate.path ?? gate.localLog;
        requireThat(typeof path === 'string' && /^output\/help-centre\/gate-evidence\/[a-zA-Z0-9_-]+\.log$/.test(path), label, 'gate log is not portable candidate evidence');
        if (gate.path && gate.localLog) requireThat(gate.path === gate.localLog, label, 'conflicting log paths');
        const log = verifyRecord({ path, bytes: gate.bytes, sha256: gate.sha256 }, label).toString('utf8').replace(/\r/g, '\n');
        if (['server', 'client', 'builder', 'mapLockdown'].includes(gate.gate)) {
            const failures = [...log.matchAll(/^# (?:fail|cancelled) (\d+)$/gm)];
            const passes = [...log.matchAll(/^# pass (\d+)$/gm)];
            requireThat(failures.length >= 2 && failures.every(item => Number(item[1]) === 0)
                && passes.length > 0 && passes.every(item => Number(item[1]) > 0) && !/^not ok \d+/m.test(log), label, 'test log lacks passing terminal evidence');
        }
        if (gate.gate === 'build') requireThat(/✓ built in \S+/.test(log), label, 'build completion is absent');
        if (gate.gate === 'static') {
            const terminal = log.trim().split('\n').at(-1);
            const failure = /^\s*(?:npm (?:ERR!|error\b)|not ok \d+|# (?:fail|cancelled) [1-9]\d*|[A-Za-z]*Error(?: \[[^\]\n]+\])?:|FAIL(?:ED)?\b|✘.*(?:ERROR|FAIL))/mi;
            requireThat(/^Validated \d+ ordered migration\(s\); repository schema ownership is consistent\.$/m.test(log)
                && /^Validated \d+ source modules and \d+ relative import edges; no cycles found\.$/m.test(log)
                && /^> git diff --check -- /.test(terminal) && !failure.test(log), label, 'static completion evidence is absent or failed');
        }
        if (gate.gate === 'offline') {
            offlineGateSummary = parse(Buffer.from(log.trim().split('\n').at(-1)), label);
            version(offlineGateSummary, label);
            requireThat(offlineGateSummary.mode === 'offline real-route synthetic accounts'
                && offlineGateSummary.cases === 60 && manifest.offlineCases === 60 && offlineGateSummary.passedCases === 60
                && offlineGateSummary.assertions === manifest.assertions && Number.isSafeInteger(offlineGateSummary.assertions)
                && offlineGateSummary.assertions > 0 && offlineGateSummary.passedAssertions === offlineGateSummary.assertions
                && offlineGateSummary.modelAttempts === 0 && offlineGateSummary.paidCalls === 0, label, 'offline terminal summary failed or contradicts candidate');
        }
        if (gate.gate === 'workerDryRun') requireThat(/--dry-run: exiting now\./.test(log), label, 'dry-run completion is absent');
        if (['builtBrowser', 'realApiUat', 'personalPlaceUat'].includes(gate.gate)) requireThat(/^PASS /m.test(log) && !/^FAIL /m.test(log), label, 'UAT log lacks passing evidence');
    }
    requireThat(requiredGates.every(gate => gateNames.has(gate)), 'gates', 'a required local gate is missing');
    const reports = Object.fromEntries(Object.entries(reportPaths).map(([kind, path]) => {
        requireThat(manifest.evidenceFiles.some(record => record.path === path), kind, 'required report is not recorded');
        return [kind, parse(verified.get(path).data, kind)];
    }));
    const offline = reports.offline;
    version(offline, 'offline');
    requireThat(['contentVersion', 'cases', 'passedCases', 'assertions', 'passedAssertions', 'modelAttempts', 'paidCalls']
        .every(field => offline[field] === offlineGateSummary[field]), 'offline', 'report and terminal summary disagree');
    requireThat(offline.cases === 60 && manifest.offlineCases === 60 && offline.passedCases === 60
        && Array.isArray(offline.results) && offline.results.length === 60, 'offline', 'fixed 60-case evaluation is incomplete');
    requireThat(offline.modelAttempts === 0 && offline.paidCalls === 0, 'offline', 'evidence is not the zero-call offline evaluation');
    const caseIds = new Set();
    let assertions = 0;
    for (const result of offline.results) {
        requireThat(typeof result.caseId === 'string' && !caseIds.has(result.caseId) && result.status === 200 && result.passed === true
            && Array.isArray(result.assertions) && result.assertions.length > 0 && result.assertions.every(item => item.passes === true), 'offline', 'a served case or assertion failed');
        caseIds.add(result.caseId); assertions += result.assertions.length;
    }
    requireThat(assertions === offline.assertions && offline.passedAssertions === assertions && manifest.assertions === assertions, 'offline', 'assertion counts disagree');
    const reportsWithoutVersion = [];
    for (const [kind, count] of [['browser', 10], ['api', 3], ['personal', 4]]) {
        const report = reports[kind];
        if (Object.hasOwn(report, 'contentVersion')) version(report, kind);
        else reportsWithoutVersion.push(kind);
        requireThat(Array.isArray(report.checks) && report.checks.length === count && report.checks.every(check => check.passed === true)
            && Array.isArray(report.pageErrors) && report.pageErrors.length === 0, kind, 'workflow checks failed or page errors are present');
    }
    version(reports.personal, 'personal');
    requireThat(Array.isArray(reports.browser.unexpectedWrites) && reports.browser.unexpectedWrites.length === 0, 'browser', 'unexpected writes are present');
    requireThat(reports.api.liveInference === false, 'api', 'API evidence is not local simulated inference');
    const confirmed = reports.api.checks.find(check => Object.hasOwn(check, 'noWriteBeforeConfirmation'));
    requireThat(confirmed?.noWriteBeforeConfirmation === true && confirmed.createdRows === 1 && confirmed.hidden === true && confirmed.productionWrites === 0, 'api', 'explicit confirmation evidence failed');
    const workflows = new Set(reports.personal.checks.map(check => `${check.width}:${check.mode}`));
    requireThat(['1440:addressed', '1440:map_only', '390:addressed', '390:map_only'].every(item => workflows.has(item))
        && reports.personal.checks.every(check => check.savedRows === 1 && check.selectedMapMembership === true
            && check.myPlacesReuse === true && check.productionWrites === 0), 'personal', 'save, reuse or device-layout evidence failed');
    requireThat(manifest.paidCalls === 0 && manifest.productionWrites === 0, 'manifest', 'local proof boundary contradicts candidate');
    // Ownership is a recorded human decision, not a conclusion from passing tests.
    const reviewBatch = manifest.humanReviewBatch
        ? parse(verifyRecord(manifest.humanReviewBatch, 'humanReviewBatch'), 'humanReviewBatch') : null;
    const ownerConfirmation = manifest.contentOwnerConfirmation;
    const ownerConfirmed = typeof reviewBatch?.contentOwner === 'string' && reviewBatch.contentOwner.trim().length > 0
        && ownerConfirmation?.source === 'direct user reply in this task'
        && /^\d{4}-\d{2}-\d{2}$/.test(ownerConfirmation.date || '')
        && ownerConfirmation.date === reviewBatch.contentOwnerConfirmation?.date
        && ownerConfirmation.source === reviewBatch.contentOwnerConfirmation?.source
        && ownerConfirmation.scope === reviewBatch.contentOwnerConfirmation?.scope;
    return { verified: true, proof: 'local candidate evidence only', contentVersion: manifest.contentVersion,
        artifacts: verified.size, gateLogs: gateNames.size, offlineCases: 60, assertions,
        browserChecks: 10, apiChecks: 3, personalPlaceChecks: 4,
        limitations: { hashBoundReportsWithoutExplicitVersion: reportsWithoutVersion,
            liveModelQuality: 'not verified by this tool', physicalDeviceAndLiveGeocoding: 'not verified by this tool',
            humanSignoffAndReleaseAuthority: 'not verified by local passes' },
        recordedContentOwner: ownerConfirmed ? { name: reviewBatch.contentOwner, confirmedAt: ownerConfirmation.date,
            proof: 'Recorded direct user decision; does not approve article content, answer quality or release' } : null,
        remainingHumanAndExternalGates: externalGates.filter(gate => gate !== 'Named content owner confirmation' || !ownerConfirmed) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        const args = process.argv.slice(2);
        const options = {};
        for (let index = 0; index < args.length; index += 2) {
            requireThat(['--root', '--manifest'].includes(args[index]) && typeof args[index + 1] === 'string', 'arguments', 'use --root PATH and/or --manifest RELATIVE_PATH');
            options[args[index] === '--root' ? 'root' : 'manifestPath'] = args[index + 1];
        }
        console.log(JSON.stringify(verifyHelpReleaseCandidate(options)));
    } catch (error) {
        console.error(JSON.stringify({ verified: false, error: error.message }));
        process.exitCode = 1;
    }
}
