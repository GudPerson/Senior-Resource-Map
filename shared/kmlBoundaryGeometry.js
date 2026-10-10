// Coordinates remain flat in the revisioned document. Ring lengths preserve
// polygon parts and holes without storing any coordinates a third time.
export const KML_MAX_POLYGON_CORNERS = 1000;
export const KML_MAX_GEOMETRY_POINTS = 10000;

export function normalizeKmlBoundaryParts(parts, pointCount) {
    if (!Number.isInteger(pointCount) || pointCount < 3 || pointCount > KML_MAX_GEOMETRY_POINTS) return null;
    const layout = parts === undefined ? [[pointCount]] : parts;
    if (!Array.isArray(layout) || !layout.length || layout.length > pointCount / 3) return null;
    let total = 0;
    const result = [];
    for (const rings of layout) {
        if (!Array.isArray(rings) || !rings.length || rings.length > KML_MAX_POLYGON_CORNERS / 3) return null;
        let polygonCount = 0;
        for (const count of rings) {
            if (!Number.isInteger(count) || count < 3) return null;
            polygonCount += count;
        }
        if (polygonCount > KML_MAX_POLYGON_CORNERS) return null;
        total += polygonCount;
        result.push([...rings]);
    }
    return total === pointCount ? result : null;
}

export function splitKmlBoundaryParts(points, parts) {
    const layout = normalizeKmlBoundaryParts(parts, points.length);
    if (!layout) return [];
    let offset = 0;
    return layout.map(rings => rings.map(count => {
        const ring = points.slice(offset, offset + count);
        offset += count;
        return ring;
    }));
}

// Rendering winding only: outer rings add fill and holes subtract it. This also
// preserves the union of overlapping multipart polygons with nonzero fill.
// Stored points and their source order are never changed.
export function orientKmlBoundaryDisplayParts(polygons) {
    return polygons.map(rings => rings.map((ring, index) => {
        const [originLat, originLng] = ring[0];
        const area = ring.reduce((sum, [lat, lng], i) => {
            const [nextLat, nextLng] = ring[(i + 1) % ring.length];
            return sum + (lng - originLng) * (nextLat - originLat) - (nextLng - originLng) * (lat - originLat);
        }, 0);
        return (area > 0) === (index === 0) ? ring : [...ring].reverse();
    }));
}
