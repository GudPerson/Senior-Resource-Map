/**
 * Haversine formula to calculate the distance between two points in km
 */
export function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

/**
 * OneMap SG Geocoding
 */
export async function searchOneMap(postalCode) {
    try {
        const response = await fetch(`https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${postalCode}&returnGeom=Y&getAddrDetails=Y&pageNum=1`);
        const data = await response.json();

        if (data.results && data.results.length > 0) {
            const first = data.results[0];
            return {
                lat: parseFloat(first.LATITUDE),
                lng: parseFloat(first.LONGITUDE),
                address: first.ADDRESS
            };
        }
        return null;
    } catch (error) {
        console.error('OneMap Search Error:', error);
        return null;
    }
}
