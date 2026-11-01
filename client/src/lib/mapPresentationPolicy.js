// Build-only presentation policy. Browser URLs and saved preferences cannot enable experiments.
// Keep the experiment code available for dedicated test builds and later explicit review.
const configuredExperiment = typeof import.meta.env === 'object'
    ? import.meta.env.VITE_MAP_FIRST_EXPERIMENT_ENABLED
    : undefined;

export function isMapFirstExperimentEnabled(enabled = configuredExperiment) {
    return enabled === true || enabled === 'true';
}
