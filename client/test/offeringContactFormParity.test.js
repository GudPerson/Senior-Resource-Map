import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const currentDir = dirname(fileURLToPath(import.meta.url));
const clientRoot = resolve(currentDir, '..');

function readClientSource(relativePath) {
    return readFileSync(resolve(clientRoot, relativePath), 'utf8');
}

const OFFERING_CONTACT_LABELS = [
    'Contact phone',
    'WhatsApp contact',
    'Contact email',
    'Action button label',
    'Action button link',
    'Venue note',
];

test('create/edit offering form exposes the same public contact and action fields as import review', () => {
    const source = readClientSource('src/components/AssetForm.jsx');

    for (const label of OFFERING_CONTACT_LABELS) {
        assert.match(source, new RegExp(label, 'i'));
    }
});

test('collateral import review exposes the same public contact and action fields as create/edit', () => {
    const source = readClientSource('src/components/SoftAssetCollateralImportWizard.jsx');

    for (const label of OFFERING_CONTACT_LABELS) {
        assert.match(source, new RegExp(label, 'i'));
    }
});
