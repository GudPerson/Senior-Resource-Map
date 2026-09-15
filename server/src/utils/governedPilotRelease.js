import { normalizeRole } from './roles.js';

// Deployment stages are independent of the public directory/login access settings.
// Unknown or absent values fail closed. Later stages include the capabilities of
// every earlier stage so releases can advance without reopening prior gates.
export const GOVERNED_PILOT_RELEASE_STAGES = Object.freeze([
    'off',
    'onboarding',
    'claims',
    'maps',
    'lifecycle',
]);

export function getGovernedPilotReleaseStage(env) {
    const value = String(env?.GOVERNED_PILOT_RELEASE_STAGE || '');
    return GOVERNED_PILOT_RELEASE_STAGES.includes(value) ? value : 'off';
}

export function isGovernedPilotStageEnabled(env, requiredStage) {
    const currentIndex = GOVERNED_PILOT_RELEASE_STAGES.indexOf(getGovernedPilotReleaseStage(env));
    const requiredIndex = GOVERNED_PILOT_RELEASE_STAGES.indexOf(requiredStage);
    return requiredIndex > 0 && currentIndex >= requiredIndex;
}

export function isOrganizationOnboardingEnabled(env) {
    return isGovernedPilotStageEnabled(env, 'onboarding');
}

export function isResourceClaimsEnabled(env) {
    return isGovernedPilotStageEnabled(env, 'claims');
}

export function isGovernedMapsEnabled(env) {
    return isGovernedPilotStageEnabled(env, 'maps');
}

export function isGovernedMapLifecycleEnabled(env) {
    return isGovernedPilotStageEnabled(env, 'lifecycle');
}

// Compatibility summary for existing callers. It means that at least one
// governed-pilot capability is available; it is not permission to use all gates.
export function isGovernedPilotEnabled(env) {
    return isOrganizationOnboardingEnabled(env);
}

export function governedPilotUnavailable(c, requiredStage = 'onboarding') {
    c.header('Cache-Control', 'no-store');
    return c.json({
        error: 'This closed-pilot capability is not available yet.',
        code: 'governed_pilot_disabled',
        requiredStage,
    }, 503);
}

function stageGuard(requiredStage) {
    return async function requireReleaseStage(c, next) {
        if (!isGovernedPilotStageEnabled(c.env, requiredStage)) {
            return governedPilotUnavailable(c, requiredStage);
        }
        return next();
    };
}

export const requireOrganizationOnboarding = stageGuard('onboarding');
export const requireResourceClaims = stageGuard('claims');
export const requireGovernedMaps = stageGuard('maps');
export const requireGovernedMapLifecycle = stageGuard('lifecycle');

// Super Admins retain the legacy governance console for preparation and
// recovery. Organisation users cannot use those older mutation routes to
// bypass the staged resource-claim workflow.
export async function requireDirectResourceGovernanceAccess(c, next) {
    if (normalizeRole(c.get('user')?.role) === 'super_admin') return next();
    if (!isResourceClaimsEnabled(c.env)) return governedPilotUnavailable(c, 'claims');
    c.header('Cache-Control', 'no-store');
    return c.json({
        error: 'Organisation resource changes must use the governed claim workflow.',
        code: 'resource_claim_workflow_required',
    }, 403);
}
