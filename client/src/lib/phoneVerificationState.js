export function getWhatsAppUrl(challenge) {
    return challenge?.whatsappUrl || challenge?.whatsAppUrl || challenge?.url || '';
}

export function isSafeWhatsAppUrl(value) {
    const url = String(value || '').trim();
    return url.startsWith('https://wa.me/')
        || url.startsWith('https://api.whatsapp.com/')
        || url.startsWith('whatsapp://');
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
