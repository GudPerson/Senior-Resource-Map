export const PHONE_LOGIN_ATTEMPT_STORAGE_KEY = 'carearound-phone-login-attempt';
const STORED_ATTEMPT_TTL_MS = 10 * 60 * 1000;

function clean(value) {
    return String(value || '').trim();
}

export function readStoredPhoneLoginAttempt() {
    if (typeof window === 'undefined') return null;

    try {
        const raw = window.localStorage.getItem(PHONE_LOGIN_ATTEMPT_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const attemptId = Number.parseInt(String(parsed?.attemptId || ''), 10);
        const expiresAt = Number.parseInt(String(parsed?.expiresAt || ''), 10);
        if (!attemptId || !expiresAt || Date.now() > expiresAt) {
            window.localStorage.removeItem(PHONE_LOGIN_ATTEMPT_STORAGE_KEY);
            return null;
        }
        return {
            attemptId,
            phone: clean(parsed?.phone),
            returnTo: clean(parsed?.returnTo),
        };
    } catch {
        try {
            window.localStorage.removeItem(PHONE_LOGIN_ATTEMPT_STORAGE_KEY);
        } catch {
            // Ignore storage cleanup failures.
        }
        return null;
    }
}

export function writeStoredPhoneLoginAttempt(attemptId, phone, returnTo) {
    if (typeof window === 'undefined') return;

    const normalizedAttemptId = Number.parseInt(String(attemptId || ''), 10);
    if (!normalizedAttemptId) return;

    try {
        window.localStorage.setItem(PHONE_LOGIN_ATTEMPT_STORAGE_KEY, JSON.stringify({
            attemptId: normalizedAttemptId,
            phone: clean(phone),
            returnTo: clean(returnTo),
            expiresAt: Date.now() + STORED_ATTEMPT_TTL_MS,
        }));
    } catch {
        // Ignore storage failures; active polling still continues in the current tab.
    }
}

export function clearStoredPhoneLoginAttempt() {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.removeItem(PHONE_LOGIN_ATTEMPT_STORAGE_KEY);
    } catch {
        // Ignore storage failures.
    }
}
