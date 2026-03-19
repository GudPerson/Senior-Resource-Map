function getDistanceInMeters(from, to) {
    const earthRadiusMeters = 6371000;
    const dLat = deg2rad(to.latitude - from.latitude);
    const dLng = deg2rad(to.longitude - from.longitude);
    const lat1 = deg2rad(from.latitude);
    const lat2 = deg2rad(to.latitude);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
        + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadiusMeters * c;
}

function deg2rad(value) {
    return value * (Math.PI / 180);
}

self.onmessage = (e) => {
    const { locations, userLocation, radiusInMeters } = e.data;

    // If radius is effectively infinite (100km+) or missing location, return all
    if (!userLocation || !radiusInMeters || radiusInMeters >= 100000) {
        self.postMessage(locations);
        return;
    }

    const { lat: uLat, lng: uLng } = userLocation;

    const filtered = locations.filter(loc => {
        const lat = parseFloat(loc.lat);
        const lng = parseFloat(loc.lng);

        if (isNaN(lat) || isNaN(lng)) return false;

        const distance = getDistanceInMeters(
            { latitude: uLat, longitude: uLng },
            { latitude: lat, longitude: lng }
        );

        return distance <= radiusInMeters;
    });

    self.postMessage(filtered);
};
