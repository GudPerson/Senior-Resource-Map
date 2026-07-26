import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '../..');

function readJson(relativePath) {
    return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

test('local UAT uses development Worker cookies and keeps schema preparation explicit', () => {
    const rootPackage = readJson('package.json');
    const serverPackage = readJson('server/package.json');

    assert.equal(
        rootPackage.scripts['dev:server'],
        'npm run dev:worker:local --workspace=server'
    );
    assert.equal(
        rootPackage.scripts['uat:local:prepare'],
        'npm run bootstrap:boundary-schema --workspace=server'
    );
    assert.match(
        serverPackage.scripts['dev:worker:local'],
        /--var NODE_ENV:development/
    );
    assert.doesNotMatch(
        serverPackage.scripts.deploy,
        /NODE_ENV:development/
    );
});

test('production Worker configuration remains production-only', () => {
    const wranglerConfig = fs.readFileSync(
        path.join(repoRoot, 'server/wrangler.toml'),
        'utf8'
    );

    assert.match(wranglerConfig, /NODE_ENV\s*=\s*"production"/);
});
