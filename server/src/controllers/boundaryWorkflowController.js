import { z } from 'zod';
import { createBoundaryWorkflowRepository } from '../utils/boundaryWorkflowRepository.js';
import { boundaryHandler, boundaryPositiveId, boundaryRequestId } from '../utils/boundaryRequests.js';

const startSchema = z.object({ requestId: boundaryRequestId, hardAssetId: boundaryPositiveId }).strict();

export const startBoundaryMap = boundaryHandler(async (c, query, actor) => {
    const input = startSchema.parse(await c.req.json());
    return c.json(await createBoundaryWorkflowRepository(query).start(actor, input));
});

export const getBoundaryMap = boundaryHandler(async (c, query, actor) => {
    const requestId = boundaryRequestId.parse(c.req.param('requestId'));
    return c.json(await createBoundaryWorkflowRepository(query).get(actor.id, requestId));
});

export const cancelBoundaryMapGuidance = boundaryHandler(async (c, query, actor) => {
    const requestId = boundaryRequestId.parse(c.req.param('requestId'));
    return c.json(await createBoundaryWorkflowRepository(query).cancel(actor.id, requestId));
});
