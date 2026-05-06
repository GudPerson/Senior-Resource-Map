const SINGAPORE_E164_PREFIX = '+65';
const SINGAPORE_MOBILE_DIGITS = /^[689]\d{7}$/;
const SINGAPORE_WITH_COUNTRY_CODE_DIGITS = /^65([689]\d{7})$/;

export function normalizeSingaporePhoneIdentity(value) {
    if (value === undefined || value === null) return null;

    const digits = String(value).replace(/\D/g, '');
    if (!digits) return null;

    if (SINGAPORE_MOBILE_DIGITS.test(digits)) {
        return `${SINGAPORE_E164_PREFIX}${digits}`;
    }

    const countryCodeMatch = digits.match(SINGAPORE_WITH_COUNTRY_CODE_DIGITS);
    if (countryCodeMatch) {
        return `${SINGAPORE_E164_PREFIX}${countryCodeMatch[1]}`;
    }

    return null;
}
