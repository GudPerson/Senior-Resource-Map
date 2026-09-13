export function restrictedAccessSettings(governedPilotEnabled) {
    return governedPilotEnabled ? {
        publicDirectoryMode: 'authenticated',
        publicRegistrationMode: 'organization_only',
        publicLoginMode: 'organization_only',
    } : {
        publicDirectoryMode: 'closed',
        publicRegistrationMode: 'closed',
        publicLoginMode: 'closed',
    };
}

export function hasRestrictedPublicAccess(settings) {
    return Boolean(settings) && ['publicDirectoryMode', 'publicRegistrationMode', 'publicLoginMode']
        .some((key) => settings[key] !== 'open');
}

export function publicAccessStatusLabel(settings) {
    if (!settings?.available) return 'Migration required';
    if (['publicDirectoryMode', 'publicRegistrationMode', 'publicLoginMode'].every((key) => settings[key] === 'closed')) return 'Private workspace';
    if (settings.publicDirectoryMode === 'authenticated'
        && settings.publicRegistrationMode === 'organization_only'
        && settings.publicLoginMode === 'organization_only') return 'Closed organisation pilot';
    return hasRestrictedPublicAccess(settings) ? 'Custom access restrictions' : 'Open public access';
}
