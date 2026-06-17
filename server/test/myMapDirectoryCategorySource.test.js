import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
    new URL('../src/utils/myMapDirectory.js', import.meta.url),
    'utf8',
);

test('My Map directory snapshots expose category color with category icons', () => {
    assert.match(source, /color: true/);
    assert.match(source, /color: subCategories\.color/);
    assert.match(source, /categoryColor: categoryMeta\?\.color \|\| null/);
    assert.match(source, /categoryIconUrl: categoryMeta\?\.iconUrl \|\| null/);
    assert.match(source, /address: place\.address \|\| null/);
    assert.match(source, /const hardPlaceRow = place\.rows\.find\(\(row\) => row\.resourceType === 'hard' && \(row\.categoryIconUrl \|\| row\.categoryColor\)\)/);
    assert.match(source, /sharedCategoryColor = row\.categoryColor \|\| null/);
    assert.match(source, /categoryColor: categoryMeta\.color/);
});
