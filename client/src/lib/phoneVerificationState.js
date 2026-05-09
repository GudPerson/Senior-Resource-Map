export function getWhatsAppUrl(challenge) {
    return challenge?.whatsappUrl || challenge?.whatsAppUrl || challenge?.url || '';
}

function cleanUrl(value) {
    return String(value || '').trim();
}

export function isSafeWhatsAppUrl(value) {
    const url = cleanUrl(value);
    return url.startsWith('https://wa.me/')
        || url.startsWith('https://api.whatsapp.com/')
        || url.startsWith('whatsapp://');
}

function buildNativeWhatsAppUrl(phone, text) {
    const params = new URLSearchParams();
    const safePhone = String(phone || '').replace(/[^\d]/g, '');
    const safeText = String(text || '').trim();
    if (safePhone) params.set('phone', safePhone);
    if (safeText) params.set('text', safeText);
    const query = params.toString();
    return query ? `whatsapp://send?${query}` : '';
}

function getNativeWhatsAppUrl(value) {
    const rawUrl = cleanUrl(value);
    if (!isSafeWhatsAppUrl(rawUrl)) return '';
    if (rawUrl.startsWith('whatsapp://')) return rawUrl;

    try {
        const parsed = new URL(rawUrl);
        const host = parsed.hostname.toLowerCase();
        if (host === 'wa.me') {
            return buildNativeWhatsAppUrl(parsed.pathname.replace(/^\/+/, ''), parsed.searchParams.get('text'));
        }
        if (host === 'api.whatsapp.com') {
            return buildNativeWhatsAppUrl(parsed.searchParams.get('phone'), parsed.searchParams.get('text'));
        }
    } catch {
        return '';
    }

    return '';
}

export function getPreferredWhatsAppLaunchUrl(value, { preferNative = false } = {}) {
    const rawUrl = cleanUrl(value);
    if (!isSafeWhatsAppUrl(rawUrl)) return '';
    return preferNative ? getNativeWhatsAppUrl(rawUrl) || rawUrl : rawUrl;
}

export function isLikelyMobileDevice(userAgent = '') {
    return /Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i.test(String(userAgent || ''));
}

export function isTouchFirstDevice({ maxTouchPoints = 0, coarsePointer = false } = {}) {
    return Number(maxTouchPoints || 0) > 0 || coarsePointer === true;
}

export function getBrowserWhatsAppLaunchDevice() {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return {};

    return {
        maxTouchPoints: Number(navigator.maxTouchPoints || 0),
        coarsePointer: Boolean(window.matchMedia?.('(pointer: coarse)')?.matches),
    };
}

export function shouldUseNativeWhatsAppLaunch(userAgent = '', device = {}) {
    return isLikelyMobileDevice(userAgent) || isTouchFirstDevice(device);
}

export function shouldUsePreparedWhatsAppWindow(userAgent = '', device = {}) {
    return !shouldUseNativeWhatsAppLaunch(userAgent, device);
}

export function isGudAuthPhoneLinkReturn(search) {
    const rawSearch = String(search || '').trim();
    const normalizedSearch = rawSearch.startsWith('?') ? rawSearch : `?${rawSearch}`;
    const params = new URLSearchParams(normalizedSearch);
    return params.get('gudauth') === 'phone_link';
}

export function isGudAuthPhoneLoginReturn(search) {
    const rawSearch = String(search || '').trim();
    const normalizedSearch = rawSearch.startsWith('?') ? rawSearch : `?${rawSearch}`;
    const params = new URLSearchParams(normalizedSearch);
    return params.get('gudauth') === 'phone_login';
}

export function getGudAuthPhoneLoginAttemptId(search) {
    if (!isGudAuthPhoneLoginReturn(search)) return null;
    const rawSearch = String(search || '').trim();
    const normalizedSearch = rawSearch.startsWith('?') ? rawSearch : `?${rawSearch}`;
    const params = new URLSearchParams(normalizedSearch);
    const attemptId = Number.parseInt(String(params.get('attempt') || ''), 10);
    return attemptId > 0 ? attemptId : null;
}

function isTerminalStatus(status) {
    return ['verified', 'failed', 'expired', 'conflict', 'manual_review'].includes(
        String(status || '').trim().toLowerCase(),
    );
}

export function mergePhoneVerificationChallenge(previousChallenge, nextChallenge, nextStatus) {
    if (isTerminalStatus(nextStatus)) return null;

    const status = String(nextStatus || '').trim().toLowerCase();
    if (!nextChallenge) {
        return status === 'pending' ? previousChallenge || null : null;
    }

    if (status !== 'pending') return nextChallenge;

    const previousWhatsappUrl = getWhatsAppUrl(previousChallenge);
    const nextWhatsappUrl = getWhatsAppUrl(nextChallenge);
    if (!previousWhatsappUrl || nextWhatsappUrl) return nextChallenge;

    return {
        ...nextChallenge,
        whatsappUrl: previousWhatsappUrl,
        message: nextChallenge.message || previousChallenge?.message || null,
    };
}
