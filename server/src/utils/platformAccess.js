import { normalizeRole } from './roles.js';

export const PUBLIC_DIRECTORY_MODES = Object.freeze(['open', 'authenticated', 'closed']);
export const PUBLIC_REGISTRATION_MODES = Object.freeze(['open', 'organization_only', 'closed']);
export const PUBLIC_LOGIN_MODES = Object.freeze(['open', 'organization_only', 'closed']);

export const DEFAULT_PLATFORM_ACCESS_SETTINGS = Object.freeze({
    publicDirectoryMode: 'open',
    publicRegistrationMode: 'open',
    publicLoginMode: 'open',
    revision: 0,
    updatedAt: null,
});

function normalizeMode(value, allowed, fallback) {
    const normalized = String(value || '').trim().toLowerCase();
    return allowed.includes(normalized) ? normalized : fallback;
}

function hasActiveOrganizationAccess(user) {
    return Array.isArray(user?.organizationAccess)
        && user.organizationAccess.some((entry) => (
            Number.isInteger(Number(entry?.organizationId))
            && !entry?.revokedAt
            && ['admin', 'staff'].includes(String(entry?.accessRole || '').trim().toLowerCase())
        ));
}

function hasLegacyOrganizationAccess(user) {
    const role = normalizeRole(user?.role);
    return ['super_admin', 'regional_admin', 'partner'].includes(role)
        || (Array.isArray(user?.partnerStaffAccess) && user.partnerStaffAccess.length > 0);
}

export function normalizePlatformAccessSettings(row = {}) {
    const parsedRevision = Number.parseInt(String(row?.revision ?? ''), 10);
    return {
        publicDirectoryMode: normalizeMode(
            row?.publicDirectoryMode,
            PUBLIC_DIRECTORY_MODES,
            DEFAULT_PLATFORM_ACCESS_SETTINGS.publicDirectoryMode,
        ),
        publicRegistrationMode: normalizeMode(
            row?.publicRegistrationMode,
            PUBLIC_REGISTRATION_MODES,
            DEFAULT_PLATFORM_ACCESS_SETTINGS.publicRegistrationMode,
        ),
        publicLoginMode: normalizeMode(
            row?.publicLoginMode,
            PUBLIC_LOGIN_MODES,
            DEFAULT_PLATFORM_ACCESS_SETTINGS.publicLoginMode,
        ),
        revision: Number.isInteger(parsedRevision) && parsedRevision > 0 ? parsedRevision : 0,
        updatedAt: row?.updatedAt || null,
    };
}

export function canAccessDirectory(settings, user = null) {
    const mode = normalizePlatformAccessSettings(settings).publicDirectoryMode;
    if (mode === 'open') return true;
    if (normalizeRole(user?.role) === 'super_admin') return true;
    if (mode === 'closed') return false;
    return Boolean(user?.id) && (hasActiveOrganizationAccess(user) || hasLegacyOrganizationAccess(user));
}

export function evaluateExistingUserLogin(settings, user, { organizationLogin = false } = {}) {
    const mode = normalizePlatformAccessSettings(settings).publicLoginMode;
    if (mode === 'open') return { allowed: true, code: null };
    if (normalizeRole(user?.role) === 'super_admin') return { allowed: true, code: null };
    if (mode === 'closed') return { allowed: false, code: 'login_closed' };
    if (!organizationLogin) return { allowed: false, code: 'organization_login_required' };
    if (hasActiveOrganizationAccess(user) || hasLegacyOrganizationAccess(user)) {
        return { allowed: true, code: null };
    }
    return { allowed: false, code: 'organization_approval_required' };
}

export function evaluateRegistration(settings, { matchedOrganizationId = null } = {}) {
    const mode = normalizePlatformAccessSettings(settings).publicRegistrationMode;
    if (mode === 'open') {
        return { allowed: true, pendingApproval: false, code: null };
    }
    if (mode === 'closed') {
        return { allowed: false, pendingApproval: false, code: 'registration_closed' };
    }
    const organizationId = Number.parseInt(String(matchedOrganizationId ?? ''), 10);
    if (!Number.isInteger(organizationId) || organizationId <= 0) {
        return { allowed: false, pendingApproval: false, code: 'organization_registration_required' };
    }
    return {
        allowed: true,
        pendingApproval: true,
        code: 'organization_approval_required',
        organizationId,
    };
}

export function buildPlatformAccessError(code) {
    switch (code) {
        case 'login_closed':
            return { status: 403, error: 'CareAround SG sign-in is currently closed.' };
        case 'organization_login_required':
            return { status: 403, error: 'Use the organisation sign-in pathway.' };
        case 'organization_approval_required':
            return { status: 403, error: 'Your organisation must approve access before you can sign in.' };
        case 'registration_closed':
            return { status: 403, error: 'CareAround SG registration is currently closed.' };
        case 'organization_registration_required':
            return { status: 403, error: 'Register your organisation before creating a staff account.' };
        case 'directory_authentication_required':
            return { status: 401, error: 'Sign in through an approved organisation to access the resource directory.' };
        case 'directory_closed':
        default:
            return { status: 403, error: 'The CareAround SG resource directory is currently closed.' };
    }
}
