import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function readClientSource(relativePath) {
    return readFileSync(resolve(__dirname, '../src', relativePath), 'utf8');
}

test('dashboard sidebar links use document navigation for deploy-stale recovery', () => {
    const source = readClientSource('components/dashboard/DashboardNavigation.jsx');

    assert.match(source, /<NavLink[\s\S]*?reloadDocument[\s\S]*?>/);
});

test('organisation workspace sidebar link uses document navigation and section label', () => {
    const source = readClientSource('components/dashboard/DashboardNavigation.jsx');

    assert.match(source, /to="\/dashboard\/organization"/);
    assert.match(source, /<NavLink[\s\S]*?reloadDocument[\s\S]*?>/);
    assert.match(source, /pathname\.startsWith\('\/dashboard\/organization'\)/);
    assert.match(source, /organisationWorkspaceTitle/);
});

test('dashboard overview launchpad uses document links, not JS-only buttons', () => {
    const source = readClientSource('pages/dashboard/DashboardOverview.jsx');

    assert.match(source, /import \{ Link \} from 'react-router-dom';/);
    assert.match(source, /<Link[\s\S]*?reloadDocument[\s\S]*?>/);
    assert.equal(source.includes('useNavigate'), false);
    assert.equal(source.includes('onClick={() => navigate(item.to)}'), false);
});
