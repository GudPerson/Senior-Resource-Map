import { z } from 'zod';
import { createBoundaryLibraryRepository } from '../utils/boundaryLibraryRepository.js';
import { boundaryHandler, boundaryPositiveId, boundaryRequestId, boundarySourceSchema } from '../utils/boundaryRequests.js';

const text = z.string().trim().max(240).regex(/^[^\u0000-\u001f\u007f]*$/);
const saveSchema = z.object({
    requestId: boundaryRequestId, name: text.min(1), groupName: text.nullish().transform(value => value || null),
    source: boundarySourceSchema,
}).strict();
const idParam = z.string().regex(/^[1-9]\d{0,9}$/).transform(Number).pipe(boundaryPositiveId);
const listSchema = z.object({
    cursor: idParam.optional(), limit: idParam.pipe(z.number().max(100)).optional(),
    search: text.optional(), name: text.optional(), group: text.optional(),
}).strict();

export const postBoundaryLibrary = boundaryHandler(async (c, query, actor) => {
    const input = saveSchema.parse(await c.req.json());
    const result = await createBoundaryLibraryRepository(query).save(actor.id, input);
    return c.json(result, result.replayed ? 200 : 201);
});

export const listBoundaryLibrary = boundaryHandler(async (c, query, actor) => {
    const input = listSchema.parse(c.req.query());
    return c.json(await createBoundaryLibraryRepository(query).list(actor.id, input));
});

export const getBoundaryLibraryItem = boundaryHandler(async (c, query, actor) =>
    c.json(await createBoundaryLibraryRepository(query).get(actor.id, idParam.parse(c.req.param('id')))));

export const retireBoundaryLibraryItem = boundaryHandler(async (c, query, actor) =>
    c.json(await createBoundaryLibraryRepository(query).retire(actor.id, idParam.parse(c.req.param('id')))));
