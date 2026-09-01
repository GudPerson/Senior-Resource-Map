import { validateSingaporePostalCodeWithOneMap } from './singaporePostalFallback.js';

const SIX_DIGIT_POSTAL_CODE = /^\d{6}$/;

function createLocationError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function cleanLocationText(value) {
    return String(value ?? '').trim();
}

export async function resolvePersonalPlaceLocation(body = {}, fetchImpl = fetch) {
    const address = cleanLocationText(body.address);
    const postalCode = cleanLocationText(body.postalCode);
    const requestedMode = body.locationMode || (address || postalCode ? 'addressed' : 'map_only');

    if (requestedMode === 'map_only') {
        if (address || postalCode) {
            throw createLocationError(
                400,
                'A map-only personal place cannot include an address or postal code.',
            );
        }

        return {
            locationMode: 'map_only',
            address: '',
            postalCode: '',
            lat: Number(body.lat),
            lng: Number(body.lng),
        };
    }

    if (!SIX_DIGIT_POSTAL_CODE.test(postalCode)) {
        throw createLocationError(
            400,
            'Enter a valid six-digit Singapore postal code before saving this personal place.',
        );
    }

    let validation;
    try {
        validation = await validateSingaporePostalCodeWithOneMap(postalCode, fetchImpl);
    } catch {
        throw createLocationError(
            503,
            'Postal-code verification is temporarily unavailable. No changes were saved; please try again.',
        );
    }

    if (!validation.valid || !validation.address) {
        throw createLocationError(
            400,
            'This postal code could not be verified as an exact Singapore address.',
        );
    }

    return {
        locationMode: 'addressed',
        address: validation.address,
        postalCode: validation.postalCode,
        lat: validation.lat,
        lng: validation.lng,
    };
}
