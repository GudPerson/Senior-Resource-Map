import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const componentSource = readFileSync(
    resolve(__dirname, '../src/components/DiscoveryLocationIndicatorBadges.jsx'),
    'utf8',
);

test('audience relevance star uses a brand-teal glossy filled icon', () => {
    assert.equal(componentSource.includes("from 'lucide-react'"), false);
    assert.match(componentSource, /radial-gradient/);
    assert.match(componentSource, /boxShadow/);
    assert.match(componentSource, /var\(--color-brand\)/);
    assert.match(componentSource, /var\(--color-brand-strong\)/);
    assert.equal(componentSource.includes('#ffdf66'), false);
    assert.equal(componentSource.includes('#ffc400'), false);
    assert.equal(componentSource.includes('#ff9f0a'), false);
    assert.match(componentSource, /fill="#fff"/);
    assert.match(componentSource, /aria-hidden="true"/);
});
