function extractPhoneFromUrl(value) {
    const text = String(value || '').trim();
    if (!text) return '';

    try {
        const url = new URL(text);
        if (url.hostname.endsWith('wa.me')) {
            return url.pathname.replace(/\D/g, '');
        }
        if (url.hostname.endsWith('whatsapp.com')) {
            return url.searchParams.get('phone')?.replace(/\D/g, '') || '';
        }
    } catch {
        // Fall back to number parsing below.
    }

    return '';
}

function normalizeSingaporeWhatsAppDigits(value) {
    const urlDigits = extractPhoneFromUrl(value);
    const digits = urlDigits || String(value || '').replace(/\D/g, '');
    if (/^[689]\d{7}$/.test(digits)) return `65${digits}`;
    if (/^65[689]\d{7}$/.test(digits)) return digits;
    return '';
}

export function buildWhatsAppContactHref(value) {
    const digits = normalizeSingaporeWhatsAppDigits(value);
    return digits ? `https://wa.me/${digits}` : '';
}

export function formatWhatsAppContactLabel(value) {
    const digits = normalizeSingaporeWhatsAppDigits(value);
    if (!digits) return String(value || '').trim();

    const local = digits.startsWith('65') ? digits.slice(2) : digits;
    return `+65 ${local.slice(0, 4)} ${local.slice(4)}`;
}
