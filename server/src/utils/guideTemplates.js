import { Hono } from 'hono';
import { getSoftAssetParents } from '../controllers/softAssetParentsController.js';
import { canOpenGuideTemplateTools } from './guideAccess.js';

const NAME_LIMIT = 5;

export function createGuideTemplateLoader({ list = getSoftAssetParents } = {}) {
    return async (actor, env) => {
        if (!canOpenGuideTemplateTools(actor)) throw new Error('Offering-template access unavailable');
        const internal = new Hono();
        internal.use('*', async (c, next) => { c.set('user', actor); await next(); });
        internal.get('/templates', list);
        const response = await internal.fetch(new Request('http://guide.internal/templates'), env);
        if (!response.ok) throw new Error('Offering-template list unavailable');
        const rows = await response.json();
        if (!Array.isArray(rows) || rows.some((row) => !Number.isSafeInteger(row?.id)
            || row.id <= 0 || typeof row.name !== 'string')) throw new Error('Offering-template list unavailable');
        return { totalCount: rows.length,
            names: rows.slice(0, NAME_LIMIT).map((row) => row.name.replace(/\s+/g, ' ').trim().slice(0, 120))
                .filter(Boolean) };
    };
}
