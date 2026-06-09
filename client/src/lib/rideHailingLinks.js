const GRAB_ONELINK_BASE_URL = 'https://grab.onelink.me/2695613898';
const GRAB_DIRECT_BOOKING_URL = 'grab://open';

function normalizeText(value) {
    return String(value || '').trim();
}

function normalizeCoordinate(value) {
    const number = Number.parseFloat(value);
    return Number.isFinite(number) ? String(number) : '';
}

export function buildGrabRideDeepLink(destination) {
    if (!destination) return '';

    const address = normalizeText(destination.address);
    const title = normalizeText(destination.name);
    const lat = normalizeCoordinate(destination.lat);
    const lng = normalizeCoordinate(destination.lng);
    const hasCoordinates = Boolean(lat && lng);

    if (!address && !hasCoordinates) return '';

    const directUrl = new URL(GRAB_DIRECT_BOOKING_URL);
    directUrl.searchParams.set('screenType', 'BOOKING');
    if (address) {
        directUrl.searchParams.set('dropOffTitle', address);
        directUrl.searchParams.set('dropOffAddress', address);
    } else if (title) {
        directUrl.searchParams.set('dropOffTitle', title);
    }
    if (hasCoordinates) {
        directUrl.searchParams.set('dropOffLatitude', lat);
        directUrl.searchParams.set('dropOffLongitude', lng);
    }

    const linkUrl = new URL(GRAB_ONELINK_BASE_URL);
    linkUrl.searchParams.set('af_dp', directUrl.toString());
    return linkUrl.toString();
}

export function buildGrabBookingDeepLink() {
    const directUrl = new URL(GRAB_DIRECT_BOOKING_URL);
    directUrl.searchParams.set('screenType', 'BOOKING');

    const linkUrl = new URL(GRAB_ONELINK_BASE_URL);
    linkUrl.searchParams.set('af_dp', directUrl.toString());
    return linkUrl.toString();
}
