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

test('desktop dashboard side menu stays sticky while list content scrolls', () => {
    const navigationSource = readClientSource('components/dashboard/DashboardNavigation.jsx');
    const dashboardPageSource = readClientSource('pages/dashboard/DashboardPage.jsx');
    const myDirectoryPageSource = readClientSource('pages/MyDirectoryPage.jsx');

    assert.match(navigationSource, /DASHBOARD_DESKTOP_SIDEBAR_CLASS_NAME/);
    assert.match(navigationSource, /lg:sticky/);
    assert.match(navigationSource, /lg:top-\[64px\]/);
    assert.match(navigationSource, /lg:h-\[calc\(100svh-64px\)\]/);
    assert.match(navigationSource, /lg:overflow-y-auto/);
    assert.match(dashboardPageSource, /className=\{DASHBOARD_DESKTOP_SIDEBAR_CLASS_NAME\}/);
    assert.match(myDirectoryPageSource, /className=\{DASHBOARD_DESKTOP_SIDEBAR_CLASS_NAME\}/);
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

test('dashboard overview includes audit trail card for users with audit access', () => {
    const source = readClientSource('pages/dashboard/DashboardOverview.jsx');

    assert.match(source, /canAccessAuditTrail/);
    assert.match(source, /const canShowAudit = canAccessAuditTrail\(user\);/);
    assert.match(source, /id: 'dash-audit'/);
    assert.match(source, /to: '\/dashboard\/audit'/);
    assert.match(source, /icon: ScrollText/);
    assert.match(source, /title: t\('auditTrailTitle'\)/);
    assert.match(source, /description: t\('overviewAuditDescription'\)/);
});
