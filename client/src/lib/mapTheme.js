export const CAREAROUND_BASEMAP_ATTRIBUTION = '<a href="https://www.onemap.gov.sg/" target="_blank" rel="noopener noreferrer">OneMap</a> &copy; Singapore Land Authority';
export const CAREAROUND_BASEMAP_URL = 'https://www.onemap.gov.sg/maps/tiles/Grey_HD/{z}/{x}/{y}.png';
export const CAREAROUND_DEFAULT_BASEMAP_URL = 'https://www.onemap.gov.sg/maps/tiles/Default_HD/{z}/{x}/{y}.png';
export const CAREAROUND_MAP_STYLE_DEFAULT = 'default';
export const CAREAROUND_MAP_STYLE_GRAY = 'gray';
export const CAREAROUND_MAP_STYLE_STORAGE_KEY = 'carearound:map-style';
export const CAREAROUND_BASEMAP_MIN_NATIVE_ZOOM = 11;
export const CAREAROUND_BASEMAP_MIN_ZOOM = CAREAROUND_BASEMAP_MIN_NATIVE_ZOOM - 1;
export const CAREAROUND_BASEMAP_NATIVE_ZOOM = 19;
export const CAREAROUND_BASEMAP_MAX_ZOOM = CAREAROUND_BASEMAP_NATIVE_ZOOM;
export const CAREAROUND_BASEMAP_LOGO_URL = 'https://mobile.onemap.gov.sg/web/2025/images/icons/onemap_logo.svg';

export function normalizeCareAroundMapStyle(value) {
    return value === CAREAROUND_MAP_STYLE_GRAY
        ? CAREAROUND_MAP_STYLE_GRAY
        : CAREAROUND_MAP_STYLE_DEFAULT;
}

export function getCareAroundBasemapUrl(style) {
    return normalizeCareAroundMapStyle(style) === CAREAROUND_MAP_STYLE_GRAY
        ? CAREAROUND_BASEMAP_URL
        : CAREAROUND_DEFAULT_BASEMAP_URL;
}
