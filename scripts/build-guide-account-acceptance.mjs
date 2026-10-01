import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const maps = 'https://maps.carearound.sg';
const environment = {
    ...process.env,
    VITE_API_URL: '/api',
    VITE_SUPPORT_INBOX_ENABLED: 'true',
    VITE_GUIDE_ACCOUNT_ACCEPTANCE_PREVIEW: 'true',
    VITE_GOVERNED_PILOT_RELEASE_STAGE: 'off',
    VITE_DISCOVER_DETAILED_MAP_ENABLED: 'true',
    VITE_TOWN_MAP_PROOF_ENABLED: 'true',
    VITE_TOWN_MAP_ZOOM14_OVERVIEW_ENABLED: 'true',
    VITE_TOWN_MAP_ASSET_BASE_URL: `${maps}/v2/native-scale-20260722/default`,
    VITE_TOWN_MAP_GRAY_ASSET_BASE_URL: `${maps}/v2/native-scale-20260722/gray`,
    VITE_TOWN_MAP_OVERVIEW_ASSET_BASE_URL: `${maps}/v3/zoom14-atlas-20260730/default`,
    VITE_TOWN_MAP_GRAY_OVERVIEW_ASSET_BASE_URL: `${maps}/v3/zoom14-atlas-20260730/gray`,
    VITE_TOWN_MAP_PRINT_MASTER_ASSET_BASE_URL: `${maps}/v2/print-master-100-20260723/default`,
    VITE_TOWN_MAP_GRAY_PRINT_MASTER_ASSET_BASE_URL: `${maps}/v2/print-master-100-20260723/gray`,
    VITE_DISCOVER_DETAILED_DERIVATIVE_ENABLED: 'true',
    VITE_DISCOVER_DETAILED_DERIVATIVE_NATIVE_ASSET_BASE_URL: `${maps}/v5/discover-derivative-v1-80-20260906-r2/native/default`,
    VITE_DISCOVER_DETAILED_DERIVATIVE_GRAY_NATIVE_ASSET_BASE_URL: `${maps}/v5/discover-derivative-v1-80-20260906-r2/native/gray`,
    VITE_DISCOVER_DETAILED_DERIVATIVE_OVERVIEW_ASSET_BASE_URL: `${maps}/v5/discover-derivative-v1-80-20260906-r2/overview/default`,
    VITE_DISCOVER_DETAILED_DERIVATIVE_GRAY_OVERVIEW_ASSET_BASE_URL: `${maps}/v5/discover-derivative-v1-80-20260906-r2/overview/gray`,
};
const result = spawnSync('npm', ['run', 'build:bare', '--workspace=client', '--',
    '--outDir', 'dist-guide-account-acceptance'], { cwd: root, env: environment, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
