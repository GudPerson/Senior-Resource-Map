import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const rootPackage = JSON.parse(
    fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
);
const viteConfigSource = fs.readFileSync(
    new URL('../vite.config.js', import.meta.url),
    'utf8'
);

const requiredLocalMapEnvironment = [
    'VITE_TOWN_MAP_PROOF_ENABLED=true',
    'VITE_TOWN_MAP_ASSET_BASE_URL=/__carearound-town-maps/v2/native-scale-20260722/default',
    'VITE_TOWN_MAP_GRAY_ASSET_BASE_URL=/__carearound-town-maps/v2/native-scale-20260722/gray',
    'VITE_TOWN_MAP_PRINT_MASTER_ASSET_BASE_URL=/__carearound-town-maps/v2/print-master-100-20260723/default',
    'VITE_TOWN_MAP_GRAY_PRINT_MASTER_ASSET_BASE_URL=/__carearound-town-maps/v2/print-master-100-20260723/gray',
];

const requiredProductionMapEnvironment = [
    'VITE_TOWN_MAP_PROOF_ENABLED=true',
    'VITE_TOWN_MAP_ASSET_BASE_URL=https://maps.carearound.sg/v2/native-scale-20260722/default',
    'VITE_TOWN_MAP_GRAY_ASSET_BASE_URL=https://maps.carearound.sg/v2/native-scale-20260722/gray',
    'VITE_TOWN_MAP_PRINT_MASTER_ASSET_BASE_URL=https://maps.carearound.sg/v2/print-master-100-20260723/default',
    'VITE_TOWN_MAP_GRAY_PRINT_MASTER_ASSET_BASE_URL=https://maps.carearound.sg/v2/print-master-100-20260723/gray',
];

const requiredZoom14OverviewEnvironment = [
    'VITE_TOWN_MAP_ZOOM14_OVERVIEW_ENABLED=true',
    'VITE_TOWN_MAP_OVERVIEW_ASSET_BASE_URL=/@fs${PWD}/output/town-map-proof/zoom14-atlas/default',
    'VITE_TOWN_MAP_GRAY_OVERVIEW_ASSET_BASE_URL=/@fs${PWD}/output/town-map-proof/zoom14-atlas/gray',
];

const requiredProductionZoom14OverviewEnvironment = [
    'VITE_TOWN_MAP_ZOOM14_OVERVIEW_ENABLED=true',
    'VITE_TOWN_MAP_OVERVIEW_ASSET_BASE_URL=https://maps.carearound.sg/v3/zoom14-atlas-20260730/default',
    'VITE_TOWN_MAP_GRAY_OVERVIEW_ASSET_BASE_URL=https://maps.carearound.sg/v3/zoom14-atlas-20260730/gray',
];

test('default local client UAT keeps the complete Detailed map contract', () => {
    const command = rootPackage.scripts['dev:client'];

    requiredLocalMapEnvironment.forEach((entry) => {
        assert.match(command, new RegExp(entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    });
    assert.match(command, /--host localhost --port 5173/);
    assert.match(viteConfigSource, /['"]\/__carearound-town-maps['"]/);
    assert.match(viteConfigSource, /target:\s*['"]https:\/\/maps\.carearound\.sg['"]/);
    assert.match(viteConfigSource, /path\.replace\(\/\^\\\/__carearound-town-maps\//);
});

test('zoom-14 overview UAT stays opt-in and keeps the native zoom-15 roots', () => {
    const defaultCommand = rootPackage.scripts['dev:client'];
    const overviewCommand = rootPackage.scripts['dev:client:zoom14-overview'];

    assert.doesNotMatch(defaultCommand, /VITE_TOWN_MAP_ZOOM14_OVERVIEW_ENABLED/);
    requiredLocalMapEnvironment.forEach((entry) => {
        assert.match(overviewCommand, new RegExp(entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    });
    requiredZoom14OverviewEnvironment.forEach((entry) => {
        assert.match(overviewCommand, new RegExp(entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    });
    assert.match(overviewCommand, /--host localhost --port 5173/);
});

test('map lockdown verification keeps focused tests and the exact production build', () => {
    assert.equal(
        rootPackage.scripts['verify:map-lockdown'],
        'npm run test:map-lockdown && npm run build:client:map-lockdown'
    );

    const testCommand = rootPackage.scripts['test:map-lockdown'];
    [
        'fixedTownSurface.test.js',
        'fixedTownSurfaceIntegration.test.js',
        'mapSettingsControl.test.js',
        'printMapWorkspace.test.js',
        'printAnnotations.test.js',
    ].forEach((testFile) => {
        assert.match(testCommand, new RegExp(testFile.replaceAll('.', '\\.')));
    });

    const buildCommand = rootPackage.scripts['build:client:map-lockdown'];
    assert.match(buildCommand, /VITE_API_URL=https:\/\/api\.carearound\.sg\/api/);
    requiredProductionMapEnvironment.forEach((entry) => {
        assert.match(buildCommand, new RegExp(entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    });
    requiredProductionZoom14OverviewEnvironment.forEach((entry) => {
        assert.match(buildCommand, new RegExp(entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    });
});

test('zoom-14 atlas upload commands keep Default and Gray in separate immutable roots', () => {
    const defaultUpload = rootPackage.scripts['town-map:zoom14-atlas:r2:upload'];
    const grayUpload = rootPackage.scripts['town-map:zoom14-atlas:gray:r2:upload'];

    assert.match(defaultUpload, /--style=default/);
    assert.match(defaultUpload, /--manifest-root=output\/town-map-proof\/zoom14-atlas\/default/);
    assert.match(defaultUpload, /--prefix=v3\/zoom14-atlas-20260730\/default/);
    assert.match(grayUpload, /--style=gray/);
    assert.match(grayUpload, /--manifest-root=output\/town-map-proof\/zoom14-atlas\/gray/);
    assert.match(grayUpload, /--prefix=v3\/zoom14-atlas-20260730\/gray/);
});
