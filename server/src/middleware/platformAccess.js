import { getDb } from '../db/index.js';
import {
    buildPlatformAccessError,
    canAccessDirectory,
    DEFAULT_PLATFORM_ACCESS_SETTINGS,
    normalizePlatformAccessSettings,
} from '../utils/platformAccess.js';
import { loadPlatformAccessSettings } from '../utils/platformAccessStore.js';

export function requirePlatformDirectoryAccess({ loadSettings = loadPlatformAccessSettings } = {}) {
    return async (c, next) => {
        try {
            const settings = normalizePlatformAccessSettings(
                c.env?.NODE_ENV === 'test' && !c.env?.DATABASE_URL
                    ? DEFAULT_PLATFORM_ACCESS_SETTINGS
                    : await loadSettings(getDb(c.env)),
            );
            if (canAccessDirectory(settings, c.get('user'))) {
                await next();
                return;
            }

            const code = settings.publicDirectoryMode === 'authenticated'
                ? (c.get('user')?.id ? 'organization_approval_required' : 'directory_authentication_required')
                : 'directory_closed';
            const response = buildPlatformAccessError(code);
            c.header('Cache-Control', 'no-store');
            return c.json({ error: response.error, code }, response.status);
        } catch (error) {
            console.error('platform directory access check failed:', error);
            c.header('Cache-Control', 'no-store');
            return c.json({
                error: 'The CareAround SG resource directory is temporarily unavailable.',
                code: 'directory_access_unavailable',
            }, 503);
        }
    };
}
