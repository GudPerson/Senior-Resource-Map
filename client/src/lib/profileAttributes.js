export const GENDER_OPTIONS = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
];

export const PROPERTY_TYPE_OPTIONS = [
    { value: 'hdb_1_2_room', label: 'HDB 1-2 Room' },
    { value: 'hdb_3_room', label: 'HDB 3 Room' },
    { value: 'hdb_4_room', label: 'HDB 4 Room' },
    { value: 'hdb_5_room_exec', label: 'HDB 5 Room / Executive' },
    { value: 'condominium', label: 'Condominium' },
    { value: 'landed', label: 'Landed' },
    { value: 'rental', label: 'Rental' },
    { value: 'other', label: 'Other' },
];

export const PROFILE_FIELD_LABELS = {
    dateOfBirth: 'date of birth',
    gender: 'gender',
    propertyType: 'property type',
};

export function normalizeGender(value) {
    if (value === undefined || value === null || value === '') return '';
    const normalized = String(value).trim().toLowerCase();
    return GENDER_OPTIONS.some((option) => option.value === normalized) ? normalized : '';
}

export function normalizePropertyType(value) {
    if (value === undefined || value === null || value === '') return '';
    const normalized = String(value).trim().toLowerCase();
    return PROPERTY_TYPE_OPTIONS.some((option) => option.value === normalized) ? normalized : '';
}

export function getProfileFieldLabel(field) {
    return PROFILE_FIELD_LABELS[field] || field;
}
