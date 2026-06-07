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

test('client admin feedback uses in-app notices instead of native browser alert', () => {
    const offenders = collectSourceFiles(sourceRoot)
        .filter((file) => /\b(?:window\.)?alert\s*\(/.test(readFileSync(file, 'utf8')))
        .map((file) => relative(clientRoot, file));

    assert.deepEqual(offenders, []);
});
