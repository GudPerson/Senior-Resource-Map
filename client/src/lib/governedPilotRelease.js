export const GOVERNED_PILOT_RELEASE_STAGES = Object.freeze([
    'off',
    'onboarding',
    'claims',
    'maps',
    'lifecycle',
]);

export function normalizeGovernedPilotReleaseStage(value) {
    const normalized = String(value || '');
    return GOVERNED_PILOT_RELEASE_STAGES.includes(normalized) ? normalized : 'off';
}

export function isGovernedPilotUiStageEnabled(currentStage, requiredStage) {
    const currentIndex = GOVERNED_PILOT_RELEASE_STAGES.indexOf(normalizeGovernedPilotReleaseStage(currentStage));
    const requiredIndex = GOVERNED_PILOT_RELEASE_STAGES.indexOf(requiredStage);
    return requiredIndex > 0 && currentIndex >= requiredIndex;
}

export const GOVERNED_PILOT_UI_STAGE = normalizeGovernedPilotReleaseStage(
    import.meta.env?.VITE_GOVERNED_PILOT_RELEASE_STAGE,
);
export const ORGANIZATION_ONBOARDING_UI_ENABLED = isGovernedPilotUiStageEnabled(GOVERNED_PILOT_UI_STAGE, 'onboarding');
export const RESOURCE_CLAIMS_UI_ENABLED = isGovernedPilotUiStageEnabled(GOVERNED_PILOT_UI_STAGE, 'claims');
export const GOVERNED_MAPS_UI_ENABLED = isGovernedPilotUiStageEnabled(GOVERNED_PILOT_UI_STAGE, 'maps');
export const GOVERNED_MAP_LIFECYCLE_UI_ENABLED = isGovernedPilotUiStageEnabled(GOVERNED_PILOT_UI_STAGE, 'lifecycle');

// Compatibility summary for code that only needs to know whether any closed-pilot
// capability is visible. New route and control gates must use the specific export.
export const GOVERNED_PILOT_UI_ENABLED = ORGANIZATION_ONBOARDING_UI_ENABLED;
