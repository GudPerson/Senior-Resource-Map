import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/controllers/softAssetsController.js', import.meta.url), 'utf8');

test('soft asset list supports distinct Group and offering filters', () => {
    assert.match(source, /import \{[^}]*\bne\b[^}]*\} from 'drizzle-orm';/s);
    assert.match(source, /assetModeFilter === SOFT_ASSET_MODES\.GROUP[\s\S]*eq\(softAssets\.assetMode, SOFT_ASSET_MODES\.GROUP\)/);
    assert.match(source, /assetModeFilter === 'offering' \|\| assetModeFilter === 'offerings'/);
    assert.match(source, /ne\(softAssets\.assetMode, SOFT_ASSET_MODES\.GROUP\)/);
});
