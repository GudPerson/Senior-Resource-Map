export const PROPERTY_TYPE_OPTIONS = Object.freeze([
    'hdb_1_2_room',
    'hdb_3_room',
    'hdb_4_room',
    'hdb_5_room_exec',
    'condominium',
    'landed',
    'rental',
    'other',
]);

export const GENDER_OPTIONS = Object.freeze([
    'male',
    'female',
]);

export const CHAS_CARD_OPTIONS = Object.freeze([
    'green',
    'orange',
    'blue',
]);

export const YES_NO_OPTIONS = Object.freeze([
    'yes',
    'no',
]);

function normalizeText(value) {
    if (value === undefined || value === null) return '';
    return String(value).trim();
}

export function normalizeGender(value) {
    const normalized = normalizeText(value).toLowerCase();
    if (!normalized) return null;
    if (!GENDER_OPTIONS.includes(normalized)) {
        const error = new Error('Gender must be one of the supported values.');
        error.status = 400;
        throw error;
    }
    return normalized;
}

export function normalizeChasCard(value) {
    const normalized = normalizeText(value).toLowerCase();
    if (!normalized) return null;
    if (!CHAS_CARD_OPTIONS.includes(normalized)) {
        const error = new Error('CHAS card must be one of the supported values.');
        error.status = 400;
        throw error;
    }
    return normalized;
}

export function normalizeYesNo(value, fieldLabel = 'This field') {
    const normalized = normalizeText(value).toLowerCase();
    if (!normalized) return null;
    if (!YES_NO_OPTIONS.includes(normalized)) {
        const error = new Error(`${fieldLabel} must be Yes or No.`);
        error.status = 400;
        throw error;
    }
    return normalized;
}

export function normalizePropertyType(value) {
    const normalized = normalizeText(value).toLowerCase();
    if (!normalized) return null;
    if (!PROPERTY_TYPE_OPTIONS.includes(normalized)) {
        const error = new Error('Property type must be one of the supported values.');
        error.status = 400;
        throw error;
    }
    return normalized;
}

export function normalizeDateOfBirth(value) {
    const normalized = normalizeText(value);
    if (!normalized) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
        const error = new Error('Date of birth must be in YYYY-MM-DD format.');
        error.status = 400;
        throw error;
    }
    const date = new Date(`${normalized}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
        const error = new Error('Date of birth is invalid.');
        error.status = 400;
        throw error;
    }
    return normalized;
}

export function getAgeFromDateOfBirth(dateOfBirth, now = new Date()) {
    if (!dateOfBirth) return null;
    const birthDate = new Date(`${dateOfBirth}T00:00:00.000Z`);
    if (Number.isNaN(birthDate.getTime())) return null;

    let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
    const nowMonth = now.getUTCMonth();
    const birthMonth = birthDate.getUTCMonth();
    if (
        nowMonth < birthMonth
        || (nowMonth === birthMonth && now.getUTCDate() < birthDate.getUTCDate())
    ) {
        age -= 1;
    }

    return age >= 0 ? age : null;
}
