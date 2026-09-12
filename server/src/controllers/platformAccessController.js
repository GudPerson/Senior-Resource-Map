import { z } from 'zod';

import { getDb } from '../db/index.js';
import { validateRequestBody } from '../utils/inputValidation.js';
import {
    PUBLIC_DIRECTORY_MODES,
    PUBLIC_LOGIN_MODES,
    PUBLIC_REGISTRATION_MODES,
} from '../utils/platformAccess.js';
import {
    loadPlatformAccessSettings,
    updatePlatformAccessSettings,
} from '../utils/platformAccessStore.js';

const updateSchema = z.object({
    publicDirectoryMode: z.enum(PUBLIC_DIRECTORY_MODES),
    publicRegistrationMode: z.enum(PUBLIC_REGISTRATION_MODES),
    publicLoginMode: z.enum(PUBLIC_LOGIN_MODES),
    expectedRevision: z.number().int().nonnegative(),
});

function publicSettings(settings) {
    return {
        publicDirectoryMode: settings.publicDirectoryMode,
        publicRegistrationMode: settings.publicRegistrationMode,
        publicLoginMode: settings.publicLoginMode,
        revision: settings.revision,
        updatedAt: settings.updatedAt || null,
        available: settings.schemaAvailable,
    };
}

export async function getPlatformAccessSettings(c) {
    try {
        const settings = await loadPlatformAccessSettings(getDb(c.env));
        c.header('Cache-Control', 'no-store');
        return c.json({ settings: publicSettings(settings) });
    } catch (error) {
        console.error('getPlatformAccessSettings Error:', error);
        return c.json({ error: 'Platform access settings are temporarily unavailable.' }, 503);
    }
}

export async function putPlatformAccessSettings(c) {
    try {
        const body = validateRequestBody(
            await c.req.json(),
            updateSchema,
            'Platform access settings',
        );
        const settings = await updatePlatformAccessSettings(
            getDb(c.env),
            c.get('user'),
            body,
            body.expectedRevision,
        );
        c.header('Cache-Control', 'no-store');
        return c.json({ settings: publicSettings(settings) });
    } catch (error) {
        if (!error.status || error.status >= 500) {
            console.error('putPlatformAccessSettings Error:', error);
        }
        return c.json({ error: error.message || 'Failed to update platform access settings.' }, error.status || 500);
    }
}
