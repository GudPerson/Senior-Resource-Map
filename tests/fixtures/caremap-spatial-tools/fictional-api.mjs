// Test-only data and HTTP boundary. No production session, account, database or remote writes.
import { createMapStudioDocument } from '../../../client/src/lib/mapStudioState.js';
import { normalizePrintAnnotation } from '../../../client/src/lib/printAnnotations.js';

export const mapId = 91261103;
export const center = [1.3800, 103.7500];
export const owner = { id: 91261103, name: 'Fictional preview owner', role: 'standard', locale: 'en', postalCode: '680001' };
const hard = (id, name, lat = center[0], lng = center[1]) => ({ id, name, category: 'Community', subCategory: 'Preview centres', status: 'active', visibility: 'public', address: 'Fictional preview address', postalCode: '680001', lat, lng, _type: 'hard', resourceType: 'hard', resourceId: id });
export const catalogueHard = [hard(82101, 'Fictional mapped centre'), hard(82102, 'Fictional catalogue centre outside saved map', 1.3803, 103.7504), hard(82103, 'Fictional distant centre', 1.42, 103.82), hard(82104, 'Fictional unlocated centre', null, null)];
export const catalogueSoft = [
    { id: 82201, name: 'Fictional multi-venue programme', bucket: 'Programmes', subCategory: 'Preview programmes', assetMode: 'standalone', status: 'active', visibility: 'public', locations: [catalogueHard[1], catalogueHard[2]], _type: 'soft' },
    { id: 82202, name: 'Fictional online programme without a venue', bucket: 'Programmes', subCategory: 'Preview programmes', assetMode: 'standalone', status: 'active', visibility: 'public', locations: [], _type: 'soft' },
];
export const annotations = [
    { id: 'preview-circle', type: 'circle', text: 'Fictional local area', points: [center, [1.3844966, 103.75]] },
    { id: 'preview-box', type: 'rectangle', text: 'Fictional rotated box', points: [[1.378, 103.748], [1.382, 103.752]], rotationDegrees: 27 },
    { id: 'preview-boundary', type: 'polygon', text: 'Fictional rounded boundary', points: [[1.378, 103.748], [1.383, 103.748], [1.383, 103.753], [1.378, 103.753]], controlPoints: [[1.378, 103.748], [1.383, 103.748], [1.383, 103.753], [1.378, 103.753]] },
].map(normalizePrintAnnotation);
function studioDocument() {
    const value = createMapStudioDocument();
    value.revision = 1; value.views[0].revision = 1;
    value.views[0].design.camera = { mode: 'fixed', view: { center, zoom: 16 } };
    value.views[0].design.layout.preset = 'balanced';
    return value;
}
export function createFictionalApi() {
    const audit = { requests: [], unexpectedWrites: [], explicitWrites: [] };
    const personal = { id: 82301, rowKey: 'personal:82301', assetKey: 'personal:82301', resourceType: 'personal', resourceId: 82301, personalPlaceId: 82301, name: 'Fictional private meeting point', personalPlaceCategory: 'home', subCategory: 'Personal place', address: '', postalCode: '', lat: center[0], lng: center[1], isPersonalPlace: true, saveEligible: false, status: 'active', mapShortDescriptors: [], notes: [] };
    const directory = { id: mapId, name: 'Fictional Care Map spatial preview', description: 'Local preview with fictional CareAround resources', categoryOrder: [], summary: { resourceCount: 2, savedResourceCount: 1, personalPlaceCount: 1, placeCount: 2, mappablePlaceCount: 2 }, share: { isShared: false, shareToken: null, embedEnabled: false, embedAllowedOrigins: [] }, assets: [catalogueHard[0]], personalPlaces: [personal], places: [personal, catalogueHard[0]].map((r, i) => ({ pinKey: i ? 'hard-82101' : personal.assetKey, placeKey: i ? 'hard-82101' : personal.assetKey, title: r.name, name: r.name, address: r.address, postalCode: r.postalCode, lat: r.lat, lng: r.lng, hasCoordinates: true, openProgrammeServiceCount: 0, rows: [{ ...r, rowKey: i ? 'hard-82101' : personal.rowKey, assetKey: i ? 'hard-82101' : personal.assetKey, mapShortDescriptors: [] }] })), pins: [{ pinKey: personal.assetKey, placeKey: personal.assetKey, title: personal.name, lat: personal.lat, lng: personal.lng, curatedCount: 0, previewResourceNames: [] }], viewer: { isAuthenticated: true, isOwner: true, canSaveCopy: false, canSaveResources: true } };
    let annotationDocument = structuredClone(annotations), revision = 1, allowWrite = false;
    const paged = (data, url) => { const page = Math.max(1, Number(url.searchParams.get('page') || 1)); const pageSize = 2; return { data: data.slice((page - 1) * pageSize, page * pageSize), pagination: { page, pageSize, totalCount: data.length, totalPages: Math.ceil(data.length / pageSize) } }; };
    function handle(method, url, body) {
        const pathname = url.pathname;
        audit.requests.push({ method, path: pathname, search: url.search });
        if (pathname === '/__preview/audit') return { status: 200, value: { ...audit, annotations: annotationDocument, revision } };
        if (pathname === '/__preview/allow-next-write' && method === 'POST') { allowWrite = true; return { status: 200, value: { allowed: true } }; }
        if (pathname === '/api/discovery/location-indicators' && method === 'POST') return { status: 200, value: { indicators: {} } };
        if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
            const attempt = { method, path: pathname, body };
            if (allowWrite && method === 'PUT' && pathname.endsWith('/print-annotations')) {
                allowWrite = false; audit.explicitWrites.push(attempt); annotationDocument = body.annotations || []; revision++;
                return { status: 200, value: { mapId, schemaVersion: 1, annotations: annotationDocument, revision } };
            }
            // Explicit private-place creation stays local and still requires the normal review form.
            if (allowWrite && method === 'POST' && /personal-places$/.test(pathname)) {
                allowWrite = false; audit.explicitWrites.push(attempt);
                return { status: 200, value: { id: 82302, ...body } };
            }
            audit.unexpectedWrites.push(attempt);
            return { status: 409, value: { error: 'Preview write blocked. Complete the explicit review action to permit a local test write.' } };
        }
        if (pathname === '/api/platform-access') return { status: 200, value: { settings: { publicDirectoryMode: 'open', publicRegistrationMode: 'open', publicLoginMode: 'open' } } };
        if (pathname.startsWith('/api/auth/')) return { status: 200, value: { user: owner } };
        if (/^\/api\/my-maps\/\d+$/.test(pathname)) return { status: 200, value: { ...directory, id: Number(pathname.split('/').pop()) } };
        if (/^\/api\/my-maps\/\d+\/studio$/.test(pathname)) return { status: 200, value: { mapId, document: studioDocument(), updatedAt: null } };
        if (/^\/api\/my-maps\/\d+\/print-annotations$/.test(pathname)) return { status: 200, value: { mapId, schemaVersion: 1, annotations: annotationDocument, revision } };
        if (pathname === '/api/hard-assets') return { status: 200, value: paged(catalogueHard, url) };
        if (pathname === '/api/soft-assets') return { status: 200, value: paged(catalogueSoft, url) };
        if (pathname === '/api/sub-categories') return { status: 200, value: [{ id: 82101, name: 'Preview centres', type: 'hard', color: '#0f766e' }, { id: 82102, name: 'Preview programmes', type: 'soft', color: '#0369a1' }] };
        if (pathname === '/api/favorites') return { status: 200, value: [catalogueHard[0]] };
        if (pathname === '/api/personal-places') return { status: 200, value: [personal] };
        return { status: 200, value: [] };
    }
    return { handle, audit };
}
