import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverRoot = resolve(__dirname, '..');

function readSource(relativePath) {
    return readFileSync(resolve(serverRoot, relativePath), 'utf8');
}

function assertDeleteTransitionGuard(source, tableName, auditCallName) {
    const transitionUpdatePattern = new RegExp(
        `const \\[deletedRow\\] = await db\\.update\\(${tableName}\\)[\\s\\S]*?` +
        `\\.where\\(and\\([\\s\\S]*?eq\\(${tableName}\\.id, id\\)[\\s\\S]*?` +
        `eq\\(${tableName}\\.isDeleted, false\\)[\\s\\S]*?\\)\\)[\\s\\S]*?` +
        `\\.returning\\(\\{ id: ${tableName}\\.id \\}\\)`,
    );
    assert.match(source, transitionUpdatePattern);

    const noOpIndex = source.indexOf('if (!deletedRow) {');
    const auditIndex = source.indexOf(`await ${auditCallName}`, noOpIndex);
    assert.ok(noOpIndex >= 0, 'delete endpoint should no-op when the record was already deleted');
    assert.ok(auditIndex > noOpIndex, 'audit write should happen only after the delete transition succeeds');
    assert.match(
        source.slice(noOpIndex, auditIndex),
        /return c\.json\(\{ success: true, alreadyDeleted: true \}\);/,
    );
}

test('hard asset delete audits only the first active-to-deleted transition', () => {
    const source = readSource('src/controllers/hardAssetsController.js');
    assertDeleteTransitionGuard(source, 'hardAssets', 'recordHardAssetAudit');
});

test('soft asset delete audits only the first active-to-deleted transition', () => {
    const source = readSource('src/controllers/softAssetsController.js');
    assertDeleteTransitionGuard(source, 'softAssets', 'recordSoftAssetAudit');
});

test('template delete audits only the first active-to-deleted transition', () => {
    const source = readSource('src/controllers/softAssetParentsController.js');
    assertDeleteTransitionGuard(source, 'softAssetParents', 'recordTemplateAudit');
});
