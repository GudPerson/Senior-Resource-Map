import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const componentSource = readFileSync(
    resolve(__dirname, '../src/components/OfferingAccessNotice.jsx'),
    'utf8',
);

test('offering access notice stays silent in user-facing resource surfaces', () => {
    assert.equal(componentSource.includes('This may not match your profile'), false);
    assert.equal(componentSource.includes('This programme or service is currently shown'), false);
    assert.equal(componentSource.includes('A few profile details are needed'), false);
    assert.match(componentSource, /return null;/);
});
