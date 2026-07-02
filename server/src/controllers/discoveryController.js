import { z } from 'zod';

import { getDb } from '../db/index.js';
import { ensureBoundarySchema } from '../utils/boundarySchema.js';
import {
    buildDiscoveryIndicatorContext,
    buildDiscoveryLocationIndicators,
    loadDiscoveryIndicatorResourceMetadata,
    normalizeDiscoveryIndicatorResources,
} from '../utils/discoveryLocationIndicators.js';
import { resolveStandardAudiencePartnerIds } from '../utils/partnerBoundaries.js';
import {
    optionalOneLineTextSchema,
    positiveIntValueSchema,
    validateRequestBody,
} from '../utils/inputValidation.js';
import { resolveStandardAudienceZoneIds } from '../utils/audienceZones.js';
import { isAssetVisible } from '../utils/visibility.js';

const discoveryIndicatorBodySchema = z.object({
    resources: z.array(z.object({
        type: z.enum(['hard', 'soft']),
        id: positiveIntValueSchema('resource id'),
    })).max(1000).optional().default([]),
    contextPostalCode: optionalOneLineTextSchema(20),
    contextLocation: z.object({
        lat: z.union([z.number(), z.string()]).optional(),
        lng: z.union([z.number(), z.string()]).optional(),
        latitude: z.union([z.number(), z.string()]).optional(),
        longitude: z.union([z.number(), z.string()]).optional(),
    }).optional(),
});

export const getDiscoveryLocationIndicators = async (c) => {
    try {
        const user = c.get('user');
        const body = validateRequestBody(
            await c.req.json().catch(() => ({})),
            discoveryIndicatorBodySchema,
            'Discovery location indicators',
        );
        const resources = normalizeDiscoveryIndicatorResources(body.resources);
        if (resources.length === 0) {
            return c.json({ indicators: {} });
        }

        const db = getDb(c.env);
        await ensureBoundarySchema(db, c.env);

        const [
            context,
            allowedPartnerAudienceIds,
            allowedAudienceZoneIds,
        ] = await Promise.all([
            buildDiscoveryIndicatorContext(db, user, {
                contextPostalCode: body.contextPostalCode,
                contextLocation: body.contextLocation,
                env: c.env,
            }),
            resolveStandardAudiencePartnerIds(db, user),
            resolveStandardAudienceZoneIds(db, user),
        ]);
        const resourceMetadata = await loadDiscoveryIndicatorResourceMetadata(db, resources, {
            isVisible: (asset) => isAssetVisible(asset, user, {
                ownerPartner: asset.partner,
                allowedPartnerAudienceIds,
                allowedAudienceZoneIds,
            }),
        });

        return c.json({
            indicators: buildDiscoveryLocationIndicators(resourceMetadata, context),
        });
    } catch (err) {
        if (!err.status || err.status >= 500) {
            console.error('getDiscoveryLocationIndicators Error:', err);
        }
        return c.json({ error: err.message || 'Failed to load location indicators' }, err.status || 500);
    }
};
