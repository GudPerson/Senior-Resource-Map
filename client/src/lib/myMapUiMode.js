export const MY_MAP_UI_MODE_STABLE = 'stable';
export const MY_MAP_UI_MODE_V2 = 'v2';
export const MY_MAP_UI_QUERY_PARAM = 'ui';

export function getMyMapUiMode(searchParams) {
    const params = searchParams instanceof URLSearchParams
        ? searchParams
        : new URLSearchParams(searchParams || '');

    return params.get(MY_MAP_UI_QUERY_PARAM) === MY_MAP_UI_MODE_STABLE
        ? MY_MAP_UI_MODE_STABLE
        : MY_MAP_UI_MODE_V2;
}

export function buildStableMyMapSearchParams(searchParams) {
    const params = searchParams instanceof URLSearchParams
        ? new URLSearchParams(searchParams)
        : new URLSearchParams(searchParams || '');

    params.set(MY_MAP_UI_QUERY_PARAM, MY_MAP_UI_MODE_STABLE);
    return params;
}
