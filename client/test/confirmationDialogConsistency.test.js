import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientRoot = resolve(__dirname, '..');
const sourceRoot = resolve(clientRoot, 'src');

function collectSourceFiles(dir) {
    return readdirSync(dir).flatMap((entry) => {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) return collectSourceFiles(fullPath);
        return /\.(jsx?|tsx?)$/.test(entry) ? [fullPath] : [];
    });
}

test('client confirmation boxes use the shared CareAround dialog instead of native browser confirm', () => {
    const offenders = collectSourceFiles(sourceRoot)
        .filter((file) => !file.endsWith('ConfirmDialog.jsx'))
        .filter((file) => /\b(?:window\.)?confirm\s*\(/.test(readFileSync(file, 'utf8')))
        .map((file) => relative(clientRoot, file));

    assert.deepEqual(offenders, []);
});

test('shared confirmation dialog exposes accessible modal structure and destructive action states', () => {
    const source = readFileSync(resolve(sourceRoot, 'components/ConfirmDialog.jsx'), 'utf8');

    assert.match(source, /export function useConfirmDialog/);
    assert.match(source, /role="dialog"/);
    assert.match(source, /aria-modal="true"/);
    assert.match(source, /confirmLabel/);
    assert.match(source, /cancelLabel/);
    assert.match(source, /Deleting\.\.\./);
    assert.match(source, /disabled=\{loading\}/);
});
