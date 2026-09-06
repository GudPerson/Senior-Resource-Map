// A response may replace/disable its initiating control. Do not pull a user
// back if they have moved elsewhere while the request was in flight.
export function restoreSupportFocus(destination, origin, page = globalThis.document) {
    if (!destination || !origin || !page) return false;
    if (page.activeElement !== origin && page.activeElement !== page.body) return false;
    destination.focus();
    return true;
}
