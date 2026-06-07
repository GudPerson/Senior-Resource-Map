import test from 'node:test';
import assert from 'node:assert/strict';

test('admin user table copy uses support coverage instead of account assignment columns', async () => {
    const fs = await import('node:fs/promises');
    const source = await fs.readFile(new URL('../src/pages/dashboard/AdminPage.jsx', import.meta.url), 'utf8');
    const formSource = await fs.readFile(new URL('../src/components/AdminUserForm.jsx', import.meta.url), 'utf8');
    const apiSource = await fs.readFile(new URL('../src/lib/api.js', import.meta.url), 'utf8');

    assert.match(source, />\s*Support Coverage\s*</);
    assert.match(source, />\s*Region Scope\s*</);
    assert.match(source, /Manage Region Scope/);
    assert.match(source, /Support Context/);
    assert.match(source, /View support context/);
    assert.match(source, /does not grant profile edits, role changes, account deletion, user-view access, resource ownership, organisation access, group access, or private notes\/files access/);
    assert.match(source, /Assigned Admins/);
    assert.match(source, /getAssignedAdminsForRegion/);
    assert.match(source, /No Admins assigned/);
    assert.match(source, /Assigned Admins are derived from Admin Region Scope/);
    assert.match(source, /api\.updateUserRegionScope/);
    assert.match(apiSource, /updateUserRegionScope/);
    assert.match(apiSource, /\/region-scope/);
    assert.doesNotMatch(source, />\s*Account Assignment\s*</);
    assert.doesNotMatch(source, />\s*Assignment Status\s*</);
    assert.doesNotMatch(formSource, /Managed By/);
    assert.match(formSource, /Support Coverage/);
    assert.doesNotMatch(source, /<th[^>]*>\s*Ownership\s*<\/th>/);
    assert.doesNotMatch(source, /onChange=\{\(e\) => handleManagerChange\(u\.id, e\.target\.value\)\}/);
});
