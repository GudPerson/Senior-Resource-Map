import { getDistance } from 'geolib';

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

        const distance = getDistance(
            { latitude: uLat, longitude: uLng },
            { latitude: lat, longitude: lng }
        );

        return distance <= radiusInMeters;
    });

    self.postMessage(filtered);
};
