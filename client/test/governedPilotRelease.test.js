import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
    isGovernedPilotUiStageEnabled,
    normalizeGovernedPilotReleaseStage,
} from '../src/lib/governedPilotRelease.js';

const readSource = (path) => fs.readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');

test('client pilot stages fail closed and unlock in sequence', () => {
    for (const value of [undefined, null, false, true, '', 'TRUE', 'future', 'ONBOARDING', 'onboarding ']) {
        assert.equal(normalizeGovernedPilotReleaseStage(value), 'off');
    }

    const expected = {
        off: [false, false, false, false],
        onboarding: [true, false, false, false],
        claims: [true, true, false, false],
        maps: [true, true, true, false],
        lifecycle: [true, true, true, true],
    };
    for (const [stage, values] of Object.entries(expected)) {
        assert.deepEqual([
            isGovernedPilotUiStageEnabled(stage, 'onboarding'),
            isGovernedPilotUiStageEnabled(stage, 'claims'),
            isGovernedPilotUiStageEnabled(stage, 'maps'),
            isGovernedPilotUiStageEnabled(stage, 'lifecycle'),
        ], values, stage);
    }
});

test('client routes and controls use capability-specific release gates', () => {
    const app = readSource('App.jsx');
    const embedded = readSource('EmbeddedApp.jsx');
    const navigation = readSource('components/dashboard/DashboardNavigation.jsx');
    const publicGate = readSource('components/PublicDirectoryGate.jsx');
    const adminPanel = readSource('components/admin/PlatformAccessPanel.jsx');
    const mapPage = readSource('pages/dashboard/GovernedMapsPage.jsx');
    const organizationWorkspace = readSource('pages/dashboard/OrganizationWorkspacePage.jsx');
    const organizationPanel = readSource('components/admin/GovernanceOrganizationsPanel.jsx');

    assert.match(app, /ORGANIZATION_ONBOARDING_UI_ENABLED \? <OrganizationOnboardingPage/);
    assert.match(app, /GOVERNED_MAPS_UI_ENABLED \? <SharedMapPage mapKind="governed"/);
    assert.match(app, /GOVERNED_MAPS_UI_ENABLED \? <GovernedMapsPage/);
    assert.match(embedded, /GOVERNED_MAPS_UI_ENABLED \? <EmbeddedMapPage mapKind="governed"/);
    assert.match(navigation, /const canShowGovernedMaps = GOVERNED_MAPS_UI_ENABLED/);
    assert.match(publicGate, /ORGANIZATION_ONBOARDING_UI_ENABLED && settings\?\.organizationOnboardingEnabled/);
    assert.match(publicGate, /GOVERNED_MAPS_UI_ENABLED && settings\?\.governedMapsEnabled/);
    assert.match(publicGate, /Existing personal My Maps shared by service providers/);
    assert.match(adminPanel, /ORGANIZATION_ONBOARDING_UI_ENABLED && access\.settings\.organizationOnboardingEnabled/);
    assert.match(adminPanel, /RESOURCE_CLAIMS_UI_ENABLED && settings\?\.resourceClaimsEnabled === true/);
    assert.match(adminPanel, /resourceClaimsEnabled \? <ResourceClaimsPanel \/>/);
    assert.match(adminPanel, /GOVERNED_MAPS_UI_ENABLED && settings\?\.governedMapsEnabled/);
    assert.match(adminPanel, /Governed Care Maps remain unavailable until their release stage/);
    assert.match(mapPage, /GOVERNED_MAP_LIFECYCLE_UI_ENABLED && selected\.capabilities\.canRequestRetirement/);
    assert.match(mapPage, /GOVERNED_MAP_LIFECYCLE_UI_ENABLED && selected\.capabilities\.canRestore/);
    assert.match(organizationWorkspace, /resourceClaimsEnabled=\{RESOURCE_CLAIMS_UI_ENABLED\}/);
    assert.match(organizationWorkspace, /RESOURCE_CLAIMS_UI_ENABLED && canManage \? \(/);
    assert.match(organizationWorkspace, /<ResourceClaimsPanel \/>/);
    assert.match(organizationPanel, /const canUseDirectResourceGovernanceControls = !isOrganizationWorkspace/);
    assert.match(organizationPanel, /New resource claims and publication agreements open at Gate 2/);
});
