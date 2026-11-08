import { neon } from '@neondatabase/serverless';
import { z } from 'zod';
import { normalizeRole } from './roles.js';

export const boundaryRequestId = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/);
export const boundaryPositiveId = z.number().int().positive().max(2147483647);
export const boundarySourceRevision = z.number().int().min(0).max(2147483647);
export const boundarySourceSchema = z.object({
    mapId: boundaryPositiveId, annotationId: z.string().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/),
    revision: boundarySourceRevision,
}).strict();

export class BoundaryRequestError extends Error {
    constructor(status, code, message) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

export function assertBoundaryReplay(storedHash, submittedHash) {
    if (storedHash !== submittedHash) throw new BoundaryRequestError(409, 'BOUNDARY_REQUEST_CONFLICT',
        'This request was already used for different details. Start a new action.');
}

// A JSONB round trip can reorder keys. Sort keys recursively and retain array order.
export async function boundaryHash(value) {
    const json = JSON.stringify(value, (_key, item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
        return Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]]));
    });
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json));
    return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function boundaryHandler(action) {
    return async c => {
        try {
            const actor = c.get('user');
            if (!actor?.id || normalizeRole(actor.role) === 'guest') {
                throw new BoundaryRequestError(403, 'BOUNDARY_ACCOUNT_REQUIRED', 'Sign in with a personal account.');
            }
            const url = c.env?.DATABASE_URL || globalThis.process?.env?.DATABASE_URL;
            if (!url) throw new Error('Database unavailable');
            return await action(c, neon(url), actor);
        } catch (error) {
            if (error instanceof BoundaryRequestError) return c.json({ error: error.message, code: error.code }, error.status);
            if (error instanceof z.ZodError || error instanceof SyntaxError) {
                return c.json({ error: 'Check the boundary request details.', code: 'BOUNDARY_INVALID_REQUEST' }, 400);
            }
            return c.json({ error: 'Boundary storage is temporarily unavailable. Retry the same request.' }, 503);
        }
    };
}

export async function privateBoundaryHeaders(c, next) {
    c.header('Cache-Control', 'private, no-store');
    await next();
}
