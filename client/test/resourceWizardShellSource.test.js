import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/components/ResourceWizardShell.jsx', import.meta.url), 'utf8');

test('ResourceWizardShell provides static tabs, scrollable workspace, and static actions', () => {
    assert.match(source, /export default function ResourceWizardShell/);
    assert.match(source, /resource-wizard-shell/);
    assert.match(source, /resource-wizard-tabbar/);
    assert.match(source, /resource-wizard-workspace/);
    assert.match(source, /resource-wizard-footer/);
    assert.match(source, /previewTitle/);
    assert.match(source, /previewDescription/);
    assert.match(source, /renderPreview/);
    assert.match(source, /onSave/);
    assert.match(source, /onCancel/);
    assert.doesNotMatch(source, />\s*Back\s*</);
    assert.doesNotMatch(source, />\s*Next\s*</);
});
