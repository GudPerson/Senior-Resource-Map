import test from 'node:test';
import assert from 'node:assert/strict';

test('admin user table copy separates profile region, account assignment, and region scope', async () => {
    const fs = await import('node:fs/promises');
    const source = await fs.readFile(new URL('../src/pages/dashboard/AdminPage.jsx', import.meta.url), 'utf8');
    const apiSource = await fs.readFile(new URL('../src/lib/api.js', import.meta.url), 'utf8');

    assert.match(source, />\s*Profile Region\s*</);
    assert.match(source, />\s*Account Assignment\s*</);
    assert.match(source, />\s*Assignment Status\s*</);
    assert.match(source, />\s*Region Scope\s*</);
    assert.match(source, /Manage Region Scope/);
    assert.match(source, /api\.updateUserRegionScope/);
    assert.match(apiSource, /updateUserRegionScope/);
    assert.match(apiSource, /\/region-scope/);
    assert.doesNotMatch(source, /<th[^>]*>\s*Ownership\s*<\/th>/);
    assert.doesNotMatch(source, /onChange=\{\(e\) => handleManagerChange\(u\.id, e\.target\.value\)\}/);
});
