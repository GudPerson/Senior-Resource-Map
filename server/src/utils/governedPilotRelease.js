// Deployment gate, independent of the public directory/login access settings.
export function isGovernedPilotEnabled(env) {
    return env?.GOVERNED_PILOT_ENABLED === 'true';
}

export function governedPilotUnavailable(c) {
    c.header('Cache-Control', 'no-store');
    return c.json({
        error: 'Organisation onboarding and Governed Care Maps are not available yet.',
        code: 'governed_pilot_disabled',
    }, 503);
}

export async function requireGovernedPilot(c, next) {
    if (!isGovernedPilotEnabled(c.env)) return governedPilotUnavailable(c);
    return next();
}
